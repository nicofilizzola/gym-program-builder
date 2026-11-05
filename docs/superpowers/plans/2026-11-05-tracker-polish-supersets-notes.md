# Tracker Set Rows, Supersets, Warm-ups and Notes Implementation Plan (rigorous)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The workout logger shows each set as one aligned, clearly separated unit with a ⋯ set menu. Logs carry warm-ups and superset pairs from their template. Exercises and sets can hold optional notes, and last time's exercise note resurfaces.

**Architecture:** Work continues on branch `feature/log-warmups-supersets`, rebased onto `main` after Plans 1–2 merge. Its Task 1 (log model version 2) is already done.

- **Pure modules own every rule:**
  - `src/workout-log.js`: model, validation, version 1 upgrade, note limits;
  - `src/workout-edit.js`: transforms;
  - `src/workout-sets.js`: placeholders and Last time.
- **Views only render and wire:** `src/workout-set-row.js` and `src/workout-logger-view.js`.
- **Server:** keeps strict validation; `lastTime` returns set `kind` and the exercise `note`.

**Tech Stack:** Vanilla ES modules, SQLite/libSQL, node:test, Playwright. No new dependencies, no SQL migration.

**Spec:** `docs/superpowers/specs/2026-11-05-mobile-polish-tracker-notes-design.md` §B1–B3, and `docs/superpowers/specs/2026-11-04-log-warmups-supersets-design.md` (warm-ups and supersets, unchanged except where §B1/§B3 extend it). The branch's `docs/superpowers/plans/2026-11-04-log-warmups-supersets.md` Tasks 2–7 are executed here as Tasks 2–6 and 10, with the amendments listed in each.

## Global Constraints

- **Inherited:** every Global Constraint of `2026-11-04-log-warmups-supersets.md` applies (log version 2, set `kind`, pair invariant, warm-ups excluded from stats, Finish copy).
- **Set-row grid:** `1.5rem | minmax(0,1.15fr) | minmax(0,1fr) | 44px`.
  - **Narrow cards (<560px container):** line 1 `# kg reps ✓`; line 2 `RIR-caption | segmented 0–5 spanning kg→reps | ⋯`; line 3 note (when present) spanning kg→⋯.
  - **Wide cards (≥560px):** one line `# kg reps RIR ✓ ⋯`.
- **Separation:** 1px `--border` hairline between consecutive sets, with 8px vertical padding per set. The done tint spans the full card width.
- **Set menu:**
  - accessible name `Set {n} actions, {exercise}` (`Warm-up set {n} actions, …` for warm-ups);
  - items `Add note` / `Edit note` and `Remove set`;
  - the per-row remove button is gone; read-only logs have no menu.
- **Notes:**
  - `exercises[].note` 0–1,000 and `sets[].note` 0–280 UTF-16 units, default `""`, in `WORKOUT_LIMITS.exerciseNoteMax` / `setNoteMax`;
  - errors `Exercise N: Note must be at most 1,000 characters.` / `Exercise N, set M: Note must be at most 280 characters.`;
  - trimmed on blur; whitespace-only becomes `""`.
- **Note copy:**
  - `✎ Add note` (name `Add note, {exercise}`);
  - textarea label `Note, {exercise}`;
  - set input label `Note, set {n}, {exercise}`;
  - last-time note prefix (visually hidden) `Last time note:`.
- **Notes reach nowhere else:** never in exports, AI review, volume or analytics, and never copied from Last time.
- **Phone sizing:** logger gutter 12px and card padding 10px at ≤760px. Targets ≥44px on touch. `999.75` kg and `100` reps are fully visible at ≥375px width.
- **Motion:** the 200ms collapse pattern for set add/remove, note open/close, warm-up insert and frame unlink. Closing completes before removal; rapid reversal is safe; reduced motion is instant; typing is never animated.
- **Process:** change `style.css` first, then `docs/design-system/README.md` in the same commit.
- **Playwright** uses 127.0.0.1:3199. Never kill processes you didn't start.
- **Verification:** `npm test`, `npm run test:e2e`, `npm run build`. Never claim a pending deployment was verified.

## Review Focus

1. **App update mid-workout:** a dirty version 1 active log in the mirror resumes as version 2 with empty notes and working sets, then syncs. Task 7 unit (`validateWorkoutLog` and mirror recovery) and the Task 4 e2e (inherited).
2. **Typing a note then going offline or reloading:** the note survives through the mirror and syncs later. Task 8 e2e with the save route aborted, then a reload.
3. **Removing a set while its note field is open or focused:** the row collapses cleanly, focus moves to the next row's ⋯ (else Add set), and no orphan field remains. Task 9 e2e.
4. **Long and multiline notes:** the exercise note wraps without overflow at 360px; the set note `maxlength` stops at 280; an over-limit note sent through the API returns the exact error. Task 7 unit, Tasks 8–9 e2e.
5. **Set-row alignment at 360px with `999.75` and `100`:** nothing overflows the card, and the columns align across rows, warm-ups included. Task 1 e2e (bounding boxes) and Task 4 e2e.

---

### Task 1: Rebase, set-row grid, separators and set menu

**Files:**
- Modify: `src/workout-set-row.js`, `src/workout-logger-view.js` (focus after removal targets `.log-set-menu`), `style.css`, `docs/design-system/README.md` (Workout logger section)
- Modify: existing e2e that click `Remove set N, X` (`e2e/workout-logger.spec.js`, `e2e/workout-history-edit.spec.js`, and others found by grep) to open `Set N actions, X`, then `Remove set`
- Test: `e2e/workout-set-row.spec.js` (new)

**Interfaces:**
- Produces:
  - `createSetRow({...,onMenu})`, where the row renders `button.log-set-menu` (`more` icon) and calls `onMenu(button)`;
  - the logger opens a `mountReorderMenu({label:'Set actions'})` with `[{label:'Remove set',run}]`. Task 9 adds the note item.
  - Line-3 slot `div.log-set-note-slot` (empty for now) for Task 9.

- [ ] **Step 1: Rebase and confirm green.** Run `git switch feature/log-warmups-supersets && git rebase main`, then `npm test` and `npm run test:e2e`. Expected: PASS. Resolve conflicts in favour of main's UI and the branch's model.
- [ ] **Step 2: Write the failing e2e** (390×844 touch, 360×780 touch, 1366×768). Start from a 3-set template and type `999.75` and `100` into set 1.

```js
// For every row: kg stepper x/width, reps stepper x/width and ✓ x equal row 1's (±1px)
// RIR group left == kg stepper left and RIR group right == reps stepper right (±1px), at 390 and 360
// ⋯ x == ✓ x; no element's right edge exceeds the card's content box
// Rows 2..n have a 1px top border, row 1 has none; a done row's background spans the card's inner width
// At 1366: each row is one line (✓ and RIR share row 1's y range)
// Inputs show the full values at 390 (scrollWidth <= clientWidth)
// `Set 2 actions, {name}` → `Remove set` removes row 2 (collapse; instant with reduced motion) and focuses `Set 2 actions` of the new row 2
```

- [ ] **Step 3: Run `npx playwright test e2e/workout-set-row.spec.js`.** Expected: FAIL.
- [ ] **Step 4: Implement.**
  - Restructure the row markup to the grid and remove `.log-rir-label` from line 1.
  - The RIR caption sits in the number column on line 2. On wide cards it is hidden and the header shows `RIR`.
  - Use a container query on `.log-exercise-card` for the wide layout.
  - Apply the phone gutters, the hairline separators and the full-width done tint.
- [ ] **Step 5: Run the new spec and the full `npm run test:e2e`.** Expected: PASS after updating the remove-set lookups.
- [ ] **Step 6: Browser review and commit.**
  - Check 360/390/430 touch, 1366 and 1920, 200% text and reduced motion, and record the findings.
  - Commit `feat: aligned set rows with separators and a set menu`.

### Tasks 2–6: Warm-ups and supersets (from the 11-04 plan)

Execute `2026-11-04-log-warmups-supersets.md` Tasks 2, 3, 4, 5 and 6 exactly as written, as Tasks 2–6 here, with these amendments:

- **Task 4 (warm-up rows):**
  - `createSetRow` takes `kind` and `kindIndex`; the menu button name follows the Global Constraints.
  - `W{n}` fits the 1.5rem number column. The e2e asserts W rows use the same column x-positions as working rows.
  - `Add warm-up` sits in the same action strip as `Add set`.
  - The finished-log "remove last working set" path is reached through the set menu.
- **Task 5 (superset frame):** member cards keep the Task 1 set grid. The frame must not change the card's inner width at 390px beyond the rail (assert the card content box ≥ 300px at 360px).
- **Task 6 (guided focus):** the focus target is the partner row's reps input, and the row scrolls into view without covering the sticky header (`scroll-margin-top` equal to the header height).

Each task keeps its own failing test → implement → pass → commit cycle and its commit message from the 11-04 plan.

### Task 7: Notes in the log model

**Files:**
- Modify: `src/workout-log.js` (`WORKOUT_LIMITS.exerciseNoteMax:1000`, `setNoteMax:280`; `emptySet`, `createWorkoutLog`, `logExerciseFromEntry` add `note:''`; `validateSet` and `validateExercise` accept `note` and default a missing one to `''` for version 1 and version 2 alike; canonical output always carries it)
- Modify: `src/workout-edit.js`
- Test: `test/workout-log.test.js`, `test/workout-edit.test.js`, `test/workout-sync.test.js`

**Interfaces:**
- Produces:
  - `normalizeNote(text:string) → string` (trim; whitespace-only → `''`) in `src/workout-log.js`;
  - `setExerciseNote(log,exerciseId,text) → log` and `setSetNote(log,exerciseId,setId,text) → log` in `src/workout-edit.js` (store as given; the UI calls `normalizeNote` on blur);
  - `swapExercise` keeps `note`, and `addSet`/`addWarmup` create `note:''`.

- [ ] **Step 1: Write the failing tests**

```js
test('notes default to empty and upgrade from version 1',()=>{
  const v1=v1LogFixture(); // sets without kind/note, exercises without note
  const {log}=validateWorkoutLog(v1);
  assert.equal(log.exercises[0].note,'');assert.equal(log.exercises[0].sets[0].note,'');
});
test('note limits',()=>{
  assert.equal(validateWorkoutLog(withExerciseNote('x'.repeat(1001))).error,'Exercise 1: Note must be at most 1,000 characters.');
  assert.equal(validateWorkoutLog(withSetNote('x'.repeat(281))).error,'Exercise 1, set 1: Note must be at most 280 characters.');
  assert.ok(validateWorkoutLog(withExerciseNote('x'.repeat(1000))).log);
  assert.equal(validateWorkoutLog(withSetNote(42)).error,'Exercise 1, set 1: Invalid set.');
});
test('note transforms',()=>{
  let log=setExerciseNote(base(),'e1','Seat 4');assert.equal(log.exercises[0].note,'Seat 4');
  log=setSetNote(log,'e1','s1','Felt easy');assert.equal(log.exercises[0].sets[0].note,'Felt easy');
  assert.equal(swapExercise(log,'e1',variant('X')).exercises[0].note,'Seat 4');
  assert.equal(normalizeNote('  \n '),'');assert.equal(normalizeNote(' a b '),'a b');
});
test('a version 1 mirror snapshot recovers with notes',()=>{/* recoveryDecision on a v1 mirror → resumes, canonical log has note '' */});
```

- [ ] **Step 2: Run `npm test`.** Expected: FAIL. **Step 3: Implement.** **Step 4: Run `npm test`.** Expected: PASS, including `test/workout-repository.test.js` (the server validates through the same function).
- [ ] **Step 5: Commit** `feat: exercise and set notes in workout logs`.

### Task 8: Exercise notes and last time's note

**Files:**
- Modify: `server/workout-repository.js` (`lastTime` adds `note: match.note ?? ''`), `src/workout-logger-view.js`, `style.css`, `docs/design-system/README.md`
- Test: `test/workout-repository.test.js`, `e2e/workout-notes.spec.js` (new)

**Interfaces:**
- Consumes: `setExerciseNote`, `normalizeNote` (Task 7).
- Produces:
  - Last time entries `{logId, finishedAt, sets, note}`;
  - card DOM: `p.log-last-note` (read-only, 2-line clamp, `title` = full text) and `div.log-note` holding either `button.log-note-add`, a `textarea.log-note-input` or `button.log-note-text`.

- [ ] **Step 1: Write the failing repository test.** A finished log whose exercise has `note:'Seat 4'` returns `lastTime[v].note==='Seat 4'`; a stored version 1 log returns `''`.
- [ ] **Step 2: Write the failing e2e** (390 touch, 1366):
  - Pressing `Add note, Bench press` opens a focused textarea `Note, Bench press` (collapse open; instant under reduced motion).
  - Typing `Seat 4` and blurring shows the button text `✎ Seat 4`, and the server log has the note after the save settles.
  - Pressing the text reopens the textarea with the caret at the end.
  - Clearing it and blurring collapses back to `✎ Add note` and the server note becomes `''`.
  - Enter inserts a newline.
  - Aborting `PUT **/api/workouts/*`, typing, reloading: the note is still there and syncs once restored.
  - Finishing, then starting the same template again: the card shows `Seat 4` under Last time as a read-only line, and the new log's note is `''`.
  - Opening that finished log for editing lets you change the note, and the change saves through autosave.
  - The read-only history view shows the note text with no add button.
  - At 360px, a 1,000-character note wraps without horizontal scroll.
- [ ] **Step 3: Run.** Expected: FAIL.
- [ ] **Step 4: Implement.**
  - **Input:** commit on `input` via `setExerciseNote`. On blur, apply `normalizeNote`, and commit again only if the value changed.
  - **Open/close:** the open/close uses the existing `reveal`/`collapseOut` helpers on a `.collapsible` wrapper.
  - **Render guard:** `updateCard` must not overwrite a focused textarea's value. This is the same rule the set inputs follow.
- [ ] **Step 5: Run the spec plus the workout e2e specs.** Expected: PASS. Run `npm test`. Expected: PASS.
- [ ] **Step 6: Commit** `feat: exercise notes with last time's note`.

### Task 9: Set notes

**Files:**
- Modify: `src/workout-set-row.js` (line-3 note slot), `src/workout-logger-view.js` (set menu `Add note`/`Edit note`), `style.css`, `docs/design-system/README.md`
- Test: `e2e/workout-notes.spec.js`

**Interfaces:**
- Consumes: `setSetNote`, `normalizeNote` (Task 7); the Task 1 menu and note slot.
- Produces: `createSetRow({...,onNote:text=>void, onNoteBlur:()=>void})` and `updateSetRow(row,{...,noteOpen:boolean})`. The row renders `input.log-set-note-input` (`maxlength` 280) or `button.log-set-note-text` in the slot.

- [ ] **Step 1: Write the failing e2e:**
  - `Set 2 actions, Bench press` → `Add note` opens the focused input `Note, set 2, Bench press` spanning kg→⋯ (bounding box).
  - Typing `Felt easy` and pressing Enter shows `✎ Felt easy`; the menu now says `Edit note`.
  - The input stops at 280 characters.
  - Clearing and blurring collapses the slot.
  - Removing set 2 while its note input is focused collapses the row, leaves no orphan input, and focuses `Set 2 actions` of the new row 2 (Review Focus 3).
  - A warm-up row supports notes the same way.
  - Read-only history shows set notes as text.
  - Under reduced motion every open/close is instant.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.** Open state lives in the logger as a `Set` of set ids. It is view state and never stored.
- [ ] **Step 4: Run the spec plus the workout e2e specs.** Expected: PASS.
- [ ] **Step 5: Commit** `feat: set notes from the set menu`.

### Task 10: Docs and verification

**Files:**
- Modify: `AGENTS.md`, `docs/superpowers/verification/2026-11-05-mobile-polish-tracker-notes.md` ("Plan 3" section)
- Create: `docs/superpowers/verification/2026-11-04-log-warmups-supersets.md` (as the 11-04 Task 7 specifies)

- [ ] **Step 1: Update AGENTS.md.**
  - Add the "Logging warm-ups and supersets (2026-11-04)" section from the 11-04 Task 7.
  - Add a "Tracker set rows and notes (2026-11-05)" section with condensed bullets from the Global Constraints, links to the spec and this plan, and a note that it supersedes the tracker V1 "notes" out-of-scope item.
- [ ] **Step 2: Run `npm test`, `npm run test:e2e` and `npm run build`.** Record the counts.
- [ ] **Step 3: Real-browser review.** Use a temporary `e2e/zz-verify-*.spec.js`, deleted before committing. Cover:
  - set-row alignment, separators and the set menu;
  - W rows and Add warm-up;
  - the superset frame with unlink, reorder, swap and remove;
  - guided focus;
  - finish flows;
  - exercise, set and last-time notes;
  - version 1 mirror resume.

  Inspect at 360/390/430 touch, 1366 and 1920, 200% text and reduced motion. Record every item and every gap; never claim a deployment.
- [ ] **Step 4: Commit** `docs: record tracker set rows, warm-ups, supersets and notes verification`.
