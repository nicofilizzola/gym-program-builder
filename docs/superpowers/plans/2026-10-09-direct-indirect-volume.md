# Direct and Indirect Volume Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split each muscle's bar in the volume list into a direct segment (primary work) followed by an indirect segment (secondary work, half sets), and show the split as text in the readout and for screen readers.

**Architecture:** Two new pure, unit-tested functions in `src/volume.js` hold the rules: `computeVolumeSplit(session)` and `barSegments(direct, indirect, scale)`. `computeVolume` is rewritten on top of `computeVolumeSplit`, so its behaviour and its callers (body map, goal status) stay unchanged. `refresh()` in `src/app.js` derives the split on every render and drives two bar segments, the readout and a visually hidden text per row. The bar stops using heat colours; the body map keeps them.

**Tech Stack:** HTML, CSS, vanilla JS ES modules, `node:test` on Node 22. No dependencies, no build step.

**Spec:** `AGENTS.md`: functional requirements 7 and 10, the "Direct and indirect volume (business rule)" section and its worked example, the implementation guidelines, and the "Direct and indirect volume" entry under "Decided".

## Global Constraints

- No runtime or dev dependencies; no build step.
- `direct = Σ sets` where the muscle is primary; `indirect = Σ sets × 0.5` where it is secondary; `volume = direct + indirect`. Exercises whose sets are not an integer ≥ 1 contribute nothing (current `computeVolume` behaviour).
- `scale = goal, or 10 when no goal`; `directFill = min(direct / scale, 1)`; `indirectFill = min(indirect / scale, 1 − directFill)`.
- Goal status still compares the **total** volume with the goal. `goalStatus` is not changed.
- Numbers are shown as-is (`1.5`), never rounded.
- Readout copy, exact: `Triceps 5 sets (3 direct · 2 indirect) · 2 exercises`, and with a goal `Triceps 5 / 4 sets (3 direct · 2 indirect) · over · 2 exercises`. Both parts are always named, even when one is 0.
- Each row still shows a single number (total, or `total / goal`).
- Design system (`docs/design-system/README.md`): one accent colour, colour never stands alone, `prefers-reduced-motion` turns transitions off. The body map keeps its absolute heat colours.
- Split and fills are derived on render and never stored on `session`.

## Review Focus

1. **Sets field empty or invalid while typing** (`''`, `0`, `2.5`): that exercise adds nothing to either segment, and the readout and hidden text never show `NaN`. → Task 1 test `computeVolumeSplit skips invalid sets`; Task 2 Step 3 manual check.
2. **Indirect alone exceeding the scale** (indirect 6, goal 4): the bar is fully indirect (`{ direct: 0, indirect: 1 }`), not overflowing. → Task 1 test `barSegments caps the total at the scale`.
3. **Direct alone exceeding the scale with indirect present** (direct 12, indirect 3, no goal): the bar is all direct (`{ direct: 1, indirect: 0 }`). → Task 1 test `barSegments caps the total at the scale`.
4. **Mobile chips (≤ 760px)**: the new hidden text and key must not change chip size or add a gap; bars and key stay hidden. → Task 2 Step 3 manual check at 375px.
5. **Clearing a goal**: the row returns to the 10-set scale with both segments, no status. → Task 2 Step 3 manual check.

---

### Task 1: Split and bar-fill rules (pure functions)

**Files:**
- Modify: `src/volume.js` (add `computeVolumeSplit`, `barSegments`; rewrite `computeVolume` on top of the split)
- Test: `test/volume.test.js`

**Interfaces:**
- Consumes: `MUSCLE_GROUPS` from `src/muscles.js`.
- Produces:
  - `computeVolumeSplit(session: Session) → Record<MuscleGroup, { direct: number, indirect: number }>`: one key per `MUSCLE_GROUPS` entry, in order.
  - `computeVolume(session: Session) → Record<MuscleGroup, number>`: unchanged contract, now `direct + indirect`.
  - `barSegments(direct: number, indirect: number, scale: number) → { direct: number, indirect: number }`: fills from 0 to 1.

- [ ] **Step 1: Write the failing tests** in `test/volume.test.js`. Update the import to `{ barSegments, computeVolume, computeVolumeSplit, goalStatus, volumeLevel }` and reuse the existing `exercise()` helper. Keep every existing test.

```js
const WORKED_EXAMPLE = {
  exercises: [
    exercise(4, ['Chest'], ['Triceps', 'Shoulders']),
    exercise(3, ['Chest', 'Triceps'], ['Shoulders']),
    exercise(3, ['Lats'], ['Biceps', 'Upper back']),
  ],
};

test('computeVolumeSplit worked example from spec', () => {
  assert.deepEqual(computeVolumeSplit(WORKED_EXAMPLE), {
    Chest: { direct: 7, indirect: 0 },
    Lats: { direct: 3, indirect: 0 },
    'Upper back': { direct: 0, indirect: 1.5 },
    Biceps: { direct: 0, indirect: 1.5 },
    Triceps: { direct: 3, indirect: 2 },
    Shoulders: { direct: 0, indirect: 3.5 },
    Abs: { direct: 0, indirect: 0 },
    Quads: { direct: 0, indirect: 0 },
    Hamstrings: { direct: 0, indirect: 0 },
    Calves: { direct: 0, indirect: 0 },
  });
});

test('computeVolumeSplit keys follow MUSCLE_GROUPS order', () => {
  assert.deepEqual(Object.keys(computeVolumeSplit({ exercises: [] })), [...MUSCLE_GROUPS]);
});

test('computeVolumeSplit skips invalid sets', () => {
  for (const sets of [NaN, 0, -2, 2.5]) {
    const { Quads, Abs } = computeVolumeSplit({ exercises: [exercise(sets, ['Quads'], ['Abs'])] });
    assert.deepEqual([Quads, Abs], [{ direct: 0, indirect: 0 }, { direct: 0, indirect: 0 }], `sets=${sets}`);
  }
});

test('computeVolume equals direct + indirect', () => {
  const split = computeVolumeSplit(WORKED_EXAMPLE);
  const volume = computeVolume(WORKED_EXAMPLE);
  for (const muscle of MUSCLE_GROUPS) {
    assert.equal(volume[muscle], split[muscle].direct + split[muscle].indirect, muscle);
  }
});

test('barSegments worked example from spec', () => {
  assert.deepEqual(barSegments(7, 0, 7), { direct: 1, indirect: 0 });       // Chest, goal 7
  assert.deepEqual(barSegments(3, 2, 4), { direct: 0.75, indirect: 0.25 }); // Triceps, goal 4
  assert.deepEqual(barSegments(3, 0, 6), { direct: 0.5, indirect: 0 });     // Lats, goal 6
  assert.deepEqual(barSegments(0, 0, 8), { direct: 0, indirect: 0 });       // Quads, goal 8
  assert.deepEqual(barSegments(0, 3.5, 10), { direct: 0, indirect: 0.35 }); // Shoulders, no goal
  assert.deepEqual(barSegments(0, 1.5, 10), { direct: 0, indirect: 0.15 }); // Biceps, Upper back
});

test('barSegments caps the total at the scale, direct first', () => {
  assert.deepEqual(barSegments(12, 3, 10), { direct: 1, indirect: 0 });
  assert.deepEqual(barSegments(0, 6, 4), { direct: 0, indirect: 1 });
  assert.deepEqual(barSegments(5, 6, 10), { direct: 0.5, indirect: 0.5 });   // indirect cut off
});
```

The existing `worked example from spec` test for `computeVolume` stays as the regression check that the total did not change.

- [ ] **Step 2: Run the tests and confirm they fail**

Run: `node --test test/volume.test.js`
Expected: FAIL, with `computeVolumeSplit` / `barSegments` not exported (SyntaxError on the import).

- [ ] **Step 3: Implement in `src/volume.js`**
  - `computeVolumeSplit(session)`: the loop currently in `computeVolume`, writing `direct += sets` for primary and `indirect += sets * 0.5` for secondary; same invalid-sets `continue`. JSDoc like the existing functions.
  - `computeVolume(session)`: map `computeVolumeSplit(session)` entries to `direct + indirect`. Update its JSDoc to say it is derived from the split.
  - `barSegments(direct, indirect, scale)`: exactly the Global Constraints formulas. Every expected value in the tests is exactly what these formulas give in JS (checked with Node), so do not round.

- [ ] **Step 4: Run all tests and confirm they pass**

Run: `npm test`
Expected: PASS for every test in `test/`, including the old `computeVolume` tests.

- [ ] **Step 5: Commit**

```bash
git add src/volume.js test/volume.test.js
git commit -m "feat: compute direct and indirect volume and bar segments"
```

---

### Task 2: Stacked bar, key, readout and screen-reader text

**Files:**
- Modify: `src/app.js` (`renderPanel()` row markup around lines 67-81; `refresh()` volume and readout block around lines 154-189)
- Modify: `index.html` (panel, lines 43-50)
- Modify: `style.css` (`.volume-row .bar` / `.bar-fill` / heat bar rules around lines 636-653; mobile block around lines 741-772)
- Modify: `docs/design-system/README.md` ("Volume panel" section, item 5; "Principles" accent line if needed)

**Interfaces:**
- Consumes: `computeVolumeSplit`, `barSegments`, `computeVolume`, `goalStatus`, `volumeLevel` from `src/volume.js` (Task 1).
- Produces: nothing used by other tasks.

- [ ] **Step 1: Markup and rendering**
  - Row markup in `renderPanel()`: replace `<span class="bar-fill"></span>` with `<span class="bar-direct"></span><span class="bar-indirect"></span>`, and add `<span class="split visually-hidden"></span>` as the button's last child.
  - In `refresh()`: call `computeVolumeSplit(session)` once next to `computeVolume`. Per row: `const { direct, indirect } = split[muscle]`, `const fill = barSegments(direct, indirect, goal ?? 10)`, set `.bar-direct` / `.bar-indirect` `style.width` to `fill.direct * 100 + '%'` / `fill.indirect * 100 + '%'`, and set `.split` text to `` ` (${direct} direct · ${indirect} indirect)` `` (the leading space keeps the accessible name readable). Remove the `.bar-fill` width line. Keep `data-level` on rows; the body map and the muted zero value still use it.
  - Readout: insert `` ` (${direct} direct · ${indirect} indirect)` `` right after ` sets`, so the text matches the Global Constraints copy exactly with and without a goal.
  - `index.html`: change the heat legend's `aria-label` to `"Body map colour scale"`. Directly before `<ul id="volume">` add:

```html
<ul class="split-key" aria-hidden="true">
  <li class="direct">Direct</li>
  <li class="indirect">Indirect</li>
</ul>
```

`aria-hidden` because every row's hidden text already names both parts.

- [ ] **Step 2: Styles in `style.css`**
  - `.volume-row .bar` becomes `display: flex` (keeps its track, radius and `overflow: hidden`).
  - `.bar-direct`, `.bar-indirect`: `display: block; height: 100%; transition: width 250ms ease`. `.bar-direct` gets `background: var(--accent)`. `.bar-indirect` gets `background: var(--accent-soft); box-shadow: inset 0 0 0 1px var(--accent)`, mirroring the selected secondary chip.
  - Delete the four `.volume-row[data-level="1..4"] .bar-fill` rules and the `.bar-fill` rule.
  - `.split-key`: same look as `.legend` (flex, 12px gap, 0.75rem, `--muted`, no list style), but left-aligned with `margin: 0 0 8px`. Its `li::before` swatches are 10×10 with radius 3px: `.direct` uses `--accent`, `.indirect` uses `--accent-soft` with `inset 0 0 0 1px var(--accent)`.
  - Mobile block (`max-width: 760px`): add `.split-key { display: none; }` next to `.legend`.

- [ ] **Step 3: Verify in the browser** (`npm start`, then open the served URL). Enter the worked example (Bench press 4 / Chest / Triceps, Shoulders; Dips 3 / Chest, Triceps / Shoulders; Pull-ups 3 / Lats / Biceps, Upper back) and check:
  - Chest bar fully solid at 70% (no goal); Triceps 30% solid + 20% soft; Shoulders 35% soft only; Lats 30% solid; Biceps and Upper back 15% soft; every other bar empty.
  - Set goals Chest 7, Triceps 4, Lats 6, Quads 8: Chest full solid; Triceps 75% solid + 25% soft with `5 / 4 OVER`; Lats 50% solid; Quads empty with `0 / 8 UNDER`.
  - Select Triceps: readout reads exactly `Triceps 5 / 4 sets (3 direct · 2 indirect) · over · 2 exercises`. Select Biceps: `Biceps 1.5 sets (0 direct · 1.5 indirect) · 1 exercise`.
  - Clear the Triceps goal: its row returns to the 10-set scale (30% + 20%), with no status.
  - Empty the Dips sets field: no `NaN` anywhere; Triceps shows `2` with `(0 direct · 2 indirect)` in the readout.
  - Body map heat colours are the same as before the change.
  - At 375px width: chips look the same as before (no bars, no key, no extra gap), and there is no horizontal page scroll.
  - Reduced motion (DevTools rendering emulation): segment widths change with no transition.

- [ ] **Step 4: Update `docs/design-system/README.md`**
  - Volume panel item 5: the bar is two segments, direct (`--accent`) then indirect (`--accent-soft` + inset `--accent` outline), full at the goal or at 10 sets, filled direct first; it no longer uses heat colours. The hidden `(N direct · M indirect)` text is part of each row's accessible name.
  - Add the "Direct / Indirect" key (hidden on mobile) to the panel's numbered parts, just before the volume list, and note that the heat legend now describes the body map only.
  - The readout line: add the split to the example (`Chest 7 / 10 sets (7 direct · 0 indirect) · under · 2 exercises`).
  - Heat scale section: the heat colours apply to the body map only.

- [ ] **Step 5: Run the tests and commit**

Run: `npm test`
Expected: PASS.

```bash
git add src/app.js index.html style.css docs/design-system/README.md
git commit -m "feat: show direct and indirect volume as stacked bars"
```
