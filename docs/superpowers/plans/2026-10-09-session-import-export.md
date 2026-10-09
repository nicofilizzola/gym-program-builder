# Session Import/Export Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the user export the current session (exercises and goals) as a JSON file and import such a file back, replacing the session.

**Architecture:** One new pure, unit-tested module, `src/session-file.js`, owns the file format: `serializeSession`, `parseSession`, `exportFileName`. It reuses `validateExercise`, `validateGoal` and `MUSCLE_GROUPS`. `src/app.js` adds an Import and an Export button with browser built-ins only (`Blob` + `<a download>`, a hidden `<input type="file">`, `confirm()`), then replaces `session.exercises` / `session.goals` and calls `renderExercises()` + `refresh()`.

**Tech Stack:** HTML, CSS, vanilla JS ES modules, `node:test` on Node 22. No dependencies, no build step.

**Spec:** `AGENTS.md` (functional requirements 8–9, "Session file format (business rule)", implementation guidelines, "Decided: Session import/export", "Out of scope")

## Global Constraints

- No runtime or dev dependencies; no build step; no libraries for file I/O.
- File format: `{ "version": 1, "exercises": [...], "goals": {...} }`. `version` must be exactly `1`. Exercise keys: `name`, `sets`, `repRange: { min, max }`, `primaryMuscles`, `secondaryMuscles`. Goals keyed by exact `MuscleGroup` names.
- Unknown keys are ignored on import and never written on export. Export uses `JSON.stringify(..., null, 2)`.
- Round trip: export then import gives an identical session.
- File name: `gym-session-YYYY-MM-DD.json`, today's **local** date.
- Export is refused while any exercise is invalid, with `Fix exercise N before exporting.` (N is 1-based, the first invalid exercise). An empty session can be exported.
- Import replaces exercises **and** goals. Confirm only if the current session has an exercise or a goal; declining changes nothing.
- An invalid file is rejected as a whole with one message; the session does not change.
- Design system (`docs/design-system/README.md`): reuse `.secondary-btn` for the buttons, 44px touch targets, visible focus ring, error text styled like `.error`.

## Review Focus

1. **Hand-edited files with wrong types** (`"sets": "4"`, `"name": null`, `"primaryMuscles": "Chest"`, `"repRange": [6, 10]`, an exercise that is `null`): rejected with a message. `parseSession` never throws. → Task 1 test `rejects wrong types without throwing`.
2. **Top level that is not a session object** (empty file, `null`, `[]`, `"text"`, `{}`): rejected with a message, no crash. → Task 1 test `rejects non-session top level`.
3. **The same muscle listed twice in one exercise** (`["Chest", "Chest"]`): would double its volume, so it is rejected. → Task 1 test `rejects duplicate muscles`.
4. **A bad file picked while the session has content:** no confirm prompt appears, because the file is checked before asking, and the session is unchanged. → Task 2 Step 3, check (e).
5. **Picking the same file twice in a row** (for example, re-importing after a declined confirm): the second pick still triggers an import, because the input's value is reset after each pick. → Task 2 Step 3, check (f).

---

### Task 1: Session file format (pure functions)

**Files:**
- Create: `src/session-file.js`
- Test: `test/session-file.test.js`

**Interfaces:**
- Consumes: `validateExercise(ex) → { name?, sets?, repRange?, muscles? }` and `validateGoal(goal) → string | null` from `src/validate.js`; `MUSCLE_GROUPS` from `src/muscles.js`.
- Produces:
  - `serializeSession(session: { exercises: Exercise[], goals: Partial<Record<string, number>> }) → string`. Writes `version: 1`, only the five exercise keys (with `repRange` limited to `min`/`max`), and goals in `MUSCLE_GROUPS` order.
  - `parseSession(text: string) → { session: { exercises: Exercise[], goals } } | { error: string }`. Never throws. The returned session holds fresh objects with only known keys, and muscle lists in `MUSCLE_GROUPS` order.
  - `exportFileName(date: Date = new Date()) → string`, for example `'gym-session-2026-10-09.json'`.

**Error messages (exact copy; checks run in this order, and the first failure wins):**

| Condition | Message |
|---|---|
| `JSON.parse` throws | `File is not valid JSON.` |
| top level is not a plain object (null, array, primitive) | `File is not a gym session.` |
| `version !== 1` | `Unsupported file version.` |
| `exercises` is not an array, or `goals` is not a plain object | `File is not a gym session.` |
| exercise N is not an object, `name` is not a string, `repRange` is not a plain object, or either muscle list is not an array of strings | `Exercise N: invalid format.` |
| a muscle name is not in `MUSCLE_GROUPS` | `Exercise N: unknown muscle group "X".` |
| a muscle appears twice in the same list | `Exercise N: "X" is listed twice.` |
| `validateExercise` returns errors | `Exercise N: ` + its first message (in `name`, `sets`, `repRange`, `muscles` order) |
| goal key not in `MUSCLE_GROUPS` | `Goal for unknown muscle group "X".` |
| goal value not a number, or `validateGoal` fails | `Goal for X must be a positive multiple of 0.5.` |

N is 1-based. The type checks before `validateExercise` exist only so it never throws. Number checks (sets, reps, and `"4"` versus `4`) are left to `validateExercise`, which already rejects non-integers.

- [ ] **Step 1: Write the failing tests** in `test/session-file.test.js` (same style as `test/validate.test.js`):

```js
const workedExample = () => ({
  exercises: [
    { name: 'Bench press', sets: 4, repRange: { min: 6, max: 10 }, primaryMuscles: ['Chest'], secondaryMuscles: ['Triceps', 'Shoulders'] },
    { name: 'Dips', sets: 3, repRange: { min: 8, max: 12 }, primaryMuscles: ['Chest', 'Triceps'], secondaryMuscles: ['Shoulders'] },
    { name: 'Pull-ups', sets: 3, repRange: { min: 5, max: 8 }, primaryMuscles: ['Lats'], secondaryMuscles: ['Upper back', 'Biceps'] },
  ],
  goals: { Chest: 7, Triceps: 4, Lats: 6, Quads: 8 },
});
const file = (overrides) => JSON.stringify({ version: 1, ...workedExample(), ...overrides });
const exerciseFile = (patch) => file({ exercises: [{ ...workedExample().exercises[0], ...patch }] });
```

Tests and assertions:
- `round trip keeps the worked example`: `parseSession(serializeSession(s)).session` deep-equals `s`, and `computeVolume` of it gives Chest 7, Triceps 5, Shoulders 3.5, Lats 3, Biceps 1.5, Upper back 1.5.
- `round trip keeps half-set goals and an empty session`: `{ exercises: [], goals: { Calves: 4.5 } }` and `{ exercises: [], goals: {} }` both survive unchanged.
- `serialize writes version 1, 2-space indent, no extra keys`: serializing an exercise with an extra `id: 1` key and `repRange.extra` gives text equal to `JSON.stringify({ version: 1, exercises: [<five keys only>], goals }, null, 2)`.
- `serialize writes goals in MUSCLE_GROUPS order`: `Object.keys(JSON.parse(serializeSession({ exercises: [], goals: { Quads: 8, Chest: 7 } })).goals)` deep-equals `['Chest', 'Quads']`.
- `parse ignores unknown keys`: `file({ app: 'x' })` and an exercise with `notes: 'hi'` parse OK, and the result has no `app` / `notes` key.
- `parse normalizes muscle order`: `secondaryMuscles: ['Shoulders', 'Triceps']` comes back as `['Triceps', 'Shoulders']`.
- `rejects invalid JSON`: `''` and `'{'` give `{ error: 'File is not valid JSON.' }`.
- `rejects non-session top level`: `'null'`, `'[]'`, `'"text"'`, `'{}'` (`{}` fails the version check first, so it gives `Unsupported file version.`), plus `file({ exercises: {} })` and `file({ goals: [] })` give the messages in the table.
- `rejects other versions`: `version` `2`, `'1'`, and missing all give `Unsupported file version.`.
- `rejects wrong types without throwing`: `exerciseFile({ name: null })`, `exerciseFile({ primaryMuscles: 'Chest' })`, `exerciseFile({ primaryMuscles: [1] })`, `exerciseFile({ repRange: [6, 10] })` and `file({ exercises: [null] })` each give `Exercise 1: invalid format.`; `exerciseFile({ sets: '4' })` gives `Exercise 1: Sets must be a whole number of at least 1.`.
- `rejects unknown muscle`: `file({ exercises: [ex0, { ...ex0, secondaryMuscles: ['Glutes'] }] })` gives `Exercise 2: unknown muscle group "Glutes".`.
- `rejects duplicate muscles`: `exerciseFile({ primaryMuscles: ['Chest', 'Chest'] })` gives `Exercise 1: "Chest" is listed twice.`.
- `rejects exercises the form would reject`: `name: '  '` gives `Exercise 1: Name is required.`; `repRange: { min: 10, max: 8 }` gives the `validateExercise` repRange message; `primaryMuscles: []` gives `Exercise 1: Pick at least one primary muscle.`; Chest as both primary and secondary gives `Exercise 1: A muscle cannot be both primary and secondary.`.
- `rejects bad goals`: `goals: { Glutes: 5 }` gives `Goal for unknown muscle group "Glutes".`; `goals: { Chest: 0 }`, `{ Chest: 7.3 }`, `{ Chest: '7' }`, `{ Chest: null }` each give `Goal for Chest must be a positive multiple of 0.5.`.
- `export file name uses local date`: `exportFileName(new Date(2026, 0, 5))` is `'gym-session-2026-01-05.json'`.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL in `test/session-file.test.js` with `Cannot find module '../src/session-file.js'`. Other test files still pass.

- [ ] **Step 3: Implement `serializeSession`, `parseSession`, `exportFileName` in `src/session-file.js`**

Write JSDoc in the style of `src/volume.js`, reusing its `Exercise` typedef. A small `isPlainObject(v)` helper (`v !== null && typeof v === 'object' && !Array.isArray(v)`) covers the shape checks. Build the date from `getFullYear` / `getMonth` / `getDate` with `padStart(2, '0')`, not `toISOString` (which is UTC).

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: all tests PASS, 0 failures.

- [ ] **Step 5: Commit**

```bash
git add src/session-file.js test/session-file.test.js
git commit -m "feat: add session file serialize and parse"
```

---

### Task 2: Import and Export buttons

**Files:**
- Modify: `index.html` (builder section, below `<h1>`)
- Modify: `src/app.js`
- Modify: `style.css`

**Interfaces:**
- Consumes: `serializeSession`, `parseSession`, `exportFileName` from Task 1; `validateExercise` from `src/validate.js`; the existing `session`, `renderExercises()` and `refresh()` in `src/app.js`.

- [ ] **Step 1: Add the markup**

Below `<h1>Session builder</h1>`, add a `.file-actions` row with:
- `<button id="import-session" type="button" class="secondary-btn">Import</button>`
- `<button id="export-session" type="button" class="secondary-btn">Export</button>`
- `<input id="import-file" type="file" accept=".json,application/json" hidden>`

After that row, add `<p id="file-message" class="error" role="alert"></p>`. The existing `.error:empty` rule hides it while it is empty. In `style.css`, give `.file-actions` a flex row with a gap; buttons keep `.secondary-btn` styling and a 44px minimum height.

- [ ] **Step 2: Wire the handlers in `src/app.js`**

Every handler first clears `#file-message`.
- **Export click:** find the first exercise index `i` where `validateExercise` returns any key. If one is found, show `Fix exercise ${i + 1} before exporting.` and stop. Otherwise, make a `Blob([serializeSession(session)], { type: 'application/json' })` and an object URL, click a temporary `<a download={exportFileName()}>`, then revoke the URL.
- **Import click:** call `fileInput.click()`.
- **File input `change`:** read `files[0]` with `await file.text()`, then reset `fileInput.value = ''` right away. Call `parseSession`. On `error`, show it and stop, before any confirm. If `session.exercises.length > 0 || Object.keys(session.goals).length > 0`, then `confirm('Replace the current session? Its exercises and goals will be lost.')`; if declined, stop. Otherwise assign `session.exercises` and `session.goals` from the result, then `renderExercises(); refresh();`.

- [ ] **Step 3: Verify in the browser**

Run: `npm test` (all PASS), then `npm start` and open the served URL. Check:
- (a) Build the volume worked example and set goals Chest 7 and Triceps 4.5. Export downloads `gym-session-<today>.json`, with 2-space indent and `"version": 1`.
- (b) Reload the page and import that file. There is no confirm (the session is empty). The exercises, order, goals, volume panel (`7 / 7 met`) and body map match what they were before.
- (c) Clear an exercise name and click Export. `Fix exercise N before exporting.` appears and nothing downloads. An empty session exports `"exercises": []`.
- (d) With content in the session, import a valid file: the confirm appears. Cancel leaves everything unchanged; OK replaces it.
- (e) With content in the session, import a file edited to contain `"Glutes"`: there is no confirm, `Exercise N: unknown muscle group "Glutes".` is shown, and the session is unchanged.
- (f) Pick the same file twice in a row: the second pick imports again.
- (g) Keyboard only: Tab reaches Import and Export, the focus ring is visible, and Enter activates each.

- [ ] **Step 4: Commit**

```bash
git add index.html src/app.js style.css
git commit -m "feat: import and export sessions as JSON files"
```
