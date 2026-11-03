import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createApiClient} from '../src/api-client.js';
test('API client sends revision and cookie-safe requests and retains conflict details',async()=>{
 let received;const api=createApiClient({fetch:async(url,options)=>{received={url,options};return Response.json({error:{code:'CONFLICT',message:'Newer version'}},{status:409});}});
 await assert.rejects(api.update({id:'a',revision:4,document:{name:'Local'}}),{status:409,code:'CONFLICT'});
 assert.equal(received.url,'/api/documents/a');assert.equal(received.options.credentials,'same-origin');assert.equal(JSON.parse(received.options.body).revision,4);
});
test('profile client reads and writes the single-user profile with its revision',async()=>{
 const calls=[];const api=createApiClient({fetch:async(url,options)=>{calls.push({url,options});return Response.json({profile:{trainingBackgroundAndApproach:'x'},revision:2});}});
 assert.deepEqual(await api.getProfile(),{profile:{trainingBackgroundAndApproach:'x'},revision:2});
 assert.equal(calls[0].url,'/api/profile');assert.equal(calls[0].options.method,'GET');
 assert.deepEqual(await api.updateProfile({revision:1,profile:{trainingBackgroundAndApproach:'x'}}),{profile:{trainingBackgroundAndApproach:'x'},revision:2});
 assert.equal(calls[1].url,'/api/profile');assert.equal(calls[1].options.method,'PUT');assert.deepEqual(JSON.parse(calls[1].options.body),{revision:1,profile:{trainingBackgroundAndApproach:'x'}});
});
test('workout client calls the workout routes',async()=>{
 const calls=[];const api=createApiClient({fetch:async(url,options)=>{
  calls.push({url,options});
  if(options.method==='DELETE')return new Response(null,{status:204});
  if(url.includes('/last'))return Response.json({lastTime:{v1:{}}});
  if(url==='/api/workouts/active')return Response.json({record:null});
  if(url==='/api/workouts'||url.startsWith('/api/workouts?'))return Response.json({records:[1],hasMore:true});
  return Response.json({record:{id:'a',revision:1}});
 }});
 assert.deepEqual(await api.listWorkouts(),{records:[1],hasMore:true});assert.equal(calls[0].url,'/api/workouts');
 await api.listWorkouts({before:'2026-11-03T10:00:00+00:00',beforeId:'x y'});
 assert.equal(calls[1].url,'/api/workouts?before='+encodeURIComponent('2026-11-03T10:00:00+00:00')+'&beforeId=x+y');
 assert.equal(await api.activeWorkout(),null);assert.equal(calls[2].url,'/api/workouts/active');
 assert.deepEqual(await api.getWorkout('a/b'),{id:'a',revision:1});assert.equal(calls[3].url,'/api/workouts/a%2Fb');
 const log={id:'a'};
 assert.deepEqual(await api.saveWorkout({id:'a',revision:0,log}),{id:'a',revision:1});
 assert.equal(calls[4].url,'/api/workouts/a');assert.equal(calls[4].options.method,'PUT');assert.deepEqual(JSON.parse(calls[4].options.body),{revision:0,log});
 await api.deleteWorkout({id:'a',revision:1});assert.equal(calls[5].url,'/api/workouts/a?revision=1');assert.equal(calls[5].options.method,'DELETE');assert.equal(calls[5].options.body,undefined);
 assert.deepEqual(await api.lastTime({variantIds:['v1','v2'],exclude:'z'}),{v1:{}});assert.equal(calls[6].url,'/api/workouts/last?variantIds=v1%2Cv2&exclude=z');
 await api.lastTime({variantIds:['v1']});assert.equal(calls[7].url,'/api/workouts/last?variantIds=v1');
});
