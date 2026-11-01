import {pathToFileURL} from 'node:url';
import {programAnalysisFixtures} from '../test/fixtures/analysis-programs.js';
import {prepareProgramAnalysisSnapshot} from '../src/program-analysis-input.js';
import {createAnalysisService} from '../server/analysis-service.js';
import {PROGRAM_ANALYSIS_PROMPT_VERSION} from '../server/program-analysis-prompt.js';
import {readSse} from '../src/sse.js';

/** Explicit, single synthetic paid evaluation. Never used by tests/builds with real credentials. */
export async function runProgramEvaluation({args=process.argv.slice(2),env=process.env,fetch=globalThis.fetch}={}){
 const index=args.indexOf('--fixture'),fixture=args[index+1];
 if(args.length!==3||!args.includes('--live')||index<0||!Object.hasOwn(programAnalysisFixtures,fixture)||args.filter(v=>v==='--fixture').length!==1)return {exitCode:2,message:'Usage: node scripts/evaluate-program-analysis.js --live --fixture <name>',fixtures:Object.keys(programAnalysisFixtures)};
 const model=env.OPENROUTER_MODEL||'anthropic/claude-sonnet-4.6';let usage=null,report='';
 try{
  const snapshot=prepareProgramAnalysisSnapshot(programAnalysisFixtures[fixture]);
  const service=createAnalysisService({apiKey:env.OPENROUTER_API_KEY,model,fetch,onUsage:value=>usage=value});
  const response=await service.analyze(snapshot);let complete=false;
  for await(const frame of readSse(response.body)){
   const data=JSON.parse(frame.data);
   if(frame.event==='delta')report+=data.text;
   if(frame.event==='error')throw Error(data.message);
   if(frame.event==='complete')complete=true;
  }
  if(!complete)throw Error('Incomplete report.');
  return {exitCode:0,fixture,model,promptVersion:PROGRAM_ANALYSIS_PROMPT_VERSION,report,usage};
 }catch(error){return {exitCode:1,fixture,model,promptVersion:PROGRAM_ANALYSIS_PROMPT_VERSION,report,usage,error:error.message};}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){const result=await runProgramEvaluation();process.stdout.write(JSON.stringify(result,null,2)+'\n');process.exitCode=result.exitCode;}
