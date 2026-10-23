import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTemplate, createProgram, copyWorkout, duplicateProgram, assignDay, moveWorkout } from '../src/program.js';

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
