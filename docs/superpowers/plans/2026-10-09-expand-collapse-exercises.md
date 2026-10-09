# Expand and Collapse Exercises Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the user collapse each exercise card to a one-line summary, and expand or collapse every card at once. Imported exercises start collapsed, and a refused export opens the exercise it names.

**Architecture:** One new pure, unit-tested function `exerciseSummary(ex)` in `src/exercise.js` holds the summary rule. Collapsed state is UI view state in `src/app.js`: a `collapsed: boolean[]` array kept in session order next to `session`, never stored on it. It moves with the existing pure `moveExercise` on reorder. `refresh()` applies the state to the cards (field body hidden, summary shown, toggle `aria-expanded`, `Needs fixing` marker) without rebuilding them, so focus survives a toggle.

**Tech Stack:** HTML, CSS, vanilla JS ES modules, `node:test` on Node 22. No dependencies, no build step.

**Spec:** `AGENTS.md`: functional requirements 8 and 11, the "Exercise summary (business rule)" section and its worked example, the implementation guidelines ("Keep the exercise summary in a pure function", "Collapsed state is view state"), and the "Expand and collapse exercises" entry under "Decided".

## Global Constraints

- No runtime or dev dependencies; no build step.
- Summary: `name · sets × reps · primary muscles · secondary: secondary muscles`, parts joined with ` · `; empty name → `Untitled exercise`; reps `min–max` (en dash U+2013), or `min` when `min = max`; a sets/min/max value that is not a positive whole number → `?`; muscles joined with `, `; the primary part is left out when there are none, and the `secondary: …` part when there are none.
- Exact copy: toggle `aria-label` `Collapse exercise` / `Expand exercise`; marker `Needs fixing`; buttons `Expand all` / `Collapse all`.
- New exercise → expanded. Every imported exercise → collapsed. A declined or rejected import does not change collapsed state.
- Collapsed state is not on `Exercise` or `Session`, never written by `serializeSession`, not persisted.
- Design system (`docs/design-system/README.md`): 44×44 icon buttons with `aria-label`, inline SVG strokes using `currentColor`, colour never stands alone, `prefers-reduced-motion` turns transitions off (the existing global rule covers new transitions). No collapse animation.

## Review Focus

1. **Toggling while editing another card:** clicking a toggle must not rebuild the list. Focus stays on the toggle, and text typed in other cards is untouched. → Task 2 Step 4 manual check.
2. **Reordering mixed-height cards** (collapsed between expanded) by mouse, touch and ↑/↓: the drop position is right, each exercise keeps its own collapsed state, and keyboard focus stays on the moved handle. → Task 1 test `moveExercise moves any array, such as collapsed flags`; Task 2 Step 4 manual check.
3. **Removing a card in the middle:** the cards after it keep their own state; it is not shifted onto a neighbour. → Task 2 Step 4 manual check.
4. **Import declined at the confirm prompt, or rejected as invalid:** the collapsed state does not change. → Task 2 Step 4 manual check.
5. **Narrow screens (375px):** a header with drag handle, `Exercise 10`, a long hit tag (`secondary · Upper back`), `Needs fixing`, toggle and trash wraps inside the card, with no horizontal page scroll. → Task 2 Step 4 manual check.

---

### Task 1: Exercise summary (pure function)

**Files:**
- Modify: `src/exercise.js` (add `exerciseSummary`; make the `moveExercise` JSDoc generic)
- Test: `test/exercise.test.js`

**Interfaces:**
- Consumes: nothing new.
- Produces:
  - `exerciseSummary(ex: Exercise) → string`
  - `moveExercise<T>(items: T[], from: number, to: number) → T[]` (same behaviour, JSDoc now `@template T`, so Task 2 can reuse it for `boolean[]`)

- [ ] **Step 1: Write the failing tests** in `test/exercise.test.js`. Add `exerciseSummary` to the import and keep every existing test.

```js
const ex = (name, sets, min, max, primaryMuscles, secondaryMuscles) =>
  ({ name, sets, repRange: { min, max }, primaryMuscles, secondaryMuscles });

test('exerciseSummary worked example from spec', () => {
  assert.equal(exerciseSummary(ex('Bench press', 4, 6, 10, ['Chest'], ['Triceps', 'Shoulders'])),
    'Bench press · 4 × 6–10 · Chest · secondary: Triceps, Shoulders');
  assert.equal(exerciseSummary(ex('Dips', 3, 8, 8, ['Chest', 'Triceps'], ['Shoulders'])),
    'Dips · 3 × 8 · Chest, Triceps · secondary: Shoulders');
  assert.equal(exerciseSummary(createExercise()), 'Untitled exercise · 3 × 8–12');
  assert.equal(exerciseSummary(ex('  Row ', NaN, 8, 12, [], ['Biceps'])), 'Row · ? × 8–12 · secondary: Biceps');
});

test('exerciseSummary shows ? for each invalid number', () => {
  assert.equal(exerciseSummary(ex('Squat', 2.5, 0, NaN, ['Quads'], [])), 'Squat · ? × ?–? · Quads');
});

test('exerciseSummary shows an inverted range as typed', () => {
  assert.equal(exerciseSummary(ex('Squat', 3, 12, 8, ['Quads'], [])), 'Squat · 3 × 12–8 · Quads');
});

test('exerciseSummary treats a blank name as untitled', () => {
  assert.equal(exerciseSummary(ex('   ', 3, 5, 5, ['Calves'], [])), 'Untitled exercise · 3 × 5 · Calves');
});

test('moveExercise moves any array, such as collapsed flags', () => {
  assert.deepEqual(moveExercise([true, false, false], 0, 2), [false, false, true]);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test`
Expected: FAIL. `exerciseSummary` is not exported. (The `moveExercise` test already passes; it pins the reuse.)

- [ ] **Step 3: Implement `exerciseSummary(ex)` in `src/exercise.js`**

Use a local helper that returns the number, or `'?'` unless `Number.isInteger(n) && n >= 1`. Use the same check as `isPositiveInteger` in `src/validate.js`, which is not exported; inline it rather than export it. With an inverted range, each number is valid on its own, so it shows as typed. Build the parts array, drop the empty muscle parts, and `join(' · ')`. Muscles are already in `MuscleGroup` order (`toggleMuscle` and `parseSession` keep them that way), so don't sort them again. Change the `moveExercise` JSDoc to `@template T`, `@param {T[]} exercises`, `@returns {T[]}`; the body stays the same.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test`
Expected: PASS, all tests.

- [ ] **Step 5: Commit**

```bash
git add src/exercise.js test/exercise.test.js
git commit -m "feat: summarise an exercise in one line"
```

---

### Task 2: Per-card collapse, summary, marker and default states

**Files:**
- Modify: `src/app.js` (`CARD_HTML`; new `collapsed` view state; `renderExercises()`; `refresh()` card loop; `commitMove()`; list click handler; add-exercise and import handlers)
- Modify: `style.css` (card rules, about lines 150-240)
- Modify: `docs/design-system/README.md` ("Exercise card" section)

**Interfaces:**
- Consumes: `exerciseSummary`, `moveExercise` (Task 1); `validateExercise` (existing).
- Produces for Task 3: module-level `let collapsed = []` in `src/app.js` (`boolean[]`, same length and order as `session.exercises`). `refresh()` applies it to every card, so Task 3 only changes the array and calls `refresh()`.

- [ ] **Step 1: Markup**

In `CARD_HTML`:
- Add a `.fix-tag` and a toggle between `[data-hit-tag]` and the remove button:

```html
<span class="fix-tag" data-fix-tag hidden>Needs fixing</span>
<button type="button" class="toggle-btn" data-action="toggle" aria-expanded="true" aria-label="Collapse exercise">
  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>
</button>
```

- After `.card-head`, add `<p class="card-summary" data-summary hidden></p>`.
- Wrap everything after the summary (name field through the muscles error) in `<div class="card-body">`.

In `renderExercises()`, give each body `id = exercise-body-${i}` and set the toggle's `aria-controls` to that id.

- [ ] **Step 2: State and wiring in `src/app.js`**

- Below `drag`, add `/** View state: whether each exercise is collapsed, in session order. Never part of the session. */ let collapsed = [];`
- `refresh()` card loop: with `const isCollapsed = collapsed[i]` and the existing `errors`:
  - `.card-body` `hidden = isCollapsed`
  - `[data-summary]` `hidden = !isCollapsed`, text `exerciseSummary(ex)`
  - toggle `aria-expanded = String(!isCollapsed)`, `aria-label` `Expand exercise` when collapsed, `Collapse exercise` when expanded
  - `[data-fix-tag]` `hidden = !(isCollapsed && Object.keys(errors).length > 0)`
- Keep `collapsed` in step with `session.exercises` everywhere they change:
  - add exercise: `collapsed.push(false)`
  - remove: `collapsed.splice(i, 1)`, where `i` is the index you already use for `session.exercises.splice`
  - `commitMove`: `collapsed = moveExercise(collapsed, from, to)`
  - import, only after the confirm is accepted, next to the session replace: `collapsed = result.session.exercises.map(() => true)`
- List click handler: dispatch on `event.target.closest('[data-action]')?.dataset.action`. `remove` behaves as today. `toggle` flips `collapsed[i]` and calls `refresh()` only. Don't call `renderExercises()`, so the toggle keeps focus.

- [ ] **Step 3: Styles in `style.css`**

- `.card-head`: add `flex-wrap: wrap; row-gap: 4px`.
- Move `margin-left: auto` from `.icon-btn` to the new `.toggle-btn`. `.icon-btn` is only used for the trash button.
- `.toggle-btn`: the same box as `.icon-btn` (44×44 grid, transparent, `--muted`, radius 8px). Hover: `color: var(--text); background: var(--surface-2)` (not the red remove hover). SVG 20×20 with the same stroke rules as `.icon-btn svg`. `[aria-expanded="true"] svg { transform: rotate(180deg) }` with `transition: transform 150ms ease`.
- `.fix-tag`: a pill like `.hit-tag` (padding, radius, 0.75rem, 600 weight), `color: var(--error)`, `border: 1px solid var(--error)`, transparent background.
- `.card-summary`: `--muted`, 0.875rem, `overflow-wrap: anywhere`. It wraps; it is not truncated.
- `.exercise > * + *` gives 12px spacing; add `.card-body > * + *` to the same rule so the fields keep their spacing inside the wrapper.
- `[hidden]` elements in the card stay hidden: none of the new classes may set `display` without a `[hidden]` override. The `.card-body` wrapper needs no `display`.

- [ ] **Step 4: Verify in the browser** (`npm start`, then open the served URL). Check:
  - Add 3 exercises: Bench press 4 × 6–10 Chest / Triceps, Shoulders; Dips 3 × 8–8 Chest, Triceps / Shoulders; Pull-ups 3 × 6–10 Lats / Biceps, Upper back. All start expanded, and each new one has focus on its name.
  - Collapse Bench press: the fields disappear and the summary reads exactly `Bench press · 4 × 6–10 · Chest · secondary: Triceps, Shoulders`; Dips reads `Dips · 3 × 8 · Chest, Triceps · secondary: Shoulders`. Focus stays on the toggle, and Enter/Space toggles it back. The screen reader announces collapsed/expanded.
  - Add a 4th exercise, leave it empty and collapse it: `Untitled exercise · 3 × 8–12` and `Needs fixing` appear. Expand it: the marker is gone and the inline errors show.
  - Volume panel numbers are the same with every card collapsed or expanded.
  - Select Chest in the panel: collapsed cards still show the primary/secondary border and hit tag.
  - Collapse Dips only. Drag it above Bench press with the mouse and with touch (DevTools device mode), then move it with ↑/↓: it stays collapsed, the others stay expanded, and focus stays on its handle.
  - Collapse the 2nd of 4 cards and remove the 1st: the now-1st card is still the collapsed one.
  - Export a valid session, import it: every card is collapsed. Import again and decline the confirm: the state is unchanged. Import a bad file: the state is unchanged.
  - At 375px, with the header in its fullest form (see Review Focus 5): the header wraps inside the card, with no horizontal page scroll.
  - Reduced motion emulation: the chevron flips with no transition.

- [ ] **Step 5: Update `docs/design-system/README.md`** "Exercise card": the header order is handle, index, hit tag, `Needs fixing` marker (outlined `--error` pill, collapsed and invalid only), chevron toggle (44×44, `aria-expanded`, `Collapse exercise` / `Expand exercise`, points up when expanded), trash. A collapsed card hides its fields and shows the one-line summary in `--muted`.

- [ ] **Step 6: Run the tests and commit**

Run: `npm test`
Expected: PASS.

```bash
git add src/app.js style.css docs/design-system/README.md
git commit -m "feat: collapse exercise cards to a one-line summary"
```

---

### Task 3: Expand all / Collapse all, and export opens the invalid exercise

**Files:**
- Modify: `index.html` (builder section, between `#file-message` and `#exercises`)
- Modify: `src/app.js` (`renderExercises()`, new button handlers, export handler)
- Modify: `style.css`
- Modify: `docs/design-system/README.md`

**Interfaces:**
- Consumes: `collapsed` and `refresh()` from Task 2; `validateExercise` (existing).
- Produces: nothing used by other tasks.

- [ ] **Step 1: Markup and styles**

Before `<ol id="exercises">` in `index.html`:

```html
<div id="list-actions" class="list-actions" hidden>
  <button id="expand-all" type="button" class="secondary-btn">Expand all</button>
  <button id="collapse-all" type="button" class="secondary-btn">Collapse all</button>
</div>
```

`.list-actions`: `display: flex; gap: 8px; justify-content: flex-end; margin-top: 16px`. Add `.list-actions[hidden] { display: none; }`, because the author `display` would otherwise override `hidden`.

- [ ] **Step 2: Wiring in `src/app.js`**

- `renderExercises()`: set `#list-actions` `hidden = session.exercises.length === 0`, next to the existing `empty.hidden` line.
- `#expand-all` click: `collapsed.fill(false); refresh();`. `#collapse-all` click: `collapsed.fill(true); refresh();`. Neither rebuilds the list.
- Export refusal, after setting the message: `collapsed[invalid] = false; refresh();`, then focus the first invalid field of `list.children[invalid]`. Use the first key of `validateExercise(...)` (key order is `name`, `sets`, `repRange`, `muscles`) and map it like this:

| Error key  | Focus                                            |
|------------|--------------------------------------------------|
| `name`     | `[data-field="name"]`                            |
| `sets`     | `[data-field="sets"]`                            |
| `repRange` | `[data-field="min"]`                             |
| `muscles`  | `input[data-role="primary"]:not(:disabled)` (first) |

  Keep this map as a small constant next to the export handler.

- [ ] **Step 3: Verify in the browser**
  - With no exercises: no Expand all / Collapse all. Add one: they appear. Remove it: they disappear.
  - With 3 cards in mixed states: Collapse all collapses all three; Expand all expands all three. Focus stays on the clicked button.
  - Clear exercise 2's name, press Collapse all, then press Export: the message reads `Fix exercise 2 before exporting.`, card 2 expands, and focus is in its name field. Repeat with an empty sets field (focus goes to Sets), with min > max (focus goes to Reps min), and with no primary muscle (focus goes to the first enabled primary chip).
  - A refused export expands only the named card; the others keep their state.
  - At 375px: the buttons fit, with no horizontal scroll.

- [ ] **Step 4: Update `docs/design-system/README.md`** with the "Expand all / Collapse all" secondary buttons above the exercise list (right-aligned, hidden with no exercises), and note that a refused export expands and focuses the invalid exercise.

- [ ] **Step 5: Run the tests and commit**

Run: `npm test`
Expected: PASS.

```bash
git add index.html src/app.js style.css docs/design-system/README.md
git commit -m "feat: expand or collapse all exercises; open the invalid one on export"
```
