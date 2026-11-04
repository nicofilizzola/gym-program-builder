# Logging Warm-ups and Supersets Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Workout logs started from templates keep warm-up sets (as `W` rows excluded from stats) and superset pairs (framed, block-reordered, with guided focus), on a backward-compatible log version 2.

**Architecture:** The pure log module (`src/workout-log.js`) gains set `kind`, `target.warmupSets` and the template-style `superset` marker, with version 1 logs upgraded on validation. Pure transforms in `src/workout-edit.js` and `src/workout-sets.js` own kind ordering, pair dissolution, block moves, finish pruning, placeholders and guided-focus targets; the logger view only renders and wires them. The server's Last time query returns each set's `kind`.

**Tech Stack:** Vanilla ES modules, native controls, node:test, Playwright, SQLite/libSQL. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-11-04-log-warmups-supersets-design.md` (extends `docs/superpowers/specs/2026-11-03-workout-tracker-design.md`)

## Global Constraints

- `logVersion` 2 for every new or saved log; version 1 logs validate and come back as canonical version 2 (`kind:'working'` on every set, `target.warmupSets: 0`, no `superset`). No SQL migration.
- Set `kind` is `'warmup'` or `'working'`; within an exercise all warm-ups precede all working sets; the 20-set cap counts both.
- Log `superset` = `{restBetweenSeconds 0–120 by 15, restAfterRoundSeconds 0–300 by 15}` on the first of exactly two consecutive exercises; reuse `supersetIssue`/`supersetError` (`src/validate.js`) and the helpers in `src/superset.js`; message `Exercise N: Invalid superset.`.
- Warm-ups never count in Last time, working placeholders, history `doneSets` or the Finish warning.
- Finish refusal copy: `Log at least one working set, or discard the workout.`; warning copy unchanged: `{n} sets not completed — finish anyway? Uncompleted sets will be removed.` (n = not-done working sets).
- UI: follow docs/design-system/README.md and AGENTS.md (UI workflow; Workout tracker V1); 32px fine pointer / 44px touch; motion reuses the 200ms collapse pattern; reduced motion instant; initial render/resume/reorder show final state; change `style.css` first, then the design-system doc in the same commit.
- Playwright uses 127.0.0.1:3199, which another session may hold: never kill processes you didn't start; wait for the port.
- Verification: `npm test`, `npm run test:e2e`, `npm run build`; never claim a pending deployment was verified.

## Review Focus

1. **App update mid-workout:** an active version 1 log in the device mirror (with a dirty queued snapshot) must resume, render as working rows and sync as version 2 — Task 1 unit (`recoveryDecision`/validation) and Task 4 e2e.
2. **Removing the last working set while warm-ups remain (active log):** the exercise stays with its warm-ups; Finish then drops it; if no working set is done anywhere, Finish refuses — Task 2 unit.
3. **Guided focus edge cases:** partner fully done → own next working set; both done → no move; unchecking → no move; warm-up ✓ → no move — Task 2 unit, Task 6 e2e.
4. **Swap or remove inside a pair:** swap keeps the frame and refreshes Last time; removing either member dissolves the pair and the survivor shows its own Reorder — Task 5 e2e.
5. **Finished-log editing:** Add warm-up adds a done row inheriting the previous warm-up's values; removing the last working set removes the exercise (with warm-ups) after the existing confirmation — Task 4 e2e.

---

### Task 1: Log model version 2

**Files:**
- Modify: `src/workout-log.js` (`createWorkoutLog`, `logExerciseFromEntry`, `emptySet`, `validateTarget`, `validateSet`, `validateExercise`, `validateWorkoutLog`, `workoutSummary`)
- Test: `test/workout-log.test.js`, `test/workout-sync.test.js` (v1 mirror recovery), `test/workout-history.test.js`

**Interfaces:**
- Produces: `createWorkoutLog(...)` → logVersion 2 with `warmupSets` warm-up rows then `sets` working rows per template exercise, `target:{sets,warmupSets,repRange,restSeconds}`, and `superset` copied from the template's first pair member; `emptySet(makeId,kind)` (default `'working'`); `logExerciseFromEntry` sets have `kind:'working'`; `validateWorkoutLog(value) → {log}|{error}` accepting `logVersion` 1|2 and returning version 2; `workoutSummary(log).doneSets` = done working sets.

- [ ] **Step 1: Write failing tests**

```js
test('template start builds warm-up rows, working rows and pairs',()=>{
  const template={id:'t',document:{name:'Push',exercises:[
    {...ex('Bench'),sets:3,warmupSets:2,superset:{restBetweenSeconds:30,restAfterRoundSeconds:120}},
    {...ex('Row'),sets:2,warmupSets:0}]}};
  const log=createWorkoutLog({id:'l',now:new Date(),makeId:seq(),template});
  assert.equal(log.logVersion,2);
  assert.deepEqual(log.exercises[0].sets.map(s=>s.kind),['warmup','warmup','working','working','working']);
  assert.deepEqual(log.exercises[0].target,{sets:3,warmupSets:2,repRange:{min:8,max:12},restSeconds:120});
  assert.deepEqual(log.exercises[0].superset,{restBetweenSeconds:30,restAfterRoundSeconds:120});
  assert.equal(Object.hasOwn(log.exercises[1],'superset'),false);
  assert.ok(validateWorkoutLog(log).log);
});
test('version 1 logs upgrade to version 2',()=>{
  const v1={...validActiveLog(),logVersion:1};v1.exercises[0].sets.forEach(s=>delete s.kind);delete v1.exercises[0].target.warmupSets;
  const {log}=validateWorkoutLog(v1);
  assert.equal(log.logVersion,2);assert.ok(log.exercises[0].sets.every(s=>s.kind==='working'));assert.equal(log.exercises[0].target.warmupSets,0);
});
test('kind order, superset invariant and finished rules',()=>{
  assert.equal(validateWorkoutLog(withSets(['working','warmup'])).error,'Exercise 1: Warm-up sets must come before working sets.');
  assert.equal(validateWorkoutLog(withSets(['warmup'],{kindValue:'drop'})).error,'Exercise 1, set 1: Invalid set kind.');
  assert.equal(validateWorkoutLog(pairOnLast()).error,'Exercise 2: Invalid superset.');
  assert.equal(validateWorkoutLog(finishedWithOnlyWarmups()).error,'Exercise 1: A finished workout needs at least one working set per exercise.');
});
test('history counts done working sets only',()=>{assert.equal(workoutSummary(logWithDone({warmup:2,working:3})).doneSets,3);});
```

In `test/workout-sync.test.js`: a mirror holding a dirty version 1 active log yields the same `recoveryDecision` as before, and the record passed on validates to version 2.

- [ ] **Step 2: Run `npm test` — the new tests FAIL.**
- [ ] **Step 3: Implement.** Version 1 inputs are normalized before validation (missing `kind` → `'working'`, missing `target.warmupSets` → 0; a version 1 log with `superset` or `kind` present is invalid). Validate `superset` shape/limits through `supersetIssue` on the canonical exercises. Error copy exactly as in Step 1.
- [ ] **Step 4: Run `npm test` — PASS (update existing deepEqual expectations for `logVersion:2`, `kind`, `target.warmupSets`).**
- [ ] **Step 5: Commit** `feat: log version 2 with warm-up sets and superset pairs`

### Task 2: Edit transforms, finish rules and guided-focus target

**Files:**
- Modify: `src/workout-edit.js`
- Test: `test/workout-edit.test.js`

**Interfaces:**
- Consumes: `src/superset.js` (`supersetBlocks`, `moveBlockOrder`, `unpair`, `removeExercise as removePairMember`), Task 1 shapes.
- Produces:
  - `addSet(log,exerciseId,makeId,values={})` appends a `working` set; `addWarmup(log,exerciseId,makeId,values={})` inserts a `warmup` set after the last warm-up (both no-op at 20 sets).
  - `removeExercise(log,exerciseId)` dissolves the pair; `swapExercise` keeps `superset`.
  - `moveLogBlock(log,fromBlock,toBlock)` (block-index move via `moveBlockOrder`); `unlinkSuperset(log,exerciseId)` (either member).
  - `undoneSetCount(log)` counts not-done working sets; `NO_SETS='Log at least one working set, or discard the workout.'`.
  - `finishWorkout(log,now)` removes not-done sets, then exercises without a done working set, dissolving any pair that loses a member; refuses with `NO_SETS` when no done working set remains.
  - `nextGuidedSet(log,exerciseId,setId) → {exerciseId,setId}|null` (spec §3 rule; called after the set became done).

- [ ] **Step 1: Write failing tests**

```js
test('add warm-up inserts after the last warm-up; add set appends working',()=>{
  const log=addWarmup(base(['warmup','working','working']),'e1',seq('n'));
  assert.deepEqual(log.exercises[0].sets.map(s=>s.kind),['warmup','warmup','working','working']);
  assert.equal(addSet(log,'e1',seq('m')).exercises[0].sets.at(-1).kind,'working');
});
test('pairs survive swap, dissolve on remove/unlink and move as blocks',()=>{
  const log=paired(); // [A+B pair][C]
  assert.ok(swapExercise(log,'a',variant('X')).exercises[0].superset);
  assert.equal(removeExercise(log,'b').exercises[0].superset,undefined);
  assert.equal(unlinkSuperset(log,'b').exercises[0].superset,undefined);
  assert.deepEqual(moveLogBlock(log,0,1).exercises.map(e=>e.id),['c','a','b']);
});
test('finish ignores warm-ups in the warning and refuses without working sets',()=>{
  const log=doneMix({a:{warmupDone:1,warmupOpen:1,workingDone:2,workingOpen:0}});
  assert.equal(undoneSetCount(log),0);assert.equal(finishConfirmation(log),null);
  const done=finishWorkout(log,new Date());assert.deepEqual(done.log.exercises[0].sets.map(s=>s.kind),['warmup','working','working']);
  assert.equal(finishWorkout(doneMix({a:{warmupDone:2,workingDone:0,workingOpen:1}}),new Date()).error,'Log at least one working set, or discard the workout.');
});
test('finish drops warm-up-only exercises and dissolves broken pairs',()=>{
  const r=finishWorkout(pairWhereBHasOnlyWarmupsDone(),new Date());
  assert.deepEqual(r.log.exercises.map(e=>e.id),['a']);assert.equal(r.log.exercises[0].superset,undefined);
});
test('guided focus alternates partners and falls back',()=>{
  const log=pairedWorking({a:[true,false,false],b:[false,false]}); // A set1 just done
  assert.deepEqual(nextGuidedSet(log,'a','a1'),{exerciseId:'b',setId:'b1'});
  assert.deepEqual(nextGuidedSet(pairedWorking({a:[true,false],b:[true,true]}),'a','a1'),{exerciseId:'a',setId:'a2'});
  assert.equal(nextGuidedSet(pairedWorking({a:[true],b:[true]}),'a','a1'),null);
  assert.equal(nextGuidedSet(unpairedWorking(),'c','c1'),null);
  assert.equal(nextGuidedSet(pairedWithWarmupDone(),'a','aw1'),null); // warm-up ✓ never guides
});
test('active log may keep an exercise with only warm-ups after removing its working sets',()=>{
  const log=removeSet(base(['warmup','working']),'e1','s2');assert.ok(validateWorkoutLog(log).log);
});
```

- [ ] **Step 2: Run `npm test` — FAIL.**
- [ ] **Step 3: Implement the signatures above.** Keep the existing `mapExercise`/`mapSet` helpers; transforms never mutate inputs.
- [ ] **Step 4: Run `npm test` — PASS.**
- [ ] **Step 5: Commit** `feat: warm-up, pair and finish transforms for workout logs`

### Task 3: Placeholders, Last time and server kind

**Files:**
- Modify: `src/workout-sets.js` (`formatLastTime`, `setPlaceholder`), `server/workout-repository.js` (`lastTime`)
- Test: `test/workout-sets.test.js`, `test/workout-repository.test.js`

**Interfaces:**
- Produces: Last time API sets `{weightKg,reps,rir,kind}` (`kind` defaults to `'working'` for version 1 logs); `formatLastTime(sets)` formats done working sets only (`No history` when none); `workingLastSets(sets)`/`warmupLastSets(sets)` helpers exported from `src/workout-sets.js`; `setPlaceholder(exercise,index,lastTimeSets)` keeps its signature (index = position in `exercise.sets`) and applies the rule for that set's kind.

- [ ] **Step 1: Write failing tests**

```js
test('last time ignores warm-ups',()=>{
  assert.equal(formatLastTime([{kind:'warmup',weightKg:40,reps:8,rir:null},{kind:'working',weightKg:80,reps:8,rir:2}]),'80×8 @2');
  assert.equal(formatLastTime([{kind:'warmup',weightKg:40,reps:8,rir:null}]),'No history');
});
test('placeholders follow the set kind',()=>{
  const ex={target:{repRange:{min:8,max:12}},sets:[{kind:'warmup',weightKg:null,reps:null,rir:null},{kind:'warmup',weightKg:null,reps:null,rir:null},{kind:'working',weightKg:null,reps:null,rir:null}]};
  const last=[{kind:'warmup',weightKg:40,reps:10,rir:null},{kind:'working',weightKg:80,reps:8,rir:2}];
  assert.deepEqual(setPlaceholder(ex,0,last),{weightKg:40,reps:10,rir:null});      // same-numbered warm-up
  assert.deepEqual(setPlaceholder(ex,1,last),{weightKg:40,reps:10,rir:null});      // previous warm-up row's placeholder
  assert.deepEqual(setPlaceholder(ex,2,last),{weightKg:80,reps:8,rir:2});          // working #1 ← last working #1
  assert.deepEqual(setPlaceholder({...ex,sets:[ex.sets[0]]},0,[]),{weightKg:null,reps:null,rir:null}); // warm-up never uses target
});
```

Repository test: a finished version 2 log with warm-ups returns `kind` per set from `lastTime`; a stored version 1 log returns `kind:'working'`.

- [ ] **Step 2: Run `npm test` — FAIL.**
- [ ] **Step 3: Implement.** Kind-local indexing: warm-up #k uses last time's k-th warm-up, else the previous warm-up row (values, then its placeholder); working #k keeps today's rule applied to working sets only.
- [ ] **Step 4: Run `npm test` — PASS.**
- [ ] **Step 5: Commit** `feat: kind-aware last time and placeholders`

### Task 4: Logger warm-up rows

**Files:**
- Modify: `src/workout-set-row.js` (label and accessible names), `src/workout-logger-view.js` (Add warm-up, rows by kind, finished-log last-working-set removal), `style.css`, `docs/design-system/README.md` (workout logger section)
- Test: `e2e/workout-warmups.spec.js` (new; reuse `e2e/workout-helper.js`)

**Interfaces:**
- Consumes: Task 1–3 functions; `addWarmup` for the new button.
- Produces: `createSetRow({...,kind,kindIndex})` renders `W{kindIndex}` for warm-ups and `{kindIndex}` for working sets; input/✓/remove accessible names prefix `Warm-up set {n}` or `Set {n}` (e.g. `Warm-up set 1 reps, Bench press`).

- [ ] **Step 1: Write failing e2e** (390×844 touch and 1366×768): starting from a template with 2 warm-ups and 3 sets shows rows `W1, W2, 1, 2, 3` with the W rows muted; `Add warm-up, Bench press` inserts `W3` before `1` with the collapse motion (no animation under reduced motion); checking off warm-ups never opens the finish warning when only warm-ups are open; finishing with an open working set shows `1 set not completed …`; History shows only working sets in its count; a finished log's Add warm-up adds a done row inheriting the previous warm-up's values; removing a finished exercise's last working set asks the existing confirmation and removes the exercise; seeding the mirror with a dirty version 1 active log (via `localStorage` before load) resumes, shows numbered working rows and syncs.
- [ ] **Step 2: Run `npx playwright test e2e/workout-warmups.spec.js` — FAIL** (port check first).
- [ ] **Step 3: Implement.** Placeholders come from `setPlaceholder` (Task 3); the "Add warm-up" button sits beside "Add set" (`secondary-btn`, plus icon, disabled at 20 sets).
- [ ] **Step 4: Run the spec plus `e2e/workout-logger.spec.js e2e/workout-history-edit.spec.js e2e/workout-offline.spec.js e2e/workout-start.spec.js` — PASS.**
- [ ] **Step 5: Commit** `feat: log warm-up sets as W rows`

### Task 5: Logger superset frame

**Files:**
- Modify: `src/workout-logger-view.js`, `style.css`, `docs/design-system/README.md`
- Optionally reuse: `src/superset-frame.js` (`createSupersetFrame`/`syncSupersetFrame`) if its markup fits; otherwise add `src/workout-superset-frame.js` with the same visual pattern
- Test: `e2e/workout-supersets.spec.js` (new)

**Interfaces:**
- Consumes: `moveLogBlock`, `unlinkSuperset`, `removeExercise`, `swapExercise` (Task 2); `formatDuration` (`src/duration.js`).
- Produces DOM contract for Task 6: paired cards inside `li.log-superset` > `.log-superset-head` + `ol.log-superset-members` (two `li` exercise cards); member headings prefixed `A1`/`A2`; pair reorder control `.reorder-action` in the head.

- [ ] **Step 1: Write failing e2e:** a template pair renders one frame with header `Superset · 30 sec between · 2 min after round`, members `A1 Bench press` / `A2 Row` without their own Reorder; `Unlink superset` animates the frame closed (instant under reduced motion) and both cards show Reorder; dragging/keyboard ↑/↓/Reorder menu move the pair as one block and nothing can drop between members; Swap on A2 keeps the frame and refreshes A2's Last time; removing A1 dissolves the frame; Add exercise appends an unpaired card; a finished/read-only log shows the frame without Unlink/Reorder.
- [ ] **Step 2: Run — FAIL.**
- [ ] **Step 3: Implement** following the editor's frame motion and token-guarded rapid reversal; mobile-first single column.
- [ ] **Step 4: Run the spec plus the four workout specs from Task 4 and `e2e/drag-reorder.spec.js` — PASS.**
- [ ] **Step 5: Commit** `feat: show supersets in the workout logger`

### Task 6: Guided focus

**Files:**
- Modify: `src/workout-logger-view.js` (✓ handler)
- Test: `e2e/workout-supersets.spec.js`

**Interfaces:**
- Consumes: `nextGuidedSet` (Task 2); the set row's reps input as the focus target.

- [ ] **Step 1: Write failing e2e:** in an active log with pair A (3 sets) / B (2 sets): activating ✓ on A set 1 focuses B set 1 reps (row scrolled into view); ✓ on B set 1 focuses A set 2; after B is complete, ✓ on A set 3 does not move focus elsewhere when none remain; ✓ on a warm-up, unchecking, and ✓ in an unpaired exercise leave focus on the ✓ button; typing in a field never triggers a focus move.
- [ ] **Step 2: Run — FAIL.**
- [ ] **Step 3: Implement**: after a successful done-toggle (active mode only), call `nextGuidedSet` and focus the target row's reps input with `scrollIntoView({block:'nearest'})`.
- [ ] **Step 4: Run the superset spec — PASS.**
- [ ] **Step 5: Commit** `feat: guide focus between superset partners`

### Task 7: Docs and verification

**Files:**
- Modify: `AGENTS.md` (new top section "Logging warm-ups and supersets (2026-11-04)": design/plan links, condensed bullets from the spec, supersedes note for the tracker section's out-of-scope line and its data/finish rules)
- Create: `docs/superpowers/verification/2026-11-04-log-warmups-supersets.md`

- [ ] **Step 1: Run `npm test`, `npm run test:e2e`, `npm run build`; record counts.**
- [ ] **Step 2: Real-browser review** (Playwright Chromium via a temporary `e2e/zz-verify-*.spec.js` deleted before committing): W rows, Add warm-up, superset frame, unlink/reorder/swap/remove, guided focus, finish flows, version 1 mirror resume — at 390×844 touch, 1366×768 and 200% text, plus reduced motion. Record each item and every gap; never claim a deployment.
- [ ] **Step 3: Commit** `docs: record warm-up and superset logging verification`
