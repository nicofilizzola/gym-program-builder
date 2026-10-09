import { test } from 'node:test';
import assert from 'node:assert/strict';
import { serializeSession, parseSession, exportFileName } from '../src/session-file.js';
import { computeVolume } from '../src/volume.js';

const workedExample = () => ({
  exercises: [
    { name: 'Bench press', sets: 4, repRange: { min: 6, max: 10 }, primaryMuscles: ['Chest'], secondaryMuscles: ['Triceps', 'Shoulders'] },
    { name: 'Dips', sets: 3, repRange: { min: 8, max: 12 }, primaryMuscles: ['Chest', 'Triceps'], secondaryMuscles: ['Shoulders'] },
    { name: 'Pull-ups', sets: 3, repRange: { min: 5, max: 8 }, primaryMuscles: ['Lats'], secondaryMuscles: ['Upper back', 'Biceps'] },
  ],
  goals: { Chest: 7, Triceps: 4, Lats: 6, Quads: 8 },
});
const file = (overrides) => JSON.stringify({ version: 1, ...workedExample(), ...overrides });
const exerciseFile = (patch) => file({ exercises: [{ ...workedExample().exercises[0], ...patch }] });
const errorOf = (text) => parseSession(text).error;

test('round trip keeps the worked example', () => {
  const session = workedExample();
  const parsed = parseSession(serializeSession(session)).session;
  assert.deepEqual(parsed, session);
  assert.deepEqual(computeVolume(parsed), {
    Chest: 7, Lats: 3, 'Upper back': 1.5, Biceps: 1.5, Triceps: 5,
    Shoulders: 3.5, Abs: 0, Quads: 0, Hamstrings: 0, Calves: 0,
  });
});

test('round trip keeps half-set goals and an empty session', () => {
  for (const session of [{ exercises: [], goals: { Calves: 4.5 } }, { exercises: [], goals: {} }]) {
    assert.deepEqual(parseSession(serializeSession(session)).session, session);
  }
});

test('serialize writes version 1, 2-space indent, no extra keys', () => {
  const ex = workedExample().exercises[0];
  const session = { exercises: [{ ...ex, id: 1, repRange: { ...ex.repRange, extra: true } }], goals: { Chest: 7 } };
  assert.equal(serializeSession(session), JSON.stringify({ version: 1, exercises: [ex], goals: { Chest: 7 } }, null, 2));
});

test('serialize writes goals in MUSCLE_GROUPS order', () => {
  const text = serializeSession({ exercises: [], goals: { Quads: 8, Chest: 7 } });
  assert.deepEqual(Object.keys(JSON.parse(text).goals), ['Chest', 'Quads']);
});

test('parse ignores unknown keys', () => {
  const app = parseSession(file({ app: 'x' }));
  assert.equal(app.error, undefined);
  assert.equal('app' in app.session, false);
  const notes = parseSession(exerciseFile({ notes: 'hi' }));
  assert.equal(notes.error, undefined);
  assert.equal('notes' in notes.session.exercises[0], false);
});

test('parse normalizes muscle order', () => {
  const { session } = parseSession(exerciseFile({ secondaryMuscles: ['Shoulders', 'Triceps'] }));
  assert.deepEqual(session.exercises[0].secondaryMuscles, ['Triceps', 'Shoulders']);
});

test('rejects invalid JSON', () => {
  for (const text of ['', '{']) {
    assert.deepEqual(parseSession(text), { error: 'File is not valid JSON.' });
  }
});

test('rejects non-session top level', () => {
  for (const text of ['null', '[]', '"text"', file({ exercises: {} }), file({ goals: [] })]) {
    assert.equal(errorOf(text), 'File is not a gym session.', text);
  }
  assert.equal(errorOf('{}'), 'Unsupported file version.');
});

test('rejects other versions', () => {
  for (const version of [2, '1', undefined]) {
    assert.equal(errorOf(file({ version })), 'Unsupported file version.', `version=${version}`);
  }
});

test('rejects wrong types without throwing', () => {
  const texts = [
    exerciseFile({ name: null }),
    exerciseFile({ primaryMuscles: 'Chest' }),
    exerciseFile({ primaryMuscles: [1] }),
    exerciseFile({ repRange: [6, 10] }),
    file({ exercises: [null] }),
  ];
  for (const text of texts) {
    assert.equal(errorOf(text), 'Exercise 1: invalid format.', text);
  }
  assert.equal(errorOf(exerciseFile({ sets: '4' })), 'Exercise 1: Sets must be a whole number of at least 1.');
});

test('rejects unknown muscle', () => {
  const ex0 = workedExample().exercises[0];
  const text = file({ exercises: [ex0, { ...ex0, secondaryMuscles: ['Glutes'] }] });
  assert.equal(errorOf(text), 'Exercise 2: unknown muscle group "Glutes".');
});

test('rejects duplicate muscles', () => {
  assert.equal(errorOf(exerciseFile({ primaryMuscles: ['Chest', 'Chest'] })), 'Exercise 1: "Chest" is listed twice.');
});

test('rejects exercises the form would reject', () => {
  assert.equal(errorOf(exerciseFile({ name: '  ' })), 'Exercise 1: Name is required.');
  assert.equal(
    errorOf(exerciseFile({ repRange: { min: 10, max: 8 } })),
    'Exercise 1: Reps must be whole numbers of at least 1, with min ≤ max.',
  );
  assert.equal(errorOf(exerciseFile({ primaryMuscles: [] })), 'Exercise 1: Pick at least one primary muscle.');
  assert.equal(
    errorOf(exerciseFile({ primaryMuscles: ['Chest'], secondaryMuscles: ['Chest'] })),
    'Exercise 1: A muscle cannot be both primary and secondary.',
  );
});

test('rejects bad goals', () => {
  assert.equal(errorOf(file({ goals: { Glutes: 5 } })), 'Goal for unknown muscle group "Glutes".');
  for (const value of [0, 7.3, '7', null]) {
    assert.equal(
      errorOf(file({ goals: { Chest: value } })),
      'Goal for Chest must be a positive multiple of 0.5.',
      `goal=${value}`,
    );
  }
});

test('export file name uses local date', () => {
  assert.equal(exportFileName(new Date(2026, 0, 5)), 'gym-session-2026-01-05.json');
});
