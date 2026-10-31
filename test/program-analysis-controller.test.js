import {test} from 'node:test';import assert from 'node:assert/strict';
import {createAnalysisController} from '../src/analysis-controller.js';
import {prepareProgramAnalysisSnapshot} from '../src/program-analysis-input.js';
import {programAnalysisFixtures} from './fixtures/analysis-programs.js';
test('program controller captures local context and tracks exact changes independently of revisions',()=>{
 const program=structuredClone(programAnalysisFixtures['repeated-template']),requests=[];
 const controller=createAnalysisController({getSnapshot:()=>prepareProgramAnalysisSnapshot(program),request:(snapshot,options)=>{requests.push({snapshot,...options});return new Promise(()=>{});}});
 controller.start();assert.equal(controller.getState().phase,'connecting');
 program.context.goalsAndPriorities='Delts';controller.refresh();assert.equal(controller.getState().stale,true);assert.equal(requests[0].snapshot.context.goalsAndPriorities,'Build muscle');
 program.context.goalsAndPriorities='Build muscle';program.workouts[0].templateRevision=5;controller.refresh();assert.equal(controller.getState().stale,false);
 program.workouts[2].exercises[0].sets=0;controller.refresh();assert.equal(controller.getState().stale,true);
 controller.stop();assert.equal(requests[0].signal.aborted,true);requests[0].onEvent({type:'delta',text:'obsolete'});assert.equal(controller.getState().text,'');
 program.workouts[2].exercises[0].sets=3;controller.start();requests[1].onEvent({type:'delta',text:'Current'});requests[0].onEvent({type:'complete'});assert.equal(controller.getState().phase,'streaming');
 controller.destroy();requests[1].onEvent({type:'delta',text:'late'});assert.equal(controller.getState().text,'Current');
});
