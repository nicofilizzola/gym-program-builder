import test from 'node:test';
import assert from 'node:assert/strict';
import {CATALOG_NAME_MAX} from '../src/catalog.js';
import {WORKOUT_LIMITS,toLocalIso,validateWorkoutLog,createWorkoutLog,logExerciseFromEntry,workoutSummary} from '../src/workout-log.js';

const seq=()=>{let n=0;return()=>'id'+(++n);};
const set=(over={})=>({id:'s1',kind:'working',weightKg:80,reps:8,rir:2,done:true,...over});
const exercise=(over={})=>({id:'e1',variantId:null,referenceId:null,name:'Row',equipment:null,primaryMuscles:['Lats'],secondaryMuscles:['Biceps'],target:null,sets:[set()],...over});
const active=(over={})=>({id:'l1',logVersion:2,status:'active',name:'Workout',startedAt:'2026-11-03T18:00:00.000+01:00',finishedAt:null,source:{kind:'blank'},exercises:[exercise()],...over});
const finished=(over={})=>active({status:'finished',finishedAt:'2026-11-03T19:00:00.000+01:00',...over});
const bad=(log,part)=>{const r=validateWorkoutLog(log);assert.ok(r.error,'expected error');if(part)assert.match(r.error,part);};

test('limits are frozen',()=>{
 assert.ok(Object.isFrozen(WORKOUT_LIMITS));
 assert.deepEqual({...WORKOUT_LIMITS},{weightMax:999.75,weightStep:0.25,repsMin:1,repsMax:100,rirMax:5,nameMax:120,exerciseNameMax:200,exercises:40,sets:20,bytes:262144,lastTimeIds:40,historyPage:30});
});

test('exercise names follow the catalog limit (200), separate from the workout name limit (120)',()=>{
 assert.equal(WORKOUT_LIMITS.exerciseNameMax,CATALOG_NAME_MAX);
 const long='x'.repeat(200);
 assert.ok(validateWorkoutLog(active({exercises:[exercise({name:long})]})).log);
 bad(active({exercises:[exercise({name:'x'.repeat(201)})]}),/Exercise 1: Name must be 1–200 characters/);
 bad(active({name:'x'.repeat(121),exercises:[exercise({name:long})]}),/^Name must be 1–120 characters/);
 const entry={id:'v1',familyId:'r1',name:long,equipment:'Cable',primaryMuscles:['Lats'],secondaryMuscles:[]};
 assert.ok(validateWorkoutLog(active({exercises:[{...logExerciseFromEntry(entry,seq()),sets:[set()]}]})).log);
 const template={id:'t1',document:{name:'Pull',exercises:[{name:long,sets:1,repRange:{min:8,max:12},restSeconds:90,primaryMuscles:['Lats'],secondaryMuscles:[],catalogId:'v1',familyId:'r1'}]}};
 assert.ok(validateWorkoutLog(createWorkoutLog({id:'l2',now:new Date('2026-11-03T17:00:00Z'),makeId:seq(),template})).log);
});

test('createWorkoutLog seeds a program occurrence snapshot',()=>{
 const makeId=seq();
 const template={id:'t1',document:{name:'Push A',exercises:[{name:'Bench press',sets:3,repRange:{min:6,max:10},restSeconds:180,primaryMuscles:['Chest'],secondaryMuscles:['Triceps'],catalogId:'v1',familyId:'r1',catalogRevision:2,equipment:'Barbell'},{name:'Old curl',sets:2,repRange:{min:10,max:12},restSeconds:90,primaryMuscles:['Biceps'],secondaryMuscles:[]}]}};
 const log=createWorkoutLog({id:'log1',now:new Date('2026-11-03T17:00:00Z'),makeId,template,program:{id:'p1',name:'PPL'},occurrenceId:'o1'});
 assert.equal(log.logVersion,2);assert.equal(log.status,'active');assert.equal(log.name,'Push A');assert.equal(log.finishedAt,null);
 assert.deepEqual(log.source,{kind:'program',programId:'p1',occurrenceId:'o1',templateId:'t1',programName:'PPL',templateName:'Push A'});
 assert.deepEqual(log.exercises[0].target,{sets:3,warmupSets:0,repRange:{min:6,max:10},restSeconds:180});
 assert.equal(log.exercises[0].variantId,'v1');assert.equal(log.exercises[0].referenceId,'r1');assert.equal(log.exercises[0].equipment,'Barbell');assert.equal(log.exercises[0].sets.length,3);
 assert.deepEqual(log.exercises[0].sets[0],{id:log.exercises[0].sets[0].id,kind:'working',weightKg:null,reps:null,rir:null,done:false});
 assert.equal(log.exercises[1].variantId,null);assert.equal(log.exercises[1].equipment,null);
 assert.equal(log.exercises[1].sets.length,2);
 assert.equal(new Set(log.exercises.flatMap(e=>[e.id,...e.sets.map(s=>s.id)])).size,7);
 assert.ok(validateWorkoutLog(log).log);
});

test('createWorkoutLog handles template and blank sources',()=>{
 const template={id:'t1',document:{name:'Legs',exercises:[]}};
 const fromTemplate=createWorkoutLog({id:'a',now:new Date(),makeId:seq(),template});
 assert.deepEqual(fromTemplate.source,{kind:'template',templateId:'t1',templateName:'Legs'});
 assert.equal(fromTemplate.name,'Legs');
 const blank=createWorkoutLog({id:'b',now:new Date(),makeId:seq()});
 assert.deepEqual(blank.source,{kind:'blank'});assert.equal(blank.name,'Workout');assert.deepEqual(blank.exercises,[]);
 assert.ok(validateWorkoutLog(blank).log);
});

test('createWorkoutLog normalizes the template name like setLogName',()=>{
 const doc=name=>({id:'t1',document:{name,exercises:[]}});
 const empty=createWorkoutLog({id:'a',now:new Date(),makeId:seq(),template:doc('   ')});
 assert.equal(empty.name,'Workout');assert.ok(validateWorkoutLog(empty).log);
 const long=createWorkoutLog({id:'b',now:new Date(),makeId:seq(),template:doc('x'.repeat(130))});
 assert.equal(long.name,'x'.repeat(120));assert.ok(validateWorkoutLog(long).log);
});

test('logExerciseFromEntry snapshots a catalog entry with one empty set',()=>{
 const ex=logExerciseFromEntry({id:'v9',familyId:'r9',name:'Curl',equipment:'Dumbbell',primaryMuscles:['Biceps'],secondaryMuscles:[],extra:1},seq());
 assert.equal(ex.variantId,'v9');assert.equal(ex.referenceId,'r9');assert.equal(ex.target,null);assert.equal(ex.name,'Curl');
 assert.equal(ex.sets.length,1);assert.deepEqual(ex.sets[0],{id:ex.sets[0].id,kind:'working',weightKg:null,reps:null,rir:null,done:false});
 assert.ok(!('extra' in ex));
});

test('toLocalIso keeps the local offset',()=>{
 const text=toLocalIso(new Date('2026-11-03T17:00:00Z'));
 assert.match(text,/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}[+-]\d\d:\d\d$/);
 assert.equal(new Date(text).toISOString(),'2026-11-03T17:00:00.000Z');
});

test('validateWorkoutLog enforces set bounds',()=>{
 const withSet=over=>active({exercises:[exercise({sets:[set({done:false,...over})]})]});
 for(const weightKg of [-0.25,1000,82.3,'80',NaN])bad(withSet({weightKg}),/Exercise 1, set 1: Weight/);
 for(const reps of [0,101,2.5,'8'])bad(withSet({reps}),/Exercise 1, set 1: Reps/);
 for(const rir of [-1,6,1.5])bad(withSet({rir}),/Exercise 1, set 1: RIR/);
 for(const weightKg of [0,999.75,null,82.5])assert.ok(validateWorkoutLog(withSet({weightKg})).log);
 assert.ok(validateWorkoutLog(withSet({reps:null,rir:null})).log);
 assert.ok(validateWorkoutLog(withSet({reps:100,rir:0})).log);
 bad(withSet({done:true,reps:null}),/Exercise 1, set 1: .*reps/i);
 bad(withSet({done:'yes'}),/set 1/);
});

test('validateWorkoutLog enforces structure and limits',()=>{
 bad(active({name:''}),/Name/);bad(active({name:'x'.repeat(121)}),/Name/);
 assert.ok(validateWorkoutLog(active({name:'x'.repeat(120)})).log);
 bad(active({exercises:Array.from({length:41},(_,i)=>exercise({id:'e'+i}))}),/40/);
 bad(active({exercises:[exercise({sets:Array.from({length:21},(_,i)=>set({id:'s'+i}))})]}),/20/);
 bad(active({exercises:[exercise({primaryMuscles:['Wings']})]}),/Exercise 1: .*"Wings"/);
 bad(active({exercises:[exercise({primaryMuscles:['Chest','Chest']})]}),/Exercise 1/);
 bad(active({exercises:[exercise({equipment:'Spoon'})]}),/equipment/i);
 bad(active({id:''}),/id/i);bad(active({logVersion:3}),/version/i);bad(active({status:'weird'}),/status/i);
 bad(active({startedAt:'yesterday'}),/Start/);bad(active({startedAt:'2026-11-03 18:00:00'}),/Start/);
 bad(active({source:{kind:'x'}}),/source/i);bad(active({source:{kind:'template',templateId:'',templateName:'n'}}),/source/i);
 bad(null);bad([]);
 // active
 bad(active({finishedAt:'2026-11-03T19:00:00.000+01:00'}),/active/i);
 assert.ok(validateWorkoutLog(active({exercises:[exercise({sets:[]})]})).log);
 // finished
 assert.ok(validateWorkoutLog(finished()).log);
 bad(finished({finishedAt:null}),/finish/i);
 bad(finished({finishedAt:'2026-11-03T18:00:00.000+01:00'}),/after/i);
 bad(finished({finishedAt:'2026-11-03T17:59:00.000+01:00'}),/after/i);
 bad(finished({exercises:[]}),/exercise/i);
 bad(finished({exercises:[exercise({sets:[]})]}),/Exercise 1/);
 bad(finished({exercises:[exercise({sets:[set({done:false})]})]}),/Exercise 1, set 1/);
 // Z accepted, unknown keys dropped, canonical key order
 const r=validateWorkoutLog(finished({startedAt:'2026-11-03T17:00:00Z',finishedAt:'2026-11-03T18:00:00.000Z',junk:1,source:{kind:'blank',junk:2},exercises:[exercise({junk:3,sets:[set({junk:4})]})]}));
 assert.ok(r.log);
 assert.deepEqual(Object.keys(r.log),['id','logVersion','status','name','startedAt','finishedAt','source','exercises']);
 assert.deepEqual(Object.keys(r.log.exercises[0]),['id','variantId','referenceId','name','equipment','primaryMuscles','secondaryMuscles','target','sets']);
 assert.deepEqual(Object.keys(r.log.exercises[0].sets[0]),['id','kind','weightKg','reps','rir','done']);
 assert.deepEqual(r.log.source,{kind:'blank'});
 // target
 const target={sets:3,warmupSets:0,repRange:{min:6,max:10},restSeconds:180};
 assert.deepEqual(validateWorkoutLog(active({exercises:[exercise({target:{...target,junk:1}})]})).log.exercises[0].target,target);
 bad(active({exercises:[exercise({target:{...target,repRange:{min:10,max:6}}})]}),/target/i);
 // round trip
 const log=finished();assert.deepEqual(validateWorkoutLog(log).log,log);
});

test('workoutSummary counts done sets',()=>{
 const log=active({source:{kind:'template',templateId:'t',templateName:'T'},exercises:[exercise({sets:[set({id:'a'}),set({id:'b',done:false}),set({id:'c'})]})]});
 assert.deepEqual(workoutSummary(log),{id:'l1',name:'Workout',source:log.source,startedAt:log.startedAt,finishedAt:null,doneSets:2});
});

// ---- log version 2: warm-ups and supersets ----
const ex=(name,over={})=>({name,sets:3,warmupSets:0,repRange:{min:8,max:12},restSeconds:120,primaryMuscles:['Chest'],secondaryMuscles:[],...over});
const validActiveLog=()=>active({logVersion:2});
const withSets=(kinds,{kindValue}={})=>active({exercises:[exercise({sets:kinds.map((k,i)=>set({id:'s'+i,kind:kindValue??k,done:false}))})]});
const pairOnLast=()=>active({exercises:[exercise({id:'e1'}),exercise({id:'e2',superset:{restBetweenSeconds:30,restAfterRoundSeconds:120}})]});
const finishedWithOnlyWarmups=()=>finished({exercises:[exercise({sets:[set({kind:'warmup'}),set({id:'s2',kind:'warmup'})]})]});
const logWithDone=({warmup,working})=>active({exercises:[exercise({sets:[
 ...Array.from({length:warmup},(_,i)=>set({id:'w'+i,kind:'warmup'})),...Array.from({length:working},(_,i)=>set({id:'k'+i}))]})]});

test('template start builds warm-up rows, working rows and pairs',()=>{
 const template={id:'t',document:{name:'Push',exercises:[
  {...ex('Bench'),sets:3,warmupSets:2,superset:{restBetweenSeconds:30,restAfterRoundSeconds:120}},
  {...ex('Row'),sets:2,warmupSets:0}]}};
 const log=createWorkoutLog({id:'l',now:new Date(),makeId:seq(),template});
 assert.equal(log.logVersion,2);
 assert.deepEqual(log.exercises[0].sets.map(s=>s.kind),['warmup','warmup','working','working','working']);
 assert.deepEqual(log.exercises[0].target,{sets:3,warmupSets:2,repRange:{min:8,max:12},restSeconds:120});
 assert.deepEqual(log.exercises[0].superset,{restBetweenSeconds:30,restAfterRoundSeconds:120});
 assert.equal(Object.hasOwn(log.exercises[1],'superset'),false);
 assert.ok(validateWorkoutLog(log).log);
});
test('version 1 logs upgrade to version 2',()=>{
 const v1={...validActiveLog(),logVersion:1};v1.exercises[0].sets.forEach(s=>delete s.kind);
 v1.exercises[0].target={sets:3,repRange:{min:8,max:12},restSeconds:120};
 const {log}=validateWorkoutLog(v1);
 assert.equal(log.logVersion,2);assert.ok(log.exercises[0].sets.every(s=>s.kind==='working'));assert.equal(log.exercises[0].target.warmupSets,0);
 bad({...v1,exercises:[{...v1.exercises[0],superset:{restBetweenSeconds:30,restAfterRoundSeconds:30}}]},/Invalid superset/);
 bad({...v1,exercises:[{...v1.exercises[0],sets:[{...v1.exercises[0].sets[0],kind:'working'}]}]},/Invalid set kind/);
});
test('kind order, superset invariant and finished rules',()=>{
 assert.equal(validateWorkoutLog(withSets(['working','warmup'])).error,'Exercise 1: Warm-up sets must come before working sets.');
 assert.equal(validateWorkoutLog(withSets(['warmup'],{kindValue:'drop'})).error,'Exercise 1, set 1: Invalid set kind.');
 assert.equal(validateWorkoutLog(pairOnLast()).error,'Exercise 2: Invalid superset.');
 assert.equal(validateWorkoutLog(finishedWithOnlyWarmups()).error,'Exercise 1: A finished workout needs at least one working set per exercise.');
});
test('valid pairs are kept in canonical shape',()=>{
 const pair=active({exercises:[exercise({id:'e1',superset:{restBetweenSeconds:30,restAfterRoundSeconds:120,junk:1}}),exercise({id:'e2'})]});
 bad(pair,/Invalid superset/);
 pair.exercises[0].superset={restBetweenSeconds:30,restAfterRoundSeconds:120};
 const r=validateWorkoutLog(pair);
 assert.deepEqual(r.log.exercises[0].superset,{restBetweenSeconds:30,restAfterRoundSeconds:120});
 assert.deepEqual(Object.keys(r.log.exercises[0]),['id','variantId','referenceId','name','equipment','primaryMuscles','secondaryMuscles','target','superset','sets']);
 assert.deepEqual(Object.keys(r.log.exercises[0].sets[0]).slice(0,2),['id','kind']);
});
test('history counts done working sets only',()=>{assert.equal(workoutSummary(logWithDone({warmup:2,working:3})).doneSets,3);});
