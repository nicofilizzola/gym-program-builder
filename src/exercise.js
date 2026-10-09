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

/**
 * Move one exercise to a new position. `to` is clamped to the list bounds;
 * an out-of-range `from` leaves the order unchanged.
 * Also used for any list kept in session order, such as collapsed flags.
 * @template T
 * @param {T[]} exercises
 * @param {number} from
 * @param {number} to
 * @returns {T[]} a new array with the same items; `exercises` is not mutated
 */
export function moveExercise(exercises, from, to) {
  const result = [...exercises];
  if (from < 0 || from >= result.length) return result;
  const [moved] = result.splice(from, 1);
  result.splice(Math.min(Math.max(to, 0), result.length), 0, moved);
  return result;
}

/** A sets or reps value as typed, or `?` unless it is a whole number of at least 1. */
const countText = (n) => (Number.isInteger(n) && n >= 1 ? String(n) : '?');

/**
 * One-line summary for a collapsed card, e.g. `Bench press · 4 × 6–10 · Chest · secondary: Triceps, Shoulders`.
 * @param {import('./volume.js').Exercise} ex
 * @returns {string}
 */
export function exerciseSummary(ex) {
  const { min, max } = ex.repRange;
  const reps = min === max ? countText(min) : `${countText(min)}–${countText(max)}`;
  return [
    ex.name.trim() || 'Untitled exercise',
    `${countText(ex.sets)} × ${reps}`,
    ex.primaryMuscles.join(', '),
    ex.secondaryMuscles.length > 0 ? `secondary: ${ex.secondaryMuscles.join(', ')}` : '',
  ].filter(Boolean).join(' · ');
}
