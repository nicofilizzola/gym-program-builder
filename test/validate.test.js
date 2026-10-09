import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateExercise, validateSessionName } from '../src/validate.js';

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
  assert.equal(validateSessionName('  '), 'Name is required.');
  assert.equal(validateSessionName('Push day'), null);
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
