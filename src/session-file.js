import { MUSCLE_GROUPS } from './muscles.js';
import { validateExercise, validateGoal } from './validate.js';

/** @typedef {import('./volume.js').Exercise} Exercise */
/** @typedef {{ exercises: Exercise[], goals: Partial<Record<string, number>> }} Session */

const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isStringList = (v) => Array.isArray(v) && v.every((item) => typeof item === 'string');
const inMuscleOrder = (muscles) => MUSCLE_GROUPS.filter((muscle) => muscles.includes(muscle));

/** Copy only the known exercise keys, so nothing extra is written or kept. */
function cleanExercise({ name, sets, repRange, primaryMuscles, secondaryMuscles }) {
  return {
    name,
    sets,
    repRange: { min: repRange.min, max: repRange.max },
    primaryMuscles: inMuscleOrder(primaryMuscles),
    secondaryMuscles: inMuscleOrder(secondaryMuscles),
  };
}

/** Goals with keys in MUSCLE_GROUPS order. */
function cleanGoals(goals) {
  return Object.fromEntries(MUSCLE_GROUPS.filter((muscle) => Object.hasOwn(goals, muscle))
    .map((muscle) => [muscle, goals[muscle]]));
}

/**
 * @param {Session} session
 * @returns {string} the session file as JSON with 2-space indent
 */
export function serializeSession(session) {
  return JSON.stringify({
    version: 1,
    exercises: session.exercises.map(cleanExercise),
    goals: cleanGoals(session.goals),
  }, null, 2);
}

/**
 * @param {unknown} ex
 * @returns {string | null} why the exercise is rejected, or null when valid
 */
function exerciseError(ex) {
  if (!isPlainObject(ex) || typeof ex.name !== 'string' || !isPlainObject(ex.repRange)
    || !isStringList(ex.primaryMuscles) || !isStringList(ex.secondaryMuscles)) {
    return 'invalid format.';
  }
  for (const list of [ex.primaryMuscles, ex.secondaryMuscles]) {
    const unknown = list.find((muscle) => !MUSCLE_GROUPS.includes(muscle));
    if (unknown !== undefined) return `unknown muscle group "${unknown}".`;
    const twice = list.find((muscle, i) => list.indexOf(muscle) !== i);
    if (twice !== undefined) return `"${twice}" is listed twice.`;
  }
  const errors = validateExercise(ex);
  return errors.name ?? errors.sets ?? errors.repRange ?? errors.muscles ?? null;
}

/**
 * Read a session file. The whole file is rejected on the first problem found.
 * @param {string} text
 * @returns {{ session: Session } | { error: string }} never throws
 */
export function parseSession(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    return { error: 'File is not valid JSON.' };
  }
  if (!isPlainObject(data)) return { error: 'File is not a gym session.' };
  if (data.version !== 1) return { error: 'Unsupported file version.' };
  if (!Array.isArray(data.exercises) || !isPlainObject(data.goals)) {
    return { error: 'File is not a gym session.' };
  }

  for (const [i, ex] of data.exercises.entries()) {
    const error = exerciseError(ex);
    if (error) return { error: `Exercise ${i + 1}: ${error}` };
  }
  for (const [muscle, goal] of Object.entries(data.goals)) {
    if (!MUSCLE_GROUPS.includes(muscle)) return { error: `Goal for unknown muscle group "${muscle}".` };
    if (typeof goal !== 'number' || validateGoal(goal)) {
      return { error: `Goal for ${muscle} must be a positive multiple of 0.5.` };
    }
  }

  return { session: { exercises: data.exercises.map(cleanExercise), goals: cleanGoals(data.goals) } };
}

/**
 * @param {Date} [date]
 * @returns {string} `gym-session-YYYY-MM-DD.json` for the local date
 */
export function exportFileName(date = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return `gym-session-${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}.json`;
}
