import test from 'node:test';
import assert from 'node:assert/strict';
import {
  pairRole, canPairWithNext, pairWithNext, unpair, swapPair, removeExercise, supersetBlocks, moveBlockOrder,
} from '../src/superset.js';
import { supersetError } from '../src/validate.js';

const ex = (name, restSeconds = 120) => ({ name, sets: 3, restSeconds, warmupSets: 0, repRange: { min: 8, max: 12 }, primaryMuscles: ['Chest'], secondaryMuscles: [] });

test('pairing defaults and guards', () => {
  const list = [ex('A', 180), ex('B', 90), ex('C')];
  const paired = pairWithNext(list, 0);
  assert.deepEqual(paired[0].superset, { restBetweenSeconds: 30, restAfterRoundSeconds: 180 });
  assert.equal(list[0].superset, undefined);
  assert.equal(canPairWithNext(paired, 1), false); assert.equal(canPairWithNext(paired, 2), false);
  assert.throws(() => pairWithNext(paired, 1));
  assert.deepEqual([0, 1, 2].map(i => pairRole(paired, i)), ['first', 'second', null]);
});
test('unpair, swap and remove keep the invariant', () => {
  const paired = pairWithNext([ex('A'), ex('B'), ex('C')], 0);
  assert.equal(unpair(paired, 1)[0].superset, undefined);
  const swapped = swapPair(paired, 1);
  assert.deepEqual(swapped.map(e => e.name), ['B', 'A', 'C']); assert.ok(swapped[0].superset); assert.equal(swapped[1].superset, undefined);
  assert.deepEqual(removeExercise(paired, 1).map(e => [e.name, Boolean(e.superset)]), [['A', false], ['C', false]]);
  assert.deepEqual(removeExercise(paired, 0).map(e => [e.name, Boolean(e.superset)]), [['B', false], ['C', false]]);
  assert.equal(supersetError(removeExercise(paired, 1)), null);
});
test('blocks move as units and never split a pair', () => {
  const list = pairWithNext([ex('A'), ex('B'), ex('C'), ex('D')], 1); // [A][B+C][D]
  assert.deepEqual(supersetBlocks(list), [{ start: 0, length: 1 }, { start: 1, length: 2 }, { start: 3, length: 1 }]);
  assert.deepEqual(moveBlockOrder(list, 1, 0), [1, 2, 0, 3]);
  assert.deepEqual(moveBlockOrder(list, 0, 2), [1, 2, 3, 0]);
  assert.deepEqual(moveBlockOrder(list, 2, 1), [0, 3, 1, 2]);
  const moved = moveBlockOrder(list, 0, 2).map(i => list[i]); assert.equal(supersetError(moved), null);
});
test('helpers tolerate missing fields and out-of-range input without mutating', () => {
  const bare = [{ name: 'A' }, { name: 'B' }];
  const paired = pairWithNext(bare, 0);
  assert.equal(paired[0].superset.restAfterRoundSeconds, 120);
  assert.equal(bare[0].superset, undefined);
  assert.equal(canPairWithNext(bare, 1), false);
  assert.equal(pairRole(bare, 5), null);
  assert.deepEqual(moveBlockOrder(bare, 9, 0), [0, 1]);
  assert.deepEqual(moveBlockOrder(bare, 0, 9), [1, 0]);
  assert.deepEqual(swapPair(bare, 0).map(e => e.name), ['A', 'B']);
});
