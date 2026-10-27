import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as sequence from '../src/program-sequence.js';
import {createProgram,copyWorkout,createTemplate,duplicateProgram,placeWorkout} from '../src/program.js';
import {computeProgramVolume,contributingWorkouts} from '../src/program-volume.js';
const fixture=()=>({...createProgram(),workouts:['a','b'].map((id,day)=>({...copyWorkout(createTemplate(),id),day}))});
const keys=p=>sequence.getSequence(p).map(e=>e.workoutId??e.id);
test('new programs open in Week and legacy sequences preserve order',()=>{
 assert.equal(createProgram().mode,'schedule');
 assert.deepEqual(keys(fixture()),['a','b']);
});
test('rest and workout moves preserve days and do not mutate inputs',()=>{
 const p=fixture(),before=structuredClone(p);
 const added=sequence.addRestDay(p,'r');
 assert.deepEqual(keys(added),['a','b','r']);
 const mixed=sequence.placeSequenceEntry(added,'r',{beforeKey:'b'});
 assert.deepEqual(keys(mixed),['a','r','b']);
 const moved=sequence.placeSequenceEntry(mixed,'b',{beforeKey:'a'});
 assert.deepEqual(keys(moved),['b','a','r']);
 assert.deepEqual(moved.workouts.map(w=>[w.id,w.day]),[['b',1],['a',0]]);
 assert.deepEqual(p,before);
 assert.deepEqual(keys(sequence.removeRestDay(mixed,'r')),['a','b']);
});
test('week mutations reconcile fixed rest slots and duplication remaps every identity',()=>{
 const p=sequence.placeSequenceEntry(sequence.addRestDay(fixture(),'r'),'r',{beforeKey:'b'});
 assert.deepEqual(keys(placeWorkout(p,'b',{beforeId:'a',day:6})),['b','r','a']);
 assert.deepEqual(keys(sequence.reconcileSequence({...p,workouts:[p.workouts[0]]})),['a','r']);
 assert.deepEqual(keys(sequence.reconcileSequence({...p,workouts:[...p.workouts,{...p.workouts[0],id:'c'}]})),['a','r','b','c']);
 let i=0;const copy=duplicateProgram(p,()=> 'new'+ ++i);
 assert.deepEqual(keys(copy),['new1','new3','new2']);
 copy.workouts[0].goals.Chest=4;assert.deepEqual(p.workouts[0].goals,{});
});
test('rest-only and consecutive rests have no volume and invalid operations reject',()=>{
 let p=sequence.addRestDay(createProgram(),'r1');p=sequence.addRestDay(p,'r2');
 assert.deepEqual(keys(p),['r1','r2']);
 assert.ok(Object.values(computeProgramVolume(p)).every(n=>n===0));
 assert.equal(contributingWorkouts(p,'Chest'),0);
 for(const id of ['','r1'])assert.throws(()=>sequence.addRestDay(p,id));
 assert.throws(()=>sequence.removeRestDay(p,'missing'));
 assert.throws(()=>sequence.placeSequenceEntry(p,'r1',{beforeKey:'missing'}));
 const q=fixture();q.workouts[0].exercises=[{sets:4,primaryMuscles:['Chest'],secondaryMuscles:['Triceps']}];
 assert.deepEqual(computeProgramVolume(sequence.addRestDay(q,'r')),computeProgramVolume(q));
 assert.equal(contributingWorkouts(sequence.addRestDay(q,'r'),'Chest'),1);
});
