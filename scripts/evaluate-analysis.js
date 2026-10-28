import {pathToFileURL} from 'node:url';
import {analysisFixtures} from '../test/fixtures/analysis-sessions.js';
import {prepareAnalysisSnapshot} from '../src/analysis-input.js';
import {createAnalysisService} from '../server/analysis-service.js';
import {ANALYSIS_PROMPT_VERSION} from '../server/analysis-prompt.js';
import {readSse} from '../src/sse.js';

/** Explicit, single-fixture paid evaluation. Never called by build or test scripts. */
export async function runEvaluation({args=process.argv.slice(2),env=process.env,fetch=globalThis.fetch}={}){
 const fixture=args[args.indexOf('--fixture')+1];
 if(!args.includes('--live')||!Object.hasOwn(analysisFixtures,fixture))return {exitCode:2,message:'Usage: node scripts/evaluate-analysis.js --live --fixture <name>',fixtures:Object.keys(analysisFixtures)};
 const model=env.OPENROUTER_MODEL||'anthropic/claude-sonnet-4.6';let usage=null,report='';
 try{
  const service=createAnalysisService({apiKey:env.OPENROUTER_API_KEY,model,fetch,onUsage:value=>usage=value});
  const response=await service.analyze(prepareAnalysisSnapshot(analysisFixtures[fixture]));let complete=false;
  for await(const frame of readSse(response.body)){const data=JSON.parse(frame.data);if(frame.event==='delta')report+=data.text;if(frame.event==='error')throw Error(data.message);if(frame.event==='complete')complete=true;}
  if(!complete)throw Error('Incomplete report.');
  return {exitCode:0,fixture,model,promptVersion:ANALYSIS_PROMPT_VERSION,report,usage};
 }catch(error){return {exitCode:1,fixture,model,promptVersion:ANALYSIS_PROMPT_VERSION,report,usage,error:error.message};}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){const result=await runEvaluation();process.stdout.write(JSON.stringify(result,null,2)+'\n');process.exitCode=result.exitCode;}
