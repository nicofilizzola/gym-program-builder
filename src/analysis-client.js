import {readSse} from './sse.js';
import {analysisError} from './analysis-input.js';
export async function streamAnalysis(snapshot,{signal,onEvent=()=>{},fetch:request=globalThis.fetch}={}){
 const response=await request('/api/analysis',{method:'POST',credentials:'same-origin',cache:'no-store',headers:{'content-type':'application/json',accept:'text/event-stream'},body:JSON.stringify({workout:snapshot}),signal});
 if(!response.ok){let data;try{data=await response.json();}catch{}throw analysisError(data?.error?.message||'Analysis request failed.',data?.error?.code||'NETWORK',response.status);}
 if(!response.headers.get('content-type')?.includes('text/event-stream')){await response.body?.cancel();throw analysisError('Invalid analysis response.','PROTOCOL',502);}
 let started=false,complete=false,bytes=0;
 for await(const frame of readSse(response.body,{signal,maxFrameBytes:131072})){
  if(complete)throw analysisError('Unexpected data after analysis completion.','PROTOCOL',502);
  let data;try{data=JSON.parse(frame.data);}catch{throw analysisError('Invalid analysis response.','PROTOCOL',502);}
  if(!data||typeof data!=='object'||Array.isArray(data))throw analysisError('Invalid analysis response.','PROTOCOL',502);
  const type=frame.event;
  if(type==='error'&&typeof data.code==='string'&&typeof data.message==='string')throw analysisError(data.message,data.code,502);
  if(type==='start'&&!started&&typeof data.requestId==='string'&&typeof data.promptVersion==='string')started=true;
  else if(type==='delta'&&started&&typeof data.text==='string'){bytes+=new TextEncoder().encode(data.text).length;if(bytes>65536)throw analysisError('Analysis response is too large.','PROTOCOL',502);}
  else if(type==='complete'&&started)complete=true;
  else throw analysisError('Invalid analysis response.','PROTOCOL',502);
  onEvent({type,...data});
 }
 if(!complete)throw analysisError('Analysis interrupted. Partial report is incomplete. Please retry.','INCOMPLETE',502);
}
