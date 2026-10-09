import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createExercise, toggleMuscle } from '../src/exercise.js';

test('createExercise returns independent defaults', () => {
  const a = createExercise();
  const b = createExercise();
  assert.deepEqual(a, {
    name: '',
    sets: 3,
    repRange: { min: 8, max: 12 },
    primaryMuscles: [],
    secondaryMuscles: [],
  });
  assert.deepEqual(a, b);
  assert.notEqual(a.primaryMuscles, b.primaryMuscles);
});

test('toggle adds then removes', () => {
  const added = toggleMuscle(createExercise(), 'primary', 'Chest');
  assert.deepEqual(added.primaryMuscles, ['Chest']);
  assert.deepEqual(toggleMuscle(added, 'primary', 'Chest').primaryMuscles, []);
});

test('toggle does not mutate input', () => {
  const original = createExercise();
  toggleMuscle(original, 'primary', 'Chest');
  assert.deepEqual(original.primaryMuscles, []);
});

test('adding to one role removes from the other', () => {
  const ex = { ...createExercise(), secondaryMuscles: ['Triceps'] };
  const result = toggleMuscle(ex, 'primary', 'Triceps');
  assert.deepEqual(result.primaryMuscles, ['Triceps']);
  assert.deepEqual(result.secondaryMuscles, []);
});

test('lists stay in MUSCLE_GROUPS order', () => {
  const ex = toggleMuscle(toggleMuscle(createExercise(), 'primary', 'Calves'), 'primary', 'Chest');
  assert.deepEqual(ex.primaryMuscles, ['Chest', 'Calves']);
});
