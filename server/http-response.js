/** Forward a Web Response without buffering it; respect backpressure and client disconnects. */
export async function pipeWebResponse(response,res,{signal}={}){
 const reader=response.body?.getReader();let disconnected=false;
 const cancel=()=>{disconnected=true;reader?.cancel().catch(()=>{});};
 const close=()=>{if(!res.writableFinished)cancel();};
 res.on('close',close);signal?.addEventListener('abort',cancel,{once:true});
 try{
  res.writeHead(response.status,Object.fromEntries(response.headers));
  res.flushHeaders();
  if(signal?.aborted)cancel();
  if(reader)while(!disconnected){const {done,value}=await reader.read();if(done||disconnected)break;if(!res.write(value))await new Promise(resolve=>{
   const finish=()=>{res.off('drain',finish);res.off('close',finish);resolve();};res.once('drain',finish);res.once('close',finish);if(res.destroyed)finish();
  });}
  if(!disconnected)res.end();
 }catch(error){if(!disconnected)res.destroy(error);}
 finally{res.off('close',close);signal?.removeEventListener('abort',cancel);await reader?.cancel().catch(()=>{});reader?.releaseLock();}
}
