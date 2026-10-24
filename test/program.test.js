import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTemplate, createProgram, copyWorkout, duplicateProgram, assignDay, moveWorkout, placeWorkout } from '../src/program.js';

test('program copies own all nested data and retain schedule across reorder', () => {
  const source = createTemplate();
  source.exercises.push({ name: 'Press', sets: 3, repRange: {min:8,max:12}, primaryMuscles:['Chest'],secondaryMuscles:[] });
  source.goals.Chest = 4;
  const copy = copyWorkout(source, 'w1');
  copy.exercises[0].repRange.min = 9;
  copy.exercises[0].primaryMuscles.push('Triceps');
  copy.goals.Chest = 6;
  assert.equal(source.exercises[0].repRange.min,8);
  assert.deepEqual(source.exercises[0].primaryMuscles,['Chest']);
  assert.equal(source.goals.Chest,4);
  assert.equal(copy.day,null);
  let program = {...createProgram(),workouts:[copy,copyWorkout(source,'w2')]};
  program = assignDay(program,'w1',0);
  program = {...program,mode:'schedule'};
  program = {...program,mode:'simple'};
  program = moveWorkout(program,'w1',1);
  assert.deepEqual(program.workouts.map(w=>[w.id,w.day]),[['w2',null],['w1',0]]);
  let i=0;
  assert.deepEqual(duplicateProgram(program,()=>`new${++i}`).workouts.map(w=>w.id),['new1','new2']);
});

const placementFixture=()=>({...createProgram(),workouts:[['a',0],['b',6],['c',0]].map(([id,day])=>({...copyWorkout(createTemplate(),id),day}))});
test('placeWorkout reorders canonical copies and assigns only the requested day',()=>{
 const p=placementFixture();
 const moved=placeWorkout(p,'a',{beforeId:'c',afterId:null,day:6});
 assert.deepEqual(moved.workouts.map(w=>[w.id,w.day]),[['b',6],['a',6],['c',0]]);
 assert.deepEqual(p.workouts.map(w=>[w.id,w.day]),[['a',0],['b',6],['c',0]]);
 assert.deepEqual(placeWorkout(p,'c',{beforeId:'a',afterId:null}).workouts.map(w=>[w.id,w.day]),[['c',0],['a',0],['b',6]]);
 assert.deepEqual(placeWorkout(p,'a',{beforeId:null,afterId:'b',day:null}).workouts.map(w=>[w.id,w.day]),[['b',6],['a',null],['c',0]]);
 assert.deepEqual(placeWorkout(p,'a',{beforeId:null,afterId:null,day:2}).workouts.map(w=>[w.id,w.day]),[['b',6],['c',0],['a',2]]);
 const single={...p,workouts:[p.workouts[0]]};assert.deepEqual(placeWorkout(single,'a',{day:0,beforeId:null,afterId:null}),single);
});
test('placeWorkout rejects invalid placement without mutating the source',()=>{
 const p=placementFixture(),before=structuredClone(p);
 for(const args of [{day:7},{day:-1},{day:0.5},{beforeId:'missing'},{afterId:'a'},{beforeId:'b',afterId:'c'}])assert.throws(()=>placeWorkout(p,'a',args));
 assert.throws(()=>placeWorkout(p,'missing',{}));assert.deepEqual(p,before);
});
