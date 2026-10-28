import {test} from 'node:test';
import assert from 'node:assert/strict';
import {prepareAnalysisSnapshot,analysisFingerprint} from '../src/analysis-input.js';
import {workedSession,analysisFixtures} from './fixtures/analysis-sessions.js';
test('analysis validates limits and exercise fields without mutating or leaking metadata',()=>{
 const original=structuredClone(workedSession);const raw={...original,id:'secret',exercises:original.exercises.map(e=>({...e,catalogId:'private'}))};
 const snapshot=prepareAnalysisSnapshot(raw);assert.equal(snapshot.exercises[0].position,1);assert.equal(snapshot.id,undefined);assert.equal(snapshot.exercises[0].catalogId,undefined);assert.deepEqual(original,workedSession);
 assert.throws(()=>prepareAnalysisSnapshot({...raw,exercises:[]}),/exercise/i);
 assert.equal(prepareAnalysisSnapshot(analysisFixtures['long-session']).exercises.length,40);
 assert.throws(()=>prepareAnalysisSnapshot({...raw,exercises:Array(41).fill(raw.exercises[0])}),/40/);
 for(const name of ['x'.repeat(200),'💪'.repeat(200)]) assert.equal(prepareAnalysisSnapshot({...raw,name}).name,name);
 assert.throws(()=>prepareAnalysisSnapshot({...raw,name:'💪'.repeat(201)}),/200/);
 assert.equal(prepareAnalysisSnapshot({...raw,name:''}).name,'Untitled session');
 for(const change of [{name:''},{name:'x'.repeat(201)},{sets:0},{repRange:{min:13,max:12}},{primaryMuscles:[]},{primaryMuscles:['Glutes']},{secondaryMuscles:['Chest']},{restSeconds:14},{equipment:'Spaceship'}]){
  assert.throws(()=>prepareAnalysisSnapshot({...raw,exercises:[{...raw.exercises[0],...change}]}),e=>e.code==='INVALID'&&e.exerciseIndex===0&&Boolean(e.field));
 }
 assert.equal(prepareAnalysisSnapshot({...raw,exercises:[{...raw.exercises[0],equipment:'Barbell'}]}).exercises[0].equipment,'Barbell');
});
test('fingerprint tracks every sent edit and clears when reverted',()=>{
 const source=structuredClone(workedSession),base=analysisFingerprint(prepareAnalysisSnapshot(source));
 for(const mutate of [s=>s.name='New',s=>s.exercises[0].restSeconds=90,s=>s.goals.Chest=4,s=>s.exercises[0].equipment='Barbell',s=>s.exercises.reverse()]){const edited=structuredClone(source);mutate(edited);assert.notEqual(analysisFingerprint(prepareAnalysisSnapshot(edited)),base);}
 assert.equal(analysisFingerprint(prepareAnalysisSnapshot(source)),base);
});
test('analysis rejects coercible goal types and malformed exercises as indexed input errors',()=>{
 for(const goal of ['4',true,null,{},[]])assert.throws(()=>prepareAnalysisSnapshot({...workedSession,goals:{Chest:goal}}),e=>e.code==='INVALID'&&e.status===400);
 for(const exercise of [null,false,3,'press'])assert.throws(()=>prepareAnalysisSnapshot({...workedSession,exercises:[exercise]}),e=>e.code==='INVALID'&&e.exerciseIndex===0&&e.field==='name');
});
test('null exercise is an indexed validation error before timing normalization',()=>{
 assert.throws(()=>prepareAnalysisSnapshot({...workedSession,exercises:[null]}),e=>e.code==='INVALID'&&e.exerciseIndex===0&&e.field==='name');
});
