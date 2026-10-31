import {readSse} from '../src/sse.js';
import {analysisError} from '../src/analysis-input.js';
import {ANALYSIS_PROMPT_VERSION,buildAnalysisMessages} from './analysis-prompt.js';
import {PROGRAM_ANALYSIS_PROMPT_VERSION,buildProgramAnalysisMessages} from './program-analysis-prompt.js';
const encoder=new TextEncoder();
export const encodeAnalysisEvent=({type,...data})=>encoder.encode(`event: ${type}\ndata: ${JSON.stringify(data)}\n\n`);
export function createAnalysisService({apiKey,model='anthropic/claude-sonnet-4.6',fetch:request=globalThis.fetch,timeoutMs=60000,provider='anthropic',onUsage=()=>{}}={}){
 const enabled=Boolean(apiKey?.trim());
 return {enabled,async analyze(snapshot,{signal,scope='session'}={}){
  if(!['session','program'].includes(scope))throw analysisError('Invalid analysis scope.');
  const messages=scope==='program'?buildProgramAnalysisMessages(snapshot):buildAnalysisMessages(snapshot);
  const promptVersion=scope==='program'?PROGRAM_ANALYSIS_PROMPT_VERSION:ANALYSIS_PROMPT_VERSION;
  const generation=scope==='program'?{max_tokens:2500,reasoning:{enabled:true,max_tokens:1024,exclude:true}}:{max_tokens:1500,temperature:0.2,reasoning:{enabled:false}};
  if(!enabled)throw analysisError('Session analysis is not configured.','CONFIGURATION',503);
  const abort=new AbortController();let timedOut=false;
  const forward=()=>abort.abort(signal.reason);if(signal?.aborted)forward();else signal?.addEventListener('abort',forward,{once:true});
  const timer=setTimeout(()=>{timedOut=true;abort.abort(new Error('Analysis timed out.'));},timeoutMs);
  const cleanup=()=>{clearTimeout(timer);signal?.removeEventListener('abort',forward);};
  let upstream;
  const timeoutError=()=>analysisError('Analysis timed out. Please retry.','TIMEOUT',504);
  try{
   upstream=await request('https://openrouter.ai/api/v1/chat/completions',{method:'POST',headers:{Authorization:`Bearer ${apiKey}`,'Content-Type':'application/json'},signal:abort.signal,body:JSON.stringify({model,messages,stream:true,...generation,provider:{only:[provider],allow_fallbacks:false}})});
   if(!upstream.ok){await upstream.body?.cancel();const errors={401:['Analysis provider credentials need updating.','CONFIGURATION',503],402:['Analysis credit limit reached.','CREDITS',402],429:['Analysis is busy. Please retry shortly.','RATE_LIMIT',429]};throw analysisError(...(errors[upstream.status]||['Analysis provider is unavailable. Please retry.','PROVIDER',502]));}
   if(!upstream.headers.get('content-type')?.includes('text/event-stream'))throw analysisError('Analysis provider returned an invalid response.','PROVIDER',502);
  }catch(error){cleanup();abort.abort();if(timedOut)throw timeoutError();if(signal?.aborted)throw signal.reason;if(error.code)throw error;throw analysisError('Analysis provider is unavailable. Please retry.','PROVIDER',502);}
  async function* normalize(){
   let finish=false,hasText=false,bytes=0;
   try{
    yield {type:'start',requestId:crypto.randomUUID(),promptVersion};
    for await(const frame of readSse(upstream.body,{signal:abort.signal,maxFrameBytes:131072})){
     if(frame.data==='[DONE]'){if(!finish||!hasText)throw new Error('Incomplete');yield {type:'complete'};return;}
     const data=JSON.parse(frame.data);if(data.error||frame.event==='error')throw new Error('Provider error');
     if(data.usage)onUsage({inputTokens:data.usage.prompt_tokens,outputTokens:data.usage.completion_tokens,cost:data.usage.cost});
     if(data.choices!==undefined&&!Array.isArray(data.choices))throw new Error('Invalid choices');
     for(const choice of data.choices||[]){
      const text=choice.delta?.content;if(text!==undefined&&text!==null&&typeof text!=='string')throw new Error('Invalid delta');
      if(text){if(finish)throw new Error('Content after finish');bytes+=encoder.encode(text).length;if(bytes>65536)throw new Error('Too large');hasText=true;yield {type:'delta',text};}
      if(choice.finish_reason){if(choice.finish_reason!=='stop')throw new Error('Truncated');finish=true;}
     }
    }
    throw new Error('Early EOF');
   }catch{if(!signal?.aborted)yield {type:'error',code:timedOut?'TIMEOUT':'INCOMPLETE',message:timedOut?'Analysis timed out. Partial report is incomplete.':'Analysis interrupted. Partial report is incomplete. Please retry.'};}
   finally{cleanup();abort.abort();await upstream.body?.cancel().catch(()=>{});}
  }
  const iterator=normalize();
  const body=new ReadableStream({async pull(controller){try{const next=await iterator.next();if(next.done)controller.close();else controller.enqueue(encodeAnalysisEvent(next.value));}catch(error){controller.error(error);cleanup();abort.abort();}},async cancel(){abort.abort();cleanup();await iterator.return();}});
  return new Response(body,{headers:{'content-type':'text/event-stream; charset=utf-8','cache-control':'no-store, no-transform','x-accel-buffering':'no'}});
 }};
}
