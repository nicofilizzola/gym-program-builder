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
