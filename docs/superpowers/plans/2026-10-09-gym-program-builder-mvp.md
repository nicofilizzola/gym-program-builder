# Gym Program Builder MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a single-page session builder where the user edits one session and sees the set volume for each muscle group update live.

**Architecture:** A static `index.html` loads vanilla JS ES modules. The domain logic lives in three pure modules: the muscle constant, the volume calculation, and validation plus exercise helpers. Node's built-in test runner unit-tests these modules. `app.js` owns the in-memory `session` object and the DOM. On every input event, it derives the volume and error output from the session again.

**Tech Stack:** HTML, CSS, and vanilla JavaScript (ES modules). Tests use `node:test` and `node:assert/strict` on Node 22. There are no npm dependencies and no build step.

**Spec:** `AGENTS.md`

## Decisions (confirmed with the user, 2026-10-09)

- Stack: a static page with no build step.
- Persistence: in memory only. A reload clears the session.
- Overlap: a muscle cannot be both primary and secondary on one exercise. The UI prevents it, and validation also rejects it.
- An exercise needs at least 1 primary muscle. If it has none, a validation error is shown.
- There is one session, and only one.
- Invalid input does not block the volume panel. Any exercise whose `sets` value is not an integer ≥ 1 contributes 0, so the panel never shows `NaN`.

## Global Constraints

- `MUSCLE_GROUPS` has exactly these values, in this order: `Chest, Lats, Upper back, Biceps, Triceps, Shoulders, Abs, Quads, Hamstrings, Calves`. It is defined once, in `src/muscles.js`. The form, the panel, and validation all import it.
- Volume per muscle = Σ `sets × 1` (primary) + `sets × 0.5` (secondary). Rep range has no effect on volume.
- Volume is displayed unrounded: `String(value)`, for example `4.5` and `7`.
- Volume is derived on render. It is never stored in state.
- Validation rules: the session name and exercise names must be non-empty after trim. `sets` must be an integer ≥ 1. Rep `min` and `max` must be positive integers with `min ≤ max`. There must be at least 1 primary muscle. There must be no muscle in both lists.
- No runtime or dev dependencies. `package.json` exists only to set `"type": "module"` and define the scripts.
- Out of scope: auth, persistence, presets, weight/RPE, scheduling, multiple sessions.

## Review Focus

1. **Empty sets field (`NaN`).** If the user clears the sets input, the panel must show numbers and never `NaN`. That exercise contributes 0 and shows a sets error. Covered by a test in Task 1 and a test in Task 2.
2. **Decimal or negative sets (`2.5`, `-1`, `0`).** These are rejected by validation and contribute 0 volume. Covered in Tasks 1 and 2.
3. **Losing focus while typing.** Every keystroke updates the panel. If the exercise list re-renders on each input event, the input loses focus. The list must re-render only on add or remove. This is a manual check in Task 4.
4. **Whitespace-only names (`"   "`).** These are invalid. Covered in Task 2.
5. **Removing a middle exercise.** If there are 3 exercises and the user removes #2, then #2 is the one that disappears, and the panel drops its volume immediately. This is a manual check in Task 4.

---

## File Structure

```
package.json            # type: module, test/start scripts, no deps
index.html              # page shell: session name input, exercise list, add button, volume panel
style.css               # minimal two-column layout (form | panel), stacks on narrow screens
src/muscles.js          # MUSCLE_GROUPS constant
src/volume.js           # computeVolume (pure)
src/validate.js         # validateSessionName, validateExercise (pure)
src/exercise.js         # createExercise, toggleMuscle (pure)
src/app.js              # in-memory state + DOM wiring
test/volume.test.js
test/validate.test.js
test/exercise.test.js
```

Shared shapes (JS, documented with JSDoc in the module that owns them):

```js
// Exercise: { name: string, sets: number, repRange: { min: number, max: number },
//             primaryMuscles: string[], secondaryMuscles: string[] }
// Session:  { name: string, exercises: Exercise[] }
```

`sets`, `min`, and `max` hold `input.valueAsNumber`, so they can be `NaN` when a field is empty.

---

### Task 1: Scaffold, muscle constant, computeVolume

**Files:**
- Create: `package.json`, `src/muscles.js`, `src/volume.js`
- Test: `test/volume.test.js`

**Interfaces:**
- Produces: `export const MUSCLE_GROUPS: readonly string[]`, which is frozen and has the 10 values in spec order.
- Produces: `export function computeVolume(session: Session): Record<string, number>`. It returns a key for every muscle in `MUSCLE_GROUPS`, in that order, and the value is 0 when no exercise hits the muscle.

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "gym-program-builder",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "node --test \"test/*.test.js\"",
    "start": "npx --yes serve ."
  }
}
```

(Browsers block ES modules loaded from `file://`, so the page has to be served over HTTP. `npx serve` runs without adding a dependency. Any static server works.)

- [ ] **Step 2: Write failing tests in `test/volume.test.js`**

Use `test` from `node:test` and `assert` from `node:assert/strict`. Write these tests:

- `MUSCLE_GROUPS has the 10 spec values in order`: `assert.deepEqual([...MUSCLE_GROUPS], ['Chest','Lats','Upper back','Biceps','Triceps','Shoulders','Abs','Quads','Hamstrings','Calves'])`, and `Object.isFrozen(MUSCLE_GROUPS)`.
- `worked example from spec`: a session with Bench press (4, primary `[Chest]`, secondary `[Triceps, Shoulders]`), Dips (3, `[Chest, Triceps]`, `[Shoulders]`), and Pull-ups (3, `[Lats]`, `[Biceps, Upper back]`). Expect `deepEqual` against `{ Chest: 7, Lats: 3, 'Upper back': 1.5, Biceps: 1.5, Triceps: 5, Shoulders: 3.5, Abs: 0, Quads: 0, Hamstrings: 0, Calves: 0 }`.
- `empty session gives all zeros`: `{ name: 'x', exercises: [] }` → each of the 10 keys is `0`.
- `rep range does not affect volume`: two otherwise identical sessions with rep ranges `{1,1}` and `{20,30}` give equal results.
- `invalid sets contribute 0`: one exercise each with `sets` equal to `NaN`, `0`, `-2`, and `2.5`, all with primary `[Quads]`. `Quads` must be `0` for each.
- `keys follow MUSCLE_GROUPS order`: `assert.deepEqual(Object.keys(result), [...MUSCLE_GROUPS])`.

- [ ] **Step 3: Run the tests to confirm they fail**

Run: `npm test`
Expected: FAIL with a module-not-found error for `src/muscles.js` and `src/volume.js`.

- [ ] **Step 4: Implement `src/muscles.js` and `src/volume.js`**

`computeVolume` seeds a `0` for each `MUSCLE_GROUPS` entry. For each exercise, it skips the exercise unless `Number.isInteger(sets) && sets >= 1`. It then adds `sets` for each primary muscle and `sets * 0.5` for each secondary muscle.

- [ ] **Step 5: Run the tests to confirm they pass**

Run: `npm test`
Expected: all 6 tests pass.

- [ ] **Step 6: Commit**

```bash
git add package.json src/muscles.js src/volume.js test/volume.test.js
git commit -m "feat: add muscle groups constant and computeVolume"
```

---

### Task 2: Validation

**Files:**
- Create: `src/validate.js`
- Test: `test/validate.test.js`

**Interfaces:**
- Consumes: `MUSCLE_GROUPS` from `src/muscles.js`.
- Produces: `export function validateSessionName(name: string): string | null`. It returns an error message, or `null`.
- Produces: `export function validateExercise(ex: Exercise): { name?: string, sets?: string, repRange?: string, muscles?: string }`. It returns an empty object `{}` when the exercise is valid. Each key holds one user-facing message.

Messages (exact copy):
- Session name or exercise name: `"Name is required."`
- `sets`: `"Sets must be a whole number of at least 1."`
- `repRange`: `"Reps must be whole numbers of at least 1, with min ≤ max."`
- `muscles`: `"Pick at least one primary muscle."`. If the problem is overlap, use `"A muscle cannot be both primary and secondary."`. If a muscle is unknown, use `"Unknown muscle group."`. Check them in this order and report the first one that fails.

- [ ] **Step 1: Write failing tests in `test/validate.test.js`**

Start from a `valid()` helper that returns `{ name: 'Squat', sets: 3, repRange: { min: 5, max: 8 }, primaryMuscles: ['Quads'], secondaryMuscles: ['Hamstrings'] }`. Write these tests:

- `valid exercise has no errors`: `deepEqual(validateExercise(valid()), {})`.
- `empty and whitespace names are rejected`: names `''` and `'   '` → `errors.name === 'Name is required.'`. Also `validateSessionName('  ')` returns that message, and `validateSessionName('Push day')` returns `null`.
- `sets must be integer >= 1`: for each of `NaN, 0, -1, 2.5`, `errors.sets` is set. For `1`, `errors.sets` is `undefined`.
- `rep range`: `{min: 10, max: 8}`, `{min: 0, max: 5}`, `{min: NaN, max: 5}`, and `{min: 5.5, max: 8}` each set `errors.repRange`. `{min: 8, max: 8}` is valid.
- `requires a primary muscle`: `primaryMuscles: []` → `errors.muscles === 'Pick at least one primary muscle.'`.
- `rejects overlap`: primary `['Chest']` and secondary `['Chest']` → the overlap message.
- `rejects unknown muscle`: primary `['Glutes']` → `'Unknown muscle group.'`.

- [ ] **Step 2: Run the tests to confirm they fail**

Run: `npm test`
Expected: the `validate.test.js` tests fail with module not found, and the `volume` tests still pass.

- [ ] **Step 3: Implement `src/validate.js`**

- [ ] **Step 4: Run the tests to confirm they pass**

Run: `npm test`
Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/validate.js test/validate.test.js
git commit -m "feat: add session and exercise validation"
```

---

### Task 3: Exercise helpers

**Files:**
- Create: `src/exercise.js`
- Test: `test/exercise.test.js`

**Interfaces:**
- Produces: `export function createExercise(): Exercise`. It returns a fresh object each call: `{ name: '', sets: 3, repRange: { min: 8, max: 12 }, primaryMuscles: [], secondaryMuscles: [] }`.
- Produces: `export function toggleMuscle(ex: Exercise, role: 'primary' | 'secondary', muscle: string): Exercise`. It returns a **new** exercise and does not mutate `ex`. If `muscle` is in the role's list, it is removed. Otherwise it is added to that list and removed from the other list, which enforces the no-overlap rule even if the UI misses a case. Muscle lists stay in `MUSCLE_GROUPS` order.

- [ ] **Step 1: Write failing tests in `test/exercise.test.js`**

- `createExercise returns independent defaults`: two calls give `deepEqual` values but different `primaryMuscles` arrays, so `a.primaryMuscles !== b.primaryMuscles`.
- `toggle adds then removes`: toggling `'Chest'` as primary on a fresh exercise gives `['Chest']`, and toggling it again gives `[]`.
- `toggle does not mutate input`: the original `primaryMuscles` is still `[]` after the toggle.
- `adding to one role removes from the other`: with secondary `['Triceps']`, toggling `'Triceps'` as primary gives primary `['Triceps']` and secondary `[]`.
- `lists stay in MUSCLE_GROUPS order`: toggling `'Calves'` and then `'Chest'` as primary gives `['Chest', 'Calves']`.

- [ ] **Step 2: Run the tests to confirm they fail**

Run: `npm test`
Expected: the `exercise.test.js` tests fail with module not found.

- [ ] **Step 3: Implement `src/exercise.js`**

To keep the order, filter `MUSCLE_GROUPS` by membership in the updated set instead of appending.

- [ ] **Step 4: Run the tests to confirm they pass**

Run: `npm test`
Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/exercise.js test/exercise.test.js
git commit -m "feat: add exercise factory and muscle toggle"
```

---

### Task 4: UI (form, live volume panel)

**Files:**
- Create: `index.html`, `style.css`, `src/app.js`

**Interfaces:**
- Consumes: `MUSCLE_GROUPS`, `computeVolume(session)`, `validateSessionName(name)`, `validateExercise(ex)`, `createExercise()`, and `toggleMuscle(ex, role, muscle)`, all with the signatures from Tasks 1–3.
- Produces: the running app. Nothing else depends on it.

**Rendering contract (the decisions that make this task unambiguous):**
- State: `let session = { name: '', exercises: [] }`, in module scope in `app.js`. It is the only state. Nothing else is stored.
- `renderExercises()` rebuilds the exercise list DOM. Call it **only** on page load, on Add, and on Remove.
- `refresh()` re-renders the volume panel and every error message, and sets each muscle checkbox's `checked` and `disabled` state. Call it after **every** state change, including every `input` and `change` event. It must not recreate the input elements.
- Each exercise card contains:
  - a name text input
  - a sets `<input type="number" min="1" step="1">`
  - rep min and max number inputs
  - a "Primary" fieldset and a "Secondary" fieldset, each with one checkbox per `MUSCLE_GROUPS` entry
  - a "Remove" button
  - an error line for each field
- A secondary checkbox is `disabled` while that muscle is checked as primary, and the reverse applies too.
- Read numbers with `input.valueAsNumber`. Write them back to the exercise in `session.exercises[i]`, and replace the exercise object when you use `toggleMuscle`.
- The volume panel is a `<table>` with one row per `MUSCLE_GROUPS` entry, always in that order, and the value shown is `String(volume[m])`. Muscles with 0 volume stay visible.
- There is a session name input at the top, with its error line beneath it. The "Add exercise" button appends `createExercise()`.
- Layout: the form is on the left and the panel on the right. The panel uses `position: sticky` so it stays visible. The layout stacks into one column under 700px. Keep the CSS minimal.

- [ ] **Step 1: Create `index.html` and `style.css`**

`index.html` loads `style.css` and `<script type="module" src="src/app.js">`. It has these static containers: `#session-name`, `#session-name-error`, `#exercises`, `#add-exercise`, and `#volume`.

- [ ] **Step 2: Implement `src/app.js` following the rendering contract above**

- [ ] **Step 3: Run the unit tests (no regressions)**

Run: `npm test`
Expected: all tests pass.

- [ ] **Step 4: Manual verification in a browser**

Run: `npm start`, then open the printed URL. Check each item:
1. On load, the panel shows all 10 muscles at `0`, and the session name shows "Name is required."
2. Enter the spec's worked example: Bench 4 sets, Dips 3 sets, and Pull-ups 3 sets, with the muscles from the spec table. The panel shows Chest `7`, Triceps `5`, Shoulders `3.5`, Lats `3`, Biceps `1.5`, Upper back `1.5`, and all others `0`. It updates on each keystroke or click with no button.
3. Type a long exercise name continuously. Focus and caret stay in the input. *(Review Focus 3)*
4. Clear the Dips sets field. The panel shows Chest `4` and Triceps `2`, never `NaN`, and the sets error appears. *(Review Focus 1)*
5. Enter sets `2.5`, then `-1`. Each shows the sets error, and Dips contributes 0. *(Review Focus 2)*
6. Set the rep min to 12 and the max to 8. The rep error appears, and the volume is unchanged.
7. Check Chest as primary on an exercise. The Chest checkbox under Secondary on that exercise is disabled.
8. Uncheck all primary muscles. "Pick at least one primary muscle." appears.
9. Remove Dips, the middle exercise. Bench and Pull-ups remain with their values intact, and Chest drops to `4`. *(Review Focus 5)*
10. Enter a name of only spaces. "Name is required." appears. *(Review Focus 4)*

- [ ] **Step 5: Commit**

```bash
git add index.html style.css src/app.js
git commit -m "feat: add session builder UI with live volume panel"
```
