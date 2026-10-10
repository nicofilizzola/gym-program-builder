import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MUSCLE_GROUPS } from '../src/muscles.js';
import { barScale, barSegments, bodyMapTone, computeVolume, computeVolumeSplit, goalStatus, visibleMuscles } from '../src/volume.js';

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

test('goal worked example from spec', () => {
  assert.deepEqual(goalStatus(7, 7), { status: 'met' });
  assert.deepEqual(goalStatus(5, 4), { status: 'over' });
  assert.deepEqual(goalStatus(3, 6), { status: 'under' });
  assert.deepEqual(goalStatus(0, 8), { status: 'under' });
  assert.equal(goalStatus(1.5, undefined), null);
});

test('goal status works on half sets', () => {
  assert.deepEqual(goalStatus(4.5, 4.5), { status: 'met' });
  assert.deepEqual(goalStatus(12.5, 10), { status: 'over' });
  assert.deepEqual(goalStatus(2.5, 10), { status: 'under' });
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

const GOALS = { Chest: 7, Triceps: 4, Lats: 6, Quads: 8 };

test('bodyMapTone worked example from spec', () => {
  const volume = computeVolume(WORKED_EXAMPLE);
  const tones = (goals) => Object.fromEntries(MUSCLE_GROUPS.map((m) => [m, bodyMapTone(volume[m], goals[m])]));
  assert.deepEqual(tones(GOALS), {
    Chest: 'met', Lats: 'under', 'Upper back': 'trained', Biceps: 'trained', Triceps: 'over',
    Shoulders: 'trained', Abs: 'untrained', Quads: 'under', Hamstrings: 'untrained', Calves: 'untrained',
  });
  assert.deepEqual(tones({}), {
    Chest: 'trained', Lats: 'trained', 'Upper back': 'trained', Biceps: 'trained', Triceps: 'trained',
    Shoulders: 'trained', Abs: 'untrained', Quads: 'untrained', Hamstrings: 'untrained', Calves: 'untrained',
  });
});

test('bodyMapTone: a goal at 0 volume is under, not untrained', () => {
  assert.equal(bodyMapTone(0, 6), 'under');
  assert.equal(bodyMapTone(0, undefined), 'untrained');
  assert.equal(bodyMapTone(0.5, undefined), 'trained');
});

test('volume.js no longer exports the heat scale', async () => {
  const mod = await import('../src/volume.js');
  assert.equal('volumeLevel' in mod, false);
});
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} ≈ ${expected}`);

test('barScale worked example from spec', () => {
  const volume = computeVolume(WORKED_EXAMPLE);
  const split = computeVolumeSplit(WORKED_EXAMPLE);
  const scale = barScale(volume, GOALS);
  close(scale, 32 / 3);
  close(barSegments(split.Chest.direct, split.Chest.indirect, scale).direct, 0.65625);
  const triceps = barSegments(split.Triceps.direct, split.Triceps.indirect, scale);
  close(triceps.direct, 0.28125);
  close(triceps.indirect, 0.1875);
  close(barSegments(split.Shoulders.direct, split.Shoulders.indirect, scale).indirect, 0.328125);
  close(barSegments(split.Biceps.direct, split.Biceps.indirect, scale).indirect, 0.140625);
  close(GOALS.Chest / scale, 0.65625); // markers
  close(GOALS.Triceps / scale, 0.375);
  close(GOALS.Lats / scale, 0.5625);
  close(GOALS.Quads / scale, 0.75);
});

test('barScale with no goals puts the largest volume at 75%', () => {
  close(barScale(computeVolume(WORKED_EXAMPLE), {}), 28 / 3);
});

test('barScale grows to fit a volume past the largest goal', () => {
  const scale = barScale(computeVolume(WORKED_EXAMPLE), { Chest: 4 });
  assert.equal(scale, 7);
  close(4 / scale, 4 / 7);
});

test('barScale follows the remaining goals when the largest is cleared', () => {
  const volume = computeVolume(WORKED_EXAMPLE);
  close(barScale(volume, GOALS), 32 / 3);
  close(barScale(volume, { Chest: 7, Triceps: 4, Lats: 6 }), 28 / 3);
});

test('barScale on an empty session', () => {
  const volume = computeVolume({ exercises: [] });
  assert.equal(barScale(volume, { Calves: 6 }), 8);
  assert.equal(barScale(volume, {}), 1);
});

test('barScale ignores exercises with invalid sets', () => {
  const volume = computeVolume({ exercises: [exercise(NaN, ['Quads']), exercise(0, ['Abs'])] });
  assert.equal(barScale(volume, {}), 1);
  assert.equal(barScale(volume, { Calves: 6 }), 8);
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
