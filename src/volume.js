import { MUSCLE_GROUPS } from './muscles.js';

/**
 * @typedef {{ name: string, sets: number, repRange: { min: number, max: number },
 *             primaryMuscles: string[], secondaryMuscles: string[] }} Exercise
 * @typedef {{ exercises: Exercise[] }} Session
 */

/**
 * Set volume per muscle group, split by source: direct = sets where the muscle is primary,
 * indirect = sets × 0.5 where it is secondary. Exercises whose sets are not an integer >= 1 contribute nothing.
 * @param {Session} session
 * @returns {Record<string, { direct: number, indirect: number }>} one key per MUSCLE_GROUPS entry, in order
 */
export function computeVolumeSplit(session) {
  const split = Object.fromEntries(MUSCLE_GROUPS.map((muscle) => [muscle, { direct: 0, indirect: 0 }]));
  for (const { sets, primaryMuscles, secondaryMuscles } of session.exercises) {
    if (!Number.isInteger(sets) || sets < 1) continue;
    for (const muscle of primaryMuscles) split[muscle].direct += sets;
    for (const muscle of secondaryMuscles) split[muscle].indirect += sets * 0.5;
  }
  return split;
}

/**
 * Set volume per muscle group: direct + indirect from computeVolumeSplit.
 * @param {Session} session
 * @returns {Record<string, number>} one key per MUSCLE_GROUPS entry, in order
 */
export function computeVolume(session) {
  return Object.fromEntries(Object.entries(computeVolumeSplit(session))
    .map(([muscle, { direct, indirect }]) => [muscle, direct + indirect]));
}

/**
 * Widths (0 to 1) of the bar's two segments on a shared scale, filled direct first;
 * indirect is cut off at the end of the bar.
 * @param {number} direct
 * @param {number} indirect
 * @param {number} scale the goal, or 10 when there is no goal
 * @returns {{ direct: number, indirect: number }}
 */
export function barSegments(direct, indirect, scale) {
  const directFill = Math.min(direct / scale, 1);
  return { direct: directFill, indirect: Math.min(indirect / scale, 1 - directFill) };
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

/**
 * How a muscle's volume compares to its goal. Volume and goal are multiples of 0.5, so `===` is exact.
 * @param {number} volume
 * @param {number | undefined} goal
 * @returns {{ status: 'under' | 'met' | 'over', progress: number } | null}
 *   progress is volume ÷ goal capped at 1; null when there is no goal
 */
export function goalStatus(volume, goal) {
  if (goal === undefined) return null;
  const status = volume < goal ? 'under' : volume === goal ? 'met' : 'over';
  return { status, progress: Math.min(volume / goal, 1) };
}

/**
 * Muscles the volume list shows: those with a goal, or with volume above 0.
 * @param {Record<string, number>} volume from computeVolume
 * @param {Partial<Record<string, number>>} goals
 * @returns {string[]} in MUSCLE_GROUPS order
 */
export function visibleMuscles(volume, goals) {
  return MUSCLE_GROUPS.filter((muscle) => goals[muscle] !== undefined || volume[muscle] > 0);
}
