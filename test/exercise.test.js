import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createExercise, exerciseSummary, moveExercise, setRepBound, toggleMuscle } from '../src/exercise.js';

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

const ex = (name, sets, min, max, primaryMuscles, secondaryMuscles) =>
  ({ name, sets, repRange: { min, max }, primaryMuscles, secondaryMuscles });

test('exerciseSummary worked example from spec', () => {
  assert.equal(exerciseSummary(ex('Bench press', 4, 6, 10, ['Chest'], ['Triceps', 'Shoulders'])),
    'Bench press · 4 × 6–10 · Chest · secondary: Triceps, Shoulders');
  assert.equal(exerciseSummary(ex('Dips', 3, 8, 8, ['Chest', 'Triceps'], ['Shoulders'])),
    'Dips · 3 × 8 · Chest, Triceps · secondary: Shoulders');
  assert.equal(exerciseSummary(createExercise()), 'Untitled exercise · 3 × 8–12');
  assert.equal(exerciseSummary(ex('  Row ', NaN, 8, 12, [], ['Biceps'])), 'Row · ? × 8–12 · secondary: Biceps');
});

test('exerciseSummary shows ? for each invalid number', () => {
  assert.equal(exerciseSummary(ex('Squat', 2.5, 0, NaN, ['Quads'], [])), 'Squat · ? × ?–? · Quads');
});

test('exerciseSummary shows an inverted range as typed', () => {
  assert.equal(exerciseSummary(ex('Squat', 3, 12, 8, ['Quads'], [])), 'Squat · 3 × 12–8 · Quads');
});

test('exerciseSummary treats a blank name as untitled', () => {
  assert.equal(exerciseSummary(ex('   ', 3, 5, 5, ['Calves'], [])), 'Untitled exercise · 3 × 5 · Calves');
});

test('moveExercise moves any array, such as collapsed flags', () => {
  assert.deepEqual(moveExercise([true, false, false], 0, 2), [false, false, true]);
});

test('setRepBound moves one bound inside the range', () => {
  assert.deepEqual(setRepBound({ min: 8, max: 12 }, 'min', 10), { min: 10, max: 12 });
  assert.deepEqual(setRepBound({ min: 8, max: 12 }, 'max', 20), { min: 8, max: 20 });
});

test('setRepBound pushes the other bound', () => {
  assert.deepEqual(setRepBound({ min: 8, max: 12 }, 'min', 15), { min: 15, max: 15 });
  assert.deepEqual(setRepBound({ min: 8, max: 12 }, 'max', 5), { min: 5, max: 5 });
  assert.deepEqual(setRepBound({ min: 8, max: 8 }, 'min', 9), { min: 9, max: 9 });
  assert.deepEqual(setRepBound({ min: 30, max: 30 }, 'max', 29), { min: 29, max: 29 });
});

test('setRepBound does not mutate', () => {
  const range = { min: 8, max: 12 };
  setRepBound(range, 'min', 15);
  assert.deepEqual(range, { min: 8, max: 12 });
});
