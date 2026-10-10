import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LIMITS, validateExercise, validateGoal } from '../src/validate.js';

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
  for (const sets of [NaN, 0, -1, 2.5, 11, 100]) {
    assert.equal(
      validateExercise({ ...valid(), sets }).sets,
      'Sets must be a whole number from 1 to 10.',
      `sets=${sets}`,
    );
  }
  assert.equal(validateExercise({ ...valid(), sets: 1 }).sets, undefined);
  assert.equal(validateExercise({ ...valid(), sets: 10 }).sets, undefined);
});

test('rep range', () => {
  const invalid = [
    { min: 10, max: 8 },
    { min: 0, max: 5 },
    { min: NaN, max: 5 },
    { min: 5.5, max: 8 },
    { min: 8, max: 31 },
    { min: 31, max: 31 },
  ];
  for (const repRange of invalid) {
    assert.equal(
      validateExercise({ ...valid(), repRange }).repRange,
      'Reps must be whole numbers from 1 to 30, with min ≤ max.',
      JSON.stringify(repRange),
    );
  }
  assert.equal(validateExercise({ ...valid(), repRange: { min: 8, max: 8 } }).repRange, undefined);
  assert.equal(validateExercise({ ...valid(), repRange: { min: 1, max: 30 } }).repRange, undefined);
  assert.equal(validateExercise({ ...valid(), repRange: { min: 30, max: 30 } }).repRange, undefined);
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

test('goals must be a multiple of 0.5 from 0.5 to 30', () => {
  for (const goal of [0.5, 1, 4.5, 10, 30]) assert.equal(validateGoal(goal), null);
  for (const goal of [0, -1, -0.5, 7.3, 0.25, NaN, Infinity, 30.5, 40]) {
    assert.equal(validateGoal(goal), 'Goal must be a multiple of 0.5 from 0.5 to 30.');
  }
});

test('LIMITS defines the slider limits once', () => {
  assert.deepEqual(LIMITS, {
    sets: { min: 1, max: 10, step: 1 },
    reps: { min: 1, max: 30, step: 1 },
    goal: { min: 0.5, max: 30, step: 0.5 },
  });
  assert.ok(Object.isFrozen(LIMITS));
});
