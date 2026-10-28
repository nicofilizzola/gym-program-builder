import {test} from 'node:test';import assert from 'node:assert/strict';import {createAnalysisService} from '../server/analysis-service.js';import {readSse} from '../src/sse.js';import {workedSession} from './fixtures/analysis-sessions.js';import {prepareAnalysisSnapshot} from '../src/analysis-input.js';
const snapshot=prepareAnalysisSnapshot(workedSession),enc=new TextEncoder();
const frame=v=>'data: '+(typeof v==='string'?v:JSON.stringify(v))+'\n\n';
const delta=(content,finish_reason=null)=>({choices:[{delta:{content},finish_reason}]});
const response=parts=>new Response(parts.map(frame).join(''),{headers:{'content-type':'text/event-stream'}});
async function events(service,signal){const res=await service.analyze(snapshot,{signal}),all=[];for await(const e of readSse(res.body))all.push({type:e.event,...JSON.parse(e.data)});return all;}
test('service sends bounded server-owned request and normalizes accounting frames once',async()=>{
 let calls=0,usage;const service=createAnalysisService({apiKey:'secret',onUsage:v=>usage=v,fetch:async(url,init)=>{calls++;assert.equal(url,'https://openrouter.ai/api/v1/chat/completions');assert.equal(init.headers.Authorization,'Bearer secret');const body=JSON.parse(init.body);assert.equal(body.max_tokens,1500);assert.equal(body.stream,true);assert.deepEqual(body.reasoning,{enabled:false});assert.deepEqual(body.provider,{only:['anthropic'],allow_fallbacks:false});assert.equal(body.messages[0].role,'system');return response([delta('Hello'),delta('', 'stop'),{...delta('', 'stop'),usage:{prompt_tokens:100,completion_tokens:20,cost:.001}},'[DONE]']);}});
 const all=await events(service);assert.deepEqual(all.map(e=>e.type),['start','delta','complete']);assert.equal(all[1].text,'Hello');assert.equal(calls,1);assert.equal(usage.inputTokens,100);
});
test('service labels partial and malformed provider streams incomplete',async()=>{
 for(const parts of [[delta('partial','length'),'[DONE]'],[delta('partial','stop')],[{error:{message:'secret'}}],['not json'],[delta('x'.repeat(65537))],[delta('partial'),'[DONE]']]){
  const all=await events(createAnalysisService({apiKey:'key',fetch:async()=>response(parts)}));assert.equal(all.at(-1).type,'error');assert.equal(all.some(e=>e.type==='complete'),false);assert.ok(!JSON.stringify(all).includes('secret'));
 }
});
test('service maps provider failures without retrying or leaking secrets',async()=>{
 for(const [status,code]of [[401,'CONFIGURATION'],[402,'CREDITS'],[429,'RATE_LIMIT'],[500,'PROVIDER']]){let n=0;await assert.rejects(()=>events(createAnalysisService({apiKey:'key',fetch:async()=>{n++;return new Response('secret',{status});}})),e=>e.code===code&&!e.message.includes('secret'));assert.equal(n,1);}
 await assert.rejects(()=>events(createAnalysisService({fetch:()=>assert.fail('must not call')})),e=>e.status===503);
});
test('timeout aborts fetch and downstream cancellation aborts provider',async()=>{
 let signal;const service=createAnalysisService({apiKey:'key',timeoutMs:20,fetch:async(_,init)=>{signal=init.signal;await new Promise((_,reject)=>signal.addEventListener('abort',()=>reject(signal.reason),{once:true}));}});
 await assert.rejects(()=>events(service),e=>e.code==='TIMEOUT');assert.equal(signal.aborted,true);
 let upstreamSignal,cancelled=false;const running=createAnalysisService({apiKey:'key',fetch:async(_,init)=>{upstreamSignal=init.signal;return new Response(new ReadableStream({start(c){c.enqueue(enc.encode(frame(delta('partial'))));},cancel(){cancelled=true;}}),{headers:{'content-type':'text/event-stream'}});}});
 const res=await running.analyze(snapshot);const reader=res.body.getReader();await reader.read();await reader.cancel();assert.equal(upstreamSignal.aborted,true);assert.equal(cancelled,true);
});
