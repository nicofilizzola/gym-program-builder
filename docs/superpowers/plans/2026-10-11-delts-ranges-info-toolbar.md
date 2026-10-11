# Delts, Recommended Ranges, Muscle Info and Toolbar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split Shoulders into three delts, cap goals at 12, show recommended-range hints/warnings and per-muscle info in the goals dialog, and merge the file and bulk buttons into one toolbar with icons.

**Architecture:**
- **Data:** `MUSCLE_GROUPS` (`src/muscles.js`) gets 12 values. A new frozen `MUSCLE_INFO` sits next to it, holding one `{ recommended: { min, max }, sets, notes }` per muscle, copied from AGENTS.md **Muscle info (content)**. Then `muscle-group-info.md` is deleted.
- **Rules:** `LIMITS.goal.max` becomes 12 (`src/validate.js`). The slider, `validateGoal`, `GOAL_RULE` and import all follow because they already read `LIMITS`. A new pure `goalRangeCheck(goal, range)` in `src/volume.js` sits next to `goalStatus`.
- **UI:** `renderGoalFields()` / `showGoal()` (`src/app.js:131-157`) gain an info button, a hint line and an info panel per row. The body map (`src/body.js`) splits the shoulder shape into an inner delt (front or rear) and an outer side-delt cap. `index.html` wraps `.file-actions` and `#list-actions` in one `.toolbar` row with inline SVG icons.

**Tech Stack:** HTML, CSS, vanilla JS ES modules, `node:test` on Node 22 (`npm test`). No dependencies, no build step. Browser checks use `playwright-core` installed in the session scratchpad (never in the project), driving Chrome at `C:/Program Files/Google/Chrome/Application/chrome.exe`, with the app served by `npx --yes serve .`.

**Spec:** `AGENTS.md`: domain model; requirements 6, 11, 14, 18–21; the **Recommended volume ranges** and **Muscle info (content)** sections; the updated worked examples and session file limits; the 2026-10-11 "Delts, recommended ranges, muscle info and toolbar" Decided entry; and the out-of-scope line.

## Global Constraints

- Muscle order, verbatim: `Chest, Lats, Upper back, Biceps, Triceps, Front delts, Side delts, Rear delts, Abs, Quads, Hamstrings, Calves`.
- Goal limits: `{ min: 0.5, max: 12, step: 0.5 }`, defined only in `LIMITS`. The goal slider range is `0`–`LIMITS.goal.max`.
- Ranges (inclusive): 4–8 for Chest, Lats, Upper back, Biceps, Triceps, Quads, Hamstrings and Calves; 3–6 for Front delts; 3–8 for Side delts and Rear delts; 2–6 for Abs.
- Copy, verbatim, with an en dash: `Recommended 4–8`, `Above the recommended range (4–8).`, `Below the recommended range (4–8).`; info button name `About <Muscle>`; panel labels `Productive sets` and `Programming`.
- The warning is amber (`var(--under)`), non-blocking, and appears only in the goals dialog. `No goal` (0) never warns.
- Icons are inline SVG with `aria-hidden="true"`, `fill: none`, `stroke: currentColor`, stroke width 2, like `.add-btn svg`. No icon library. Text labels stay.
- No migration for `Shoulders`. File `version` stays `1`.
- Volume, goal status, bar scale, readout text and collapse behaviour are otherwise unchanged.

## Review Focus

1. **An old exported file that uses `Shoulders`** (as an exercise muscle or a goal key) must be rejected as a whole with a clear message, not half-imported. Pinned in Task 1 (session-file tests).
2. **A file with a goal of 12.5, 20 or 30** (valid before this change) is rejected, and 12 is still accepted. Pinned in Task 2.
3. **Goals exactly on a range boundary** (4 and 8 for Chest, 2 for Abs) must not warn, and 0 must never warn. Pinned in Task 3's worked-example test.
4. **Dragging a goal slider across many steps** must not make screen readers announce the hint on every step: the hint's text is written only when it changes. Pinned in Task 4's browser check (MutationObserver count).
5. **At 360px width**, the toolbar wraps without horizontal page scroll, and a goal row with `Front delts`, the info button and `No goal` fits without overlap. Pinned in the Task 4 and Task 5 browser checks.

---

### Task 1: Three delt muscles

**Files:**
- Modify: `src/muscles.js`, `src/body.js:10-28`, `src/exercise.js:75` (JSDoc example), `docs/design-system/README.md:109` (summary example)
- Test: `test/volume.test.js`, `test/exercise.test.js`, `test/session-file.test.js`

**Interfaces:**
- Produces: `MUSCLE_GROUPS` with the 12 values in Global Constraints order. Body map regions `data-muscle="Front delts"` (front figure), `"Rear delts"` (back figure) and `"Side delts"` (both figures).

- [ ] **Step 1: Update the tests to the new list.** In `test/volume.test.js`, rename the first test to `'MUSCLE_GROUPS has the 12 spec values in order'` and assert the 12-value list. Replace every `Shoulders` in all three test files with `Front delts`. In expected volume, split and tone objects, add `'Side delts': 0, 'Rear delts': 0` (split: `{ direct: 0, indirect: 0 }`; tone: `'untrained'`). Visible-rows expectations follow AGENTS.md. Add to `test/session-file.test.js`:

```js
test('rejects the removed Shoulders muscle', () => {
  assert.equal(errorOf(file({ exercises: [{ ...ex0, secondaryMuscles: ['Shoulders'] }] })),
    'Exercise 1: unknown muscle group "Shoulders".');
  assert.equal(errorOf(file({ goals: { Shoulders: 5 } })), 'Goal for unknown muscle group "Shoulders".');
});
```

(Use the file's existing `file`, `ex0` and `errorOf` helpers.)

- [ ] **Step 2: Run `npm test`.** Expected: FAIL on the MUSCLE_GROUPS test and the worked examples (`Front delts` is unknown).

- [ ] **Step 3: Update `MUSCLE_GROUPS`** in `src/muscles.js` to the 12 values.

- [ ] **Step 4: Split the shoulder on the body map** in `src/body.js`. Replace `SHOULDER` with two shapes that share their inner edge (the same quadratic, reversed), so they meet without a gap:

```js
const SIDE_DELT = 'M25 39 Q18 43 17.5 53 Q19.5 55.5 22 55.8 Q21.5 46 25 39 Z';
const INNER_DELT = 'M25 39 Q21.5 46 22 55.8 Q24.5 56 26.5 55 Q29 48 31 41 Q28 38 25 39 Z';
```

Front figure: `['Front delts', INNER_DELT], ['Side delts', SIDE_DELT]`. Back figure: `['Rear delts', INNER_DELT], ['Side delts', SIDE_DELT]`, in the old Shoulders position in each list.

- [ ] **Step 5: Run `npm test`.** Expected: all PASS.

- [ ] **Step 6: Browser check `delts.mjs` in the scratchpad.** At 1200×1000, add one exercise with primary `Side delts`. Then:
  - All 4 `.region[data-muscle="Side delts"]` paths (2 per figure) have `data-tone="trained"`.
  - `Front delts` and `Rear delts` regions are `untrained`.
  - Hovering the front figure's side cap makes the readout start with `Side delts`.
  - The exercise card shows 12 muscle chips per role.

  Save a screenshot of the body map and look at it: the three delts must read as one shoulder shape, with no gap or overlap. Expected: all assertions pass.

- [ ] **Step 7: Update the design-system summary example** to `secondary: Triceps, Front delts`, then commit:

```bash
git add src/muscles.js src/body.js src/exercise.js test/ docs/design-system/README.md
git commit -m "feat: replace shoulders with front, side and rear delts"
```

### Task 2: Goal limit 12

**Files:**
- Modify: `src/validate.js:7`
- Test: `test/validate.test.js:80-91`, `test/session-file.test.js:117-120`

**Interfaces:**
- Produces: `LIMITS.goal` = `{ min: 0.5, max: 12, step: 0.5 }`. `GOAL_RULE` reads `must be a multiple of 0.5 from 0.5 to 12.`

- [ ] **Step 1: Update the tests.**
  - `validate.test.js`: the test name says `0.5 to 12`; valid goals are `[0.5, 1, 4.5, 10, 12]`; invalid goals add `12.5, 30` to the existing list; the expected message ends `to 12.`; and the `LIMITS` deep-equal uses `goal: { min: 0.5, max: 12, step: 0.5 }`.
  - `session-file.test.js`: the rejected values become `[0, 7.3, '7', null, 12.5, 30]`, with the message `Goal for Chest must be a multiple of 0.5 from 0.5 to 12.`
  - Add one assertion that a file with `goals: { Chest: 12 }` parses with `Chest: 12`.

- [ ] **Step 2: Run `npm test`.** Expected: FAIL on the goal tests.

- [ ] **Step 3: Set `LIMITS.goal.max` to `12`.**

- [ ] **Step 4: Run `npm test`.** Expected: PASS.

- [ ] **Step 5: Commit** with `feat: cap volume goals at 12`.

### Task 3: Recommended ranges and muscle info data

**Files:**
- Modify: `src/muscles.js`, `src/volume.js`
- Test: `test/volume.test.js`
- Delete: `muscle-group-info.md` (untracked; `rm` it)

**Interfaces:**
- Produces:
  - `MUSCLE_INFO: Readonly<Record<MuscleGroup, { recommended: { min: number, max: number }, sets: string, notes: string }>>`, frozen, in `src/muscles.js`. `sets` and `notes` are the AGENTS.md **Muscle info (content)** table cells, verbatim.
  - `goalRangeCheck(goal: number | undefined, range: { min, max }) → 'below' | 'above' | null`, exported from `src/volume.js`.

- [ ] **Step 1: Write the failing tests** in `test/volume.test.js`:

```js
test('MUSCLE_INFO has one entry per muscle with the spec ranges', () => {
  assert.deepEqual(Object.keys(MUSCLE_INFO), [...MUSCLE_GROUPS]);
  const ranges = Object.fromEntries(MUSCLE_GROUPS.map((m) => [m, `${MUSCLE_INFO[m].recommended.min}–${MUSCLE_INFO[m].recommended.max}`]));
  assert.deepEqual(ranges, {
    Chest: '4–8', Lats: '4–8', 'Upper back': '4–8', Biceps: '4–8', Triceps: '4–8',
    'Front delts': '3–6', 'Side delts': '3–8', 'Rear delts': '3–8', Abs: '2–6',
    Quads: '4–8', Hamstrings: '4–8', Calves: '4–8',
  });
  for (const m of MUSCLE_GROUPS) assert.ok(MUSCLE_INFO[m].sets && MUSCLE_INFO[m].notes, m);
  assert.equal(MUSCLE_INFO['Side delts'].notes, 'Direct lateral raises allow targeted loading with limited systemic fatigue.');
});

test('goalRangeCheck worked example', () => {
  const r = (m) => MUSCLE_INFO[m].recommended;
  assert.equal(goalRangeCheck(10, r('Chest')), 'above');
  assert.equal(goalRangeCheck(8, r('Chest')), null);
  assert.equal(goalRangeCheck(4, r('Chest')), null);
  assert.equal(goalRangeCheck(2.5, r('Front delts')), 'below');
  assert.equal(goalRangeCheck(2, r('Abs')), null);
  assert.equal(goalRangeCheck(undefined, r('Side delts')), null);
});
```

- [ ] **Step 2: Run `npm test`.** Expected: FAIL (`MUSCLE_INFO` and `goalRangeCheck` are not exported).

- [ ] **Step 3: Add `MUSCLE_INFO`** to `src/muscles.js`, freezing each entry.

- [ ] **Step 4: Add `goalRangeCheck`** to `src/volume.js`, with a JSDoc in the style of `goalStatus`.

- [ ] **Step 5: Run `npm test`.** Expected: PASS.

- [ ] **Step 6: Delete `muscle-group-info.md`** and commit `src/muscles.js src/volume.js test/volume.test.js` with `feat: add recommended goal ranges and muscle info`.

### Task 4: Range hint, warning and info panel in the goals dialog

**Files:**
- Modify: `src/app.js:130-165` (`renderGoalFields`, `showGoal`) and `src/app.js:532-535` (the open-goals handler); `style.css:755-785` (goal rows) and `style.css:1164-1180` (mobile goal row); `docs/design-system/README.md` (one short "Goals dialog" note on the hint, warning and info button)

**Interfaces:**
- Consumes: `MUSCLE_INFO` and `goalRangeCheck` (Task 3), `LIMITS.goal` (Task 2).

- [ ] **Step 1: Write the failing browser check `goals.mjs` in the scratchpad.** At 1200×1000, open "Set goals". Before sliding, put a `MutationObserver` on the Chest row's `.goal-hint` that counts childList/characterData changes. Then:
  - Every row shows `Recommended <min>–<max>`. The Abs row shows `Recommended 2–6`. No row has `.is-warning`.
  - Press End on the Chest slider: the value is `12`, and the hint is `Above the recommended range (4–8).`, has `.is-warning`, and its computed colour equals `--under` (`rgb(251, 191, 36)`).
  - Press Home, then ArrowRight ×8 (goal 4): the hint is back to `Recommended 4–8`. Press ArrowRight ×8 more (goal 8): still `Recommended 4–8`. The observer counted ≤ 2 changes after the End press, because the text is written only when it changes.
  - Set Front delts to 2.5 (Home, ArrowRight ×5): `Below the recommended range (3–6).`
  - Click the Chest info button (`button[aria-label="About Chest"]`): `aria-expanded="true"`, and the panel it `aria-controls` is visible and contains `Productive sets` and `Combine pressing and flyes`. Open Lats too; both are open. Press Done, then reopen the dialog: both are closed (`aria-expanded="false"`, panels hidden).
  - At 360×740, the dialog has no horizontal overflow (`scrollWidth <= clientWidth`), and in the Front delts row the name, the info button and the value do not overlap (bounding boxes).

- [ ] **Step 2: Run it.** Expected: FAIL (no `.goal-hint`, no info button).

- [ ] **Step 3: Extend `renderGoalFields()`.** Each row becomes:
  - **Name cell:** `<span class="goal-label">` with `.goal-name` and `<button type="button" class="info-btn" aria-label="About <muscle>" aria-expanded="false" aria-controls="goal-info-<index>">`, which holds an info SVG: `<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>`.
  - **Slider and value:** unchanged.
  - **Hint:** `<p class="goal-hint" aria-live="polite">`.
  - **Info panel:** `<div class="goal-info" id="goal-info-<index>" hidden>` with two `<p>`, each starting with `<strong>Productive sets</strong>` / `<strong>Programming</strong>` followed by the `sets` / `notes` text.

  Set all text with `textContent`, as the existing code does.

- [ ] **Step 4: Update `showGoal(input)`** to compute the hint from `goalRangeCheck(value === 0 ? undefined : value, MUSCLE_INFO[muscle].recommended)`, using the exact copy from Global Constraints. Write `hint.textContent` only when the new text differs, and toggle `is-warning`.

- [ ] **Step 5: Wire the info buttons.**
  - Add a `click` listener on `goalFields` for `.info-btn`. It flips `aria-expanded` and the controlled panel's `hidden`.
  - In the `#open-goals` handler, before `showModal()`, reset every info button to collapsed and hide every panel.
  - Clicks inside `.dialog-body` already don't close the dialog; keep it that way.

- [ ] **Step 6: Style it.**
  - **Desktop grid:** widen the name column to `120px`.
  - **`.goal-label`:** inline-flex, gap 4px.
  - **`.info-btn`:** 28×28, transparent, `--muted` icon (16px svg), `--accent` on hover, visible `:focus-visible` ring like the other buttons.
  - **`.goal-hint` and `.goal-info`:** `grid-column: 1 / -1`, 0.75rem.
  - **`.goal-hint`:** `--muted`; `.goal-hint.is-warning` uses `var(--under)`.
  - **`.goal-info`:** `--surface-2` background, 8px radius, 8px 10px padding.
  - **Mobile block:** place `.goal-hint` and `.goal-info` on the rows below the slider (grid-row 3 and 4).

- [ ] **Step 7: Run `goals.mjs` and `npm test`.** Expected: all pass.

- [ ] **Step 8: Commit** `src/app.js style.css docs/design-system/README.md` with `feat: show recommended ranges and muscle info in the goals dialog`.

### Task 5: One toolbar with icons

**Files:**
- Modify: `index.html:19-28`, `style.css:96-99` (`.file-actions`), `style.css:146-155` (`.list-actions`), `.secondary-btn` (`style.css:696`); `docs/design-system/README.md` (layout note: toolbar row)

**Interfaces:**
- Consumes: the existing ids `#import-session`, `#export-session`, `#import-file`, `#list-actions`, `#expand-all`, `#collapse-all`, `#file-message`. Keep them all, so `src/app.js` needs no change.

- [ ] **Step 1: Write the failing browser check `toolbar.mjs` in the scratchpad.**
  - At 1200×1000 with no exercises: `.toolbar` exists; Import and Export are inside it; `#list-actions` is hidden.
  - Add an exercise: all four buttons have the same `getBoundingClientRect().top`. Import and Export are left of Expand all and Collapse all. Collapse all's right edge is within 1px of the `.toolbar`'s right edge. Each button contains one `svg[aria-hidden="true"]` and keeps its text (`Import`, `Export`, `Expand all`, `Collapse all`).
  - Click Export with an invalid exercise: `#file-message` sits below the toolbar.
  - At 360×740 with one exercise: `document.documentElement.scrollWidth <= 360`, and no button overflows the toolbar.

- [ ] **Step 2: Run it.** Expected: FAIL (no `.toolbar`).

- [ ] **Step 3: Restructure the markup.** Wrap `.file-actions` and `#list-actions` in `<div class="toolbar">`, followed by `#file-message`. Prepend an icon `<svg viewBox="0 0 24 24" aria-hidden="true">` to each button:
  - **Import:** `<path d="M12 3v12M7 10l5 5 5-5M4 15v4h16v-4"/>`
  - **Export:** `<path d="M12 15V3M7 8l5-5 5 5M4 15v4h16v-4"/>`
  - **Expand all:** `<path d="M6 9l6 6 6-6"/>`
  - **Collapse all:** `<path d="M6 15l6-6 6 6"/>`

- [ ] **Step 4: Style it.**
  - **`.toolbar`:** `display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 8px`.
  - **`.list-actions`:** drop `margin-top` and `justify-content`, and keep `margin-left: auto` so it stays right when wrapped.
  - **`.secondary-btn`:** `display: inline-flex; align-items: center; gap: 6px`.
  - **`.secondary-btn svg`:** 18×18, `fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round` (check `.add-btn svg` and match its cap/join).
  - The exercise list's existing top margin gives the spacing below the row.

- [ ] **Step 5: Run `toolbar.mjs`, `goals.mjs`, `delts.mjs` and `npm test`.** Expected: all pass. Also take a screenshot of the toolbar at 1200 and 360 and look at both.

- [ ] **Step 6: Commit** `index.html style.css docs/design-system/README.md` with `feat: merge file and list actions into one toolbar with icons`.
