import { defaultRestSeconds } from './duration.js';

// A superset is stored as `superset` on the first of exactly two consecutive exercises.
// All helpers are pure: they never mutate their input and tolerate exercises lacking optional fields.

const rest = exercise => (Number.isFinite(exercise?.restSeconds) ? exercise.restSeconds : defaultRestSeconds());

function withoutSuperset(exercise) {
  const { superset, ...others } = exercise;
  return others;
}

/** @returns {null|'first'|'second'} the exercise's role in a superset pair */
export function pairRole(exercises, i) {
  if (exercises[i]?.superset) return 'first';
  if (i > 0 && exercises[i - 1]?.superset) return 'second';
  return null;
}

/** @returns {boolean} whether exercises i and i+1 both exist and are unpaired */
export function canPairWithNext(exercises, i) {
  return Number.isInteger(i) && i >= 0 && i + 1 < exercises.length
    && pairRole(exercises, i) === null && pairRole(exercises, i + 1) === null;
}

/** @returns a copy where exercise i is paired with the next one (default rests) */
export function pairWithNext(exercises, i) {
  if (!canPairWithNext(exercises, i)) throw new Error('These exercises cannot be paired.');
  return exercises.map((exercise, index) => (index === i
    ? { ...exercise, superset: { restBetweenSeconds: 30, restAfterRoundSeconds: Math.max(rest(exercise), rest(exercises[i + 1])) } }
    : exercise));
}

/** @returns a copy without the pair that contains exercise i (either member) */
export function unpair(exercises, i) {
  const first = pairRole(exercises, i) === 'second' ? i - 1 : i;
  if (!exercises[first]?.superset) return exercises.slice();
  return exercises.map((exercise, index) => (index === first ? withoutSuperset(exercise) : exercise));
}

/** @returns a copy where the pair's members swap places and the pair settings move to the new first */
export function swapPair(exercises, i) {
  const role = pairRole(exercises, i);
  if (!role) return exercises.slice();
  const first = role === 'second' ? i - 1 : i;
  const copy = exercises.slice();
  copy[first] = { ...exercises[first + 1], superset: exercises[first].superset };
  copy[first + 1] = withoutSuperset(exercises[first]);
  return copy;
}

/** @returns a copy without exercise i; removing a pair member dissolves the pair */
export function removeExercise(exercises, i) {
  const dissolved = pairRole(exercises, i) ? unpair(exercises, i) : exercises;
  return dissolved.filter((_, index) => index !== i);
}

/** @returns {Array<{start:number,length:1|2}>} the list as single exercises and pairs, in order */
export function supersetBlocks(exercises) {
  const blocks = [];
  for (let i = 0; i < exercises.length;) {
    const length = exercises[i]?.superset && i + 1 < exercises.length ? 2 : 1;
    blocks.push({ start: i, length });
    i += length;
  }
  return blocks;
}

/**
 * Moves one block to a new block position and returns the permutation of exercise indexes.
 * Apply as `order.map(i => list[i])` to the exercises and to any view-state array.
 */
export function moveBlockOrder(exercises, fromBlock, toBlock) {
  const blocks = supersetBlocks(exercises);
  const identity = exercises.map((_, index) => index);
  if (!Number.isInteger(fromBlock) || fromBlock < 0 || fromBlock >= blocks.length) return identity;
  const target = Math.min(Math.max(Number.isInteger(toBlock) ? toBlock : fromBlock, 0), blocks.length - 1);
  const order = blocks.slice();
  const [moved] = order.splice(fromBlock, 1);
  order.splice(target, 0, moved);
  return order.flatMap(({ start, length }) => (length === 2 ? [start, start + 1] : [start]));
}
