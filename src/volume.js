import { MUSCLE_GROUPS } from './muscles.js';

/**
 * @typedef {{ name: string, sets: number, repRange: { min: number, max: number },
 *             primaryMuscles: string[], secondaryMuscles: string[] }} Exercise
 * @typedef {{ name: string, exercises: Exercise[] }} Session
 */

/**
 * Set volume per muscle group: sets × 1 for primary, sets × 0.5 for secondary.
 * Exercises whose sets are not an integer >= 1 contribute nothing.
 * @param {Session} session
 * @returns {Record<string, number>} one key per MUSCLE_GROUPS entry, in order
 */
export function computeVolume(session) {
  const volume = Object.fromEntries(MUSCLE_GROUPS.map((muscle) => [muscle, 0]));
  for (const { sets, primaryMuscles, secondaryMuscles } of session.exercises) {
    if (!Number.isInteger(sets) || sets < 1) continue;
    for (const muscle of primaryMuscles) volume[muscle] += sets;
    for (const muscle of secondaryMuscles) volume[muscle] += sets * 0.5;
  }
  return volume;
}

/** Upper bounds (exclusive) of heat levels 1–3; 10+ sets is level 4. */
const LEVEL_LIMITS = [4, 7, 10];

/**
 * Heat level for the body map, on fixed bands so colours mean the same in every session:
 * 0 = untrained, 1 = under 4 sets, 2 = 4–6.5, 3 = 7–9.5, 4 = 10+.
 * @param {number} sets
 * @returns {0 | 1 | 2 | 3 | 4}
 */
export function volumeLevel(sets) {
  if (sets <= 0) return 0;
  const i = LEVEL_LIMITS.findIndex((limit) => sets < limit);
  return i === -1 ? 4 : i + 1;
}
