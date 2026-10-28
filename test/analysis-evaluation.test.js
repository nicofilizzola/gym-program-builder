import {test} from 'node:test';import assert from 'node:assert/strict';import {runEvaluation} from '../scripts/evaluate-analysis.js';
test('evaluation requires explicit live flag and known fixture before accessing provider',async()=>{
 for(const args of [[],['--fixture','focused-push'],['--live','--fixture','unknown']]){const result=await runEvaluation({args,env:{OPENROUTER_API_KEY:'private'},fetch:()=>assert.fail('must not spend')});assert.equal(result.exitCode,2);assert.ok(!JSON.stringify(result).includes('private'));}
});
test('evaluation returns one fixture report and usage without exposing credentials',async()=>{
 let calls=0;const result=await runEvaluation({args:['--live','--fixture','focused-push'],env:{OPENROUTER_API_KEY:'private'},fetch:async()=>{calls++;return new Response('data: {"choices":[{"delta":{"content":"A review"},"finish_reason":"stop"}],"usage":{"prompt_tokens":10,"completion_tokens":2,"cost":0.0001}}\n\ndata: [DONE]\n\n',{headers:{'content-type':'text/event-stream'}});}});
 assert.equal(calls,1);assert.equal(result.exitCode,0);assert.equal(result.report,'A review');assert.equal(result.usage.inputTokens,10);assert.ok(!JSON.stringify(result).includes('private'));
});
