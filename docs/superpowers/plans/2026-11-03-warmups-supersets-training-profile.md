# Warm-ups, Supersets and Structured Training Profile Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add per-exercise warm-up sets and two-exercise supersets to session templates (with matching duration estimates), and move athlete constraints into a structured, user-scoped training profile whose limits the server checks for the AI review and the app shows as non-blocking hints.

**Architecture:** Part A keeps the template exercise list flat: `warmupSets` on every exercise and a `superset` object on the first member of a pair. Pure helpers (`src/superset.js`, `computeDuration`) own the rules; the editor renders pairs as one sortable block. Part B extends the existing JSON profile (`profile_json`, no SQL migration), adds a pure `profileChecks` shared by the server prompt facts and the UI hints, and shrinks program context to Goals and priorities.

**Tech Stack:** Vanilla ES modules, native `<input type="range">`/`<dialog>`/popover, Node 24 `node:test`, Playwright, SQLite/libSQL. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-11-03-warmups-supersets-training-profile-design.md`

## Global Constraints

- No new dependencies, frameworks, ORMs or animation libraries; native range inputs only; icons are inline SVG via `actionIcon`.
- `warmupSets`: integer 0–5 step 1, default 0; never counts toward any volume, goal, heatmap or weekly figure.
- `superset` lives only on the first exercise of exactly two consecutive exercises; `restBetweenSeconds` 0–120 step 15 default 30; `restAfterRoundSeconds` 0–300 step 15 default `max(first.restSeconds, second.restSeconds)`.
- Seconds per set (warm-up or working) = 60; buffer applies to warm-up + execution + rest + extra; only the final total rounds up.
- Export bundles are version 4; versions 1–3 still import with `warmupSets: 0` and no pairs; an invalid file rejects as a whole.
- Profile limits: `maxTrainingDaysPerWeek` 1–7|null, `availableWeekdays` unique sorted 0–6 (`[]` = unspecified), `maxSessionsPerDay` 1|2|null, `maxSessionMinutes` 20–180 step 5|null, `experienceLevel` `beginner|intermediate|advanced|null`, `typicalRepsInReserve` 0–4|null, `equipment` unique subset of `EQUIPMENT` in `EQUIPMENT` order (`[]` = unspecified), two prose fields ≤2,000 UTF-16 units.
- The profile is never exported; the server ignores any client athlete copy.
- Prompt versions: `program-hypertrophy-v14` after Part A, `program-hypertrophy-v15` after Part B.
- UI: follow `docs/design-system/README.md` and its Feature design and review checklist; 32px fine-pointer / 44px touch targets; reduced motion = instant; routine data updates and hints never animate; change `style.css` first, then the design system doc in the same commit.
- Verification commands: `npm test`, `npm run test:e2e`, `npm run build`. Never claim a pending deployment was verified.

## Review Focus

1. **Removing or reordering around a pair** — deleting the second member, dragging a single card onto the gap between members, or keyboard-moving a single card past a pair must never leave a dangling `superset` or split a pair. Tests: Task 2 (`removeExercise`, `moveBlockOrder`), Task 7 e2e.
2. **Linking/replacing a paired exercise from the catalog** — catalog link, variant creation, variant move and reference propagation must keep `warmupSets`/`superset`. Test: Task 4 propagation test.
3. **Legacy and drafts** — v1–v3 imports, stored drafts without `warmupSets`, and stored programs whose context still has `constraintsAndPreferences` must load without errors. Tests: Task 1, Task 4, Task 11.
4. **Sequence mode and Unscheduled sessions in profile checks** — day checks must not fire in Sequence, and Unscheduled occurrences must not count as training days. Test: Task 13.
5. **Profile fetch failure on program/editor routes** — a failing `GET /api/profile` must hide hints and leave editing, saving and analysis fully working. Test: Task 15 e2e.

---

## Phase A — Warm-ups and supersets

### Task 1: Limits, normalization and validation for the new fields

**Files:**
- Modify: `src/duration.js` (DURATION_LIMITS, `normalizeWorkoutTiming`)
- Modify: `src/validate.js` (LIMITS, `timingError` labels, `validateExercise`)
- Modify: `src/document-validation.js` (`workout()` clean + pair invariant)
- Test: `test/validate.test.js`, `test/document-validation.test.js`

**Interfaces:**
- Produces: `DURATION_LIMITS.restBetweenSeconds = {min:0,max:120,step:15}`, `DURATION_LIMITS.restAfterRoundSeconds = {min:0,max:300,step:15}`, `LIMITS.warmupSets = {min:0,max:5,step:1}`; `normalizeWorkoutTiming` adds `warmupSets: 0` when missing; `validateExercise(ex).warmupSets` error string; `timingError(value,'restBetweenSeconds'|'restAfterRoundSeconds')` with labels `Rest between exercises` / `Rest after round`; `supersetError(exercises) → string | null` exported from `src/validate.js` (returns `Exercise N: Invalid superset.` for the first offending 1-based index, or a timing error prefixed the same way).

- [ ] **Step 1: Write failing tests**

```js
test('warm-up sets validate 0-5 whole numbers',()=>{
  for(const n of [0,5])assert.equal(validateExercise({...valid,warmupSets:n}).warmupSets,undefined);
  for(const n of [-1,6,1.5,'2'])assert.equal(validateExercise({...valid,warmupSets:n}).warmupSets,'Warm-up sets must be a whole number from 0 to 5.');
});
test('superset invariant: exactly two consecutive members, rests in limits',()=>{
  const pair={restBetweenSeconds:30,restAfterRoundSeconds:120};
  assert.equal(supersetError([{...valid,superset:pair},valid]),null);
  assert.equal(supersetError([valid,{...valid,superset:pair}]),'Exercise 2: Invalid superset.');            // no next
  assert.equal(supersetError([{...valid,superset:pair},{...valid,superset:pair},valid]),'Exercise 1: Invalid superset.'); // chain of 3
  assert.equal(supersetError([{...valid,superset:{restBetweenSeconds:20,restAfterRoundSeconds:120}},valid]),'Exercise 1: Rest between exercises must be a whole number from 0 to 120 in steps of 15.');
  assert.equal(supersetError([{...valid,superset:{restBetweenSeconds:30,restAfterRoundSeconds:315}},valid]),'Exercise 1: Rest after round must be a whole number from 0 to 300 in steps of 15.');
});
// document-validation.test.js
test('templates keep warmupSets and superset, default legacy warm-ups to 0, and reject broken pairs',()=>{
  const doc=validateDocument('template',{name:'A',goals:{},exercises:[{...ex,warmupSets:2,superset:{restBetweenSeconds:30,restAfterRoundSeconds:90}},ex]}).document;
  assert.equal(doc.exercises[0].warmupSets,2);assert.deepEqual(doc.exercises[0].superset,{restBetweenSeconds:30,restAfterRoundSeconds:90});
  assert.equal(doc.exercises[1].warmupSets,0);assert.equal(Object.hasOwn(doc.exercises[1],'superset'),false);
  assert.equal(validateDocument('template',{name:'A',goals:{},exercises:[{...ex,superset:{restBetweenSeconds:30,restAfterRoundSeconds:90}}]}).error,'Exercise 1: Invalid superset.');
  assert.equal(validateDocument('template',{name:'',goals:{},exercises:[{...ex,superset:{restBetweenSeconds:30,restAfterRoundSeconds:90}}]},{draft:true}).error,'Exercise 1: Invalid superset.'); // drafts do not relax pairs
});
```

- [ ] **Step 2: Run `npm test` — the new tests FAIL (undefined limits / missing fields).**
- [ ] **Step 3: Implement.** Add the limits; `normalizeWorkoutTiming` maps `warmupSets` like `restSeconds`; `validateExercise` checks `warmupSets` when present (after normalization it always is); `supersetError` checks each `superset` (object with exactly the two integer keys, next exists, next and previous unmarked); `workout()` in `document-validation.js` writes `warmupSets` on every clean exercise, copies a valid `superset` as `{restBetweenSeconds,restAfterRoundSeconds}`, and calls `supersetError` after the per-exercise loop (never relaxed by `draft`).
- [ ] **Step 4: Run `npm test` — all pass (update existing deepEqual expectations that now include `warmupSets: 0`).**
- [ ] **Step 5: Commit** `feat: validate warm-up sets and superset pairs`

### Task 2: Pure superset helpers

**Files:**
- Create: `src/superset.js`
- Test: `test/superset.test.js`

**Interfaces:**
- Consumes: Task 1 limits.
- Produces (all pure, never mutate input):
  - `pairRole(exercises, i) → null | 'first' | 'second'`
  - `canPairWithNext(exercises, i) → boolean` (both `i` and `i+1` exist and are unpaired)
  - `pairWithNext(exercises, i) → Exercise[]` (adds `superset:{restBetweenSeconds:30,restAfterRoundSeconds:max(rest_i,rest_i+1)}` to `i`; throws when `!canPairWithNext`)
  - `unpair(exercises, i) → Exercise[]` (`i` may be either member)
  - `swapPair(exercises, i) → Exercise[]` (members swap; `superset` moves to the new first)
  - `removeExercise(exercises, i) → Exercise[]` (removing a member dissolves the pair)
  - `supersetBlocks(exercises) → Array<{start:number,length:1|2}>`
  - `moveBlockOrder(exercises, fromBlock, toBlock) → number[]` — permutation of exercise indexes; apply as `order.map(i=>list[i])` to exercises and to any view-state array (e.g. `collapsed`).

- [ ] **Step 1: Write failing tests**

```js
const ex=(name,restSeconds=120)=>({name,sets:3,restSeconds,warmupSets:0,repRange:{min:8,max:12},primaryMuscles:['Chest'],secondaryMuscles:[]});
test('pairing defaults and guards',()=>{
  const list=[ex('A',180),ex('B',90),ex('C')];
  const paired=pairWithNext(list,0);
  assert.deepEqual(paired[0].superset,{restBetweenSeconds:30,restAfterRoundSeconds:180});
  assert.equal(list[0].superset,undefined);
  assert.equal(canPairWithNext(paired,1),false);assert.equal(canPairWithNext(paired,2),false);
  assert.throws(()=>pairWithNext(paired,1));
  assert.deepEqual([0,1,2].map(i=>pairRole(paired,i)),['first','second',null]);
});
test('unpair, swap and remove keep the invariant',()=>{
  const paired=pairWithNext([ex('A'),ex('B'),ex('C')],0);
  assert.equal(unpair(paired,1)[0].superset,undefined);
  const swapped=swapPair(paired,1);
  assert.deepEqual(swapped.map(e=>e.name),['B','A','C']);assert.ok(swapped[0].superset);assert.equal(swapped[1].superset,undefined);
  assert.deepEqual(removeExercise(paired,1).map(e=>[e.name,Boolean(e.superset)]),[['A',false],['C',false]]);
  assert.deepEqual(removeExercise(paired,0).map(e=>[e.name,Boolean(e.superset)]),[['B',false],['C',false]]);
  assert.equal(supersetError(removeExercise(paired,1)),null);
});
test('blocks move as units and never split a pair',()=>{
  const list=pairWithNext([ex('A'),ex('B'),ex('C'),ex('D')],1); // [A][B+C][D]
  assert.deepEqual(supersetBlocks(list),[{start:0,length:1},{start:1,length:2},{start:3,length:1}]);
  assert.deepEqual(moveBlockOrder(list,1,0),[1,2,0,3]);
  assert.deepEqual(moveBlockOrder(list,0,2),[1,2,3,0]);
  assert.deepEqual(moveBlockOrder(list,2,1),[0,3,1,2]);
  const moved=moveBlockOrder(list,0,2).map(i=>list[i]);assert.equal(supersetError(moved),null);
});
```

- [ ] **Step 2: Run `npm test` — FAIL (module missing).**
- [ ] **Step 3: Implement `src/superset.js` with the signatures above.**
- [ ] **Step 4: Run `npm test` — PASS.**
- [ ] **Step 5: Commit** `feat: add pure superset pairing and block-move helpers`

### Task 3: Duration rule and breakdown

**Files:**
- Modify: `src/duration.js` (`computeDuration`)
- Modify: `src/duration-controls.js` (Warm-up row, hint text)
- Test: `test/duration.test.js`, `e2e/duration.spec.js`

**Interfaces:**
- Consumes: `supersetBlocks` (Task 2).
- Produces: `computeDuration(workout) → {warmupSeconds, executionSeconds, restSeconds, extraSeconds, bufferSeconds, totalSeconds, displayMinutes}` (key order as listed).

- [ ] **Step 1: Write failing tests** (extra 0, buffer 0 unless stated):

```js
const w=(exercises,extraMinutes=0,bufferPercent=0)=>({name:'W',goals:{},exercises,extraMinutes,bufferPercent});
test('straight exercise warm-ups: 60s each, no rest between, exercise rest before first set',()=>{
  assert.deepEqual(computeDuration(w([{sets:3,restSeconds:120,warmupSets:2}])),{warmupSeconds:120,executionSeconds:180,restSeconds:480,extraSeconds:0,bufferSeconds:0,totalSeconds:780,displayMinutes:13});
});
test('uneven superset: warm-ups, rounds and a leftover straight set',()=>{
  const r=computeDuration(w([{sets:4,restSeconds:180,warmupSets:1,superset:{restBetweenSeconds:30,restAfterRoundSeconds:90}},{sets:3,restSeconds:60,warmupSets:0}]));
  assert.equal(r.totalSeconds,1020);assert.equal(r.warmupSeconds,60);assert.equal(r.executionSeconds,420);assert.equal(r.restSeconds,540);
});
test('equal superset with no transition',()=>{
  assert.equal(computeDuration(w([{sets:3,restSeconds:60,superset:{restBetweenSeconds:0,restAfterRoundSeconds:120}},{sets:3,restSeconds:60}])).totalSeconds,720);
});
test('buffer covers warm-ups; invalid sets in a pair count as zero',()=>{
  assert.equal(computeDuration(w([{sets:3,restSeconds:120,warmupSets:2}],0,10)).totalSeconds,858);
  assert.equal(computeDuration(w([{sets:0,restSeconds:60,superset:{restBetweenSeconds:30,restAfterRoundSeconds:90}},{sets:2,restSeconds:60}])).totalSeconds,300);
});
```

Update the existing deepEqual expectations to include `warmupSeconds:0` first.

- [ ] **Step 2: Run `npm test` — FAIL.**
- [ ] **Step 3: Implement** the spec A2 formulas by iterating `supersetBlocks`. An exercise whose sets are invalid contributes nothing, its warm-ups included ("invalid sets count as 0 sets"); in a pair, the warm-up rest `R` applies only when the counted warm-ups are > 0. Add `warmupSeconds:'Warm-up'` as the first breakdown row in `duration-controls.js`; hint text becomes `1 min per set, plus rest after every set. Warm-ups have no rest between them. Buffer applies to the full subtotal.`
- [ ] **Step 4: Run `npm test` and `npx playwright test e2e/duration.spec.js` — PASS (update e2e row-count expectations for the new row).**
- [ ] **Step 5: Commit** `feat: include warm-ups and superset rounds in duration`

### Task 4: Version 4 bundles and field preservation

**Files:**
- Modify: `src/document-bundle.js` (accept 3 and 4, write 4)
- Test: `test/document-bundle.test.js`, `test/document-import.test.js`, `test/shared-catalog-propagation.test.js`

**Interfaces:**
- Produces: `serializeDocumentBundle` writes `version: 4`; `validateDocumentBundle` accepts `version` 3 or 4 and returns `version: 4`; `parseDocumentBundle` keeps v1/v2 paths.

- [ ] **Step 1: Write failing tests**

```js
test('v4 round trip keeps warm-ups and pairs; v3 imports with defaults',()=>{
  const template={name:'T',goals:{},extraMinutes:5,bufferPercent:10,exercises:[{...ex,warmupSets:2,superset:{restBetweenSeconds:30,restAfterRoundSeconds:120}},{...ex,warmupSets:0}]};
  const text=serializeDocumentBundle({record:{kind:'template',document:template}});
  assert.equal(JSON.parse(text).version,4);
  assert.deepEqual(parseDocumentBundle(text).bundle.template,validateDocument('template',template).document);
  const v3=parseDocumentBundle(JSON.stringify({version:3,kind:'template',template:{...template,exercises:[ex,ex]}})).bundle.template;
  assert.deepEqual(v3.exercises.map(e=>[e.warmupSets,Object.hasOwn(e,'superset')]),[[0,false],[0,false]]);
  assert.equal(parseDocumentBundle(JSON.stringify({version:4,kind:'template',template:{...template,exercises:[{...ex,warmupSets:9}]}})).error,'Exercise 1: Warm-up sets must be a whole number from 0 to 5.');
  assert.equal(parseDocumentBundle(JSON.stringify({version:5,kind:'template',template})).error,'Unsupported file version.');
});
```

In `shared-catalog-propagation.test.js`, add: a template whose linked exercise has `warmupSets:2` and `superset` keeps both after a reference/variant definition edit propagates.

- [ ] **Step 2: Run `npm test` — FAIL.**
- [ ] **Step 3: Implement** the version change; fix propagation/link code only if the new test fails (`linkExercise` already spreads `...exercise`).
- [ ] **Step 4: Run `npm test` — PASS; update other tests asserting `version:3` on export.**
- [ ] **Step 5: Commit** `feat: export version 4 bundles with warm-ups and supersets`

### Task 5: Warm-up slider and summary in the editor

**Files:**
- Modify: `src/exercise.js` (`createExercise`, `exerciseSummary`)
- Modify: `src/session-editor.js` (`CARD_HTML`, card sync, input handler, field focus map)
- Modify: `style.css`, `docs/design-system/README.md` (Exercise card section)
- Test: `test/exercise.test.js`, `e2e/session-editor.spec.js`

**Interfaces:**
- Consumes: `LIMITS.warmupSets`.
- Produces: `createExercise()` includes `warmupSets: 0`; `exerciseSummary(ex, {paired=false}={})` → e.g. `3 × 8–12 + 2 warm-up · Rest 2 min`, `3 × 8–12 + 1 warm-up · Superset` when paired, warm-up part omitted at 0.

- [ ] **Step 1: Write failing tests**

```js
test('summary shows warm-ups and superset rest',()=>{
  assert.equal(exerciseSummary({sets:3,repRange:{min:8,max:12},restSeconds:120,warmupSets:2}),'3 × 8–12 + 2 warm-up · Rest 2 min');
  assert.equal(exerciseSummary({sets:3,repRange:{min:8,max:12},restSeconds:120,warmupSets:0}),'3 × 8–12 · Rest 2 min');
  assert.equal(exerciseSummary({sets:3,repRange:{min:8,max:8},restSeconds:120,warmupSets:1},{paired:true}),'3 × 8 + 1 warm-up · Superset');
});
```

e2e: in the session editor, the `Warm-up sets` slider (accessible name `Warm-up sets`) shows `None` and `aria-valuetext="None"` at 0; ArrowRight twice shows `2`; the duration total increases by exactly 4 min for a 120 s-rest exercise with 0% buffer (2×60 + 120); the collapsed summary contains `+ 2 warm-up`; volume panel values are unchanged.

- [ ] **Step 2: Run tests — FAIL.**
- [ ] **Step 3: Implement.** Slider sits after Sets in `exercise-main-fields`, same markup pattern as Sets (`data-field="warmupSets"`, `data-value="warmupSets"`), value text `None`/number. Volume code is untouched.
- [ ] **Step 4: Run `npm test` and the e2e spec — PASS. Inspect 1366×768 and 390×844: the main-fields row stays aligned (warm-up slider wraps with Sets on narrow widths).**
- [ ] **Step 5: Commit** `feat: add warm-up sets slider to exercise cards`

### Task 6: Superset frame, settings, swap, unlink and remove

**Files:**
- Modify: `src/session-editor.js` (render pairs, actions)
- Modify: `src/action-controls.js` (icons `link`, `unlink`, `swap`, `settings` if missing)
- Modify: `style.css`, `docs/design-system/README.md` (new "Superset frame" component)
- Test: `e2e/supersets.spec.js` (new)

**Interfaces:**
- Consumes: Task 2 helpers, `exerciseSummary(ex,{paired})`, `DURATION_LIMITS.restBetweenSeconds/restAfterRoundSeconds`.
- Produces DOM contract used by Task 7: list children are `li.exercise` (single) or `li.superset[data-block-start]` containing a header `.superset-head` and an `ol.superset-members` with two `li.exercise`. Card `dataset.index` remains the exercise index.

- [ ] **Step 1: Write failing e2e tests** (fixture: Bench 180 s, Row 90 s, Curl 90 s; 0 extra, 0 buffer):
  - Card 1 has `Superset Bench with next exercise`; card 3 (last) has none. Clicking it renders one `.superset` containing Bench and Row; header text contains `30 sec between · 3 min after round`; afterwards no card shows a pair action (Bench and Row are paired; Curl is last).
  - Member cards show `Rest set by superset` and no `Rest per set` slider and no Reorder action.
  - `Superset rest settings` has `aria-expanded=false`; clicking opens sliders `Rest between exercises` and `Rest after round`; ArrowRight on `Rest between exercises` makes the header show `45 sec between` and the duration readout update immediately.
  - `Swap exercises` order becomes Row, Bench and the frame persists; `Unlink superset` removes the frame and Bench's `Rest per set` shows `3 min` again.
  - Removing Row (with confirmation helper if the remove action confirms) dissolves the pair; no `.superset` remains.
  - With `page.emulateMedia({reducedMotion:'reduce'})`, pairing/unpairing complete with no running animations (`document.getAnimations().length===0` right after click).
  - The `onChange` workout passes `validateDocument('template', …)` after every step.
- [ ] **Step 2: Run `npx playwright test e2e/supersets.spec.js` — FAIL.**
- [ ] **Step 3: Implement.**
  - Pair action: icon button in `.card-controls` before Reorder, label/tooltip `Superset <name> with next exercise` (`Untitled exercise` fallback), visible only when `canPairWithNext(exercises,i)`.
  - Frame header: `Superset` label, summary text `<formatDuration(between)> between · <formatDuration(after)> after round`, icon buttons `Superset rest settings` (`aria-expanded`/`aria-controls`), `Swap exercises`, `Reorder superset` (`.reorder-action`, used by Task 7), `Unlink superset`. Settings body uses the existing `.collapsible` grid-rows pattern (200 ms ease-out, instant under reduced motion).
  - Pair/unpair motion: new frames enter with the collapse pattern (height + opacity) only when created by a user pair action; removal finishes its closing transition before `renderExercises()` rebuilds; a second click during the transition cancels the pending callback (guard with a token). Imports, loads and reorders render without animation.
  - Remove uses `removeExercise`; collapsed state follows the same index changes.
- [ ] **Step 4: Run the spec plus `e2e/session-editor.spec.js`, `e2e/exercise-disclosure.spec.js`, `e2e/exercise-actions.spec.js` — PASS.**
- [ ] **Step 5: Commit** `feat: pair exercises into supersets in the session editor`

### Task 7: Reordering pairs as blocks

**Files:**
- Modify: `src/session-editor.js` (`mountSortable` options, reorder menu, keyboard handler, `commitMove`)
- Test: `e2e/supersets.spec.js`, `e2e/drag-reorder.spec.js`, `e2e/reorder-regressions.spec.js`

**Interfaces:**
- Consumes: `supersetBlocks`, `moveBlockOrder` (Task 2); DOM contract from Task 6.
- Produces: `commitBlockMove(fromBlock, toBlock)` replacing `commitMove`; applies `order` to `session.exercises` and `collapsed`, then rebuilds and focuses the moved block's reorder handle.

- [ ] **Step 1: Write failing e2e tests** (fixture A, [B+C], D):
  - Dragging the pair's reorder handle above A gives B, C, A, D; the pair is intact.
  - Dragging D onto the gap between B and C lands D before or after the whole pair, never between (assert order is one of `A,D,B,C` / `A,B,C,D` and that `.superset` still contains B and C).
  - Keyboard: focus pair handle, ArrowUp → B, C, A, D with focus still on the pair handle; ArrowDown on A's handle when the next block is the pair → B, C, A, D.
  - Reorder menu on the pair offers `Move up`/`Move down` with correct disabled states at the ends.
  - Touch: press-and-hold drag of the pair (existing touch helper) works.
- [ ] **Step 2: Run — FAIL.**
- [ ] **Step 3: Implement.** `itemSelector:'.exercise:not(.superset .exercise), .superset'`; `getKey` returns the block index; `onCommit` maps `beforeKey` to a target block index; menu and keyboard step by one block. Drag preview must still render like the source (existing body-level host) for both item kinds.
- [ ] **Step 4: Run the three specs — PASS.**
- [ ] **Step 5: Commit** `feat: reorder supersets as single blocks`

### Task 8: AI review input and prompt v14

**Files:**
- Modify: `src/analysis-input.js` (`prepareAnalysisSnapshot` exercise projection)
- Modify: `server/program-analysis-prompt.js` (projection + SYSTEM text + version)
- Test: `test/analysis-input.test.js`, `test/program-analysis-input.test.js`, `test/program-analysis-prompt.test.js`

**Interfaces:**
- Produces: snapshot exercises include `warmupSets` and, on first members, `superset:{restBetweenSeconds,restAfterRoundSeconds}`; supersets validated with `supersetError` (error details `field:'sets'`). Model-facing projection adds `supersetWith:<partner position>` to both members and moves rests to the first member only.

- [ ] **Step 1: Write failing tests**
  - `prepareAnalysisSnapshot` keeps `warmupSets:2` and `superset`; a broken pair fails with `Exercise 1: Invalid superset.`.
  - Changing `warmupSets` or a superset rest changes the program analysis fingerprint (extend the `changes` list in `program-analysis-input.test.js`).
  - `PROGRAM_ANALYSIS_PROMPT_VERSION === 'program-hypertrophy-v14'`; SYSTEM matches `/Warm-up sets never count toward volume/` and `/no rest between warm-ups/`; projected member exercises carry `supersetWith` 2 and 1; `facts.sessions[i].duration.warmupSeconds` is present.
- [ ] **Step 2: Run `npm test` — FAIL.**
- [ ] **Step 3: Implement.** SYSTEM additions (replace the existing duration sentence): `Duration assumes 60 seconds per set, warm-up or working. Warm-up sets never count toward volume; there is no rest between warm-ups, then the exercise rest before its first working set. Superset pairs alternate their two exercises each round with the supplied transition rest between them and the round rest after each round; a leftover set of the longer exercise uses the round rest. Rest after EVERY set or round counts, including the last, with scheduling allowances and one final round upward.`
- [ ] **Step 4: Run `npm test` — PASS.**
- [ ] **Step 5: Commit** `feat: send warm-ups and supersets to the program review (prompt v14)`

### Task 9: Phase A docs and verification

**Files:**
- Modify: `AGENTS.md` (new top section "Warm-ups, supersets and training profile (2026-11-03)" with Part A bullets; superseding note for "Workout duration")
- Create: `docs/superpowers/verification/2026-11-03-warmups-supersets-training-profile.md`

- [ ] **Step 1: Run `npm test`, `npm run test:e2e`, `npm run build` — all pass; paste counts into the verification doc.**
- [ ] **Step 2: Real-browser review** with populated templates (≥6 exercises, two pairs, warm-ups): pair/unpair/swap, settings disclosure open/close and rapid toggles, drag/keyboard/touch block reorder, reduced motion, at 1366×768, 1440×900, 1920×1080, 390×844 touch, 200% text. Record each item and any gap.
- [ ] **Step 3: Commit** `docs: record warm-up and superset verification`

---

## Phase B — Structured training profile

### Task 10: Profile shape and normalization

**Files:**
- Modify: `src/profile.js`
- Test: `test/profile.test.js`

**Interfaces:**
- Produces: `PROFILE_TEXT_FIELDS = ['trainingBackgroundAndApproach','constraintsAndPreferences']`; `PROFILE_LIMITS = {maxTrainingDaysPerWeek:{min:1,max:7,step:1}, maxSessionsPerDay:{min:1,max:2,step:1}, maxSessionMinutes:{min:20,max:180,step:5}, typicalRepsInReserve:{min:0,max:4,step:1}}`; `EXPERIENCE_LEVELS = ['beginner','intermediate','advanced']`; `normalizeProfile(value?) → Profile` (all nine keys, in spec B1 order). `PROFILE_FIELDS` is removed; update imports.

- [ ] **Step 1: Write failing tests**

```js
test('empty profile has every key unknown',()=>{
  assert.deepEqual(normalizeProfile(),{trainingBackgroundAndApproach:'',constraintsAndPreferences:'',maxTrainingDaysPerWeek:null,availableWeekdays:[],maxSessionsPerDay:null,maxSessionMinutes:null,experienceLevel:null,typicalRepsInReserve:null,equipment:[]});
});
test('structured fields normalize order and reject invalid values',()=>{
  const p=normalizeProfile({availableWeekdays:[4,0,2],equipment:['Machine','Barbell'],maxSessionMinutes:60,typicalRepsInReserve:0,experienceLevel:'advanced',unknown:1});
  assert.deepEqual(p.availableWeekdays,[0,2,4]);assert.deepEqual(p.equipment,['Barbell','Machine']);assert.equal(p.typicalRepsInReserve,0);assert.equal(Object.hasOwn(p,'unknown'),false);
  for(const bad of [{maxTrainingDaysPerWeek:0},{maxTrainingDaysPerWeek:8},{availableWeekdays:[7]},{availableWeekdays:[1,1]},{maxSessionsPerDay:3},{maxSessionMinutes:62},{maxSessionMinutes:15},{experienceLevel:'pro'},{typicalRepsInReserve:5},{equipment:['Sled']},{constraintsAndPreferences:'x'.repeat(2001)}])
    assert.throws(()=>normalizeProfile(bad));
});
test('legacy single-field profiles load',()=>{assert.equal(normalizeProfile({trainingBackgroundAndApproach:'Five years'}).constraintsAndPreferences,'');});
```

Extend the existing repository/API tests to round-trip a full structured profile.

- [ ] **Step 2: Run `npm test` — FAIL.**
- [ ] **Step 3: Implement** (error messages: one short sentence per field, e.g. `Max session length must be 20 to 180 minutes in steps of 5.`).
- [ ] **Step 4: Run `npm test` — PASS.**
- [ ] **Step 5: Commit** `feat: add structured training profile fields`

### Task 11: Program context keeps only Goals and priorities

**Files:**
- Modify: `src/program-context.js`, `src/program-context-dialog.js` (examples array)
- Modify: tests and fixtures listed by `grep -rn constraintsAndPreferences test e2e` (program context, analysis input/prompt, profile migration, `e2e/program-analysis-helper.js`, `e2e/program-context-dialog.spec.js`)
- Modify: `test/fixtures/analysis-programs.js` — move each fixture's `context.constraintsAndPreferences` text into `athlete.constraintsAndPreferences`. Additionally: `time-mismatch` athlete becomes `{constraintsAndPreferences:'Strict 20-minute sessions.',maxSessionMinutes:20}`; `structural-mismatch` adds `maxTrainingDaysPerWeek:1, availableWeekdays:[0], maxSessionMinutes:30`. All other fixtures keep prose only.

**Interfaces:**
- Produces: `PROGRAM_CONTEXT_FIELDS = ['goalsAndPriorities']`; legacy `constraintsAndPreferences` is dropped by `normalizeProgramContext`.

- [ ] **Step 1: Write failing tests**: `PROGRAM_CONTEXT_FIELDS` deepEquals `['goalsAndPriorities']`; `normalizeProgramContext({goalsAndPriorities:'Grow',constraintsAndPreferences:'60 min'})` deepEquals `{goalsAndPriorities:'Grow'}`; a stored program whose context only had constraints loads with no `context`; the dialog shows exactly one textarea `Goals and priorities`; a v3 import containing constraints succeeds.
- [ ] **Step 2: Run — FAIL.**
- [ ] **Step 3: Implement; update affected tests to the new shape.**
- [ ] **Step 4: Run `npm test` and `npx playwright test e2e/program-context*.spec.js` — PASS.**
- [ ] **Step 5: Commit** `feat: move constraints and preferences out of program context`

### Task 12: Profile page controls

**Files:**
- Modify: `src/profile-view.js` (rewrite as sectioned form)
- Modify: `style.css`, `docs/design-system/README.md` (Profile page section)
- Test: `e2e/profile.spec.js`

**Interfaces:**
- Consumes: `normalizeProfile`, `PROFILE_LIMITS`, `EXPERIENCE_LEVELS`, `EQUIPMENT`, existing equipment pill markup/icon helper from `src/equipment-controls.js`.
- Produces: `mountProfileView(root,{profile,onChange}) → {setProfile, syncSaved, destroy}` (unchanged contract; `onChange` receives a full normalized profile).

- [ ] **Step 1: Write failing e2e tests**
  - Headings `Schedule`, `Session length`, `Experience`, `Equipment`, `Notes` in that order.
  - `Max training days per week` slider: Home → `No limit` (`aria-valuetext`), ArrowRight → `1`; saved profile has `maxTrainingDaysPerWeek:1`.
  - Day pills `Mon`…`Sun` are buttons with `aria-pressed`; pressing Mon and Thu saves `[0,3]`.
  - `Max sessions per day` radios `No limit`, `1`, `2`.
  - `Max session length` slider leftmost = `No limit` (saves `null`), next = `20 min`.
  - Level radios `Not set`, `Beginner (<1 yr)`, `Intermediate (1–3 yrs)`, `Advanced (3+ yrs)`; `Typical reps in reserve` leftmost `Not set`, then `0`.
  - Equipment pills toggle; Barbell + Machine saves `['Barbell','Machine']`.
  - `Constraints and preferences` textarea with the spec example help text; typing autosaves; header save status shows saved; conflict offers Reload saved version only (reuse existing profile conflict test).
  - Reloading the page restores every value.
- [ ] **Step 2: Run `npx playwright test e2e/profile.spec.js` — FAIL.**
- [ ] **Step 3: Implement.** Slider sentinel positions map to `null` (`maxTrainingDaysPerWeek` slider min 0; session length slider min 15; RIR slider min −1). Two-column field grid at ≥761px, stacked below. Saved acknowledgements must not move focus/caret or reset a slider mid-drag (keep the existing equal-value guard per control).
- [ ] **Step 4: Run — PASS; inspect 1366×768, 390×844 touch (44px pills/radios), 200% text.**
- [ ] **Step 5: Commit** `feat: structured profile page`

### Task 13: Pure profile checks

**Files:**
- Create: `src/profile-checks.js`
- Test: `test/profile-checks.test.js`

**Interfaces:**
- Consumes: `computeDuration`, normalized profile.
- Produces: `profileChecks({mode, workouts}, profile) → {unscheduledCount, trainingDays: null|{count,max}, unavailableDays: Array<{day,occurrences:number[]}>, crowdedDays: Array<{day,count,max}>, longSessions: Array<{occurrence,name,displayMinutes,max}>, equipmentMismatches: Array<{occurrence,exercisePosition,name,equipment}>}` where `workouts` are resolved occurrences `{day, ...workout}` in program order and `occurrence`/`exercisePosition` are 1-based. Sequence mode (`mode:'simple'`) returns `trainingDays:null`, `[]` for both day lists and `unscheduledCount:0`.

- [ ] **Step 1: Write failing tests**

```js
const sess=(day,sets=3,equipment)=>({day,name:'S',extraMinutes:0,bufferPercent:0,goals:{},exercises:[{name:'Bench',sets,restSeconds:120,warmupSets:0,repRange:{min:8,max:12},primaryMuscles:['Chest'],secondaryMuscles:[],...(equipment?{equipment}:{})}]});
const profile=normalizeProfile({maxTrainingDaysPerWeek:2,availableWeekdays:[0,2,4],maxSessionsPerDay:1,maxSessionMinutes:20,equipment:['Dumbbell']});
test('week checks',()=>{
  const r=profileChecks({mode:'schedule',workouts:[sess(0),sess(0),sess(1),sess(3,10,'Barbell'),sess(null)]},profile);
  assert.equal(r.unscheduledCount,1);
  assert.deepEqual(r.trainingDays,{count:3,max:2});
  assert.deepEqual(r.unavailableDays,[{day:1,occurrences:[3]},{day:3,occurrences:[4]}]);
  assert.deepEqual(r.crowdedDays,[{day:0,count:2,max:1}]);
  assert.deepEqual(r.longSessions,[{occurrence:4,name:'S',displayMinutes:30,max:20}]);
  assert.deepEqual(r.equipmentMismatches,[{occurrence:4,exercisePosition:1,name:'Bench',equipment:'Barbell'}]);
});
test('sequence mode skips day checks; empty profile yields no findings',()=>{
  const r=profileChecks({mode:'simple',workouts:[sess(0),sess(0),sess(1)]},profile);
  assert.deepEqual([r.trainingDays,r.unavailableDays,r.crowdedDays,r.unscheduledCount],[null,[],[],0]);
  const none=profileChecks({mode:'schedule',workouts:[sess(0,10,'Barbell')]},normalizeProfile());
  assert.deepEqual(none,{unscheduledCount:0,trainingDays:null,unavailableDays:[],crowdedDays:[],longSessions:[],equipmentMismatches:[]});
});
```

- [ ] **Step 2: Run `npm test` — FAIL.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run `npm test` — PASS.**
- [ ] **Step 5: Commit** `feat: compute profile limit checks`

### Task 14: Server injection and prompt v15

**Files:**
- Modify: `server/api.js` (inject full profile), `server/program-analysis-prompt.js`, `scripts/evaluate-program-analysis.js` (inject `normalizeProfile(source.athlete)`)
- Test: `test/program-analysis-api.test.js`, `test/program-analysis-prompt.test.js`, `test/program-analysis-evaluation.test.js`

**Interfaces:**
- Consumes: `normalizeProfile`, `profileChecks`.
- Produces: user message JSON `{program, athlete: <normalized profile>, facts: {..., profileChecks}}`; snapshot workouts map to `profileChecks` input as `{mode, workouts: snapshot.workouts.map(w=>({day:w.day,...templateWorkout}))}`. In Sequence mode `facts.profileChecks` omits `unscheduledCount`, `trainingDays`, `unavailableDays`, `crowdedDays`.

- [ ] **Step 1: Write failing tests**
  - API: a saved profile with `maxSessionMinutes:30` reaches `analysis.analyze` as `athlete.maxSessionMinutes===30`; a client-sent `athlete` in the snapshot is ignored (existing test pattern).
  - Prompt: version `program-hypertrophy-v15`; `data.athlete` deepEquals the normalized profile; `facts.profileChecks.longSessions` present for a `time-mismatch` fixture with `maxSessionMinutes:20`; Sequence fixture has no day-check keys; SYSTEM matches `/profileChecks are authoritative/` and `/athlete limits are fixed constraints/`.
- [ ] **Step 2: Run `npm test` — FAIL.**
- [ ] **Step 3: Implement.** SYSTEM additions: `Athlete limits (max training days, available weekdays, max sessions per day, max session length, equipment) are fixed constraints, not negotiable; null or empty values mean unknown. profileChecks are authoritative server comparisons against those limits: cite them, never recalculate them, and treat an absence of a check as no known violation, not proof of fit. Experience level and typical reps in reserve are self-report. Equipment mismatches name the exercise; only suggest alternatives using listed equipment.` Update "Context and athlete background" wording to "Context and athlete profile".
- [ ] **Step 4: Run `npm test` — PASS.**
- [ ] **Step 5: Commit** `feat: send structured profile and limit checks to the program review (prompt v15)`

### Task 15: In-app limit hints

**Files:**
- Modify: `src/app.js` (load profile for program and session-editor routes; revalidate on window focus; pass `profile` / `setProfile`)
- Modify: `src/program-view.js` (card duration, Week day labels, header/weekly line)
- Modify: `src/duration-controls.js` (optional `maxSessionMinutes` → readout suffix)
- Modify: `src/session-editor.js` (forward `maxSessionMinutes` to duration controls)
- Modify: `style.css`, `docs/design-system/README.md` (Limit hint pattern)
- Test: `e2e/profile-hints.spec.js` (new)

**Interfaces:**
- Consumes: `profileChecks` (Task 13), `api.getProfile`.
- Produces: `mountProgramView(..., {profile})` + returned `setProfile(profile)`; `mountDurationControls(host,{workout,onChange,maxSessionMinutes=null})` + `setMaxSessionMinutes(n|null)`; `mountSessionEditor(..., {maxSessionMinutes})` + `setMaxSessionMinutes`.

- [ ] **Step 1: Write failing e2e tests** (profile saved via API: max days 1, available `[0]`, max per day 1, max 20 min; program in Week with sessions Mon, Mon, Wed, one 30-minute session):
  - Long session card metadata reads `Estimated duration ~30 min · over 20 min max`, with tooltip `Longer than your max session length (Profile)`.
  - Wednesday day label shows `Not an available day`; Monday shows `2 sessions · max 1`.
  - Header/weekly line shows `2 training days · max 1`.
  - Switching to Sequence removes the day hints and the training-days line; the long-session hint remains.
  - Editing sets in the shared editor updates the duration readout suffix live (`over 20 min max` appears/disappears) with no animation.
  - With `GET /api/profile` routed to a 500 (`page.route`), no hints render and editing/saving still succeed.
  - With an empty profile, no hint elements exist.
- [ ] **Step 2: Run — FAIL.**
- [ ] **Step 3: Implement.** Hints use the warning token plus text; never colour alone; no transitions. Hints are computed on render from `profileChecks`; never stored.
- [ ] **Step 4: Run the spec plus `e2e/program-overview.spec.js`, `e2e/programs.spec.js`, `e2e/duration.spec.js`, `e2e/compact-desktop.spec.js` — PASS.**
- [ ] **Step 5: Commit** `feat: show non-blocking profile limit hints`

### Task 16: Phase B docs and verification

**Files:**
- Modify: `AGENTS.md` (complete the 2026-11-03 section with Part B bullets; note it supersedes the program-context and profile rules in "Program hypertrophy analysis" and "Program follow-ups")
- Modify: `docs/superpowers/verification/2026-11-03-warmups-supersets-training-profile.md`

- [ ] **Step 1: Run `npm test`, `npm run test:e2e`, `npm run build` — all pass; record counts.**
- [ ] **Step 2: Real-browser review**: profile page controls (keyboard, touch, 200% text), autosave/Retry/conflict, hints in Week and Sequence with populated programs, AI review dock still works with hints present, at the viewports listed in Task 9. Record results and gaps; note that local DB programs still holding `constraintsAndPreferences` drop it on next save (no migration, by decision).
- [ ] **Step 3: Commit** `docs: record training profile verification`
