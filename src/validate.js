import { MUSCLE_GROUPS } from './muscles.js';

/** Allowed values for the number sliders; also enforced on import. */
export const LIMITS = Object.freeze({
  sets: Object.freeze({ min: 1, max: 10, step: 1 }),
  reps: Object.freeze({ min: 1, max: 30, step: 1 }),
  goal: Object.freeze({ min: 0.5, max: 30, step: 0.5 }),
});

const inLimits = (n, { min, max }) => n >= min && n <= max;
const isCount = (n, limits) => Number.isInteger(n) && inLimits(n, limits);

/** Goal error text after its subject, shared with the session file messages. */
export const GOAL_RULE = `must be a multiple of 0.5 from ${LIMITS.goal.min} to ${LIMITS.goal.max}.`;

/**
 * @param {string} name
 * @returns {string | null} error message, or null when valid
 */
function requireName(name) {
  return name.trim() ? null : 'Name is required.';
}

/**
 * @param {import('./volume.js').Exercise} ex
 * @returns {{ name?: string, sets?: string, repRange?: string, muscles?: string }}
 *   one message per invalid field; {} when valid
 */
export function validateExercise(ex) {
  const errors = {};
  const nameError = requireName(ex.name);
  if (nameError) errors.name = nameError;

  if (!isCount(ex.sets, LIMITS.sets)) {
    errors.sets = `Sets must be a whole number from ${LIMITS.sets.min} to ${LIMITS.sets.max}.`;
  }

  const { min, max } = ex.repRange;
  if (!isCount(min, LIMITS.reps) || !isCount(max, LIMITS.reps) || min > max) {
    errors.repRange = `Reps must be whole numbers from ${LIMITS.reps.min} to ${LIMITS.reps.max}, with min ≤ max.`;
  }

  if (ex.primaryMuscles.length === 0) {
    errors.muscles = 'Pick at least one primary muscle.';
  } else if (ex.primaryMuscles.some((muscle) => ex.secondaryMuscles.includes(muscle))) {
    errors.muscles = 'A muscle cannot be both primary and secondary.';
  } else if ([...ex.primaryMuscles, ...ex.secondaryMuscles].some((muscle) => !MUSCLE_GROUPS.includes(muscle))) {
    errors.muscles = 'Unknown muscle group.';
  }

  return errors;
}

/**
 * @param {number} goal
 * @returns {string | null} error message, or null when the goal is a multiple of 0.5 within LIMITS.goal
 */
export function validateGoal(goal) {
  return Number.isInteger(goal * 2) && inLimits(goal, LIMITS.goal) ? null : `Goal ${GOAL_RULE}`;
}
