import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createDb,migrate} from '../server/db.js';
import {createWorkoutRepository} from '../server/workout-repository.js';
import {createApi} from '../server/api.js';
import {validateWorkoutLog,WORKOUT_LIMITS} from '../src/workout-log.js';

const set=(id,weightKg,reps)=>({id,weightKg,reps,rir:null,done:true});
const exercise=(id,variantId,sets)=>({id,variantId,referenceId:'f-'+variantId,name:'Ex '+id,equipment:null,primaryMuscles:['Chest'],secondaryMuscles:[],target:null,sets});
const mk=({id='a',status='active',startedAt='2026-11-03T10:00:00.000+00:00',finishedAt=null,exercises=[exercise('e1','v1',[set('s1',80,8)])]}={})=>
 validateWorkoutLog({id,logVersion:1,status,name:'Push',startedAt,finishedAt,source:{kind:'blank'},exercises}).log;

test('workouts API requires auth and round trips',async t=>{
 const db=createDb({url:':memory:'});t.after(()=>db.close());await migrate(db);
 let auth=true;const origin='http://localhost';
 const api=createApi({origin,auth:{session:async()=>auth},workouts:createWorkoutRepository(db)});
 const call=(path,method='GET',body,headers={})=>api(new Request(origin+'/api/workouts'+path,{method,headers:{origin,'content-type':'application/json',...headers},...(body===undefined?{}:{body:typeof body==='string'?body:JSON.stringify(body)})}));
 auth=false;
 for(const [path,method,body] of [['','GET'],['/active','GET'],['/last?variantIds=v1','GET'],['/a','GET'],['/a','PUT',{revision:0,log:mk()}],['/a?revision=1','DELETE']])assert.equal((await call(path,method,body)).status,401,method+path);
 auth=true;
 const log={...mk(),note:'Workout context'};
 let response=await call('/a','PUT',{revision:0,log});assert.equal(response.status,200);
 assert.deepEqual(await response.json(),{record:{id:'a',revision:1,log}});
 assert.deepEqual(await (await call('/a')).json(),{record:{id:'a',revision:1,log}});
 assert.deepEqual(await (await call('/active')).json(),{record:{id:'a',revision:1,log}});
 response=await call('/b','PUT',{revision:0,log:mk({id:'b'})});assert.equal(response.status,409);
 assert.deepEqual((await response.json()).error,{code:'CONFLICT',message:'Another workout is already in progress.',details:{reason:'active_exists'}});
 response=await call('/a','PUT',{revision:0,log:mk({exercises:[]})});assert.equal(response.status,409);
 assert.equal((await response.json()).error.details.reason,'revision_conflict');
 const done=mk({status:'finished',finishedAt:'2026-11-03T11:00:00.000+00:00'});
 assert.equal((await call('/a','PUT',{revision:1,log:done})).status,200);
 assert.equal((await (await call('/active')).json()).record,null);
 const list=await (await call('')).json();assert.equal(list.hasMore,false);assert.equal(list.records.length,1);
 assert.equal((await call('?before=nope')).status,400);
 assert.deepEqual((await (await call('/last?variantIds=v1')).json()).lastTime.v1.sets,[{weightKg:80,reps:8,rir:null,kind:'working'}]);
 assert.deepEqual(await (await call('/last?variantIds=v1&exclude=a')).json(),{lastTime:{}});
 assert.deepEqual(await (await call('/last')).json(),{lastTime:{}});
 const big=JSON.stringify({revision:2,log:{pad:'x'.repeat(WORKOUT_LIMITS.bytes)}});
 response=await call('/a','PUT',big);assert.equal(response.status,413);
 assert.equal((await response.json()).error.message,'Request must be at most 256 KiB.');
 assert.equal((await call('/a?revision=abc','DELETE')).status,400);
 assert.equal((await call('/a','DELETE')).status,400);
 assert.equal((await call('/a?revision=1','DELETE')).status,409);
 assert.equal((await call('/a?revision=2','DELETE')).status,204);
 assert.equal((await call('/a')).status,404);
 assert.equal((await call('/a','POST',{})).status,405);
 assert.equal((await call('/a','PUT',{revision:0,log},{origin:'http://evil'})).status,403);
});
