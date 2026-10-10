# Goal-Coloured Bars on a Shared Scale Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Colour each volume-list bar by its goal status (amber under, green met, red over, neutral without a goal), draw every bar on one shared scale where the largest goal sits at 75%, and show a goal marker so overshoot is visible instead of cut off.

**Architecture:** A new pure `barScale(volume, goals)` in `src/volume.js` returns the sets that fill a whole bar. `refresh()` in `src/app.js` calls it once and passes it to the existing `barSegments` in place of today's per-row `goal ?? 10`. It also positions a new `.bar-goal` marker at `goal / scale`. Colours are CSS only: each row already carries `data-status`, which picks a pair of custom properties (`--bar`, `--bar-soft`) that the segments, the status text and nothing else read. `goalStatus` loses its now-unused `progress`.

**Tech Stack:** HTML, CSS, vanilla JS ES modules, `node:test` on Node 22. No dependencies, no build step.

**Spec:** `AGENTS.md`: functional requirements 7, 10 and 13, the business rules **Goal status**, **Direct and indirect volume** and **Bar scale**, and the "Goal-coloured bars on a shared scale" entry under "Decided".

## Global Constraints

- No runtime or dev dependencies; no build step.
- `scale = max(maxGoal / 0.75, maxVolume)` with a goal set; `maxVolume / 0.75` with no goal and `maxVolume > 0`; `1` otherwise.
- Marker position = `goal / scale`, only for a muscle with a goal. It is `aria-hidden` and visual only.
- Colours: under amber `#fbbf24`, met green `#4ade80`, over red `#f87171`, no goal neutral `#94a3b8`. Each soft variant is the same colour at alpha `0.14`.
- Direct segment = solid status colour; indirect = soft status colour with a 1px inset outline of the status colour. The status text uses the status colour.
- 0 volume shows only the grey `--surface-2` track (plus the marker if there is a goal).
- Do not change: the body map and its heat colours, the readout text, the screen-reader split text, the session file format, `barSegments`, `computeVolumeSplit`, `visibleMuscles`, the rounded-ends classes (`no-direct`, `no-indirect`), or mobile (bars, marker and key stay hidden at ≤ 760px).
- Rows are built once in `renderPanel()`; only `refresh()` updates them, so hover and selection state survive.
- Compute the scale on render; never store it.

## Review Focus

1. **A volume larger than `maxGoal / 0.75`** (goal Chest 4, Chest volume 7): the scale grows to 7, Chest fills the whole bar, its marker is at 4/7, and nothing is clipped. Test in Task 1.
2. **Clearing the largest goal** (goals Quads 8 and Chest 7, then Quads cleared): the scale drops from 32/3 to `max(7 / 0.75, 7)` = 28/3, and every bar and marker moves on that edit. Test in Task 1; check live in Task 2.
3. **Exercises with empty or invalid sets** (volume 0 for their muscles): they must not change the scale. Test in Task 1, using `computeVolume`.
4. **Goal set on a muscle with 0 volume** (empty session, goal Calves 6): grey track with a marker at 75%, amber `under` text, no NaN widths. Test in Task 1 (scale 8); check by hand in Task 2.
5. **Met exactly** (Chest 7 / 7): the fill ends at the marker, and the marker stays visible on top of the fill's rounded end. Check by hand in Task 2.

---

### Task 1: Pure bar scale, and drop `progress` from `goalStatus`

**Files:**
- Modify: `src/volume.js` (`goalStatus`, about lines 63-74; add `barScale` after `barSegments`)
- Modify: `test/volume.test.js` (the `goalStatus` tests at lines 60-71; add `barScale` tests after the `barSegments` tests)

**Interfaces:**
- Produces: `barScale(volume: Record<string, number>, goals: Partial<Record<string, number>>) → number` (sets that fill a whole bar, always > 0).
- Produces: `goalStatus(volume: number, goal: number | undefined) → { status: 'under' | 'met' | 'over' } | null`.

- [ ] **Step 1: Write the failing tests**

Update the existing `goalStatus` assertions to expect `{ status }` only (for example `assert.deepEqual(goalStatus(7, 7), { status: 'met' })`), keeping every existing case and its status. Add `barScale` to the import, a helper `const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} ≈ ${expected}`);`, and these tests, after the existing module-level `WORKED_EXAMPLE` (line 74):

```js
const GOALS = { Chest: 7, Triceps: 4, Lats: 6, Quads: 8 };

test('barScale worked example from spec', () => {
  const volume = computeVolume(WORKED_EXAMPLE);
  const split = computeVolumeSplit(WORKED_EXAMPLE);
  const scale = barScale(volume, GOALS);
  close(scale, 32 / 3);
  close(barSegments(split.Chest.direct, split.Chest.indirect, scale).direct, 0.65625);
  const triceps = barSegments(split.Triceps.direct, split.Triceps.indirect, scale);
  close(triceps.direct, 0.28125);
  close(triceps.indirect, 0.1875);
  close(barSegments(split.Shoulders.direct, split.Shoulders.indirect, scale).indirect, 0.328125);
  close(barSegments(split.Biceps.direct, split.Biceps.indirect, scale).indirect, 0.140625);
  close(GOALS.Chest / scale, 0.65625);   // markers
  close(GOALS.Triceps / scale, 0.375);
  close(GOALS.Lats / scale, 0.5625);
  close(GOALS.Quads / scale, 0.75);
});

test('barScale with no goals puts the largest volume at 75%', () => {
  close(barScale(computeVolume(WORKED_EXAMPLE), {}), 28 / 3);
});

test('barScale grows to fit a volume past the largest goal', () => {
  const scale = barScale(computeVolume(WORKED_EXAMPLE), { Chest: 4 });
  assert.equal(scale, 7);
  close(4 / scale, 4 / 7);
});

test('barScale follows the remaining goals when the largest is cleared', () => {
  const volume = computeVolume(WORKED_EXAMPLE);
  close(barScale(volume, GOALS), 32 / 3);
  close(barScale(volume, { Chest: 7, Triceps: 4, Lats: 6 }), 28 / 3);
});

test('barScale on an empty session', () => {
  const volume = computeVolume({ exercises: [] });
  assert.equal(barScale(volume, { Calves: 6 }), 8);
  assert.equal(barScale(volume, {}), 1);
});

test('barScale ignores exercises with invalid sets', () => {
  const volume = computeVolume({ exercises: [exercise(NaN, ['Quads']), exercise(0, ['Abs'])] });
  assert.equal(barScale(volume, {}), 1);
  assert.equal(barScale(volume, { Calves: 6 }), 8);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL. The `goalStatus` tests fail on the extra `progress` key, and the `barScale` tests fail with `barScale is not a function` (or an import SyntaxError).

- [ ] **Step 3: Implement**

In `src/volume.js`:
- `goalStatus` returns `{ status }` only. Update its JSDoc `@returns` and drop the `progress` line.
- Add `export function barScale(volume, goals)` with a JSDoc in the file's style. `maxVolume` = `Math.max(...Object.values(volume))`. With any goal: `Math.max(Math.max(...Object.values(goals)) / 0.75, maxVolume)`. Else `maxVolume > 0 ? maxVolume / 0.75 : 1`.
- Update the `barSegments` JSDoc `@param scale` to `the shared scale from barScale`, and its summary line from "indirect is cut off at the end of the bar" to "capped at the end of the bar". The body stays unchanged.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS, all tests (the existing `barSegments` tests are unchanged and still pass).

- [ ] **Step 5: Commit**

```bash
git add src/volume.js test/volume.test.js
git commit -m "feat: compute one shared bar scale for the volume list"
```

### Task 2: Shared scale and goal marker in the volume list

**Files:**
- Modify: `src/app.js` (import line 2; `renderPanel()` bar markup, line 85; `refresh()` row loop, lines 192-215)
- Modify: `style.css` (`.volume-row .bar` rule, about line 700)

**Interfaces:**
- Consumes: `barScale(volume, goals) → number` and `barSegments(direct, indirect, scale) → { direct, indirect }` from Task 1.
- Produces: a `<span class="bar-goal" aria-hidden="true"></span>` as the last child of every `.volume-row .bar`, with `hidden` set when the muscle has no goal and `style.left` = `${goal / scale * 100}%` otherwise.

- [ ] **Step 1: Add the marker element**

In `renderPanel()`, append `<span class="bar-goal" aria-hidden="true"></span>` inside `.bar`, after `.bar-indirect`.

- [ ] **Step 2: Use the shared scale in `refresh()`**

Import `barScale`. Before the row loop, compute `const scale = barScale(volume, session.goals);` once. In the loop, replace `goal ?? 10` with `scale`. Then set the marker: `marker.hidden = goal === undefined;` and, when there is a goal, `marker.style.left = `${goal / scale * 100}%``.

- [ ] **Step 3: Style the marker**

In `style.css`, on `.volume-row .bar`, add `position: relative` and remove `overflow: hidden`. The segments round their own ends, and the scale never lets the fill pass the track. Then add:

```css
/* Goal marker: a thin tick at the goal's position, drawn over the fill. */
.volume-row .bar-goal {
  position: absolute;
  top: 50%;
  width: 2px;
  height: 14px;
  border-radius: 1px;
  background: var(--text);
  transform: translate(-50%, -50%);
  transition: left 250ms ease;
}

.volume-row .bar-goal[hidden] {
  display: none;
}
```

- [ ] **Step 4: Verify in the browser**

Run: `npm test` (expected: PASS), then `npm start` and open the served URL at desktop width (> 760px). Build the volume worked example (Bench press 4 / Chest / Triceps, Shoulders; Dips 3 / Chest, Triceps / Shoulders; Pull-ups 3 / Lats / Biceps, Upper back) and check:
- No goals: Chest fills 75%, the other bars are proportional (Triceps 5 = 5/7 of Chest), and there are no markers.
- Goals Chest 7, Triceps 4, Lats 6, Quads 8: the Quads marker is at 75% on an empty grey track. The Chest fill ends exactly at its marker, which stays visible. The Triceps fill runs past its marker at 37.5%.
- Clear Quads: every bar and marker moves on that keystroke (scale 32/3 → 28/3).
- Set only Chest 4: Chest fills the whole bar with its marker at about 57%, and nothing is clipped.
- At ≤ 760px: no bars and no markers.

- [ ] **Step 5: Commit**

```bash
git add src/app.js style.css
git commit -m "feat: draw volume bars on a shared scale with a goal marker"
```

### Task 3: Status colours for bars, status text and key

**Files:**
- Modify: `style.css` (`:root` tokens, lines 1-24; `.volume-row .bar-direct` / `.bar-indirect` colour rules, about lines 715-722; `.split-key` swatches, about lines 762-769; `.volume-row .status` colour rules, about lines 793-815)
- Modify: `docs/design-system/README.md` (principle "One accent" at line 9, colour tokens table, split key at line 119, bar and goal bullets at lines 121-123)

**Interfaces:**
- Consumes: `data-status="under" | "met" | "over"` on `.volume-row` (already set by `refresh()`, absent without a goal).
- Produces: CSS custom properties `--bar` and `--bar-soft` on every `.volume-row`.

- [ ] **Step 1: Add tokens**

On `:root`: `--under: #fbbf24; --under-soft: rgba(251, 191, 36, 0.14); --met: #4ade80; --met-soft: rgba(74, 222, 128, 0.14); --over: #f87171; --over-soft: rgba(248, 113, 113, 0.14); --no-goal: #94a3b8; --no-goal-soft: rgba(148, 163, 184, 0.14);`

- [ ] **Step 2: Colour by status**

Set `.volume-row { --bar: var(--no-goal); --bar-soft: var(--no-goal-soft); }`, and override the pair for `[data-status="under"]`, `[data-status="met"]` and `[data-status="over"]`. `.bar-direct` background becomes `var(--bar)`. `.bar-indirect` gets background `var(--bar-soft)` and `box-shadow: inset 0 0 0 1px var(--bar)`. The status text colour becomes `var(--bar)` for all three statuses: replace the `under`-muted, `met`-accent and `over`-amber colours, and keep the over outline pill, now drawn in `var(--bar)`. The split-key swatches use `var(--no-goal)` and `var(--no-goal-soft)` with an inset `var(--no-goal)` outline.

- [ ] **Step 3: Update the design system**

In `docs/design-system/README.md`:
- Reword "One accent": orange stays the only action/selection accent, and the four status colours are reserved for volume-list bars and status text.
- Add the eight tokens to the colour table.
- Rewrite the bar, split key and "With a goal" bullets to match Steps 1-2 and Task 2: shared `barScale`, the marker, status colours, and the neutral colour without a goal.
- Add to "Colour never stands alone": status colours are always paired with the status text and `volume / goal`.

- [ ] **Step 4: Verify in the browser**

Run: `npm test` (expected: PASS), then `npm start` with the volume worked example and goals Chest 7, Triceps 4, Lats 6, Quads 8. Check:
- Chest is green with `met` in green.
- Triceps is red: solid red direct, soft red indirect with a red outline, and `over` in a red pill.
- Lats and Quads are amber with `under` in amber; Quads shows only the grey track and its marker.
- Shoulders, Biceps and Upper back are neutral grey-blue with soft outlined fills.
- The key swatches are neutral.
- A pressed (selected) row's orange tint does not hide any bar colour.
- The body map keeps its heat colours.
- Edit Triceps' goal to 5: it turns green immediately.

- [ ] **Step 5: Commit**

```bash
git add style.css docs/design-system/README.md
git commit -m "feat: colour volume bars by goal status"
```
