import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LIMITS, validateExercise, validateGoal, supersetError } from '../src/validate.js';

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
  const errors = validateExercise({ ...valid(), primaryMuscles: ['Forearms'] });
  assert.equal(errors.muscles, 'Unknown muscle group.');
});

test('validate.js no longer exports validateSessionName', async () => {
  const mod = await import('../src/validate.js');
  assert.equal('validateSessionName' in mod, false);
});

test('goals must be a multiple of 0.5 from 0.5 to 12', () => {
  for (const goal of [0.5, 1, 4.5, 10, 12]) assert.equal(validateGoal(goal), null);
  for (const goal of [0, -1, -0.5, 7.3, 0.25, NaN, Infinity, 12.5, 30, 30.5, 40]) {
    assert.equal(validateGoal(goal), 'Goal must be a multiple of 0.5 from 0.5 to 12.');
  }
});

test('LIMITS defines the slider limits once', () => {
  assert.deepEqual(LIMITS, {
    sets: { min: 1, max: 10, step: 1 },
    reps: { min: 1, max: 30, step: 1 },
    goal: { min: 0.5, max: 12, step: 0.5 },
    weeklyGoal: { min: 0.5, max: 30, step: 0.5 },
    warmupSets: { min: 0, max: 5, step: 1 },
  });
  assert.ok(Object.isFrozen(LIMITS));
});

test('warm-up sets validate 0-5 whole numbers',()=>{
  for(const n of [0,5])assert.equal(validateExercise({...valid(),warmupSets:n}).warmupSets,undefined);
  for(const n of [-1,6,1.5,'2'])assert.equal(validateExercise({...valid(),warmupSets:n}).warmupSets,'Warm-up sets must be a whole number from 0 to 5.');
});
test('superset invariant: exactly two consecutive members, rests in limits',()=>{
  const v=valid(),pair={restBetweenSeconds:30,restAfterRoundSeconds:120};
  assert.equal(supersetError([{...v,superset:pair},v]),null);
  assert.equal(supersetError([v,{...v,superset:pair}]),'Exercise 2: Invalid superset.');
  assert.equal(supersetError([{...v,superset:pair},{...v,superset:pair},v]),'Exercise 1: Invalid superset.');
  assert.equal(supersetError([{...v,superset:{restBetweenSeconds:20,restAfterRoundSeconds:120}},v]),'Exercise 1: Rest between exercises must be a whole number from 0 to 120 in steps of 15.');
  assert.equal(supersetError([{...v,superset:{restBetweenSeconds:30,restAfterRoundSeconds:315}},v]),'Exercise 1: Rest after round must be a whole number from 0 to 300 in steps of 15.');
  assert.equal(supersetError([{...v,superset:{restBetweenSeconds:30}},v]),'Exercise 1: Invalid superset.');
});
