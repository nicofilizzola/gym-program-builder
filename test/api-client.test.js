import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createApiClient} from '../src/api-client.js';
test('API client sends revision and cookie-safe requests and retains conflict details',async()=>{
 let received;const api=createApiClient({fetch:async(url,options)=>{received={url,options};return Response.json({error:{code:'CONFLICT',message:'Newer version'}},{status:409});}});
 await assert.rejects(api.update({id:'a',revision:4,document:{name:'Local'}}),{status:409,code:'CONFLICT'});
 assert.equal(received.url,'/api/documents/a');assert.equal(received.options.credentials,'same-origin');assert.equal(JSON.parse(received.options.body).revision,4);
});
