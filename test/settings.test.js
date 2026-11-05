import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createDb,migrate} from '../server/db.js';
import {createRepository} from '../server/repository.js';
import {createSettingsRepository} from '../server/settings-repository.js';
import {createApi} from '../server/api.js';

const program={name:'PPL',mode:'schedule',goals:{},workouts:[]};
const template={name:'Push',goals:{},exercises:[],extraMinutes:5,bufferPercent:10};
async function setup(){
 const db=createDb({url:':memory:'});await migrate(db);
 const repository=createRepository(db);
 await repository.create({id:'p1',kind:'program',document:program});
 await repository.create({id:'t1',kind:'template',document:template});
 return {db,repository,settings:createSettingsRepository(db)};
}

test('active program defaults to null, sets, clears and ignores deleted programs',async()=>{
 const {repository,settings}=await setup();
 assert.deepEqual(await settings.get(),{activeProgramId:null});
 await assert.rejects(settings.setActiveProgram('nope'),{code:'NOT_FOUND',message:'Program not found.'});
 await assert.rejects(settings.setActiveProgram(42),{code:'INVALID',message:'Invalid program id.'});
 await assert.rejects(settings.setActiveProgram(''),{code:'INVALID'});
 await assert.rejects(settings.setActiveProgram('t1'),{code:'NOT_FOUND'});
 assert.deepEqual(await settings.setActiveProgram('p1'),{activeProgramId:'p1'});
 assert.deepEqual(await settings.get(),{activeProgramId:'p1'});
 assert.deepEqual(await settings.setActiveProgram('p1'),{activeProgramId:'p1'});
 await repository.remove({id:'p1',revision:1});
 assert.deepEqual(await settings.get(),{activeProgramId:null});
 assert.deepEqual(await settings.setActiveProgram(null),{activeProgramId:null});
});

test('settings API',async()=>{
 const {db}=await setup();const origin='http://localhost';let auth=true;
 const api=createApi({origin,auth:{session:async()=>auth},settings:createSettingsRepository(db)});
 const call=(path,method='GET',body,headers={origin})=>api(new Request(origin+'/api/'+path,{method,headers:{'content-type':'application/json',...headers},...(body===undefined?{}:{body:JSON.stringify(body)})}));
 let response=await call('settings');assert.equal(response.status,200);assert.match(response.headers.get('cache-control'),/no-store/);
 assert.deepEqual(await response.json(),{settings:{activeProgramId:null}});
 response=await call('settings/active-program','PUT',{programId:'p1'});assert.equal(response.status,200);
 assert.deepEqual(await response.json(),{settings:{activeProgramId:'p1'}});
 assert.deepEqual(await (await call('settings')).json(),{settings:{activeProgramId:'p1'}});
 assert.equal((await call('settings/active-program','PUT',{programId:'gone'})).status,404);
 assert.equal((await call('settings/active-program','PUT',{programId:7})).status,400);
 assert.equal((await call('settings/active-program','PUT',{})).status,400);
 assert.equal((await call('settings','POST',{})).status,405);
 assert.equal((await call('settings/active-program','GET')).status,405);
 assert.equal((await call('settings/other')).status,404);
 assert.equal((await call('settings/active-program','PUT',{programId:null},{origin:'https://evil.example'})).status,403);
 auth=false;assert.equal((await call('settings')).status,401);
});
