# Mobile Workout Focus Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make active mobile logging a satisfying, snapping set-by-set experience, with fast overview access, preserved editing/sync behavior, and an explicit finish recap.

**Architecture:** Keep `mountWorkoutLogger` and `workout-controller` as the authoritative view/edit and sync owners. Derive execution order separately; move the same set/input/note nodes between compact and Focus presentation instead of mounting a second logger. Compose small ruler, title, overview, and advancement modules; hand acknowledged finished records to the existing app autosave before allowing recap note edits.

**Tech Stack:** JavaScript ES modules, native DOM/CSS, Node 24, node:test, existing Playwright/Chromium. No new dependencies or server/schema changes.

**Spec:** `docs/superpowers/specs/2026-11-08-mobile-workout-focus-design.md`, approved in conversation on 2026-11-08. Read the entire specification before this plan. Prototype `focus-flow-v7.html` in ignored `.superpowers/brainstorm/2411-1794092968/content/` is a visual reference, not reusable persistence code.

## Global Constraints

- Focus is the default for active workouts at widths up to and including 760px. Desktop retains the regular tracker. Finished workouts use the compact, editable record on every viewport.
- Logs retain version 2. No SQL migration, API endpoint, export format, persistent reward model, new offline creation, or new offline editing of finished logs is introduced.
- No rest timer, sound, haptics, streaks, points, or verified-PR celebration is in scope.
- Keep `workout-controller` as the single active/pending-finish sync owner. A logger view attaches to that owner; it never creates a competing mirror or sync.
- Weight is 0–999.75kg by 0.25, with blank/0 meaning bodyweight; reps are integers 1–100. RIR is optional, 0–5. Existing placeholder materialization, strict validation, and note limits 2,000/1,000/280 UTF-16 units remain authoritative.
- Weight ruler increments are 0.25, 1, 2.5, and 5kg, initially 2.5kg. Changing an increment or mounting a ruler does not round an existing valid typed value.
- Each RIR value has a touch target at least 44×44px. Direct numeric inputs remain at least 16px. Prefer the approximately 60px real next-card preview, but allow oversized cards to scroll without clipping.
- Title motion starts at approximately 22px/s after 1.4 seconds; dragging pauses it and release waits approximately 2.2 seconds. Tap title to pause/resume. There is no separate play/pause button.
- Completion timings: progress fill approximately 480ms; check drawing approximately 300ms; restrained scale approximately 480ms; Auto-next approximately 650ms. Reduced motion makes state changes/advancement instant and disables title autoplay.
- Auto-next defaults on; UI preferences, cursor, drafts, and title state stay outside the log and clear across auth changes. Preserve input/notes DOM identity, focus, composition, and invalid drafts through breakpoint changes and saves.
- The final set can advance to review; only explicit Finish calls `confirmFinish`. Preserve all pruning, confirmation, pending-finish, conflict, and offline restrictions.
- Home / Library / History / User is now implemented on `main` (navigation merge recorded by `21ac242`). Reuse the shell and `--tab-bar-height`; logger horizontal gestures never navigate root destinations. Do not change `src/mobile-swipe.js`, `src/mobile-navigation-state.js`, or shell routing to implement controls.
- Never claim a locally queued finish was saved on the server. Never claim a pending deployment was verified. This plan authorizes no deployment.

## Review Focus

- An invalid decimal draft or composing note at the 760px breakpoint must retain the exact node, text, caret, error, and edit state; pin this in Tasks 2 and 8.
- A slow save/Best response after reorder, removal, route exit, or logout must not move the cursor, reopen a view, replay completion, or re-enable a stale recap; pin this in Tasks 7–9.
- A real mobile browser may cancel a pointer during vertical scrolling or zoom: rulers and ticker must preserve scrolling and never turn a drag into a pause tap or a navigation swipe; pin this in Tasks 3, 4, and 10.
- A finished snapshot may be acknowledged and its controller released before the recap callback runs: create exactly one finished autosave, using the acknowledged revision, and keep pending finishes read-only; pin this in Task 9.
- Repeated variants, zero-set exercises, uneven supersets, and very long names/notes must preserve distinct identities, truthful progress, and access to all controls; pin this in Tasks 1, 5, and 6.

## File map and execution order

| New module | Responsibility |
| --- | --- |
| `src/workout-focus-model.js` | Pure execution projection, current/fallback selection, milestone and rep-range descriptions |
| `src/workout-history-summary.js` | Existing Last time/note/Best presentation, shared by compact and Focus |
| `src/workout-ruler.js` | Ruler interaction attached to an existing numeric input; no log ownership |
| `src/workout-title.js` | Overflow-only ticker, tap/drag/keyboard input, lifecycle and reduced motion |
| `src/workout-focus-view.js` | Focus cards, toolbar and shared-row placement; no independent mutations/sync |
| `src/workout-overview.js` | Grouped jump/management sheet over the logger's command port |
| `src/workout-focus-advance.js` | Explicit completion feedback and cancellable advancement |
| `src/workout-focus-session.js` | Auth-scoped, memory-only UI state |
| `src/workout-recap.js` | Transient completion recap and note surface, with explicit editability |

Modify `src/workout-logger-view.js`, `src/workout-set-row.js`, `src/workout-controller.js`, `src/app.js`, `style.css`, and the documentation/tests listed per task. Reuse `workout-edit`, `workout-note`, `workout-sets`, `workout-best`, dialog/menu/picker/sortable helpers, and the current save-controls host. `scripts/build-static.js` already copies all of `src`; new modules need no build manifest.

Execute sequentially: 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10. At execution time establish isolation with `using-git-worktrees`, recheck for newer navigation work, and run `npm.cmd test` as the baseline. No implementation worktree or product changes are needed to review this plan. Preserve unrelated changes and commit only each task's explicit files.

### Task 1: Define execution order, cursor recovery, and truthful hints

**Files:** Create `src/workout-focus-model.js`, `test/workout-focus-model.test.js`, `test/fixtures/workout-focus.js`.

**Interfaces:** `SetRef = {exerciseId:string,setId:string}`. Export `setKey(ref) -> string` using `JSON.stringify([exerciseId,setId])`; `projectWorkout(log) -> {items:FocusItem[],workingKeys:string[],doneKeys:Set<string>,current:SetRef|null}`; `focusFallback(previousItems,items,viewed:SetRef|null) -> SetRef|null`; `repRangeHint({kind,reps,range,invalid=false}) -> null|{state:'target'|'within'|'below'|'above',delta:number|null,text:string}`; `completionMilestone(before,after,ref) -> {kind:'warmup'|'set'|'exercise'|'round'|'pair',text:string}`. A `FocusItem` has `{key,ref,exerciseIndex,kind,kindIndex,pairId,member,round,preview:{eyebrow,label}}`; `member` is a pair label such as A1/B2 or null, and `round` is 1-based for paired working sets only. Inputs are read-only; no helpers alter the log.

- [ ] **Step 1:** Write named cases `projects pair warmups then rounds without changing storage`, `retains uneven leftovers and empty exercise identity`, `falls forward then backward after removal`, `does not merge repeated variants`, and `range is inclusive and advisory`. Fixture export `focusFixture()` returns a valid active v2 log: straight exercise `straight` with `sw,s1,s2`; pair `a` with `aw,a1,a2` and rests 30/90, `b` with `bw,b1`; and zero-set exercise `empty`. Targets are 8–10 for straight and 10–12 for paired exercises. Give every note an empty default and every set a stable ID.

```js
const log=focusFixture(), before=structuredClone(log), p=projectWorkout(log);
assert.deepEqual(p.items.map(i=>i.ref.setId), ['sw','s1','s2','aw','bw','a1','b1','a2']);
assert.deepEqual(log,before);
assert.equal(p.workingKeys.length,5);
assert.equal(repRangeHint({kind:'working',reps:6,range:{min:8,max:10}}).text,'2 below target · Aim for 8–10 reps');
assert.equal(repRangeHint({kind:'working',reps:10,range:{min:8,max:10}}).state,'within');
assert.equal(repRangeHint({kind:'warmup',reps:6,range:{min:8,max:10}}),null);
```

- [ ] **Step 2:** Run `node --test test/workout-focus-model.test.js`; expect failure from the absent module/exports.
- [ ] **Step 3:** Implement projection with `supersetBlocks`, kind-specific numbering, all A1 warm-ups then A2 warm-ups then alternating working sets. `current` is the first `!done` item, including warm-ups. Fallback preserves a surviving ref, otherwise scans successors in the previous order, then predecessors, then returns null. Return no invented range for null targets and no comparison for invalid/empty drafts; exercise/round/pair messages require all applicable working sets done.
- [ ] **Step 4:** Run `node --test test/workout-focus-model.test.js test/workout-edit.test.js test/workout-sets.test.js`; expect all tests to pass. Add assertions for both bounds, reps 1/100, empty/invalid input, a reused variant with different targets, delimiter-containing IDs, and a round whose partner was skipped.
- [ ] **Step 5:** Commit the three files with `git commit -m "feat: model workout Focus execution order and hints"` after explicit `git add`.

### Task 2: Expose a shared presentation boundary without changing the regular logger

**Files:** Modify `src/workout-logger-view.js`, `src/workout-set-row.js`; create `src/workout-history-summary.js`, `e2e/workout-presentation.spec.js`. Reuse `src/workout-note.js` and `e2e/workout-helper.js`.

**Interfaces:** Keep the current `mountWorkoutLogger(root,options)` interface and return methods. Add `presentationPort` with:

- `read() -> {log,lastTime,bestPerformance,bestStatus,unavailable}` (copies of data, never mutable state ownership).
- `subscribe(listener) -> unsubscribe`, publishing `{cause:'edit'|'hydrate'|'history'|'status',before,after,action}`; `before`/`after` are workout logs and `action` is null except for an explicit command. Status/history publications do not masquerade as edits.
- `row(ref) -> HTMLElement|null`; `setRowPlacement(place|null)` where `place({ref,row,compactHost,index})` decides the live row's parent; `restoreRows()` returns every surviving row to its compact host.
- `command(action) -> Promise<{accepted:boolean,error?:string}>`, using the existing handlers. Actions are `{type:'patch',ref,patch}`, `{type:'toggle',ref}`, `{type:'set-note',ref,open:true}`, `{type:'exercise-note',exerciseId,host}`, `{type:'add-set'|'add-warmup'|'remove-exercise'|'unlink',exerciseId}`, `{type:'swap',exerciseId,host}`, `{type:'reorder',exerciseId,opener}`, `{type:'move-block',exerciseId,toBlockIndex}`, `{type:'remove-set',ref}`, `{type:'add-exercise',host}`, and `{type:'finish'|'discard'}`. `host`/`opener` are visible DOM nodes supplied by the presentation; picker/menu/confirmation commands open existing surfaces there. Resolve the current source block by exercise ID before `moveLogBlock`, not by a saved index. Final picker selections use current transforms.
- `restoreExerciseNotes()` reparents current exercise-note editor nodes to their compact hosts.

Export `setRowBindings(row)` from `workout-set-row.js`, returning stable `{inputs:{weight,reps},number,done,rir,menu,noteHost,errors,applyValue(kind,value),hasInvalidDraft()}`. `applyValue` passes through the existing `typed` parser exactly once. Add `destroySetRow(row)` to dispose subsequently attached widgets when a row is really removed.

Export `mountWorkoutHistory(host,state) -> {update(state),destroy()}`, where `state={exercise,lastTime,bestPerformance,bestStatus,unavailable}` uses the same maps/statuses as the logger. Extract current Last time/note/Best rendering into it without changing copy or selection.

- [ ] **Step 1:** Add fixture-browser cases `reparents the exact focused input without changing a draft`, `ports emit only explicit edits`, and `history refresh keeps note/input nodes`. Mount the real logger with the Task 1 fixture, use `presentationPort`, and pin:

```js
// Capture input identity before moving the same row into a temporary host.
await field.fill('82.3'); // invalid weight draft
await expect(field).toHaveValue('82.3');
expect(await page.evaluate(()=>window.originalInput===window.port.row(window.ref).querySelector('[data-field="weight"]'))).toBe(true);
await expect(field).toBeFocused();
// setLog/revision/history updates emit no explicit toggle and do not clear the draft.
```

- [ ] **Step 2:** Run `npx.cmd playwright test e2e/workout-presentation.spec.js`; expect the port/bindings tests to fail before adding the interface.
- [ ] **Step 3:** Implement the port around existing `commit`, confirmations, `toggle`, `dropSet`, picker, block move, and note handlers; do not copy their transforms. Route regular row placement through the hook rather than moving Focus-owned rows back on every render. Use `Element.moveBefore` when supported, otherwise preserve/restore focus and selection under the logger's `relocatingFocus` guard. Move the same exercise-note host when requested; other set cards have summary/open actions for that shared exercise note. Preserve composition and suppress relocation-triggered blur trimming. Extract history rendering and retain all current data/error paths. Record row teardown callbacks without changing existing `createSetRow` consumers.
- [ ] **Step 4:** Run `npx.cmd playwright test e2e/workout-presentation.spec.js e2e/workout-logger.spec.js e2e/workout-notes.spec.js e2e/workout-best.spec.js`; expect regular logger behavior unchanged at this task. Cover an exercise note in composition, an invalid done-set reps draft, canonical bodyweight/null values, and canceled destructive confirmation producing no accepted edit.
- [ ] **Step 5:** Commit the four files with `git commit -m "refactor: share workout presentation nodes and commands"`.

### Task 3: Attach matching rulers and live rep-range guidance to canonical inputs

**Files:** Create `src/workout-ruler.js`, `e2e/workout-ruler.spec.js`; modify `src/workout-set-row.js`, `style.css`.

**Interfaces:** `mountWorkoutRuler(host,{input,kind,onAdjust,onInteraction}) -> {update({value,placeholder,increment,range,enabled}),destroy()}`. `kind` is `weight|reps`; `onAdjust(number)` calls the Task 2 binding's `applyValue`, never a second edit callback. Use existing `parseWeight`/`parseReps` and `WORKOUT_LIMITS`. `enabled:false` hides/suspends the ruler without destroying the input or clearing drafts. Numeric input and original stepper events keep their existing ownership. Range text is obtained from Task 1; the ruler owns only the visual target band and slider semantics.

- [ ] **Step 1:** Add browser cases `typed exact weight survives increment change`, `ruler adjustment commits once`, `invalid draft is not saved`, `blank input is a placeholder not a recorded value`, and `diagonal and canceled gestures preserve scrolling`. Assert:

```js
await weight.fill('24.25'); await increment.selectOption('5');
await expect(weight).toHaveValue('24.25');
await weight.fill('999.75'); await expect(weight).toHaveValue('999.75');
await reps.fill('6'); await expect(guidance).toHaveText('2 below target · Aim for 8–10 reps');
// Geometry: every numeric input >=16px; keyboard/ruler bounds remain 0..999.75 and 1..100.
```

- [ ] **Step 2:** Run `npx.cmd playwright test e2e/workout-ruler.spec.js`; expect missing-widget failures.
- [ ] **Step 3:** Implement a horizontal tick track with a fixed center marker, bounded/virtualized visible ticks, native vertical scroll/pinch retention, drag capture only after horizontal intent, release snapping, and Arrow/Home/End input. Never create 4,000 weight options per card; do not create tick geometry while disabled. Use pointer threshold 8px and horizontal dominance 1.25 as initial control tuning, without changing root-navigation recognition. Typed comma decimals use existing parsing. Do not change a value on mount, resize, increment change, or placeholder update. Wire update-after-parse guidance so direct typing cannot display the previous value's status; suppress numeric comparisons for invalid drafts.
- [ ] **Step 4:** Run `npx.cmd playwright test e2e/workout-ruler.spec.js e2e/workout-presentation.spec.js`; expect all pass. Include null/0 BW, 0.25 and 999.75, reps 1/100, selection/caret through ack, warm-up/no-target omission, inclusive bounds, touch pointer cancellation, and no route/hash change during horizontal interaction. Check normal and reduced motion.
- [ ] **Step 5:** Commit with `git commit -m "feat: add workout rulers and advisory rep guidance"`.

### Task 4: Implement the draggable, tap-to-pause exercise title

**Files:** Create `src/workout-title.js`, `e2e/workout-title.spec.js`; modify `style.css`.

**Interfaces:** `mountWorkoutTitle(heading,{text,active=false,suspended=false,onInteraction}) -> {update({text,active,suspended}),destroy()}`. It retains the supplied heading and stores offset/explicit pause per instance. A fitting title has no button semantics/tab stop; an overflowing title exposes one accessible full name and a keyboard-operable interaction inside the heading. Visible duplicate copies are `aria-hidden`. `suspended` covers typing/dialogs; `active` covers current-card visibility.

- [ ] **Step 1:** Add cases `short title is stationary`, `tap pauses and resumes`, `drag never also toggles`, `vertical cancellation and pinch preserve native behavior`, and `reduced motion still permits manual reading`. Use Playwright `expect.poll`, not fixed startup sleeps, for movement:

```js
await expect(page.locator('.titlepause')).toHaveCount(0);
await titleControl.click(); await expect(titleControl).toHaveAttribute('aria-pressed','true');
await titleControl.press('Enter'); await expect(titleControl).toHaveAttribute('aria-pressed','false');
// Drag >8px; assert offset changed and explicit pause state did not change.
// Under reduced motion, transform stays fixed until manual ArrowRight/drag.
```

- [ ] **Step 2:** Run `npx.cmd playwright test e2e/workout-title.spec.js`; expect absent-module failure.
- [ ] **Step 3:** Implement overflow measurement against the full available title width; use two visual copies with 48px gap, 22px/s, initial 1,400ms hold, and 2,200ms post-drag hold. Only an active, unsuspended, visible-page instance schedules movement. Recognize horizontal drag after 8px/1.25 dominance, suppress click after any drag/cancel, and preserve vertical scroll and zoom. Tap/Enter/Space toggles explicit pause; arrow keys/Home/End read manually. Respect runtime reduced-motion changes, font/width/text changes, and destruction; do not reset pause on ordinary updates.
- [ ] **Step 4:** Run `npx.cmd playwright test e2e/workout-title.spec.js`; expect passing tap/drag/keyboard/loop-wrap/offscreen/typing/dialog/cleanup tests. Pin a long unbroken name, literal `<img>` text, viewport enlargement to fitting width, and a 44px-high interaction. Assert one accessible full title, no visible duplicate heading, and no extra pause button.
- [ ] **Step 5:** Commit with `git commit -m "feat: add interactive overflow workout titles"`.

### Task 5: Compose the Focus cards using the existing set nodes

**Files:** Create `src/workout-focus-view.js`, `e2e/workout-focus-view.spec.js`; modify `src/workout-set-row.js`, `style.css`.

**Interfaces:** `mountWorkoutFocus(host,{port,ui,onInteraction,onViewed,onFinish}) -> {update(snapshot),setEnabled(boolean),jump(ref|null,{animate=false,focus=false}),visibleRef(),focusContext(ref|null),suspend(boolean),restore(),destroy()}`. `ui={viewed:SetRef|null,autoNext:boolean,weightIncrement:number}`. Consume Tasks 1–4 and the Task 2 port. `ref:null` targets review/empty state. `restore()` returns every borrowed row, control, and exercise-note editor to compact slots before teardown. `setEnabled(false)` suspends motion and restores nodes; it does not discard drafts. Changes to UI preferences call `onInteraction({type:'preference',patch})`.

- [ ] **Step 1:** Mount the real logger and compose Focus through its port in fixture tests. Add `set cards reuse input and note identities`, `warmups and uneven supersets display execution context`, `RIR is one tap including zero and clear`, and `oversized cards remain reachable`. Assert:

```js
await rirZero.click(); await expect(rirZero).toHaveAttribute('aria-pressed','true');
await rirZero.click(); await expect(rirZero).toHaveAttribute('aria-pressed','false');
await expect(setNoteAction).toHaveCSS('border-top-width','0px');
await expect(page.getByRole('button',{name:'List view',exact:true})).toHaveCount(0);
// Capture weight input before/after composition; object identity must match.
```

- [ ] **Step 2:** Run `npx.cmd playwright test e2e/workout-focus-view.spec.js`; expect no Focus export/UI yet.
- [ ] **Step 3:** Build feed `ol` and keyed card chrome around the existing row `li` nodes. Use comments/slots to return moved number/done/notes controls to their original positions; do not clone interactive rows. Attach rulers only once to canonical inputs, enable geometry for the current/adjacent cards, reuse the existing RIR group and set-note editor, and add a borderless set-note action on its own line. Each card's exercise-note action opens the shared exercise editor through the port; retain the same live textarea on updates. Use `mountWorkoutHistory` for full benchmarks. Add review/empty states, contextual previews, and direct row placement. On update, use `focusFallback` against the previous projection; focus the fallback context only when a removal eliminated the focused control. Only the viewed card's title is active; picker/note/menu activity suspends it.
- [ ] **Step 4:** Run `npx.cmd playwright test e2e/workout-focus-view.spec.js e2e/workout-presentation.spec.js e2e/workout-ruler.spec.js e2e/workout-title.spec.js`; expect pass. Measure 360/390px layouts: RIR >=44px, numbers >=16px, no horizontal overflow, Complete reachable with 1,000-character exercise/280-character set notes, one shared exercise note across repeated cards but not repeated variant occurrences. Verify literal text safety, all history states, target-clearing swap, warm-up labels, and incomplete-round messaging. Oversized cards may lose the preview but must not overlap.
- [ ] **Step 5:** Commit with `git commit -m "feat: compose mobile workout Focus cards"`.

### Task 6: Add one grouped overview with all existing management actions

**Files:** Create `src/workout-overview.js`, `e2e/workout-overview.spec.js`; modify `src/workout-focus-view.js`, `style.css`.

**Interfaces:** `mountWorkoutOverview({port,onJump,onActivity,onClose}) -> {open(opener),update(snapshot,viewed),close(),destroy()}`. It is one native dialog: bottom-sheet styling at <=760px, centered at larger sizes, preserving the same live content/focus through resize. Jump rows identify `SetRef`; management uses the Task 2 command union. `onActivity(boolean)` suspends Focus motion/advancement while open, including nested picker/menu operations.

- [ ] **Step 1:** Add cases `groups straight warmup and working rows`, `frames pairs by round with leftovers`, `jump preserves a repeated variant occurrence`, `zero-set exercise remains manageable`, and `all compact editing commands remain reachable`. Assert:

```js
await expect(overview.getByRole('heading',{name:'Round 1',exact:true})).toBeVisible();
await overview.getByRole('button',{name:/Add set.*empty/i}).click();
// Snapshot: one real working set added to exercise empty; other exercises unchanged.
// Cancel removal -> no edit; remove paired member -> one surviving unpaired exercise.
```

- [ ] **Step 2:** Run `npx.cmd playwright test e2e/workout-overview.spec.js`; expect missing overview failures.
- [ ] **Step 3:** Implement keyed summaries and scope-named actions; reuse `src/dialog-motion.js`, `src/exercise-picker.js`, `src/confirm-dialog.js`, `src/reorder-menu.js`, `src/sortable.js`, and port commands. Reorder whole supersets via menu, keyboard, and drag using `move-block`; member rows cannot drop between pair members. Add set/warm-up limits are 20 combined; exercise count limit 40. Management picker hosts must be inside the visible dialog rather than a hidden compact card. Selecting a row closes then jumps instantly and focuses its context via `jump(ref,{focus:true})`; Escape/backdrop/Close without selection restores opener focus and the previous viewed set. Existing single-line/multiline note semantics remain available. Do not add another All sets or List view surface.
- [ ] **Step 4:** Run `npx.cmd playwright test e2e/workout-overview.spec.js e2e/workout-focus-view.spec.js`; expect passing jump, swap/add/remove, pair-preserving swap, unlink/reorder, cap, long-label, focus-restoration, and nested-dialog cases. Assert frame close/remove content is inert immediately, rapid reversal is safe, and the still-viewed set ID survives reorder. Test adding to an initially blank log and zero-set exercise.
- [ ] **Step 5:** Commit with `git commit -m "feat: add grouped workout overview and management"`.

### Task 7: Coordinate completion feedback and cancellable Auto-next

**Files:** Create `src/workout-focus-advance.js`, `test/workout-focus-advance.test.js`, `e2e/workout-focus-motion.spec.js`; modify `src/workout-focus-view.js`, `src/workout-logger-view.js`, `style.css`.

**Interfaces:** `createWorkoutAdvance({read,onAdvance,timers=globalThis,reduced=()=>false}) -> {completed({before,after,ref,viewed,autoNext}),cancel(),destroy()}`. `read() -> {log,viewed,autoNext,suspended}`; `onAdvance(ref|null)` is the only automatic jump callback. `completed` is called only for an accepted explicit toggle from not-done to done. The coordinator does not mutate logs. Focus also exposes `celebrate({before,after,ref})` to animate stable progress/marker nodes once per set key per attachment.

- [ ] **Step 1:** Use fake timers in node:test for `advances only the current explicit completion at 650ms`, `browsing and undo stay put`, `removal or suspension cancels a queued advance`, `late acknowledgements never schedule`, and `reduced motion is immediate`. Assert:

```js
coordinator.completed({before,after,ref,viewed:ref,autoNext:true});
timers.advance(649); assert.deepEqual(jumps,[]);
timers.advance(1); assert.deepEqual(jumps,[nextRef]);
// Repeat with a viewed ref different from before.current, Auto-next off, undo,
// a removed target, and a current log ID different from before.id: no jump.
```

- [ ] **Step 2:** Run `node --test test/workout-focus-advance.test.js`; expect absent coordinator failure. Add browser assertions that initial render/hydration does not add animation classes.
- [ ] **Step 3:** Implement the ID-guarded coordinator against Task 1 projection and subscribe only to the port's explicit accepted toggle metadata. Cancel on wheel/touch/drag/focus-in, notes/dialogs/menus, undo, preference changes, target-invalidating edits, resize, route/auth teardown. Resolve next ID against latest state when firing; a stale or changed viewed ref cancels instead of teleporting. For normal motion, animate fill 480ms/check 300ms/scale 480ms, then advance at 650ms; reduced motion has no smooth movement. Focus disables the old `guideFocus` path, while desktop keeps it. Automatic navigation focuses context, never an input. Keep progress nodes keyed, including reorder; hydration/cached history/status changes never celebrate.
- [ ] **Step 4:** Run `node --test test/workout-focus-advance.test.js test/workout-focus-model.test.js` and `npx.cmd playwright test e2e/workout-focus-motion.spec.js`; expect passing timer and real animation assertions. Override the config's default reduced motion with `test.use({reducedMotion:'no-preference'})` for actual motion checks, and separately exercise reduced motion. Test repeated undo/recheck, warm-up advancement without progress count, round completion with missing partner, burst taps, note opening at 600ms, and delayed Best/save after reorder/removal.
- [ ] **Step 5:** Commit with `git commit -m "feat: animate workout completion and coordinate Auto-next"`.

### Task 8: Enable Focus responsively inside the real shell

**Files:** Create `src/workout-focus-session.js`, `test/workout-focus-session.test.js`, `e2e/workout-focus-integration.spec.js`; modify `src/workout-logger-view.js`, `src/workout-focus-view.js`, `src/app.js`, `style.css`. Modify existing layout assumptions in `e2e/workout-set-row.spec.js`, `e2e/workout-logger.spec.js`, `e2e/workout-notes.spec.js`, `e2e/workout-warmups.spec.js`, `e2e/workout-supersets.spec.js`, and `e2e/workout-best.spec.js` only where active mobile behavior intentionally changes.

**Interfaces:** `createWorkoutFocusSession() -> {read(logId),patch(logId,patch),clear()}`. `read` returns a copy of `{viewed:null,autoNext:true,weightIncrement:2.5}` defaults; `autoNext`/increment are shared session preferences, viewed refs are per-log. Instantiate once in `src/app.js`; pass as `focusSession` to `mountWorkoutLogger`, clear from `showLogin` and successful logout. The logger retains the same public return methods, plus `showRecap` defined in Task 9.

- [ ] **Step 1:** Add node cases for copied session reads, per-log cursor, shared preferences, and auth clear; browser cases `mobile active uses Focus and desktop/finished use compact`, `breakpoint keeps composing textarea and invalid input`, and `shell exclusions and reservations are unchanged`. Pin:

```js
assert.deepEqual(session.read('new'),{viewed:null,autoNext:true,weightIncrement:2.5});
session.patch('one',{viewed:ref,autoNext:false});
assert.equal(session.read('two').autoNext,false);
session.clear(); assert.equal(session.read('one').viewed,null);
// At 760 -> 761 -> 760, exact input object/text/selection survives, as does an open IME note.
```

- [ ] **Step 2:** Run `node --test test/workout-focus-session.test.js` and `npx.cmd playwright test e2e/workout-focus-integration.spec.js`; expect no responsive integration/session export yet.
- [ ] **Step 3:** Mount Focus only for editable active mode at the mobile breakpoint, and keep the regular exercise/card/header nodes alive. On breakpoint changes transfer existing rows/notes under the relocation guard, suspend snapping until transfers/measurements finish, and restore the same focused node/caret without marking script focus as typing. Derive feed height from its actual top, toolbar, computed `--tab-bar-height`, safe-area reservation, and `visualViewport`; do not reclaim the typing-hidden bar reservation. Enable `scroll-snap-type:y mandatory`/`scroll-snap-stop:always` only when not typing/editing/dragging, keep oversized-card inner travel, and preserve stable viewed IDs through measurement. Wire overview, preference memory, current action, and cleanup. Give the app's mounted logger an idempotent disposer shared by `onAuthHidden` and `destroy`: detach the binding and dispose logger UI without releasing the controller's active sync merely because sign-in hid the view. Destroy observers/timers/capture and clear UI memory across auth changes. Do not mount another controller or change `workout-sync`.
- [ ] **Step 4:** Run the two new test files plus `npx.cmd playwright test e2e/workout-logger.spec.js e2e/workout-set-row.spec.js e2e/workout-notes.spec.js e2e/workout-warmups.spec.js e2e/workout-supersets.spec.js e2e/workout-best.spec.js e2e/mobile-library-navigation.spec.js`. Update active-mobile assertions to the intended Focus view; keep compact row geometry tests on desktop and on finished mobile logs rather than deleting their coverage. Assert History `aria-current`, no logger root-swipe navigation, no duplicate floating bar, truthful Retry/failure status, and no second mirror. Test a pending finished record remains compact/read-only, Auto-next off across route reentry, and state clear after auth change.
- [ ] **Step 5:** Commit with `git commit -m "feat: enable responsive workout Focus in the app shell"`.

### Task 9: Add a transient finish recap and a safe finished-autosave handoff

**Files:** Create `src/workout-recap.js`, `e2e/workout-recap.spec.js`; modify `src/workout-controller.js`, `src/workout-logger-view.js`, `src/app.js`, `test/workout-controller.test.js`, `e2e/workout-offline.spec.js`, `e2e/workout-history-edit.spec.js`, `style.css`.

**Interfaces:** Keep legacy `binding.onFinish()` behavior. Extend it to `binding.onFinish({stay:false}={}) -> Promise<{accepted:boolean,state?:FinishState}>`. `stay:true` reports the already validated/mirrored finished snapshot immediately and triggers flush without awaiting network completion or navigating. `FinishState={id,log,status,pending,record,blocked}`; `record` is null or the actual `{id,revision,log}` server acknowledgement, never a fabricated revision. Add optional attachment handler `setFinishState(state)`.

The logger calls its existing callback as `onFinish(log,{recap:boolean})`; the new flag is true only for the active mobile Focus's explicit Finish. Add `logger.showRecap({state,onDone,onView,onNote,onSaveStatusSlotChange})` and `logger.updateRecap(state)`; its active UI becomes inert and stops animation, but keeps attachment until route teardown. `mountWorkoutRecap(host,{state,onDone,onView,onNote}) -> {update(state),saveStatusSlot(),destroy()}` renders the actual post-pruning snapshot and uses existing `mountWorkoutNote` only when `!pending && !blocked && record`.

- [ ] **Step 1:** Extend controller tests with `stay finish returns before network settles`, `acknowledgement before onFinish still returns the same record`, `detached or signed-out recap is never published`, `conflict saved-active version cannot remain a success recap`, and `legacy finish still navigates`. Add e2e cases for every explicit finish/pruning path and recap Done/View/note editing. Pin with deferred save responses:

```js
binding.onChange(finished);
const result=await binding.onFinish({stay:true});
assert.equal(result.accepted,true); assert.equal(result.state.pending,true);
assert.equal(result.state.record,null); assert.deepEqual(navigations,[]);
// Resolve save: publish exact revision only after controller ownership is released.
// Calls after detach/signOut neither navigate nor activate finished autosave.
```

- [ ] **Step 2:** Run `node --test test/workout-controller.test.js` and `npx.cmd playwright test e2e/workout-recap.spec.js`; expect failures for the new handoff/state contract, while preserving existing controller tests.
- [ ] **Step 3:** Capture the accepted finish in the current attachment before `sync.change`, retain its actual acknowledgement in attachment-local state, and forward guarded pending/status/conflict changes. On clean finished acknowledgement, capture the returned record, release the controller's finished owner, then publish editable `FinishState`; never create two writers. Guard async flush/default navigation against obsolete attachment and auth session. Keep controller-level `finish()` and start-another-workout prompt destinations unchanged. After conflict resolution replaces local completion with an active log, exit recap and rehydrate the active view; a discarded/deleted record follows existing navigation.
- [ ] **Step 4:** In `src/app.js`, handle `{recap:true}` without the old immediate History navigation. Cache the latest `FinishState` for the mounted route so an acknowledgement arriving before `showRecap` is not lost. Once an acknowledged record is released by the controller, call existing `track(workoutRecord(record))` exactly once, detach the obsolete active binding, and route recap workout-note edits through its returned change callback and `setWorkoutNote`; do not call an unowned active binding or save via the view. Supply a guarded `mounted.syncSaved` callback for acknowledged recap document changes, preserving the focused note editor. Move the existing save-controls nodes into recap's slot at that handoff; pending recap keeps the controller's status/Retry and a read-only note. `showRecap` cancels active feed/elapsed timers, freezes duration from `finishedAt`, and hides active Finish/Discard controls. Done calls guarded `navigate('#/workouts')`; View calls guarded `navigate('#/workouts/'+id)` (same-hash navigation already remounts). Reentry/reload shows the regular finished record, not recap. Add a guard for responsive changes: after entering recap, keep it on the route until an explicit action; resizing does not replay it or revive active controls.
- [ ] **Step 5:** Run `node --test test/workout-controller.test.js test/workout-sync.test.js test/workout-edit.test.js` and `npx.cmd playwright test e2e/workout-recap.spec.js e2e/workout-offline.spec.js e2e/workout-history-edit.spec.js e2e/workout-start.spec.js e2e/workout-start-sheet.spec.js e2e/workout-home.spec.js`. Expect passing online/offline/401/409/canceled/no-working-set cases; pending History deduplication; conflict, Retry, and note autosave; a deferred response after route exit/logout; preserved start-other-workout destinations; and no replay on reload. Assert partial recap text reflects post-pruning records and has no large working-set KPI. Commit these files with `git commit -m "feat: add workout recap with guarded finished-save handoff"`.

### Task 10: Verify the complete experience and document actual evidence

**Files:** Create `docs/superpowers/verification/2026-11-08-mobile-workout-focus.md`; modify `docs/design-system/README.md`, `AGENTS.md`, and affected workout regression assertions identified by the full suite. Keep fixes inside the modules/tests that own each behavior.

**Interfaces:** No new runtime contracts. Verification distinguishes automated Chromium checks, real-device checks, and any release checks not performed. The design-system additions define only scoped Focus components/tokens and the chosen motion, input, note, and reduced-motion behavior.

- [ ] **Step 1:** Run `npm.cmd test`, then `npm.cmd run test:e2e`, then `npm.cmd run build`. Expected: all suites pass and `Built public assets.`. Read every failure before changing tests. Preserve compact desktop/finished, Home/start-sheet, offline, Best/Last time, note, catalog, and navigation coverage; do not hide failures with broad skips or selectors that match hidden duplicate controls.
- [ ] **Step 2:** Play populated flows at 360×740, 390×844, 760px, 761px, 1366×768, 1440×900, and 1920×1080; add 200% text, long/unbroken names, all note limits, cached/unavailable benchmarks, zero/40 exercises, 20 sets, the combined 40×20-set bound, unequal pairs, and touch/hybrid targets. Capture screenshots in ignored `.superpowers/sdd/2026-11-08-mobile-workout-focus/` and cite them in the evidence document. Check ordinary gestures and actual animation with normal motion, then reduced motion and keyboard/screen-reader semantics. Explicitly check the focus-preserving breakpoint case and render/teardown after authentication changes.
- [ ] **Step 3:** Verify on a real mobile browser: native numeric keyboard, tap/drag/diagonal/canceled gestures on both rulers and ticker, vertical scrolling through oversized notes, pinch zoom, one-swipe settlement, safe areas, typing-hidden tab bar, and returning controls not stealing a tap. Tune motion only from observed behavior and rerun affected tests. If no real device is available, record that gap plainly; do not label it verified by viewport emulation.
- [ ] **Step 4:** Update design-system guidance and add the feature's concise retained rules/reference paths to `AGENTS.md`. Record exact commands, results, device/browser evidence, behavior changes from the prototype (especially placeholders and read-only pending finishes), and unperformed preview/production checks. Run `git diff --check`; rerun affected tests/build if any implementation changed after Step 1. Do not deploy or run migrations.
- [ ] **Step 5:** Commit explicit documentation and any justified regression fixes with `git commit -m "docs: record workout Focus verification and retained rules"`. Request the selected execution workflow's final review before integration; use `finishing-a-development-branch` only when implementation and required checks actually pass.

## Coverage and self-review

Spec §§1–2 map to Tasks 1, 5, 7, and 8; §3 to Tasks 1, 3, and 5; §4 to Task 4; §5 to Tasks 2, 5, and 9; §6 to Task 7; §7 to Task 6; §8 to Task 9; §9 to Tasks 2, 7–9; §10 to Task 10 and each component's red/green checks. The five Review Focus classes each have named tests above. All new production exports and cross-task types are defined in Interfaces blocks; no step depends on prototype globals or a second logger/sync. Tasks 1–7 can be reviewed as fixture-tested deliverables before enabling Focus in Task 8. Task 9 changes finish behavior explicitly rather than depending on a save-status string.

Plan preparation included source/interface inspection and review against the approved spec; it did not run implementation tests or make product changes. Before execution, the user reviews this plan and chooses subagent-driven or native execution. For this plan, native execution is recommended because shared DOM ownership and the finished-save handoff cross tightly coupled logger/app/controller interfaces; a single implementer can preserve those interfaces with lower context overhead, followed by a whole-branch review.
