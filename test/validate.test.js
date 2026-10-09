import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateExercise, validateGoal } from '../src/validate.js';

function valid() {
  return {
    name: 'Squat',
    sets: 3,
    repRange: { min: 5, max: 8 },
    primaryMuscles: ['Quads'],
    secondaryMuscles: ['Hamstrings'],
  };
}

test('valid exercise has no errors', () => {
  assert.deepEqual(validateExercise(valid()), {});
});

test('empty and whitespace names are rejected', () => {
  for (const name of ['', '   ']) {
    assert.equal(validateExercise({ ...valid(), name }).name, 'Name is required.');
  }
});

test('sets must be integer >= 1', () => {
  for (const sets of [NaN, 0, -1, 2.5]) {
    assert.equal(
      validateExercise({ ...valid(), sets }).sets,
      'Sets must be a whole number of at least 1.',
      `sets=${sets}`,
    );
  }
  assert.equal(validateExercise({ ...valid(), sets: 1 }).sets, undefined);
});

test('rep range', () => {
  const invalid = [
    { min: 10, max: 8 },
    { min: 0, max: 5 },
    { min: NaN, max: 5 },
    { min: 5.5, max: 8 },
  ];
  for (const repRange of invalid) {
    assert.equal(
      validateExercise({ ...valid(), repRange }).repRange,
      'Reps must be whole numbers of at least 1, with min ≤ max.',
      JSON.stringify(repRange),
    );
  }
  assert.equal(validateExercise({ ...valid(), repRange: { min: 8, max: 8 } }).repRange, undefined);
});

test('requires a primary muscle', () => {
  assert.equal(
    validateExercise({ ...valid(), primaryMuscles: [] }).muscles,
    'Pick at least one primary muscle.',
  );
});

test('rejects overlap', () => {
  const errors = validateExercise({ ...valid(), primaryMuscles: ['Chest'], secondaryMuscles: ['Chest'] });
  assert.equal(errors.muscles, 'A muscle cannot be both primary and secondary.');
});

test('rejects unknown muscle', () => {
  const errors = validateExercise({ ...valid(), primaryMuscles: ['Glutes'] });
  assert.equal(errors.muscles, 'Unknown muscle group.');
});

test('validate.js no longer exports validateSessionName', async () => {
  const mod = await import('../src/validate.js');
  assert.equal('validateSessionName' in mod, false);
});

test('goals must be a positive multiple of 0.5', () => {
  for (const goal of [0.5, 1, 4.5, 10, 30]) assert.equal(validateGoal(goal), null);
  for (const goal of [0, -1, -0.5, 7.3, 0.25, NaN, Infinity]) {
    assert.equal(validateGoal(goal), 'Goal must be a positive multiple of 0.5.');
  }
});
