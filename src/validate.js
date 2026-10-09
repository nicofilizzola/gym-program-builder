import { MUSCLE_GROUPS } from './muscles.js';

const isPositiveInteger = (n) => Number.isInteger(n) && n >= 1;

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

  if (!isPositiveInteger(ex.sets)) {
    errors.sets = 'Sets must be a whole number of at least 1.';
  }

  const { min, max } = ex.repRange;
  if (!isPositiveInteger(min) || !isPositiveInteger(max) || min > max) {
    errors.repRange = 'Reps must be whole numbers of at least 1, with min ≤ max.';
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
