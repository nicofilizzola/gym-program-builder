import {test} from 'node:test';import assert from 'node:assert/strict';import {createServer} from 'node:http';import {once} from 'node:events';import {pipeWebResponse} from '../server/http-response.js';
test('real HTTP bridge flushes first chunk before completion and cancels source on disconnect',async t=>{
 let release,startedResolve,cancelResolve;const started=new Promise(r=>startedResolve=r),cancelled=new Promise(r=>cancelResolve=r);const completion=new Promise(r=>release=r);
 const server=createServer(async(req,res)=>{
  if(req.url==='/json'){await pipeWebResponse(Response.json({ok:true}),res);return;}
  let controller;const source=new ReadableStream({start(c){controller=c;c.enqueue(new TextEncoder().encode('first'));startedResolve();},cancel(){cancelResolve();}});
  completion.then(()=>{try{controller.enqueue(new TextEncoder().encode('last'));controller.close();}catch{}});
  await pipeWebResponse(new Response(source,{headers:{'content-type':'text/event-stream'}}),res);
 });
 t.after(()=>{release();server.closeAllConnections();server.close();});server.listen(0,'127.0.0.1');await once(server,'listening');const url=`http://127.0.0.1:${server.address().port}`;
 const abort=new AbortController();const response=await fetch(url,{signal:abort.signal});await started;const reader=response.body.getReader();assert.equal(new TextDecoder().decode((await reader.read()).value),'first');abort.abort();await cancelled;
 assert.deepEqual(await(await fetch(url+'/json')).json(),{ok:true});
});
