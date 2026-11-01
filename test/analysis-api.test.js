import {test} from 'node:test';import assert from 'node:assert/strict';import {createApi} from '../server/api.js';import {workedSession} from './fixtures/analysis-sessions.js';
const origin='http://localhost';
test('analysis capability check enforces auth and reports configuration',async()=>{
 let authenticated=true;const handler=createApi({repository:{list:async()=>[]},auth:{session:async()=>authenticated},origin,analysis:{enabled:true,analyze:()=>assert.fail('must not spend')}});
 const call=(path='/api/analysis',method='GET')=>handler(new Request(origin+path,{method,headers:{origin,'content-type':'application/json'}}));
 assert.deepEqual(await(await call()).json(),{enabled:true});authenticated=false;assert.equal((await call()).status,401);authenticated=true;
 const disabled=createApi({repository:{list:async()=>[]},auth:{session:async()=>true},origin});
 assert.deepEqual(await(await disabled(new Request(origin+'/api/analysis'))).json(),{enabled:false});
 const unconfigured=await disabled(new Request(origin+'/api/analysis/program',{method:'POST',headers:{origin,'content-type':'application/json'},body:'{}'}));
 assert.equal(unconfigured.status,503);assert.equal((await unconfigured.json()).error.message,'Program analysis is not configured.');
 assert.equal((await disabled(new Request(origin+'/api/documents'))).status,200);
});
test('session-template analysis route is removed while the capability check remains',async()=>{
 const api=createApi({origin,auth:{session:async()=>true},analysis:{enabled:true,analyze:()=>assert.fail('must not spend')}});
 const call=(method,value,path='/api/analysis')=>api(new Request(origin+path,{method,headers:{origin,'content-type':'application/json'},...(value===undefined?{}:{body:JSON.stringify(value)})}));
 assert.deepEqual(await(await call('GET')).json(),{enabled:true});
 for(const [method,path] of [['POST','/api/analysis'],['PUT','/api/analysis'],['GET','/api/analysis/program'],['POST','/api/analysis/other']]){
  const response=await call(method,method==='GET'?undefined:{workout:workedSession},path);assert.equal(response.status,405,`${method} ${path}`);assert.equal((await response.json()).error.code,'METHOD');
 }
});
