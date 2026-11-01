import {test} from 'node:test';
import assert from 'node:assert/strict';
import {normalizeProfile,PROFILE_FIELDS} from '../src/profile.js';
import {createDb,migrate} from '../server/db.js';
import {createProfileRepository} from '../server/profile-repository.js';
import {createApi} from '../server/api.js';

test('profile normalizes the single background field like program context prose',()=>{
 assert.deepEqual(PROFILE_FIELDS,['trainingBackgroundAndApproach']);
 assert.deepEqual(normalizeProfile(),{trainingBackgroundAndApproach:''});
 assert.deepEqual(normalizeProfile({trainingBackgroundAndApproach:'a\r\nb\rc',extra:'ignored'}),{trainingBackgroundAndApproach:'a\nb\nc'});
 assert.deepEqual(normalizeProfile({trainingBackgroundAndApproach:'  '}),{trainingBackgroundAndApproach:''});
 assert.equal(normalizeProfile({trainingBackgroundAndApproach:'💪'.repeat(1000)}).trainingBackgroundAndApproach.length,2000);
 assert.throws(()=>normalizeProfile({trainingBackgroundAndApproach:'x'.repeat(2001)}),/^Error: Profile fields must be at most 2,000 characters\.$/);
 for(const value of [null,[],'text',3,{trainingBackgroundAndApproach:3},{trainingBackgroundAndApproach:null}])assert.throws(()=>normalizeProfile(value),/^Error: Invalid profile\.$/);
});

test('profile repository starts empty and guards revisions',async t=>{
 const db=createDb({url:':memory:'});t.after(()=>db.close());await migrate(db);
 const profile=createProfileRepository(db,{now:()=> 'now'});
 assert.deepEqual(await profile.get(),{profile:{trainingBackgroundAndApproach:''},revision:0});
 const saved=await profile.update({revision:0,profile:{trainingBackgroundAndApproach:'Five years\r\n'}});
 assert.deepEqual(saved,{profile:{trainingBackgroundAndApproach:'Five years\n'},revision:1});
 assert.deepEqual(await profile.get(),saved);
 assert.deepEqual(await profile.update({revision:0,profile:{trainingBackgroundAndApproach:'Five years\n'}}),saved,'a retried acknowledged save is idempotent');
 await assert.rejects(profile.update({revision:0,profile:{trainingBackgroundAndApproach:'Stale'}}),{code:'CONFLICT',message:'Profile changed on another device.'});
 assert.equal((await profile.update({revision:1,profile:{trainingBackgroundAndApproach:''}})).revision,2);
 await assert.rejects(profile.update({revision:5,profile:{}}),{code:'CONFLICT'});
 for(const revision of [-1,1.5,'2',undefined])await assert.rejects(profile.update({revision,profile:{}}),{code:'INVALID'});
 await assert.rejects(profile.update({revision:2,profile:{trainingBackgroundAndApproach:4}}),{code:'INVALID',message:'Invalid profile.'});
 assert.deepEqual(await profile.get(),{profile:{trainingBackgroundAndApproach:''},revision:2});
 assert.equal((await db.execute('SELECT count(*) AS n FROM user_profile')).rows[0].n,1);
});

test('profile HTTP API requires auth and round trips with revision conflicts',async t=>{
 const db=createDb({url:':memory:'});t.after(()=>db.close());await migrate(db);
 let auth=true;const origin='http://localhost';
 const api=createApi({origin,auth:{session:async()=>auth},profile:createProfileRepository(db)});
 const call=(method='GET',body,headers={})=>api(new Request(origin+'/api/profile',{method,headers:{origin,'content-type':'application/json',...headers},...(body===undefined?{}:{body:JSON.stringify(body)})}));
 auth=false;assert.equal((await call()).status,401);assert.equal((await call('PUT',{revision:0,profile:{}})).status,401);auth=true;
 let response=await call();assert.equal(response.status,200);assert.match(response.headers.get('cache-control'),/no-store/);
 assert.deepEqual(await response.json(),{profile:{trainingBackgroundAndApproach:''},revision:0});
 response=await call('PUT',{revision:0,profile:{trainingBackgroundAndApproach:'Five years'}});assert.equal(response.status,200);
 assert.deepEqual(await response.json(),{profile:{trainingBackgroundAndApproach:'Five years'},revision:1});
 assert.deepEqual(await (await call()).json(),{profile:{trainingBackgroundAndApproach:'Five years'},revision:1});
 response=await call('PUT',{revision:0,profile:{trainingBackgroundAndApproach:'Stale'}});assert.equal(response.status,409);
 assert.equal((await response.json()).error.message,'Profile changed on another device.');
 assert.equal((await call('PUT',{revision:1,profile:{trainingBackgroundAndApproach:'x'.repeat(2001)}})).status,400);
 assert.equal((await call('PUT',{revision:1,profile:{}},{origin:'http://evil'})).status,403);
 assert.equal((await call('DELETE',{})).status,405);
 assert.equal((await api(new Request(origin+'/api/profile/extra',{headers:{origin}}))).status,404);
});
