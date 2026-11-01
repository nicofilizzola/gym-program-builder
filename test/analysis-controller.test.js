import {test} from 'node:test';import assert from 'node:assert/strict';import {createAnalysisController} from '../src/analysis-controller.js';import {prepareAnalysisSnapshot} from '../src/analysis-input.js';import {workedSession} from './fixtures/analysis-sessions.js';
test('controller captures immutable current edits, marks/reverts stale and ignores obsolete generation frames',async()=>{
 let workout=structuredClone(workedSession),requests=[];const states=[];
 const controller=createAnalysisController({getSnapshot:()=>prepareAnalysisSnapshot(workout),onState:s=>states.push(s),request:(snapshot,options)=>{requests.push({snapshot,...options});return new Promise(()=>{});}});
 controller.start();assert.equal(controller.getState().phase,'connecting');assert.equal(requests.length,1);workout.exercises[0].restSeconds=90;controller.refresh();assert.equal(controller.getState().stale,true);assert.equal(requests[0].snapshot.exercises[0].restSeconds,180);
 workout.exercises[0].restSeconds=180;controller.refresh();assert.equal(controller.getState().stale,false);requests[0].onEvent({type:'delta',text:'First'});assert.equal(controller.getState().text,'First');
 controller.stop();assert.equal(controller.getState().phase,'stopped');assert.equal(requests[0].signal.aborted,true);requests[0].onEvent({type:'delta',text:'late'});assert.equal(controller.getState().text,'First');
 controller.start();requests[0].onEvent({type:'complete'});assert.equal(controller.getState().phase,'connecting');requests[1].onEvent({type:'delta',text:'New'});requests[1].onEvent({type:'complete'});assert.equal(controller.getState().phase,'complete');
 const n=states.length;controller.destroy();requests[1].onEvent({type:'delta',text:'late'});assert.equal(states.length,n);
});
test('controller rejects invalid sessions before spending and retains partial errors',async()=>{
 let workout={...workedSession,exercises:[{...workedSession.exercises[0],name:''}]},called=0;
 const c=createAnalysisController({getSnapshot:()=>prepareAnalysisSnapshot(workout),onState:()=>{},request:async(_,o)=>{called++;o.onEvent({type:'delta',text:'Partial'});throw Object.assign(Error('Timed out'),{code:'TIMEOUT'});}});
 await c.start();assert.equal(called,0);assert.equal(c.getState().error.exerciseIndex,0);assert.equal(c.getState().error.field,'name');
 workout=workedSession;await c.start();assert.equal(c.getState().text,'Partial');assert.equal(c.getState().phase,'error');assert.equal(c.getState().error.code,'TIMEOUT');c.destroy();
});
