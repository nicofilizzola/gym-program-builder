import test from 'node:test';
import assert from 'node:assert/strict';
import {setExerciseNote,setSetNote,addWarmup,moveLogBlock,unlinkSuperset,nextGuidedSet,NO_SETS,setLogName,addExercise,swapExercise,removeExercise,moveLogExercise,addSet,removeSet,updateSet,toggleSetDone,undoneSetCount,finishWorkout,setWorkoutTimes,finishConfirmation,confirmFinish} from '../src/workout-edit.js';
import {validateWorkoutLog,toLocalIso,normalizeNote} from '../src/workout-log.js';

const seq=()=>{let n=0;return()=>'n'+(++n);};
const set=(id,over={})=>({id,kind:'working',weightKg:null,reps:null,rir:null,done:false,...over});
const exercise=(id,sets,over={})=>({id,variantId:null,referenceId:null,name:'Row '+id,equipment:null,primaryMuscles:['Lats'],secondaryMuscles:['Biceps'],target:{sets:2,warmupSets:0,repRange:{min:6,max:10},restSeconds:90},sets,...over});
const makeLog=()=>({id:'l1',logVersion:2,status:'active',name:'Workout',startedAt:'2026-11-03T18:00:00.000+01:00',finishedAt:null,source:{kind:'blank'},
 exercises:[exercise('e1',[set('s1',{weightKg:80,reps:8,rir:2,done:true}),set('s2')]),exercise('e2',[set('s3')])]});
const copy=l=>JSON.parse(JSON.stringify(l));
const entry={id:'v9',familyId:'r9',name:'Incline press',equipment:'Dumbbell',primaryMuscles:['Chest'],secondaryMuscles:['Front delts']};

test('swapExercise keeps sets and clears target',()=>{
 const log=makeLog(),before=copy(log);
 const next=swapExercise(log,'e1',entry);
 assert.equal(next.exercises[0].id,'e1');assert.equal(next.exercises[0].variantId,'v9');assert.equal(next.exercises[0].referenceId,'r9');
 assert.equal(next.exercises[0].name,'Incline press');assert.equal(next.exercises[0].equipment,'Dumbbell');
 assert.deepEqual(next.exercises[0].primaryMuscles,['Chest']);assert.deepEqual(next.exercises[0].secondaryMuscles,['Front delts']);
 assert.equal(next.exercises[0].target,null);
 assert.deepEqual(next.exercises[0].sets,log.exercises[0].sets);assert.notEqual(next,log);
 assert.deepEqual(log,before);
 assert.equal(swapExercise(log,'nope',entry),log);
});

test('toggleSetDone fills empty fields from the placeholder and needs reps',()=>{
 const log=makeLog(),before=copy(log);
 const ph={weightKg:80,reps:8,rir:2};
 const r=toggleSetDone(log,'e1','s2',ph);
 assert.deepEqual(r.log.exercises[0].sets[1],{id:'s2',kind:'working',weightKg:80,reps:8,rir:2,done:true});
 assert.deepEqual(log,before);
 const typed=updateSet(log,'e1','s2',{weightKg:82.5});
 assert.equal(toggleSetDone(typed,'e1','s2',ph).log.exercises[0].sets[1].weightKg,82.5);
 assert.deepEqual(toggleSetDone(log,'e1','s2',{weightKg:80,reps:null,rir:null}),{error:'Enter reps'});
 assert.deepEqual(toggleSetDone(log,'e1','s2',undefined),{error:'Enter reps'});
 const undone=toggleSetDone(log,'e1','s1',ph).log.exercises[0].sets[0];
 assert.deepEqual(undone,{id:'s1',kind:'working',weightKg:80,reps:8,rir:2,done:false});
 assert.equal(toggleSetDone(log,'e1','zz',ph).log,log);
});

test('finishWorkout prunes undone sets and empty exercises',()=>{
 const log=makeLog(),before=copy(log);
 assert.equal(undoneSetCount(log),2);
 const now=new Date('2026-11-03T19:00:00+01:00');
 const r=finishWorkout(log,now);
 assert.equal(r.log.status,'finished');assert.equal(r.log.finishedAt,toLocalIso(now));
 assert.equal(r.log.exercises.length,1);assert.equal(r.log.exercises[0].id,'e1');assert.deepEqual(r.log.exercises[0].sets.map(s=>s.id),['s1']);
 assert.ok(validateWorkoutLog(r.log).log);assert.deepEqual(log,before);
 const none={...log,exercises:[exercise('e1',[set('s1')])]};
 assert.deepEqual(finishWorkout(none,now),{error:'Log at least one working set, or discard the workout.'});
 assert.deepEqual(finishWorkout({...log,exercises:[]},now),{error:'Log at least one working set, or discard the workout.'});
 assert.ok(finishWorkout(log,new Date('2026-11-03T17:00:00+01:00')).error);
});

test('setWorkoutTimes treats an end before the start as the next day',()=>{
 const finished=finishWorkout(makeLog(),new Date('2026-11-03T19:00:00+01:00')).log;
 const {log:next}=setWorkoutTimes(finished,{date:'2026-11-03',startTime:'23:30',endTime:'00:40'});
 assert.equal((new Date(next.finishedAt)-new Date(next.startedAt))/60000,70);
 assert.ok(validateWorkoutLog(next).log);
 assert.equal(next.startedAt.slice(0,16),toLocalIso(new Date(2026,10,3,23,30)).slice(0,16));
 assert.deepEqual(setWorkoutTimes(finished,{date:'2026-11-03',startTime:'10:00',endTime:'10:00'}),{error:'End time must be after the start time.'});
 assert.ok(setWorkoutTimes(finished,{date:'bad',startTime:'10:00',endTime:'11:00'}).error);
 assert.ok(setWorkoutTimes(finished,{date:'2026-11-03',startTime:'25:00',endTime:'11:00'}).error);
});

test('setLogName, add/remove/move exercise and add/remove/update set',()=>{
 const log=makeLog(),before=copy(log);
 assert.equal(setLogName(log,'  ').name,'Workout');assert.equal(setLogName(log,'  Pull  ').name,'Pull');
 assert.equal(setLogName(log,'x'.repeat(130)).name.length,120);
 const added=addExercise(log,entry,seq());
 assert.equal(added.exercises.length,3);assert.equal(added.exercises[2].target,null);assert.equal(added.exercises[2].sets.length,1);assert.equal(added.exercises[2].variantId,'v9');
 assert.deepEqual(removeExercise(log,'e1').exercises.map(e=>e.id),['e2']);
 assert.deepEqual(moveLogExercise(log,0,1).exercises.map(e=>e.id),['e2','e1']);
 assert.equal(moveLogExercise(log,0,5),log);
 const withSet=addSet(log,'e1',seq(),{weightKg:80,reps:8,done:true});
 assert.deepEqual(withSet.exercises[0].sets[2],{id:'n1',kind:'working',weightKg:80,reps:8,rir:null,done:true,note:''});
 assert.deepEqual(addSet(log,'e2',seq()).exercises[1].sets[1],{id:'n1',kind:'working',weightKg:null,reps:null,rir:null,done:false,note:''});
 assert.deepEqual(removeSet(log,'e1','s2').exercises[0].sets.map(s=>s.id),['s1']);
 const upd=updateSet(log,'e1','s2',{reps:5});
 assert.equal(upd.exercises[0].sets[1].reps,5);assert.deepEqual(upd.exercises[0].sets[0],log.exercises[0].sets[0]);assert.deepEqual(upd.exercises[1],log.exercises[1]);
 assert.equal(removeExercise(log,'zz'),log);assert.equal(addSet(log,'zz',seq()),log);
 assert.equal(removeSet(log,'e1','zz'),log);assert.equal(updateSet(log,'e1','zz',{reps:1}),log);
 assert.deepEqual(log,before);
});

test('finishConfirmation pluralizes the standard warning and is null without undone sets',()=>{
 const one=makeLog();
 assert.deepEqual(finishConfirmation({...one,exercises:[one.exercises[0]]}),{title:'Finish workout?',message:'1 set not completed — finish anyway? Uncompleted sets will be removed.',confirmLabel:'Finish workout'});
 assert.equal(finishConfirmation(one).message,'2 sets not completed — finish anyway? Uncompleted sets will be removed.');
 assert.equal(finishConfirmation({...one,exercises:[exercise('e1',[set('s1',{reps:8,done:true})])]}),null);
});

test('confirmFinish refuses without done sets, asks about undone sets and finishes the latest log',async()=>{
 const now=()=>new Date('2026-11-03T19:00:00+01:00'),asked=[];
 const none={...makeLog(),exercises:[exercise('e1',[set('s1')])]};
 assert.deepEqual(await confirmFinish(()=>none,{confirm:async o=>{asked.push(o);return true;},now}),{error:'Log at least one working set, or discard the workout.'});
 assert.equal(asked.length,0);
 assert.deepEqual(await confirmFinish(()=>makeLog(),{confirm:async o=>{asked.push(o);return false;},now}),{cancelled:true});
 assert.equal(asked[0].message,'2 sets not completed — finish anyway? Uncompleted sets will be removed.');
 let current=makeLog();
 const r=await confirmFinish(()=>current,{confirm:async()=>{current=setLogName(current,'Renamed');return true;},now});
 assert.equal(r.log.status,'finished');assert.equal(r.log.name,'Renamed');assert.equal(r.log.exercises.length,1);
 assert.deepEqual(await confirmFinish(()=>null,{confirm:async()=>true,now}),{cancelled:true});
 let gone=false;
 assert.deepEqual(await confirmFinish(()=>gone?null:makeLog(),{confirm:async()=>{gone=true;return true;},now}),{cancelled:true});
});

// --- warm-ups, pairs, finish rules, guided focus ---
const sq=p=>{let n=0;return()=>p+(++n);};
const base=kinds=>({...makeLog(),exercises:[exercise('e1',kinds.map((k,i)=>set('s'+(i+1),{kind:k})))]});
const variant=id=>({id,familyId:'r'+id,name:'Var '+id,equipment:null,primaryMuscles:['Chest'],secondaryMuscles:[]});
const paired=()=>({...makeLog(),exercises:[
 exercise('a',[set('a1')],{superset:{restBetweenSeconds:30,restAfterRoundSeconds:90}}),exercise('b',[set('b1')]),exercise('c',[set('c1')])]});
const mix=spec=>{const sets=[];let i=0;
 for(const [kind,done,open] of [['warmup',spec.warmupDone||0,spec.warmupOpen||0],['working',spec.workingDone||0,spec.workingOpen||0]]){
  for(let j=0;j<done;j++)sets.push(set('x'+(++i),{kind,reps:5,done:true}));for(let j=0;j<open;j++)sets.push(set('x'+(++i),{kind}));}
 return sets;};
const doneMix=({a})=>({...makeLog(),exercises:[exercise('a',mix(a))]});
const pairedWorking=({a,b})=>({...makeLog(),exercises:[
 exercise('a',a.map((d,i)=>set('a'+(i+1),{reps:5,done:d})),{superset:{restBetweenSeconds:30,restAfterRoundSeconds:90}}),
 exercise('b',b.map((d,i)=>set('b'+(i+1),{reps:5,done:d})))]});

test('add warm-up inserts after the last warm-up; add set appends working',()=>{
 const log=addWarmup(base(['warmup','working','working']),'e1',sq('n'));
 assert.deepEqual(log.exercises[0].sets.map(s=>s.kind),['warmup','warmup','working','working']);
 assert.equal(addSet(log,'e1',sq('m')).exercises[0].sets.at(-1).kind,'working');
 assert.deepEqual(addWarmup(base(['working']),'e1',sq('n')).exercises[0].sets.map(s=>s.kind),['warmup','working']);
 const full=base(Array(20).fill('working'));
 assert.equal(addSet(full,'e1',sq('n')),full);assert.equal(addWarmup(full,'e1',sq('n')),full);
});
test('pairs survive swap, dissolve on remove/unlink and move as blocks',()=>{
 const log=paired();
 assert.ok(swapExercise(log,'a',variant('X')).exercises[0].superset);
 assert.equal(removeExercise(log,'b').exercises[0].superset,undefined);
 assert.equal(removeExercise(log,'b').exercises.length,2);
 assert.equal(unlinkSuperset(log,'b').exercises[0].superset,undefined);
 assert.equal(unlinkSuperset(log,'a').exercises.length,3);
 assert.deepEqual(moveLogBlock(log,0,1).exercises.map(e=>e.id),['c','a','b']);
 assert.ok(log.exercises[0].superset);
});
test('finish ignores warm-ups in the warning and refuses without working sets',()=>{
 const log=doneMix({a:{warmupDone:1,warmupOpen:1,workingDone:2,workingOpen:0}});
 assert.equal(undoneSetCount(log),0);assert.equal(finishConfirmation(log),null);
 const done=finishWorkout(log,new Date());assert.deepEqual(done.log.exercises[0].sets.map(s=>s.kind),['warmup','working','working']);
 assert.equal(finishWorkout(doneMix({a:{warmupDone:2,workingDone:0,workingOpen:1}}),new Date()).error,'Log at least one working set, or discard the workout.');
 assert.equal(NO_SETS,'Log at least one working set, or discard the workout.');
});
test('finish drops warm-up-only exercises and dissolves broken pairs',()=>{
 const log={...makeLog(),exercises:[
  exercise('a',[set('a1',{reps:5,done:true})],{superset:{restBetweenSeconds:30,restAfterRoundSeconds:90}}),
  exercise('b',[set('b1',{kind:'warmup',reps:5,done:true}),set('b2')])]};
 const r=finishWorkout(log,new Date());
 assert.deepEqual(r.log.exercises.map(e=>e.id),['a']);assert.equal(r.log.exercises[0].superset,undefined);
});
test('guided focus alternates partners and falls back',()=>{
 assert.deepEqual(nextGuidedSet(pairedWorking({a:[true,false,false],b:[false,false]}),'a','a1'),{exerciseId:'b',setId:'b1'});
 assert.deepEqual(nextGuidedSet(pairedWorking({a:[true,false],b:[true,true]}),'a','a1'),{exerciseId:'a',setId:'a2'});
 assert.equal(nextGuidedSet(pairedWorking({a:[true],b:[true]}),'a','a1'),null);
 assert.equal(nextGuidedSet(makeLog(),'e1','s1'),null);
 const w=pairedWorking({a:[true],b:[false]});w.exercises[0].sets.unshift(set('aw1',{kind:'warmup',reps:5,done:true}));
 assert.equal(nextGuidedSet(w,'a','aw1'),null);
});
test('active log may keep an exercise with only warm-ups after removing its working sets',()=>{
 const log=removeSet(base(['warmup','working']),'e1','s2');assert.ok(validateWorkoutLog(log).log);
});

test('note transforms',()=>{
 let log=makeLog();const ex=log.exercises[0],sid=ex.sets[0].id;
 log=setExerciseNote(log,ex.id,'Seat 4');assert.equal(log.exercises[0].note,'Seat 4');
 log=setSetNote(log,ex.id,sid,'Felt easy');assert.equal(log.exercises[0].sets[0].note,'Felt easy');
 assert.equal(swapExercise(log,ex.id,entry).exercises[0].note,'Seat 4');
 assert.equal(addSet(log,ex.id,seq()).exercises[0].sets.at(-1).note,'');
 assert.equal(addWarmup(log,ex.id,seq()).exercises[0].sets[0].note,'');
 assert.equal(normalizeNote('  \n '),'');assert.equal(normalizeNote(' a b '),'a b');
});
