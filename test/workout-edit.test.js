import test from 'node:test';
import assert from 'node:assert/strict';
import {setLogName,addExercise,swapExercise,removeExercise,moveLogExercise,addSet,removeSet,updateSet,toggleSetDone,undoneSetCount,finishWorkout,setWorkoutTimes,finishConfirmation,confirmFinish} from '../src/workout-edit.js';
import {validateWorkoutLog,toLocalIso} from '../src/workout-log.js';

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
 assert.deepEqual(finishWorkout(none,now),{error:'Log at least one set, or discard the workout.'});
 assert.deepEqual(finishWorkout({...log,exercises:[]},now),{error:'Log at least one set, or discard the workout.'});
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
 assert.deepEqual(withSet.exercises[0].sets[2],{id:'n1',kind:'working',weightKg:80,reps:8,rir:null,done:true});
 assert.deepEqual(addSet(log,'e2',seq()).exercises[1].sets[1],{id:'n1',kind:'working',weightKg:null,reps:null,rir:null,done:false});
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
 assert.deepEqual(await confirmFinish(()=>none,{confirm:async o=>{asked.push(o);return true;},now}),{error:'Log at least one set, or discard the workout.'});
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
