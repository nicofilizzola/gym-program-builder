import { MUSCLE_GROUPS } from './muscles.js';

/** @returns {import('./volume.js').Exercise} a new exercise with default values */
export function createExercise() {
  return {
    name: '',
    sets: 3,
    repRange: { min: 8, max: 12 },
    primaryMuscles: [],
    secondaryMuscles: [],
  };
}

/**
 * Toggle a muscle in one role. Adding it removes it from the other role,
 * so a muscle is never both primary and secondary. Lists keep MUSCLE_GROUPS order.
 * @param {import('./volume.js').Exercise} ex
 * @param {'primary' | 'secondary'} role
 * @param {string} muscle
 * @returns {import('./volume.js').Exercise} a new exercise; `ex` is not mutated
 */
export function toggleMuscle(ex, role, muscle) {
  const key = role === 'primary' ? 'primaryMuscles' : 'secondaryMuscles';
  const otherKey = role === 'primary' ? 'secondaryMuscles' : 'primaryMuscles';
  const selected = new Set(ex[key]);
  const other = new Set(ex[otherKey]);
  if (selected.has(muscle)) {
    selected.delete(muscle);
  } else {
    selected.add(muscle);
    other.delete(muscle);
  }
  return {
    ...ex,
    [key]: MUSCLE_GROUPS.filter((m) => selected.has(m)),
    [otherKey]: MUSCLE_GROUPS.filter((m) => other.has(m)),
  };
}
