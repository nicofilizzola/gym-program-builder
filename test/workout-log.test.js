import test from 'node:test';
import assert from 'node:assert/strict';
import {WORKOUT_LIMITS,toLocalIso,validateWorkoutLog,createWorkoutLog,logExerciseFromEntry,workoutSummary} from '../src/workout-log.js';

const seq=()=>{let n=0;return()=>'id'+(++n);};
const set=(over={})=>({id:'s1',weightKg:80,reps:8,rir:2,done:true,...over});
const exercise=(over={})=>({id:'e1',variantId:null,referenceId:null,name:'Row',equipment:null,primaryMuscles:['Lats'],secondaryMuscles:['Biceps'],target:null,sets:[set()],...over});
const active=(over={})=>({id:'l1',logVersion:1,status:'active',name:'Workout',startedAt:'2026-11-03T18:00:00.000+01:00',finishedAt:null,source:{kind:'blank'},exercises:[exercise()],...over});
const finished=(over={})=>active({status:'finished',finishedAt:'2026-11-03T19:00:00.000+01:00',...over});
const bad=(log,part)=>{const r=validateWorkoutLog(log);assert.ok(r.error,'expected error');if(part)assert.match(r.error,part);};

test('limits are frozen',()=>{
 assert.ok(Object.isFrozen(WORKOUT_LIMITS));
 assert.deepEqual({...WORKOUT_LIMITS},{weightMax:999.75,weightStep:0.25,repsMin:1,repsMax:100,rirMax:5,nameMax:120,exercises:40,sets:20,bytes:262144,lastTimeIds:40,historyPage:30});
});

test('createWorkoutLog seeds a program occurrence snapshot',()=>{
 const makeId=seq();
 const template={id:'t1',document:{name:'Push A',exercises:[{name:'Bench press',sets:3,repRange:{min:6,max:10},restSeconds:180,primaryMuscles:['Chest'],secondaryMuscles:['Triceps'],catalogId:'v1',familyId:'r1',catalogRevision:2,equipment:'Barbell'},{name:'Old curl',sets:2,repRange:{min:10,max:12},restSeconds:90,primaryMuscles:['Biceps'],secondaryMuscles:[]}]}};
 const log=createWorkoutLog({id:'log1',now:new Date('2026-11-03T17:00:00Z'),makeId,template,program:{id:'p1',name:'PPL'},occurrenceId:'o1'});
 assert.equal(log.logVersion,1);assert.equal(log.status,'active');assert.equal(log.name,'Push A');assert.equal(log.finishedAt,null);
 assert.deepEqual(log.source,{kind:'program',programId:'p1',occurrenceId:'o1',templateId:'t1',programName:'PPL',templateName:'Push A'});
 assert.deepEqual(log.exercises[0].target,{sets:3,repRange:{min:6,max:10},restSeconds:180});
 assert.equal(log.exercises[0].variantId,'v1');assert.equal(log.exercises[0].referenceId,'r1');assert.equal(log.exercises[0].equipment,'Barbell');assert.equal(log.exercises[0].sets.length,3);
 assert.deepEqual(log.exercises[0].sets[0],{id:log.exercises[0].sets[0].id,weightKg:null,reps:null,rir:null,done:false});
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

test('logExerciseFromEntry snapshots a catalog entry with one empty set',()=>{
 const ex=logExerciseFromEntry({id:'v9',familyId:'r9',name:'Curl',equipment:'Dumbbell',primaryMuscles:['Biceps'],secondaryMuscles:[],extra:1},seq());
 assert.equal(ex.variantId,'v9');assert.equal(ex.referenceId,'r9');assert.equal(ex.target,null);assert.equal(ex.name,'Curl');
 assert.equal(ex.sets.length,1);assert.deepEqual(ex.sets[0],{id:ex.sets[0].id,weightKg:null,reps:null,rir:null,done:false});
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
 bad(active({id:''}),/id/i);bad(active({logVersion:2}),/version/i);bad(active({status:'weird'}),/status/i);
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
 assert.deepEqual(Object.keys(r.log.exercises[0].sets[0]),['id','weightKg','reps','rir','done']);
 assert.deepEqual(r.log.source,{kind:'blank'});
 // target
 const target={sets:3,repRange:{min:6,max:10},restSeconds:180};
 assert.deepEqual(validateWorkoutLog(active({exercises:[exercise({target:{...target,junk:1}})]})).log.exercises[0].target,target);
 bad(active({exercises:[exercise({target:{...target,repRange:{min:10,max:6}}})]}),/target/i);
 // round trip
 const log=finished();assert.deepEqual(validateWorkoutLog(log).log,log);
});

test('workoutSummary counts done sets',()=>{
 const log=active({source:{kind:'template',templateId:'t',templateName:'T'},exercises:[exercise({sets:[set({id:'a'}),set({id:'b',done:false}),set({id:'c'})]})]});
 assert.deepEqual(workoutSummary(log),{id:'l1',name:'Workout',source:log.source,startedAt:log.startedAt,finishedAt:null,doneSets:2});
});
