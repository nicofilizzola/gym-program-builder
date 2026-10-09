# Hide Irrelevant Muscles Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** In the volume list, hide the row of every muscle that has no goal and 0 volume, and show a short message when no row is left.

**Architecture:** One new pure, unit-tested function in `src/volume.js`, `visibleMuscles(volume, goals)`, holds the rule. `refresh()` in `src/app.js` calls it on every render and toggles the `hidden` attribute on each row's `<li>`, on a new empty-state message, and on the Direct / Indirect key. Rows are still built once in `renderPanel()`, so hover and selection state survive. The body map is not touched.

**Tech Stack:** HTML, CSS, vanilla JS ES modules, `node:test` on Node 22. No dependencies, no build step.

**Spec:** `AGENTS.md`: functional requirements 4 and 12, the "Visible volume rows (business rule)" section and its worked example, the implementation guidelines, and the "Hide irrelevant muscles" entry under "Decided".

## Global Constraints

- No runtime or dev dependencies; no build step.
- `visible(muscle) = goal(muscle) is set OR volume(muscle) > 0`, using the computed volume (`computeVolume`), so empty or invalid sets count as 0.
- Visible rows keep `MuscleGroup` order.
- Empty-state copy, exact: `No volume yet. Add an exercise or set a goal.`
- When no row is visible, the Direct / Indirect key is hidden too. (It is already hidden on mobile; that stays.)
- The body map always shows every muscle with its heat colour.
- Selection is unchanged: a selected muscle whose row is hidden stays selected, its row stays hidden, and the readout still describes it. Do not clear the selection and do not force the row visible.
- Visibility is derived on render and never stored.
- Out of scope: a "show all muscles" toggle, sorting by volume, hide/show animations.
- CSS gotcha: an element whose class sets `display` ignores the `hidden` attribute unless a `[hidden] { display: none; }` rule exists for it (see `.list-actions[hidden]` in `style.css`).

## Review Focus

1. **Goal on a muscle with 0 volume** (empty session, goal Calves 6): the Calves row shows `0 / 6` and **under**, and the empty message is hidden. → Task 1 test `visibleMuscles shows a goal muscle at 0 volume`; Task 2 Step 4 manual check.
2. **Clearing the last goal of an untrained muscle in the goals dialog** (type then empty Quads): the Quads row appears then disappears live while typing, and an invalid value (`-1`, `0.3`) does not show the row (goal is not applied). → Task 2 Step 4 manual check.
3. **Sets field emptied while typing** (Bench press, the only exercise, sets `''`): its muscles disappear and the empty message shows; retyping `4` brings them back. → Task 1 test `visibleMuscles hides invalid-sets muscles`; Task 2 Step 4 manual check.
4. **Selected muscle loses its row** (select Chest, then remove the only Chest exercise): selection and highlighting stay, the readout reads `Chest 0 sets (0 direct · 0 indirect) · 0 exercises`, the body map region stays selected, and clicking it deselects. → Task 2 Step 4 manual check.
5. **Mobile chip strip (≤ 760px)** with only one or zero visible rows: no stray gaps or empty pill, and the empty message fits the compact panel. → Task 2 Step 4 manual check at 375px.

---

### Task 1: Visibility rule (pure function)

**Files:**
- Modify: `src/volume.js` (add `visibleMuscles`)
- Test: `test/volume.test.js`

**Interfaces:**
- Consumes: `computeVolume(session) → Record<MuscleGroup, number>` (existing), `MUSCLE_GROUPS` from `src/muscles.js`.
- Produces: `visibleMuscles(volume: Record<MuscleGroup, number>, goals: Partial<Record<MuscleGroup, number>>) → MuscleGroup[]`, in `MUSCLE_GROUPS` order.

- [ ] **Step 1: Write the failing tests** at the end of `test/volume.test.js` (add `visibleMuscles` to the existing import from `../src/volume.js`; reuse the file's `exercise()` helper and its `WORKED_EXAMPLE` fixture)

```js
test('visibleMuscles worked example from spec, no goals', () => {
  assert.deepEqual(visibleMuscles(computeVolume(WORKED_EXAMPLE), {}),
    ['Chest', 'Lats', 'Upper back', 'Biceps', 'Triceps', 'Shoulders']);
});

test('visibleMuscles worked example from spec, with goals', () => {
  const goals = { Chest: 7, Triceps: 4, Lats: 6, Quads: 8 };
  assert.deepEqual(visibleMuscles(computeVolume(WORKED_EXAMPLE), goals),
    ['Chest', 'Lats', 'Upper back', 'Biceps', 'Triceps', 'Shoulders', 'Quads']);
});

test('visibleMuscles is empty for an empty session with no goals', () => {
  assert.deepEqual(visibleMuscles(computeVolume({ exercises: [] }), {}), []);
});

test('visibleMuscles shows a goal muscle at 0 volume', () => {
  assert.deepEqual(visibleMuscles(computeVolume({ exercises: [] }), { Calves: 6 }), ['Calves']);
});

test('visibleMuscles hides invalid-sets muscles', () => {
  const session = { exercises: [exercise(NaN, ['Chest'], ['Triceps'])] };
  assert.deepEqual(visibleMuscles(computeVolume(session), {}), []);
});

test('visibleMuscles keeps MUSCLE_GROUPS order, not goal-key order', () => {
  assert.deepEqual(visibleMuscles(computeVolume({ exercises: [] }), { Calves: 2, Chest: 3 }), ['Chest', 'Calves']);
});
```


- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test`
Expected: FAIL, with `visibleMuscles` not exported (SyntaxError on the import).

- [ ] **Step 3: Implement `visibleMuscles(volume, goals)` in `src/volume.js`**

Filter `MUSCLE_GROUPS` (not `Object.keys(goals)`) on `goals[muscle] !== undefined || volume[muscle] > 0`. Add a JSDoc block in the style of the other functions in the file.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test`
Expected: PASS for every test in `test/`.

- [ ] **Step 5: Commit**

```bash
git add src/volume.js test/volume.test.js
git commit -m "feat: decide which muscles the volume list shows"
```

---

### Task 2: Hide rows, empty message and key in the volume panel

**Files:**
- Modify: `index.html` (empty message; `id` on the split key)
- Modify: `src/app.js` (`refresh()`; new element refs)
- Modify: `style.css` (empty message style; `[hidden]` rules)

**Interfaces:**
- Consumes: `visibleMuscles(volume, goals) → MuscleGroup[]` from Task 1; the existing `volume` (from `computeVolume`) and `session.goals` already in `refresh()`.
- Produces: nothing for later tasks.

- [ ] **Step 1: Markup.** In `index.html`, give the key an id (`<ul id="split-key" class="split-key" aria-hidden="true">`) and add, directly after `<ul id="volume" class="volume-list"></ul>`:

```html
<p id="volume-empty" class="volume-empty" hidden>No volume yet. Add an exercise or set a goal.</p>
```

- [ ] **Step 2: Render.** In `src/app.js`, add refs `splitKey = document.querySelector('#split-key')` and `volumeEmpty = document.querySelector('#volume-empty')` next to `volumeList`, and import `visibleMuscles`. In `refresh()`, after `volume` is computed:
  - `const visible = visibleMuscles(volume, session.goals);`
  - in the existing `.volume-row` loop, set `row.parentElement.hidden = !visible.includes(muscle)` (hide the `<li>`, not the button);
  - `volumeEmpty.hidden = visible.length > 0;` and `splitKey.hidden = visible.length === 0;`.

  Leave the body map loop, the selection logic and the readout unchanged.

- [ ] **Step 3: Styles.** In `style.css`:
  - add `.split-key[hidden] { display: none; }` next to `.split-key` (its `display: flex` would otherwise override `hidden`);
  - add `.volume-empty` after the `.volume-list` block: muted colour (`var(--muted)`), `font-size: 0.875rem`, small vertical margin, matching the panel's existing muted text (see `.readout` / `.split-key`). No dashed box: the panel is compact on mobile.
  - In the `@media (max-width: 760px)` block, give `.volume-empty` the same top margin as `.volume-list` there (`8px`).

- [ ] **Step 4: Verify in the browser** (`npm start`, then open the served URL). Check, desktop width then 375px:
  - Fresh page: no rows, `No volume yet. Add an exercise or set a goal.` shows, no Direct / Indirect key; body map shows all muscles at level 0.
  - Enter the worked example (Bench press 4 / Chest / Triceps, Shoulders; Dips 3 / Chest, Triceps / Shoulders; Pull-ups 3 / Lats / Biceps, Upper back): rows Chest, Lats, Upper back, Biceps, Triceps, Shoulders, in that order; no Abs, Quads, Hamstrings, Calves; message gone; key back.
  - Set goals Chest 7, Triceps 4, Lats 6, Quads 8: Quads row appears after Shoulders, showing `0 / 8` and **under**. Clear Quads: the row disappears while typing. Type `-1` in Quads: an error shows and no row appears.
  - Empty Bench press's sets field when it is the only exercise: its muscles disappear and the message shows; type `4` again: they return.
  - Select Chest (row click), then remove every Chest exercise: Chest row disappears, body map Chest stays selected, readout shows `Chest 0 sets (0 direct · 0 indirect) · 0 exercises`; clicking the body map Chest deselects.
  - At 375px: the chip strip shows only visible muscles with no extra gaps; with none visible, the message fits the bottom strip.

- [ ] **Step 5: Run the unit tests**

Run: `npm test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add index.html src/app.js style.css
git commit -m "feat: hide muscles with no goal and no volume from the volume list"
```
