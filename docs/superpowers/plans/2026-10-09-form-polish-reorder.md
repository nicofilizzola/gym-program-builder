# Form Polish: Remove Session Name, Reorder Exercises — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the session name from the model and the form, and let the user reorder exercises by dragging a handle (mouse or touch) or with the arrow keys.

**Architecture:** The session becomes `{ exercises: [] }`. Reordering is a pure `moveExercise(exercises, from, to)` in `src/exercise.js`, unit-tested with `node:test`. `src/app.js` adds a drag handle to each card: keyboard moves call `moveExercise` directly; pointer drags move the card's DOM node live and commit to state with `moveExercise` on release. After every committed move, `renderExercises()` + `refresh()` rebuild from state as today.

**Tech Stack:** HTML, CSS, vanilla JS ES modules, `node:test` on Node 22. No dependencies, no build step.

**Spec:** `AGENTS.md` (functional requirements 1 and 5, implementation guidelines)

## Decisions (confirmed with the user, 2026-10-09)

- The session name is removed from the model, not just hidden. `validateSessionName` goes away.
- The heading stays "Session builder".
- Reorder by drag and drop on a ⋮⋮ handle, implemented with pointer events (works for mouse and touch). No native HTML5 drag API, no library.
- Keyboard: with the handle focused, ↑ / ↓ moves the exercise one place; focus follows the moved exercise's handle.

## Global Constraints

- No runtime or dev dependencies; no build step.
- Order does not affect volume. `computeVolume` is not changed except its `Session` typedef.
- Validation: exercise names must be non-empty after trim (message stays `'Name is required.'`), sets ≥ 1, rep range `min ≤ max`.
- Design system (`docs/design-system/README.md`): icon buttons are 44×44 with an `aria-label`; icons are inline SVG strokes, 2px, round caps, `currentColor`, `aria-hidden`; visible focus ring; `prefers-reduced-motion: reduce` turns transitions off.

## Review Focus

1. **Moving a card with half-typed or invalid values** (empty name, empty sets → `NaN`): the values and their error messages move with the card unchanged. → Task 3 Step 5, Task 4 Step 4.
2. **A muscle is selected in the volume panel while reordering:** the primary/secondary highlight and hit tag follow the exercise to its new position. → Task 3 Step 5.
3. **Arrow key at the first/last card:** order does not change, the page does not scroll, focus stays on the handle. → Task 3 Step 5.
4. **Touch drag interrupted** (`pointercancel`, e.g. a system gesture): the list returns to the pre-drag order and state is untouched. → Task 4 Step 4.
5. **Dragging past the top or bottom of the list:** the card lands first or last; never lost or duplicated. → Task 2 clamp tests, Task 4 Step 4.

---

### Task 1: Remove the session name

**Files:**
- Modify: `index.html` (remove the `.session-name` label and `#session-name-error`)
- Modify: `src/app.js` (state, `nameInput`/`nameError`, their listener, the first line of `refresh()`, the `validateSessionName` import)
- Modify: `src/validate.js`
- Modify: `src/volume.js` (typedef only)
- Modify: `style.css` (delete `.session-name input` rule)
- Modify: `docs/design-system/README.md` (delete the "Session name input" row of the type-size table)
- Test: `test/validate.test.js`, `test/volume.test.js`

**Interfaces:**
- Produces: `Session` typedef is `{ exercises: Exercise[] }`. `src/validate.js` exports only `validateExercise`.

- [ ] **Step 1: Update tests to the new model**

In `test/validate.test.js`: import only `validateExercise`; in `'empty and whitespace names are rejected'` delete the two `validateSessionName` asserts. Add:

```js
test('validate.js no longer exports validateSessionName', async () => {
  const mod = await import('../src/validate.js');
  assert.equal('validateSessionName' in mod, false);
});
```

In `test/volume.test.js`: remove every `name:` key from session objects (e.g. `computeVolume({ exercises: [] })`).

- [ ] **Step 2: Run tests to verify the new test fails**

Run: `npm test`
Expected: FAIL only in `validate.js no longer exports validateSessionName`.

- [ ] **Step 3: Implement**

- `src/validate.js`: replace the exported `validateSessionName` with a non-exported `requireName(name)` (same body, same message) used by `validateExercise`.
- `src/volume.js`: typedef `Session` becomes `{{ exercises: Exercise[] }}`.
- `src/app.js`: `const session = { exercises: [] };` and remove everything that read or wrote `session.name`.
- `index.html`, `style.css`, design-system README: delete as listed under **Files**.

- [ ] **Step 4: Verify**

Run: `npm test` → all pass.
Run: `git grep -n -E "session-name|validateSessionName|session\.name"` → no output.
Run `npm start`, open the page: no name field, no console errors, adding/editing exercises still updates the volume panel.

- [ ] **Step 5: Commit**

```bash
git add AGENTS.md index.html src/app.js src/validate.js src/volume.js style.css docs/design-system/README.md test/validate.test.js test/volume.test.js
git commit -m "refactor: remove session name"
```

(`AGENTS.md` already holds the updated spec for this whole plan; it goes in the first commit.)

---

### Task 2: `moveExercise` pure function

**Files:**
- Modify: `src/exercise.js`
- Test: `test/exercise.test.js`

**Interfaces:**
- Produces: `moveExercise(exercises: Exercise[], from: number, to: number) → Exercise[]` — a new array with the item at `from` moved to index `to`. `to` is clamped to `[0, exercises.length - 1]`. If `from` is out of range, returns an unchanged copy. Never mutates the input; keeps the same exercise objects (no cloning).

- [ ] **Step 1: Write the failing tests** (`test/exercise.test.js`, import `moveExercise`)

```js
const A = { name: 'A' }, B = { name: 'B' }, C = { name: 'C' };

test('moveExercise moves down and up', () => {
  assert.deepEqual(moveExercise([A, B, C], 0, 2), [B, C, A]);
  assert.deepEqual(moveExercise([A, B, C], 2, 0), [C, A, B]);
  assert.deepEqual(moveExercise([A, B, C], 1, 2), [A, C, B]);
});

test('moveExercise to same index returns an equal copy', () => {
  const list = [A, B, C];
  const result = moveExercise(list, 1, 1);
  assert.deepEqual(result, list);
  assert.notEqual(result, list);
});

test('moveExercise clamps the target index', () => {
  assert.deepEqual(moveExercise([A, B, C], 1, -1), [B, A, C]);
  assert.deepEqual(moveExercise([A, B, C], 1, 99), [A, C, B]);
});

test('moveExercise ignores an out-of-range source', () => {
  assert.deepEqual(moveExercise([A, B, C], 5, 0), [A, B, C]);
});

test('moveExercise does not mutate and keeps object identity', () => {
  const list = [A, B, C];
  const result = moveExercise(list, 0, 2);
  assert.deepEqual(list, [A, B, C]);
  assert.equal(result[2], A);
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `node --test test/exercise.test.js`
Expected: FAIL — `moveExercise` is not exported.

- [ ] **Step 3: Implement `moveExercise` in `src/exercise.js`** with a JSDoc block in the style of `toggleMuscle` (copy, `splice` out, clamp, `splice` in).

- [ ] **Step 4: Run to verify they pass**

Run: `npm test` → all pass.

- [ ] **Step 5: Commit**

```bash
git add src/exercise.js test/exercise.test.js
git commit -m "feat: add moveExercise for reordering"
```

---

### Task 3: Drag handle + keyboard reorder

**Files:**
- Modify: `src/app.js` (`CARD_HTML`, new `keydown` listener on `list`)
- Modify: `index.html` (add the live region)
- Modify: `style.css` (`.drag-handle`, `.visually-hidden`)
- Modify: `docs/design-system/README.md` (Exercise card section)

**Interfaces:**
- Consumes: `moveExercise` from Task 2.
- Produces (used by Task 4): each card's head starts with `<button type="button" class="drag-handle" aria-label="Reorder exercise">` containing a 6-dot grip SVG; a helper `commitMove(from: number, to: number): void` in `app.js` that, when `from !== to`, sets `session.exercises = moveExercise(...)`, calls `renderExercises()` + `refresh()`, focuses the handle of the card at the new index, and writes `Moved <name or "exercise"> to position <to+1> of <n>.` into `#order-status`.

- [ ] **Step 1: Markup.** In `CARD_HTML`, put the handle button first in `.card-head` (before `.card-index`), with `aria-describedby="reorder-hint"`. In `index.html`, inside `.builder` after the add button, add:

```html
<p id="reorder-hint" class="visually-hidden">Drag, or use the up and down arrow keys, to move this exercise.</p>
<p id="order-status" class="visually-hidden" aria-live="polite"></p>
```

- [ ] **Step 2: Styles.** `.drag-handle`: 44×44, transparent, `color: var(--muted)`, `cursor: grab`, `touch-action: none` (required for touch drag in Task 4), same SVG sizing as `.icon-btn svg` (6 small filled circles, `fill: currentColor`). Hover: `color: var(--text)`. `.visually-hidden`: standard clip pattern. The remove button keeps `margin-left: auto`, so it stays on the right.

- [ ] **Step 3: Keyboard.** `list` `keydown` listener: if the target is a `.drag-handle` and the key is `ArrowUp` / `ArrowDown`, call `event.preventDefault()` always, then `commitMove(i, i ∓ 1)` only if the new index is within `[0, length - 1]`.

- [ ] **Step 4: Design doc.** In the Exercise card section of the design-system README, change the header description to: drag handle (⋮⋮, 44×44, `cursor: grab`, arrow keys move) · "Exercise N" index · optional hit tag · trash button.

- [ ] **Step 5: Manual verification** (`npm start`). Add three exercises A, B, C.
  - Tab to B's handle, press ↑ → order B, A, C; "Exercise N" labels renumber; focus is on B's handle; screen-reader text in `#order-status` reads "Moved B to position 1 of 3."
  - Press ↑ again on B (now first) → nothing moves, the page does not scroll, focus stays. Same for ↓ on the last card.
  - Clear C's name and sets, then move C up → empty name and empty sets fields and their errors stay on C.
  - Select "Chest" in the volume panel where only A trains chest; move A → the primary highlight and "primary · Chest" tag stay on A.
  - `npm test` still passes.

- [ ] **Step 6: Commit**

```bash
git add index.html src/app.js style.css docs/design-system/README.md
git commit -m "feat: reorder exercises with a handle and arrow keys"
```

---

### Task 4: Pointer drag-and-drop

**Files:**
- Modify: `src/app.js` (pointer listeners on `list`, one module-level `drag` view-state variable)
- Modify: `style.css` (`.exercise.is-dragging`, `.drag-handle:active`)

**Interfaces:**
- Consumes: `.drag-handle` and `commitMove(from, to)` from Task 3.

- [ ] **Step 1: Drag state and start.** Module-level `let drag = null; // { card, from }`, next to `selectedMuscle`. On `pointerdown` on a `.drag-handle` with `event.button === 0`: `preventDefault()`, `handle.setPointerCapture(event.pointerId)`, set `drag = { card, from: indexOf(handle) }`, add `.is-dragging` to the card.

- [ ] **Step 2: Move and drop.** Algorithm:

```text
pointermove (drag set):
  others = cards in list except drag.card
  target = number of others whose vertical midpoint (getBoundingClientRect) is above event.clientY
  insert drag.card before others[target], or append if target === others.length
  (DOM only — do not touch state, do not re-render; that would drop pointer capture)

pointerup:
  to = index of drag.card among list.children
  remove .is-dragging; from = drag.from; drag = null
  if to !== from → commitMove(from, to) else nothing

pointercancel:
  drag = null; renderExercises(); refresh()   // state was never changed, so this restores the order
```

Volume does not depend on order, so nothing else needs refreshing during the drag.

- [ ] **Step 3: Styles.** `.exercise.is-dragging`: `border-color: var(--accent)`, `box-shadow` like the primary hit state, `opacity: 0.9`. `.drag-handle:active` and the dragging card's handle: `cursor: grabbing`. No new transitions (existing reduced-motion rule covers the card).

- [ ] **Step 4: Manual verification** (`npm start`, desktop and devtools touch emulation / a phone). Three exercises A, B, C.
  - Drag A's handle below C → order B, C, A after release; labels renumber; focus on A's handle.
  - Drag C far above the top of the list and far below the bottom → lands first / last, list still has exactly three cards.
  - Click a handle without moving → nothing changes.
  - Right-click a handle → no drag starts.
  - On touch: the page does not scroll while dragging the handle; scrolling by swiping on the card body still works.
  - Touch-drag A, then trigger a cancel (devtools: start a drag and switch tabs / rotate emulated device) → order is back to the pre-drag order.
  - Drag a card whose sets field is empty → value and error move with it.
  - Text in inputs is not selected during a drag.
  - `npm test` still passes.

- [ ] **Step 5: Commit**

```bash
git add src/app.js style.css
git commit -m "feat: drag and drop to reorder exercises"
```
