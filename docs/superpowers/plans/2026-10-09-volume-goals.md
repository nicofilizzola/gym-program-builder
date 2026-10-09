# Volume Goals Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the user set an optional volume goal per muscle group in a dialog, and show each muscle's volume against its goal (`7 / 10`, bar, under / met / over) in the volume list.

**Architecture:** Goals live on the in-memory session as `session.goals` (`Partial<Record<MuscleGroup, number>>`). Two pure, unit-tested functions carry the rules: `goalStatus(volume, goal)` in `src/volume.js` and `validateGoal(goal)` in `src/validate.js`. `src/app.js` adds a native `<dialog>` that writes `session.goals` live and calls `refresh()`, and `refresh()` derives progress and status on every render. The body map is untouched.

**Tech Stack:** HTML, CSS, vanilla JS ES modules, `node:test` on Node 22. No dependencies, no build step.

**Spec:** `AGENTS.md` (domain model, functional requirements 6–7, "Goal status (business rule)" and its worked example, implementation guidelines, "Decided")

## Global Constraints

- No runtime or dev dependencies; no build step. Dialog is the native `<dialog>` element.
- A goal is a positive multiple of 0.5. An empty field clears the goal. An invalid value shows an error and is not applied.
- `status = under if volume < goal, met if volume = goal, over if volume > goal`; `progress = min(volume / goal, 1)`. A muscle with no goal has no status.
- Volume and goals are shown as-is (`4.5`), never rounded.
- Status is always shown as text; colour never stands alone.
- The body map keeps the absolute heat colours (`volumeLevel`); goals do not change it.
- Goals are in memory only, like the rest of the session.
- Design system (`docs/design-system/README.md`): one accent colour (`--accent`), 44px touch targets, visible focus ring, labels always visible above fields, errors directly under their field, `prefers-reduced-motion` turns transitions off.

## Review Focus

1. **Partial or invalid input while typing** (`0`, `-2`, `7.3`, `1e`, a lone `.`): the field shows an error, the previously applied goal stays in effect, and the panel never shows `NaN`. → Task 2 Step 4.
2. **Closing the dialog with an invalid field, then reopening:** the field shows the applied goal (or empty), with no stale error. → Task 2 Step 4.
3. **Clearing a goal:** the row returns exactly to its no-goal look (bar on the 10-set scale, plain value, no status). → Task 3 Step 4.
4. **Goal on a muscle with 0 volume, and volume far above the goal:** `0 / 8 under` with an empty bar; `12.5 / 10 over` with a full bar, value not rounded. → Task 1 tests, Task 3 Step 4.
5. **Goals survive exercise edits:** adding, removing and reordering exercises (which rebuild the exercise list) never reset goals. → Task 3 Step 4.

---

### Task 1: Goal rules (pure functions)

**Files:**
- Modify: `src/volume.js` (add `goalStatus`)
- Modify: `src/validate.js` (add `validateGoal`)
- Test: `test/volume.test.js`, `test/validate.test.js`

**Interfaces:**
- Produces: `goalStatus(volume: number, goal: number | undefined) → { status: 'under' | 'met' | 'over', progress: number } | null` (null when `goal` is `undefined`).
- Produces: `validateGoal(goal: number) → string | null`; the message is exactly `'Goal must be a positive multiple of 0.5.'`.

- [ ] **Step 1: Write the failing tests**

In `test/volume.test.js` (import `goalStatus`):

```js
test('goal worked example from spec', () => {
  assert.deepEqual(goalStatus(7, 7), { status: 'met', progress: 1 });
  assert.deepEqual(goalStatus(5, 4), { status: 'over', progress: 1 });
  assert.deepEqual(goalStatus(3, 6), { status: 'under', progress: 0.5 });
  assert.deepEqual(goalStatus(0, 8), { status: 'under', progress: 0 });
  assert.equal(goalStatus(1.5, undefined), null);
});

test('goal status works on half sets', () => {
  assert.deepEqual(goalStatus(4.5, 4.5), { status: 'met', progress: 1 });
  assert.deepEqual(goalStatus(12.5, 10), { status: 'over', progress: 1 });
  assert.deepEqual(goalStatus(2.5, 10), { status: 'under', progress: 0.25 });
});
```

In `test/validate.test.js` (import `validateGoal`):

```js
test('goals must be a positive multiple of 0.5', () => {
  for (const goal of [0.5, 1, 4.5, 10, 30]) assert.equal(validateGoal(goal), null);
  for (const goal of [0, -1, -0.5, 7.3, 0.25, NaN, Infinity]) {
    assert.equal(validateGoal(goal), 'Goal must be a positive multiple of 0.5.');
  }
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL, because `goalStatus` and `validateGoal` are not exported.

- [ ] **Step 3: Implement `goalStatus` in `src/volume.js` and `validateGoal` in `src/validate.js`**

Use the JSDoc style of the neighbouring functions. For `validateGoal`, `Number.isInteger(goal * 2) && goal > 0` rejects `NaN` and `Infinity` too.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS, all tests (old and new).

- [ ] **Step 5: Commit**

```bash
git add src/volume.js src/validate.js test/volume.test.js test/validate.test.js
git commit -m "feat: add goalStatus and validateGoal"
```

---

### Task 2: Goals state and the "Set goals" dialog

**Files:**
- Modify: `index.html` (button in `.panel-head`, `<dialog>` after `</main>`)
- Modify: `src/app.js`
- Modify: `style.css`
- Modify: `docs/design-system/README.md` (Buttons: secondary button; Components: new "Goals dialog" section)

**Interfaces:**
- Consumes: `validateGoal` (Task 1), `MUSCLE_GROUPS`.
- Produces: `session` is `{ exercises: [], goals: {} }`. A key exists in `session.goals` only when that muscle has a valid goal.

- [ ] **Step 1: Add the markup to `index.html`**

- In `.panel-head`, after the "sets per muscle" unit: `<button id="open-goals" type="button" class="secondary-btn">Set goals</button>`.
- After `</main>`: `<dialog id="goals-dialog" class="goals-dialog" aria-labelledby="goals-title">` containing an `<h2 id="goals-title">Volume goals</h2>`, a hint `<p>` "Target sets per muscle. Leave empty for no goal.", an empty `<div id="goal-fields">`, and `<form method="dialog"><button class="add-btn">Done</button></form>`.

- [ ] **Step 2: Wire the dialog in `src/app.js`**

- `session` gains `goals: {}`; update its comment.
- `renderGoalFields()`, called once at start-up: for each muscle in `MUSCLE_GROUPS`, a `<label class="field">{muscle} <input type="number" min="0.5" step="0.5" inputmode="decimal" data-goal="{muscle}"></label>` and a `<p class="error" data-goal-error="{muscle}"></p>`. Set the muscle names with `textContent` and `dataset`, as `renderPanel()` does.
- `syncGoalFields()`: set each input's value from `session.goals` (empty when there is no key) and clear every goal error. Call it right before `showModal()`, so a reopened dialog never shows discarded text.
- `#open-goals` click → `syncGoalFields(); dialog.showModal();`.
- `input` on `#goal-fields`: if `input.value.trim() === ''` and `!input.validity.badInput`, delete the key and clear the error. Otherwise read `valueAsNumber`; if `validateGoal` returns a message, show it and leave `session.goals` unchanged; if not, set the key and clear the error. Then call `refresh()`.
- Backdrop click: a `click` on the dialog whose `event.target === dialog` closes it. Escape and Done close it natively, and focus returns to `#open-goals`.

- [ ] **Step 3: Style it in `style.css`**

- `.secondary-btn`: min-height 44px, transparent, `1px solid var(--border)`, radius 8px, display font uppercase, `--text`; on hover the border turns `--accent`. In `.panel-head`, put the unit and the button on the right (for example `margin-left: auto` on the unit, with a gap).
- `.goals-dialog`: `--surface` background, `--border` border, `--radius`, `--text` colour, `width: min(420px, calc(100vw - 32px))`, `max-height: calc(100dvh - 32px)` with scrolling content. `::backdrop` is `rgba(0, 0, 0, 0.6)`.
- `#goal-fields`: a two-column grid (one column at ≤ 760px), 12px gap. It reuses the existing `.field` and `.error` styles.

- [ ] **Step 4: Verify in the browser**

Run: `npm start` and open the printed URL at desktop width and at 375px width.
Expected:
- "Set goals" opens a modal with 10 empty fields in `MUSCLE_GROUPS` order, and it fits at 375px without horizontal scroll.
- Typing `0`, `-2`, `7.3` or `1e` shows "Goal must be a positive multiple of 0.5." under that field.
- Type `8` in Chest, then close with Done. Reopen: Chest shows `8`. Change it to `7.3` and press Escape. Reopen: Chest shows `8`, with no error.
- Empty Chest, close, and reopen: Chest is empty.
- A backdrop click closes the dialog. After each close, focus is on "Set goals".
- `npm test` still passes.

- [ ] **Step 5: Update the design system and commit**

In `docs/design-system/README.md`, add the secondary button to "Buttons", add "Set goals" to the Volume panel header item, and add a "Goals dialog" component entry (native `<dialog>`, live apply, Done / Escape / backdrop close, errors under fields).

```bash
git add index.html src/app.js style.css docs/design-system/README.md
git commit -m "feat: set volume goals per muscle in a dialog"
```

---

### Task 3: Show volume relative to goals

**Files:**
- Modify: `src/app.js` (`renderPanel`, `refresh`)
- Modify: `style.css` (`.volume-row`, desktop and the ≤ 760px block)
- Modify: `docs/design-system/README.md` (Volume panel item 5, the colour-token use notes)

**Interfaces:**
- Consumes: `goalStatus` (Task 1), `session.goals` (Task 2).

- [ ] **Step 1: Add a status cell to each row in `renderPanel()`**

After `.value`, add `<span class="status"></span>`.

- [ ] **Step 2: Derive the goal display in `refresh()`**

For each `.volume-row`: `const result = goalStatus(sets, session.goals[muscle])`.
- With a goal: `.value` is `` `${sets} / ${goal}` ``, the bar width is `result.progress * 100%`, `.status` text is `result.status`, and `row.dataset.status = result.status`.
- Without a goal: everything works as today (`sets`, `min(sets / 10, 1)`, empty status), and `delete row.dataset.status`.
- `data-level` (heat) stays on the row in both cases, so the bar colour and the body map keep their heat meaning.
- Readout: when the focused muscle has a goal, it reads `Chest 7 / 10 sets · met · 2 exercises`. Otherwise it reads as today.

- [ ] **Step 3: Style the status in `style.css`**

- `.volume-row` columns become `88px 1fr auto auto`. `.status` is 0.75rem, uppercase, and `--muted` for `under`. `met` uses `--accent`. `over` uses `--lvl-4` (`#fbbf24`) text with a `1px solid` border of the same colour, pill radius. These are selected with `.volume-row[data-status="…"] .status`. An empty `.status` takes no space.
- At ≤ 760px, the chip's grid becomes `auto auto auto`, so the strip reads `Chest 7 / 10 MET` on one line.

- [ ] **Step 4: Verify in the browser**

Run: `npm start`. Enter the AGENTS.md volume worked example (Bench press 4 sets, Dips 3, Pull-ups 3, with their muscles), then set the goals Chest 7, Triceps 4, Lats 6, Quads 8.
Expected:
- The rows read Chest `7 / 7` met (full bar), Triceps `5 / 4` over (full bar), Lats `3 / 6` under (half bar), Quads `0 / 8` under (empty bar), and Biceps `1.5` with no status. Body map colours are the same as before the goals were set.
- Add a fourth exercise with Chest 3 sets primary: Chest becomes `10 / 7` over. Remove it: Chest goes back to `7 / 7` met.
- Drag Pull-ups to the top, then use the arrow keys on a handle: goals and statuses are unchanged.
- Clear the Lats goal: the row shows `3` with a bar at 30%, no status, and no `data-status` attribute.
- Set the Biceps goal to 1: the row shows `1.5 / 1` over with a full bar, not rounded. Set it to 1.5: `1.5 / 1.5` met.
- At 375px width, statuses are visible in the pinned strip with no page-level horizontal scroll.
- Select a muscle with a goal: the readout includes the goal and status.
- `npm test` passes.

- [ ] **Step 5: Update the design system and commit**

In `docs/design-system/README.md`, Volume panel item 5: rows with a goal show `volume / goal`, a bar relative to the goal, and an under / met / over tag (with the colours from Step 3). Rows without a goal keep the bar on the 10-set scale. Note that the body map stays on absolute heat.

```bash
git add src/app.js style.css docs/design-system/README.md
git commit -m "feat: show volume relative to goals"
```
