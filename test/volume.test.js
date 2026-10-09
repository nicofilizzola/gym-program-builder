import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MUSCLE_GROUPS } from '../src/muscles.js';
import { barSegments, computeVolume, computeVolumeSplit, goalStatus, visibleMuscles, volumeLevel } from '../src/volume.js';

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
  const result = computeVolume({ exercises: [] });
  for (const muscle of MUSCLE_GROUPS) assert.equal(result[muscle], 0);
});

test('rep range does not affect volume', () => {
  const low = computeVolume({ exercises: [exercise(3, ['Quads'], ['Abs'], { min: 1, max: 1 })] });
  const high = computeVolume({ exercises: [exercise(3, ['Quads'], ['Abs'], { min: 20, max: 30 })] });
  assert.deepEqual(low, high);
});

test('invalid sets contribute 0', () => {
  for (const sets of [NaN, 0, -2, 2.5]) {
    const result = computeVolume({ exercises: [exercise(sets, ['Quads'])] });
    assert.equal(result.Quads, 0, `sets=${sets}`);
  }
});

test('keys follow MUSCLE_GROUPS order', () => {
  const result = computeVolume({ exercises: [exercise(2, ['Calves'], ['Chest'])] });
  assert.deepEqual(Object.keys(result), [...MUSCLE_GROUPS]);
});

test('volumeLevel maps sets to fixed heat bands', () => {
  const cases = [[0, 0], [0.5, 1], [3.5, 1], [4, 2], [6.5, 2], [7, 3], [9.5, 3], [10, 4], [25, 4]];
  for (const [sets, level] of cases) assert.equal(volumeLevel(sets), level, `sets=${sets}`);
});

test('goal worked example from spec', () => {
  assert.deepEqual(goalStatus(7, 7), { status: 'met', progress: 1 });
  assert.deepEqual(goalStatus(5, 4), { status: 'over', progress: 1 });
  assert.deepEqual(goalStatus(3, 6), { status: 'under', progress: 0.5 });
  assert.deepEqual(goalStatus(0, 8), { status: 'under', progress: 0 });
  assert.equal(goalStatus(1.5, undefined), null);
});

test('goal status works on half sets', () => {
  assert.deepEqual(goalStatus(4.5, 4.5), { status: 'met', progress: 1 });
  assert.deepEqual(goalStatus(12.5, 10), { status: 'over', progress: 1 });
  assert.deepEqual(goalStatus(2.5, 10), { status: 'under', progress: 0.25 });
});

const WORKED_EXAMPLE = {
  exercises: [
    exercise(4, ['Chest'], ['Triceps', 'Shoulders']),
    exercise(3, ['Chest', 'Triceps'], ['Shoulders']),
    exercise(3, ['Lats'], ['Biceps', 'Upper back']),
  ],
};

test('computeVolumeSplit worked example from spec', () => {
  assert.deepEqual(computeVolumeSplit(WORKED_EXAMPLE), {
    Chest: { direct: 7, indirect: 0 },
    Lats: { direct: 3, indirect: 0 },
    'Upper back': { direct: 0, indirect: 1.5 },
    Biceps: { direct: 0, indirect: 1.5 },
    Triceps: { direct: 3, indirect: 2 },
    Shoulders: { direct: 0, indirect: 3.5 },
    Abs: { direct: 0, indirect: 0 },
    Quads: { direct: 0, indirect: 0 },
    Hamstrings: { direct: 0, indirect: 0 },
    Calves: { direct: 0, indirect: 0 },
  });
});

test('computeVolumeSplit keys follow MUSCLE_GROUPS order', () => {
  assert.deepEqual(Object.keys(computeVolumeSplit({ exercises: [] })), [...MUSCLE_GROUPS]);
});

test('computeVolumeSplit skips invalid sets', () => {
  for (const sets of [NaN, 0, -2, 2.5]) {
    const { Quads, Abs } = computeVolumeSplit({ exercises: [exercise(sets, ['Quads'], ['Abs'])] });
    assert.deepEqual([Quads, Abs], [{ direct: 0, indirect: 0 }, { direct: 0, indirect: 0 }], `sets=${sets}`);
  }
});

test('computeVolume equals direct + indirect', () => {
  const split = computeVolumeSplit(WORKED_EXAMPLE);
  const volume = computeVolume(WORKED_EXAMPLE);
  for (const muscle of MUSCLE_GROUPS) {
    assert.equal(volume[muscle], split[muscle].direct + split[muscle].indirect, muscle);
  }
});

test('barSegments worked example from spec', () => {
  assert.deepEqual(barSegments(7, 0, 7), { direct: 1, indirect: 0 });       // Chest, goal 7
  assert.deepEqual(barSegments(3, 2, 4), { direct: 0.75, indirect: 0.25 }); // Triceps, goal 4
  assert.deepEqual(barSegments(3, 0, 6), { direct: 0.5, indirect: 0 });     // Lats, goal 6
  assert.deepEqual(barSegments(0, 0, 8), { direct: 0, indirect: 0 });       // Quads, goal 8
  assert.deepEqual(barSegments(0, 3.5, 10), { direct: 0, indirect: 0.35 }); // Shoulders, no goal
  assert.deepEqual(barSegments(0, 1.5, 10), { direct: 0, indirect: 0.15 }); // Biceps, Upper back
});

test('barSegments caps the total at the scale, direct first', () => {
  assert.deepEqual(barSegments(12, 3, 10), { direct: 1, indirect: 0 });
  assert.deepEqual(barSegments(0, 6, 4), { direct: 0, indirect: 1 });
  assert.deepEqual(barSegments(5, 6, 10), { direct: 0.5, indirect: 0.5 }); // indirect cut off
});

test('visibleMuscles worked example from spec, no goals', () => {
  assert.deepEqual(visibleMuscles(computeVolume(WORKED_EXAMPLE), {}),
    ['Chest', 'Lats', 'Upper back', 'Biceps', 'Triceps', 'Shoulders']);
});

test('visibleMuscles worked example from spec, with goals', () => {
  const goals = { Chest: 7, Triceps: 4, Lats: 6, Quads: 8 };
  assert.deepEqual(visibleMuscles(computeVolume(WORKED_EXAMPLE), goals),
    ['Chest', 'Lats', 'Upper back', 'Biceps', 'Triceps', 'Shoulders', 'Quads']);
});

test('visibleMuscles is empty for an empty session with no goals', () => {
  assert.deepEqual(visibleMuscles(computeVolume({ exercises: [] }), {}), []);
});

test('visibleMuscles shows a goal muscle at 0 volume', () => {
  assert.deepEqual(visibleMuscles(computeVolume({ exercises: [] }), { Calves: 6 }), ['Calves']);
});

test('visibleMuscles hides invalid-sets muscles', () => {
  const session = { exercises: [exercise(NaN, ['Chest'], ['Triceps'])] };
  assert.deepEqual(visibleMuscles(computeVolume(session), {}), []);
});

test('visibleMuscles keeps MUSCLE_GROUPS order, not goal-key order', () => {
  assert.deepEqual(visibleMuscles(computeVolume({ exercises: [] }), { Calves: 2, Chest: 3 }), ['Chest', 'Calves']);
});
