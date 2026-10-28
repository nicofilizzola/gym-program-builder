/** Incremental SSE decoding. Frames are bounded even when the source never sends a newline. */
export async function* readSse(stream,{signal,maxFrameBytes=65536}={}) {
 if(!stream)throw new Error('Missing event stream.');
 const reader=stream.getReader(),decoder=new TextDecoder('utf-8',{fatal:true});
 let pending='',event='message',data=[],frameBytes=0,aborted=false;
 const abort=()=>{aborted=true;reader.cancel(signal.reason).catch(()=>{});};
 if(signal?.aborted)abort();else signal?.addEventListener('abort',abort,{once:true});
 function line(value){
  if(value===''){const result=data.length?{event,data:data.join('\n')}:null;event='message';data=[];frameBytes=0;return result;}
  if(value.startsWith(':'))return null;
  const colon=value.indexOf(':'),field=colon<0?value:value.slice(0,colon);let content=colon<0?'':value.slice(colon+1);if(content.startsWith(' '))content=content.slice(1);
  if(field==='event')event=content||'message';if(field==='data')data.push(content);return null;
 }
 try {
  while(true){
   if(aborted)throw signal.reason||new DOMException('Aborted','AbortError');
   const {done,value}=await reader.read();if(aborted)throw signal.reason||new DOMException('Aborted','AbortError');
   if(done){pending+=decoder.decode();break;}
   pending+=decoder.decode(value,{stream:true});
   let newline;while((newline=pending.indexOf('\n'))>=0){let text=pending.slice(0,newline);pending=pending.slice(newline+1);frameBytes+=new TextEncoder().encode(text).length+1;if(frameBytes>maxFrameBytes)throw new Error('Event frame is too large.');if(text.endsWith('\r'))text=text.slice(0,-1);const result=line(text);if(result)yield result;}
   if(frameBytes+new TextEncoder().encode(pending).length>maxFrameBytes)throw new Error('Event frame is too large.');
  }
  // A trailing nonterminated frame is intentionally not dispatched (SSE specification).
 } finally {signal?.removeEventListener('abort',abort);await reader.cancel().catch(()=>{});reader.releaseLock();}
}
