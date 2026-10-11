import test from 'node:test';
import assert from 'node:assert/strict';
import { tooltipPosition } from '../src/tooltip.js';

const tip = { width: 280, height: 120 };
const vp = { width: 1200, height: 1000 };

test('sits below the button, right edges aligned', () => {
  assert.deepEqual(tooltipPosition({ top: 100, right: 400, bottom: 128 }, tip, vp),
    { top: 134, left: 120, placement: 'below' });
});

test('flips above when there is no room below', () => {
  assert.deepEqual(tooltipPosition({ top: 900, right: 400, bottom: 928 }, tip, vp),
    { top: 774, left: 120, placement: 'above' });
});

test('keeps the left edge inside the window', () => {
  assert.equal(tooltipPosition({ top: 100, right: 200, bottom: 128 }, tip, { width: 360, height: 740 }).left, 8);
});

test('keeps the right edge inside the window', () => {
  assert.equal(tooltipPosition({ top: 100, right: 400, bottom: 128 }, tip, { width: 360, height: 740 }).left, 72);
});

test('neither side fits: takes the roomier side, clamped inside the window', () => {
  // Room below 78 px, room above 66 px, so below; top is clamped to 200 − 8 − 150.
  assert.deepEqual(tooltipPosition({ top: 80, right: 300, bottom: 108 }, { width: 280, height: 150 }, { width: 360, height: 200 }),
    { top: 42, left: 20, placement: 'below' });
});
