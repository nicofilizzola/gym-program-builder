import {test} from 'node:test';
import assert from 'node:assert/strict';
import {normalizeProfile,PROFILE_TEXT_FIELDS,PROFILE_LIMITS,EXPERIENCE_LEVELS} from '../src/profile.js';
import {createDb,migrate} from '../server/db.js';
import {createProfileRepository} from '../server/profile-repository.js';
import {createApi} from '../server/api.js';

const EMPTY={trainingBackgroundAndApproach:'',constraintsAndPreferences:'',maxTrainingDaysPerWeek:null,availableWeekdays:[],maxSessionsPerDay:null,maxSessionMinutes:null,experienceLevel:null,typicalRepsInReserve:null,equipment:[]};
const FULL={trainingBackgroundAndApproach:'Five years',constraintsAndPreferences:'Sore knee',maxTrainingDaysPerWeek:4,availableWeekdays:[0,2,4,5],maxSessionsPerDay:1,maxSessionMinutes:60,experienceLevel:'advanced',typicalRepsInReserve:0,equipment:['Barbell','Machine']};

test('empty profile has every key unknown',()=>{assert.deepEqual(normalizeProfile(),EMPTY);assert.deepEqual(Object.keys(normalizeProfile()),Object.keys(EMPTY));});
test('structured fields normalize order and reject invalid values',()=>{
  const p=normalizeProfile({availableWeekdays:[4,0,2],equipment:['Machine','Barbell'],maxSessionMinutes:60,typicalRepsInReserve:0,experienceLevel:'advanced',unknown:1});
  assert.deepEqual(p.availableWeekdays,[0,2,4]);assert.deepEqual(p.equipment,['Barbell','Machine']);assert.equal(p.typicalRepsInReserve,0);assert.equal(Object.hasOwn(p,'unknown'),false);
  for(const bad of [{maxTrainingDaysPerWeek:0},{maxTrainingDaysPerWeek:8},{availableWeekdays:[7]},{availableWeekdays:[1,1]},{maxSessionsPerDay:3},{maxSessionMinutes:62},{maxSessionMinutes:15},{experienceLevel:'pro'},{typicalRepsInReserve:5},{equipment:['Sled']},{constraintsAndPreferences:'x'.repeat(2001)}])
    assert.throws(()=>normalizeProfile(bad));
  assert.throws(()=>normalizeProfile({maxSessionMinutes:62}),/^Error: Max session length must be 20 to 180 minutes in steps of 5\.$/);
});
test('legacy single-field profiles load',()=>{assert.equal(normalizeProfile({trainingBackgroundAndApproach:'Five years'}).constraintsAndPreferences,'');});
test('a full structured profile round trips through the repository',async t=>{
 const db=createDb({url:':memory:'});t.after(()=>db.close());await migrate(db);
 const repo=createProfileRepository(db);
 const saved=await repo.update({revision:0,profile:FULL});assert.deepEqual(saved,{profile:FULL,revision:1});
 assert.deepEqual(await repo.get(),saved);
 await assert.rejects(repo.update({revision:1,profile:{maxSessionsPerDay:3}}),{code:'INVALID'});
});

test('profile normalizes the single background field like program context prose',()=>{
 assert.deepEqual(PROFILE_TEXT_FIELDS,['trainingBackgroundAndApproach','constraintsAndPreferences']);
 assert.deepEqual(EXPERIENCE_LEVELS,['beginner','intermediate','advanced']);
 assert.equal(PROFILE_LIMITS.maxSessionMinutes.step,5);
 assert.equal(normalizeProfile({trainingBackgroundAndApproach:'a\r\nb\rc',extra:'ignored'}).trainingBackgroundAndApproach,'a\nb\nc');
 assert.equal(normalizeProfile({trainingBackgroundAndApproach:'  '}).trainingBackgroundAndApproach,'');
 assert.equal(normalizeProfile({trainingBackgroundAndApproach:'💪'.repeat(1000)}).trainingBackgroundAndApproach.length,2000);
 assert.throws(()=>normalizeProfile({trainingBackgroundAndApproach:'x'.repeat(2001)}),/^Error: Profile fields must be at most 2,000 characters\.$/);
 for(const value of [null,[],'text',3,{trainingBackgroundAndApproach:3},{trainingBackgroundAndApproach:null}])assert.throws(()=>normalizeProfile(value),/^Error: Invalid profile\.$/);
});

test('profile repository starts empty and guards revisions',async t=>{
 const db=createDb({url:':memory:'});t.after(()=>db.close());await migrate(db);
 const profile=createProfileRepository(db,{now:()=> 'now'});
 assert.deepEqual(await profile.get(),{profile:EMPTY,revision:0});
 const saved=await profile.update({revision:0,profile:{trainingBackgroundAndApproach:'Five years\r\n'}});
 assert.deepEqual(saved,{profile:{...EMPTY,trainingBackgroundAndApproach:'Five years\n'},revision:1});
 assert.deepEqual(await profile.get(),saved);
 assert.deepEqual(await profile.update({revision:0,profile:{trainingBackgroundAndApproach:'Five years\n'}}),saved,'a retried acknowledged save is idempotent');
 await assert.rejects(profile.update({revision:0,profile:{trainingBackgroundAndApproach:'Stale'}}),{code:'CONFLICT',message:'Profile changed on another device.'});
 assert.equal((await profile.update({revision:1,profile:{trainingBackgroundAndApproach:''}})).revision,2);
 await assert.rejects(profile.update({revision:5,profile:{}}),{code:'CONFLICT'});
 for(const revision of [-1,1.5,'2',undefined])await assert.rejects(profile.update({revision,profile:{}}),{code:'INVALID'});
 await assert.rejects(profile.update({revision:2,profile:{trainingBackgroundAndApproach:4}}),{code:'INVALID',message:'Invalid profile.'});
 assert.deepEqual(await profile.get(),{profile:EMPTY,revision:2});
 assert.equal((await db.execute('SELECT count(*) AS n FROM user_profile')).rows[0].n,1);
});

test('profile HTTP API requires auth and round trips with revision conflicts',async t=>{
 const db=createDb({url:':memory:'});t.after(()=>db.close());await migrate(db);
 let auth=true;const origin='http://localhost';
 const api=createApi({origin,auth:{session:async()=>auth},profile:createProfileRepository(db)});
 const call=(method='GET',body,headers={})=>api(new Request(origin+'/api/profile',{method,headers:{origin,'content-type':'application/json',...headers},...(body===undefined?{}:{body:JSON.stringify(body)})}));
 auth=false;assert.equal((await call()).status,401);assert.equal((await call('PUT',{revision:0,profile:{}})).status,401);auth=true;
 let response=await call();assert.equal(response.status,200);assert.match(response.headers.get('cache-control'),/no-store/);
 assert.deepEqual(await response.json(),{profile:EMPTY,revision:0});
 response=await call('PUT',{revision:0,profile:{trainingBackgroundAndApproach:'Five years'}});assert.equal(response.status,200);
 assert.deepEqual(await response.json(),{profile:{...EMPTY,trainingBackgroundAndApproach:'Five years'},revision:1});
 assert.deepEqual(await (await call()).json(),{profile:{...EMPTY,trainingBackgroundAndApproach:'Five years'},revision:1});
 response=await call('PUT',{revision:0,profile:{trainingBackgroundAndApproach:'Stale'}});assert.equal(response.status,409);
 assert.equal((await response.json()).error.message,'Profile changed on another device.');
 assert.equal((await call('PUT',{revision:1,profile:{trainingBackgroundAndApproach:'x'.repeat(2001)}})).status,400);
 for(const body of [{revision:1},{revision:1,profile:null},{revision:1,profile:'text'},{revision:1,profile:[]},{revision:1,profile:3}]){
  response=await call('PUT',body);assert.equal(response.status,400,JSON.stringify(body));
  assert.deepEqual((await response.json()).error,{code:'INVALID',message:'Invalid profile.'});
 }
 assert.deepEqual(await (await call()).json(),{profile:{...EMPTY,trainingBackgroundAndApproach:'Five years'},revision:1},'a missing or malformed profile never clears the background');
 assert.equal((await call('PUT',{revision:1,profile:{}},{origin:'http://evil'})).status,403);
 assert.equal((await call('DELETE',{})).status,405);
 assert.equal((await api(new Request(origin+'/api/profile/extra',{headers:{origin}}))).status,404);
});
