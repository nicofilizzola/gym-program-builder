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
 * capped at the end of the bar.
 * @param {number} direct
 * @param {number} indirect
 * @param {number} scale the shared scale from barScale
 * @returns {{ direct: number, indirect: number }}
 */
export function barSegments(direct, indirect, scale) {
  const directFill = Math.min(direct / scale, 1);
  return { direct: directFill, indirect: Math.min(indirect / scale, 1 - directFill) };
}

/**
 * Sets that fill a whole bar, shared by every row: the largest goal sits at 75%,
 * growing to fit any larger volume; with no goal, the largest volume sits at 75%.
 * @param {Record<string, number>} volume from computeVolume
 * @param {Partial<Record<string, number>>} goals
 * @returns {number} always > 0; 1 when there is no goal and no volume
 */
export function barScale(volume, goals) {
  const maxVolume = Math.max(...Object.values(volume));
  const goalValues = Object.values(goals);
  if (goalValues.length > 0) return Math.max(Math.max(...goalValues) / 0.75, maxVolume);
  return maxVolume > 0 ? maxVolume / 0.75 : 1;
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
 * @returns {{ status: 'under' | 'met' | 'over' } | null} null when there is no goal
 */
export function goalStatus(volume, goal) {
  if (goal === undefined) return null;
  const status = volume < goal ? 'under' : volume === goal ? 'met' : 'over';
  return { status };
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
