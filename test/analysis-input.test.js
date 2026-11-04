import {test} from 'node:test';
import assert from 'node:assert/strict';
import {prepareAnalysisSnapshot,analysisFingerprint} from '../src/analysis-input.js';
import {workedSession,analysisFixtures} from './fixtures/analysis-sessions.js';
import {validateDocument} from '../src/document-validation.js';
test('analysis validates limits and exercise fields without mutating or leaking metadata',()=>{
 const original=structuredClone(workedSession);const raw={...original,id:'secret',exercises:original.exercises.map(e=>({...e,catalogId:'private'}))};
 const snapshot=prepareAnalysisSnapshot(raw);assert.equal(snapshot.exercises[0].position,1);assert.equal(snapshot.id,undefined);assert.equal(snapshot.exercises[0].catalogId,undefined);assert.deepEqual(original,workedSession);
 assert.throws(()=>prepareAnalysisSnapshot({...raw,exercises:[]}),/exercise/i);
 assert.equal(prepareAnalysisSnapshot(analysisFixtures['long-session']).exercises.length,40);
 assert.throws(()=>prepareAnalysisSnapshot({...raw,exercises:Array(41).fill(raw.exercises[0])}),/40/);
 for(const name of ['x'.repeat(200),'💪'.repeat(200)]) assert.equal(prepareAnalysisSnapshot({...raw,name}).name,name);
 assert.throws(()=>prepareAnalysisSnapshot({...raw,name:'💪'.repeat(201)}),/200/);
 assert.equal(prepareAnalysisSnapshot({...raw,name:''}).name,'Untitled session');
 for(const change of [{name:''},{name:'x'.repeat(201)},{sets:0},{repRange:{min:13,max:12}},{primaryMuscles:[]},{primaryMuscles:['Forearms']},{secondaryMuscles:['Chest']},{restSeconds:14},{equipment:'Spaceship'}]){
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
test('analysis keeps warm-ups and supersets and rejects broken pairs',()=>{
 const base=structuredClone(workedSession),two=[{...base.exercises[0],warmupSets:2,superset:{restBetweenSeconds:30,restAfterRoundSeconds:120}},{...base.exercises[0]}];
 const snap=prepareAnalysisSnapshot({...base,exercises:two});
 assert.equal(snap.exercises[0].warmupSets,2);assert.deepEqual(snap.exercises[0].superset,{restBetweenSeconds:30,restAfterRoundSeconds:120});
 assert.equal(snap.exercises[1].warmupSets,0);assert.equal(Object.hasOwn(snap.exercises[1],'superset'),false);
 assert.throws(()=>prepareAnalysisSnapshot({...base,exercises:[two[0]]}),e=>e.message==='Exercise 1: Invalid superset.'&&e.exerciseIndex===0&&e.field==='sets');
 assert.throws(()=>prepareAnalysisSnapshot({...base,exercises:[{...two[0],warmupSets:6},two[1]]}),e=>e.exerciseIndex===0&&e.field==='warmupSets');
});
test('superset extra keys are dropped consistently with document validation',()=>{
 const base=structuredClone(workedSession),pair=[{...base.exercises[0],superset:{restBetweenSeconds:30,restAfterRoundSeconds:120,note:'x'}},{...base.exercises[0]}];
 assert.deepEqual(validateDocument('template',{...base,exercises:pair}).document.exercises[0].superset,{restBetweenSeconds:30,restAfterRoundSeconds:120});
 assert.deepEqual(prepareAnalysisSnapshot({...base,exercises:pair}).exercises[0].superset,{restBetweenSeconds:30,restAfterRoundSeconds:120});
});
test('malformed pair members are indexed 400 errors, never TypeErrors',()=>{
 const base=structuredClone(workedSession),first={...base.exercises[0],superset:{restBetweenSeconds:30,restAfterRoundSeconds:120}};
 for(const exercises of [[first,null],[{...base.exercises[0],superset:null},base.exercises[0]],[{...base.exercises[0],superset:5},base.exercises[0]]]){
  assert.throws(()=>prepareAnalysisSnapshot({...base,exercises}),e=>!(e instanceof TypeError)&&e.code==='INVALID'&&e.status===400&&Number.isInteger(e.exerciseIndex));
 }
 assert.throws(()=>prepareAnalysisSnapshot({...base,exercises:[base.exercises[0],{...first},{...first}]}),e=>e.message==='Exercise 2: Invalid superset.'&&e.exerciseIndex===1&&e.field==='sets');
});
