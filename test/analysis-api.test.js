import {test} from 'node:test';import assert from 'node:assert/strict';import {createApi} from '../server/api.js';import {workedSession} from './fixtures/analysis-sessions.js';
const origin='http://localhost';
test('analysis API enforces capability, auth, methods, origin, size and sanitization before spending',async()=>{
 let authenticated=true,calls=0;const handler=createApi({repository:{list:async()=>[]},auth:{session:async()=>authenticated},origin,analysis:{enabled:true,analyze:async snapshot=>{calls++;assert.equal(snapshot.id,undefined);return new Response('event: complete\ndata: {}\n\n',{headers:{'content-type':'text/event-stream'}});}}});
 const call=(method='GET',value,headers={})=>handler(new Request(origin+'/api/analysis',{method,headers:{origin,'content-type':'application/json',...headers},...(value===undefined?{}:{body:typeof value==='string'?value:JSON.stringify(value)})}));
 assert.deepEqual(await(await call()).json(),{enabled:true});authenticated=false;assert.equal((await call('POST',{workout:workedSession})).status,401);authenticated=true;
 assert.equal((await call('POST',{workout:workedSession},{origin:'http://evil'})).status,403);assert.equal((await call('PUT',{})).status,405);
 assert.equal((await call('POST',' '.repeat(65537))).status,413);assert.equal((await call('POST',' '.repeat(65536))).status,400);
 assert.equal((await call('POST',{workout:{...workedSession,exercises:[]}})).status,400);assert.equal(calls,0);
 assert.equal((await call('POST',{workout:{...workedSession,id:'private'}})).status,200);assert.equal(calls,1);
 const disabled=createApi({repository:{list:async()=>[]},auth:{session:async()=>true},origin});
 assert.deepEqual(await(await disabled(new Request(origin+'/api/analysis'))).json(),{enabled:false});
 assert.equal((await disabled(new Request(origin+'/api/analysis',{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify({workout:workedSession})}))).status,503);
 assert.equal((await disabled(new Request(origin+'/api/documents'))).status,200);
});
test('analysis rejects invalid goal types and null exercises without invoking provider',async()=>{
 let calls=0;const api=createApi({origin,auth:{session:async()=>true},analysis:{enabled:true,analyze:()=>{calls++;return new Response('bad');}}});
 for(const workout of [{...workedSession,goals:{Chest:'4'}},{...workedSession,goals:{Chest:true}},{...workedSession,exercises:[null]}]){
  const response=await api(new Request(origin+'/api/analysis',{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify({workout})}));assert.equal(response.status,400);assert.equal((await response.json()).error.code,'INVALID');
 }assert.equal(calls,0);
});
test('analysis API returns invalid input rather than provider failure for null exercise',async()=>{
 const api=createApi({origin,auth:{session:async()=>true},analysis:{enabled:true,analyze:()=>assert.fail('must not spend')}});
 const response=await api(new Request(origin+'/api/analysis',{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify({workout:{...workedSession,exercises:[null]}})}));assert.equal(response.status,400);assert.equal((await response.json()).error.code,'INVALID');
});
