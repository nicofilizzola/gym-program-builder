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
