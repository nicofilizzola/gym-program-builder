import {test} from 'node:test';import assert from 'node:assert/strict';
import {runProgramEvaluation} from '../scripts/evaluate-program-analysis.js';
import {programAnalysisFixtures} from './fixtures/analysis-programs.js';
test('program evaluation requires one explicit valid fixture and live flag before spending',async()=>{
 for(const args of [[],['--fixture','repeated-template'],['--live','--fixture','unknown'],['--live','--fixture'],['--live','--fixture','repeated-template','--fixture','sound-program']]){
  const result=await runProgramEvaluation({args,env:{OPENROUTER_API_KEY:'private'},fetch:()=>assert.fail('must not spend')});assert.equal(result.exitCode,2);assert.equal(JSON.stringify(result).includes('private'),false);
 }
});
test('program evaluation rejects invalid fixture contents before provider access',async()=>{
 const before=programAnalysisFixtures['sound-program'];programAnalysisFixtures['sound-program']={...before,workouts:[]};
 try{const result=await runProgramEvaluation({args:['--live','--fixture','sound-program'],env:{OPENROUTER_API_KEY:'private'},fetch:()=>assert.fail('must not spend')});assert.equal(result.exitCode,1);}finally{programAnalysisFixtures['sound-program']=before;}
});
test('program evaluation returns one scoped report and usage, and labels incomplete responses',async()=>{
 for(const complete of [true,false]){
  let calls=0;const result=await runProgramEvaluation({args:['--live','--fixture','repeated-template'],env:{OPENROUTER_API_KEY:'private'},fetch:async(_,init)=>{
   calls++;assert.equal(JSON.parse(JSON.parse(init.body).messages[1].content).program.focus,'hypertrophy');
   return new Response('data: '+JSON.stringify({choices:[{delta:{content:'Program review'},finish_reason:complete?'stop':'length'}],usage:{prompt_tokens:100,completion_tokens:3,cost:0.001}})+'\n\ndata: [DONE]\n\n',{headers:{'content-type':'text/event-stream'}});
  }});
  assert.equal(calls,1);assert.equal(result.exitCode,complete?0:1);assert.match(result.promptVersion,/^program-hypertrophy-/);assert.equal(result.report,'Program review');assert.equal(result.usage.cost,.001);assert.equal(JSON.stringify(result).includes('private'),false);
  if(!complete)assert.match(result.error,/incomplete|interrupted/i);
 }
});
test('program evaluation passes the fixture athlete background as server-owned athlete data',async()=>{
 for(const [fixture,expected] of [['athlete-background',programAnalysisFixtures['athlete-background'].athlete.trainingBackgroundAndApproach],['repeated-template','']]){
  let athlete;const result=await runProgramEvaluation({args:['--live','--fixture',fixture],env:{OPENROUTER_API_KEY:'private'},fetch:async(_,init)=>{
   athlete=JSON.parse(JSON.parse(init.body).messages[1].content).athlete;
   return new Response('data: '+JSON.stringify({choices:[{delta:{content:'Program review'},finish_reason:'stop'}]})+'\n\ndata: [DONE]\n\n',{headers:{'content-type':'text/event-stream'}});
  }});
  assert.equal(result.exitCode,0);assert.deepEqual(athlete,{trainingBackgroundAndApproach:expected});
 }
});
