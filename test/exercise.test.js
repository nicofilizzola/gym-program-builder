import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createExercise, moveExercise, toggleMuscle } from '../src/exercise.js';

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

const A = { name: 'A' };
const B = { name: 'B' };
const C = { name: 'C' };

test('moveExercise moves down and up', () => {
  assert.deepEqual(moveExercise([A, B, C], 0, 2), [B, C, A]);
  assert.deepEqual(moveExercise([A, B, C], 2, 0), [C, A, B]);
  assert.deepEqual(moveExercise([A, B, C], 1, 2), [A, C, B]);
});

test('moveExercise to same index returns an equal copy', () => {
  const list = [A, B, C];
  const result = moveExercise(list, 1, 1);
  assert.deepEqual(result, list);
  assert.notEqual(result, list);
});

test('moveExercise clamps the target index', () => {
  assert.deepEqual(moveExercise([A, B, C], 1, -1), [B, A, C]);
  assert.deepEqual(moveExercise([A, B, C], 1, 99), [A, C, B]);
});

test('moveExercise ignores an out-of-range source', () => {
  assert.deepEqual(moveExercise([A, B, C], 5, 0), [A, B, C]);
});

test('moveExercise does not mutate and keeps object identity', () => {
  const list = [A, B, C];
  const result = moveExercise(list, 0, 2);
  assert.deepEqual(list, [A, B, C]);
  assert.equal(result[2], A);
});
