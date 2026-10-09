import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MUSCLE_GROUPS } from '../src/muscles.js';
import { computeVolume, volumeLevel } from '../src/volume.js';

function exercise(sets, primaryMuscles, secondaryMuscles = [], repRange = { min: 8, max: 12 }) {
  return { name: 'Exercise', sets, repRange, primaryMuscles, secondaryMuscles };
}

test('MUSCLE_GROUPS has the 10 spec values in order', () => {
  assert.deepEqual([...MUSCLE_GROUPS], [
    'Chest', 'Lats', 'Upper back', 'Biceps', 'Triceps',
    'Shoulders', 'Abs', 'Quads', 'Hamstrings', 'Calves',
  ]);
  assert.ok(Object.isFrozen(MUSCLE_GROUPS));
});

test('worked example from spec', () => {
  const session = {
    name: 'Push/pull',
    exercises: [
      exercise(4, ['Chest'], ['Triceps', 'Shoulders']),
      exercise(3, ['Chest', 'Triceps'], ['Shoulders']),
      exercise(3, ['Lats'], ['Biceps', 'Upper back']),
    ],
  };
  assert.deepEqual(computeVolume(session), {
    Chest: 7, Lats: 3, 'Upper back': 1.5, Biceps: 1.5, Triceps: 5,
    Shoulders: 3.5, Abs: 0, Quads: 0, Hamstrings: 0, Calves: 0,
  });
});

test('empty session gives all zeros', () => {
  const result = computeVolume({ name: 'x', exercises: [] });
  for (const muscle of MUSCLE_GROUPS) assert.equal(result[muscle], 0);
});

test('rep range does not affect volume', () => {
  const low = computeVolume({ name: 'x', exercises: [exercise(3, ['Quads'], ['Abs'], { min: 1, max: 1 })] });
  const high = computeVolume({ name: 'x', exercises: [exercise(3, ['Quads'], ['Abs'], { min: 20, max: 30 })] });
  assert.deepEqual(low, high);
});

test('invalid sets contribute 0', () => {
  for (const sets of [NaN, 0, -2, 2.5]) {
    const result = computeVolume({ name: 'x', exercises: [exercise(sets, ['Quads'])] });
    assert.equal(result.Quads, 0, `sets=${sets}`);
  }
});

test('keys follow MUSCLE_GROUPS order', () => {
  const result = computeVolume({ name: 'x', exercises: [exercise(2, ['Calves'], ['Chest'])] });
  assert.deepEqual(Object.keys(result), [...MUSCLE_GROUPS]);
});

test('volumeLevel maps sets to fixed heat bands', () => {
  const cases = [[0, 0], [0.5, 1], [3.5, 1], [4, 2], [6.5, 2], [7, 3], [9.5, 3], [10, 4], [25, 4]];
  for (const [sets, level] of cases) assert.equal(volumeLevel(sets), level, `sets=${sets}`);
});
