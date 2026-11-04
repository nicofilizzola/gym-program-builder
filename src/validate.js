import { MUSCLE_GROUPS } from './muscles.js';
import { DURATION_LIMITS } from './duration.js';

export function timingError(value,key) {
  const {min,max,step}=DURATION_LIMITS[key];
  const label={restSeconds:'Rest per set',extraMinutes:'Extra time',bufferPercent:'Buffer',restBetweenSeconds:'Rest between exercises',restAfterRoundSeconds:'Rest after round'}[key];
  return Number.isInteger(value)&&value>=min&&value<=max&&value%step===0?null:
    label+' must be a whole number from '+min+' to '+max+' in steps of '+step+'.';
}

/** Allowed values for the number sliders; also enforced on import. */
export const LIMITS = Object.freeze({
  sets: Object.freeze({ min: 1, max: 10, step: 1 }),
  reps: Object.freeze({ min: 1, max: 30, step: 1 }),
  goal: Object.freeze({ min: 0.5, max: 12, step: 0.5 }),
  weeklyGoal: Object.freeze({ min: 0.5, max: 30, step: 0.5 }),
  warmupSets: Object.freeze({ min: 0, max: 5, step: 1 }),
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
  if(Object.hasOwn(ex,'restSeconds')) {
    const error=timingError(ex.restSeconds,'restSeconds');
    if(error) errors.restSeconds=error;
  }

  if (Object.hasOwn(ex, 'warmupSets') && !isCount(ex.warmupSets, LIMITS.warmupSets)) {
    errors.warmupSets = `Warm-up sets must be a whole number from ${LIMITS.warmupSets.min} to ${LIMITS.warmupSets.max}.`;
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

/** A superset is two consecutive exercises, marked on the first only. */
export function supersetError(exercises) {
  return supersetIssue(exercises)?.message ?? null;
}

/** Like supersetError, but also returns the 0-based index of the offending exercise. */
export function supersetIssue(exercises) {
  for (let i = 0; i < exercises.length; i++) {
    const s = exercises[i]?.superset;
    if (s === undefined) continue;
    const keys = s && typeof s === 'object' ? Object.keys(s) : [];
    if (keys.length !== 2 || !('restBetweenSeconds' in s) || !('restAfterRoundSeconds' in s)
      || i + 1 >= exercises.length || exercises[i + 1]?.superset !== undefined || (i > 0 && exercises[i - 1]?.superset !== undefined)) {
      return { index: i, message: `Exercise ${i + 1}: Invalid superset.` };
    }
    const error = timingError(s.restBetweenSeconds, 'restBetweenSeconds') || timingError(s.restAfterRoundSeconds, 'restAfterRoundSeconds');
    if (error) return { index: i, message: `Exercise ${i + 1}: ${error}` };
  }
  return null;
}

/**
 * @param {number} goal
 * @returns {string | null} error message, or null when the goal is a multiple of 0.5 within LIMITS.goal
 */
export function validateGoal(goal) {
  return Number.isInteger(goal * 2) && inLimits(goal, LIMITS.goal) ? null : `Goal ${GOAL_RULE}`;
}

export function validateGoalFor(goal, limits) {
  return Number.isInteger(goal * 2) && inLimits(goal, limits) ? null : `Goal must be a multiple of 0.5 from ${limits.min} to ${limits.max}.`;
}
