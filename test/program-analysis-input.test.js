import {test} from 'node:test';import assert from 'node:assert/strict';
import {prepareProgramAnalysisSnapshot as prepare,validateProgramAnalysisSnapshot as validate} from '../src/program-analysis-input.js';
import {analysisFingerprint} from '../src/analysis-input.js';
import {programAnalysisFixtures as fixtures} from './fixtures/analysis-programs.js';
const source=()=>structuredClone(fixtures['repeated-template']);
test('program snapshot counts occurrences but preserves actual shared identities without exposing internal IDs',()=>{
 const p=source();p.workouts[0].catalogId='private';p.workouts[0].templateRevision=5;
 const s=prepare(p);assert.equal(s.templates.length,2);assert.equal(s.workouts.length,3);
 assert.equal(s.workouts[0].templateKey,s.workouts[1].templateKey);
 assert.equal(prepare(fixtures['same-name-independent']).templates.length,3);
 assert.equal(JSON.stringify(s).includes('occ-a'),false);assert.equal(JSON.stringify(s).includes('private'),false);
 assert.deepEqual(validate(s),s);assert.equal(s.templates[0].workout.exercises[0].position,1);
 assert.equal(p.workouts[0].templateRevision,5);
});
test('fingerprints change on every sent field and return exactly after revert, excluding revisions',()=>{
 const p=source(),before=analysisFingerprint(prepare(p));
 const changes=[p=>p.name='New',p=>p.context.goalsAndPriorities='Delts',p=>p.mode='simple',p=>p.goals.Chest=9,p=>p.workouts[2].day=3,p=>p.workouts[2].exercises[0].restSeconds=90,p=>p.workouts[2].exercises[0].variantDescription='Slow',p=>p.workouts[2].exercises[0].focusTags=['Glutes'],p=>p.workouts[2].exercises[0].warmupSets=2,p=>p.workouts.reverse(),p=>p.sequence=[...p.workouts.map(w=>({type:'workout',workoutId:w.id})),{type:'rest',id:'r'}]];
 for(const edit of changes){const q=source();edit(q);assert.notEqual(analysisFingerprint(prepare(q)),before);}
 p.workouts.forEach(w=>w.templateRevision=99);assert.equal(analysisFingerprint(prepare(p)),before);
});
test('fingerprint tracks superset rests',()=>{
 const pair=()=>{const p=source(),t=p.workouts[2];t.exercises=[{...t.exercises[0],superset:{restBetweenSeconds:30,restAfterRoundSeconds:120}},{...t.exercises[0],name:'Other'}];return p;};
 const before=analysisFingerprint(prepare(pair()));
 for(const edit of [p=>p.workouts[2].exercises[0].superset.restBetweenSeconds=45,p=>p.workouts[2].exercises[0].superset.restAfterRoundSeconds=150,p=>delete p.workouts[2].exercises[0].superset]){const q=pair();edit(q);assert.notEqual(analysisFingerprint(prepare(q)),before);}
 const bad=pair();bad.workouts[2].exercises.splice(1,1);assert.throws(()=>prepare(bad),e=>/Invalid superset/.test(e.message)&&e.exerciseIndex===0&&e.field==='sets');
});
test('analysis rejects invalid and incomplete programs with indexed exercise errors',()=>{
 for(const edit of [p=>p.workouts=[],p=>p.workouts[2].exercises=[],p=>delete p.workouts[2].templateId,p=>p.workouts[2].id=p.workouts[0].id,p=>p.workouts[1].name='Inconsistent',p=>p.workouts[2].exercises=[null],p=>p.goals.Chest='4',p=>p.workouts[2].exercises[0].focusTags=[3],p=>p.workouts[2].day=7]){const p=source();edit(p);assert.throws(()=>prepare(p),e=>e.code==='INVALID');}
 const p=source();p.workouts[2].exercises[0].sets=0;
 assert.throws(()=>prepare(p),e=>e.occurrenceIndex===2&&e.exerciseIndex===0&&e.field==='sets');
 const s=prepare(source());for(const edit of [s=>s.focus='strength',s=>s.workouts[0].templateKey='missing',s=>s.templates[0].key='private',s=>s.sequence.reverse(),s=>s.sequence.push({type:'workout',workoutKey:'workout-1'})]){const q=structuredClone(s);edit(q);assert.throws(()=>validate(q));}
});
test('program analysis enforces occurrence, per-template and expanded exercise limits',()=>{
 const p=structuredClone(fixtures['long-program']);assert.equal(prepare(p).workouts.length,50);
 p.workouts.push({...p.workouts[0],id:'overflow'});assert.throws(()=>prepare(p),/50/);
 const q=source();q.workouts=q.workouts.slice(2);q.workouts[0].exercises=Array.from({length:40},()=>structuredClone(q.workouts[0].exercises[0]));assert.equal(prepare(q).templates[0].workout.exercises.length,40);
 q.workouts[0].exercises.push(q.workouts[0].exercises[0]);assert.throws(()=>prepare(q),/40/);
 const long=source().workouts[2];long.exercises=Array.from({length:40},()=>structuredClone(long.exercises[0]));
 const r={...source(),workouts:Array.from({length:10},(_,i)=>({...long,id:'w'+i}))};assert.equal(prepare(r).workouts.length,10);
 r.workouts.push({...source().workouts[0],id:'last',exercises:[source().workouts[0].exercises[0]]});assert.throws(()=>prepare(r),/400/);
});
test('metadata is portable and validated, sequence never invents weekdays',()=>{
 const p=source();Object.assign(p.workouts[2].exercises[0],{referenceDescription:'Group',variantDescription:'Version',brand:'Brand',focusTags:['Priority'],catalogId:'private',catalogRevision:2});
 const s=prepare(p);assert.equal(s.templates[1].workout.exercises[0].referenceDescription,'Group');assert.equal(s.templates[1].workout.exercises[0].catalogId,undefined);
 const seq=prepare(fixtures['sequence-unknown-cadence']);assert.equal(seq.mode,'simple');assert.equal(seq.sequence[1].type,'rest');assert.deepEqual(seq.workouts.map(w=>w.day),[0,4,null]);
 p.workouts[2].exercises[0].referenceDescription='x'.repeat(2001);assert.throws(()=>prepare(p));
});
test('analysis enforces Unicode name and exact UTF-8 envelope boundaries',()=>{
 const p=source();p.name='💪'.repeat(200);assert.equal(prepare(p).name,p.name);p.name+='a';assert.throws(()=>prepare(p),/200/);
 const q=source();q.workouts=Array.from({length:4},(_,i)=>({...structuredClone(q.workouts[2]),id:'w'+i,templateId:'t'+i,exercises:Array.from({length:20},()=>({...structuredClone(q.workouts[2].exercises[0]),referenceDescription:'',variantDescription:''}))}));
 const s=prepare(q),bytes=()=>new TextEncoder().encode(JSON.stringify({snapshot:s})).length;
 let remaining=262144-bytes(),last;
 for(const t of s.templates)for(const ex of t.workout.exercises)for(const key of ['referenceDescription','variantDescription']){
  const count=Math.min(2000,remaining);ex[key]='x'.repeat(count);remaining-=count;
  if(count<2000&&count>0)last=[ex,key];
 }
 assert.equal(bytes(),262144);assert.deepEqual(validate(s),s);
 last[0][last[1]]+='x';assert.equal(bytes(),262145);assert.throws(()=>validate(s),e=>e.code==='TOO_LARGE');
});
test('program snapshots never carry client athlete data or legacy context background',()=>{
 const p=source();p.athlete={trainingBackgroundAndApproach:'spoof'};p.context.trainingBackgroundAndApproach='Legacy';
 const s=prepare(p);assert.equal(Object.hasOwn(s,'athlete'),false);assert.deepEqual(Object.keys(s.context),['goalsAndPriorities']);
 assert.equal(analysisFingerprint(s),analysisFingerprint(prepare(source())));
 const spoofed=validate({...s,athlete:{trainingBackgroundAndApproach:'spoof'}});assert.equal(Object.hasOwn(spoofed,'athlete'),false);assert.deepEqual(spoofed,s);
});
