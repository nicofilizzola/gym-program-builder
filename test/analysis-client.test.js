import {test} from 'node:test';import assert from 'node:assert/strict';import {streamAnalysis} from '../src/analysis-client.js';
const frame=(type,data={})=>`event: ${type}\ndata: ${JSON.stringify(data)}\n\n`;
test('browser client validates app protocol and preserves streamed Unicode',async()=>{
 const seen=[];await streamAnalysis({name:'Current'},{onEvent:e=>seen.push(e),fetch:async(url,init)=>{assert.equal(url,'/api/analysis');assert.equal(init.credentials,'same-origin');assert.equal(JSON.parse(init.body).workout.name,'Current');return new Response(frame('start',{requestId:'a',promptVersion:'v1'})+frame('delta',{text:'💪'})+frame('complete'),{headers:{'content-type':'text/event-stream'}});}});assert.equal(seen[1].text,'💪');
 for(const text of [frame('start',{}),frame('delta',{text:1}),frame('start',{requestId:'a',promptVersion:'v'})+frame('complete')+frame('complete'),frame('start',{requestId:'a',promptVersion:'v'})])await assert.rejects(()=>streamAnalysis({}, {onEvent:()=>{},fetch:async()=>new Response(text,{headers:{'content-type':'text/event-stream'}})}));
});
test('browser client reports JSON, provider stream errors and invalid response types',async()=>{
 await assert.rejects(()=>streamAnalysis({},{fetch:async()=>Response.json({error:{code:'CREDITS',message:'Credit limit reached'}},{status:402})}),e=>e.code==='CREDITS');
 await assert.rejects(()=>streamAnalysis({},{fetch:async()=>Response.json({})}),/response/i);
 await assert.rejects(()=>streamAnalysis({},{fetch:async()=>new Response(frame('error',{code:'INCOMPLETE',message:'Incomplete'}),{headers:{'content-type':'text/event-stream'}})}),e=>e.code==='INCOMPLETE');
 let cancelled=false;await assert.rejects(()=>streamAnalysis({},{onEvent:()=>{throw Error('renderer');},fetch:async()=>new Response(new ReadableStream({start(c){c.enqueue(new TextEncoder().encode(frame('start',{requestId:'a',promptVersion:'v'})));},cancel(){cancelled=true;}}),{headers:{'content-type':'text/event-stream'}})}),/renderer/);assert.equal(cancelled,true);
});
