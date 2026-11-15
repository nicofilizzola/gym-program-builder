# Tracker Inputs and Benchmarks Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep unanswered RIR empty, select Best by the target minimum, and make exact ruler changes feel responsive with mild readout feedback.

**Architecture:** Correct Best and completion in their existing shared owners so Focus, desktop and finished records agree. Keep immediate canonical writes through `onAdjust` and the existing logger port; localize frame scheduling, reusable ticks and readout animation in `mountWorkoutRuler`, without changing its public API. Measure the actual pointer → canonical row → synchronous logger/render → ruler update path before and after the drawing change.

**Tech Stack:** Existing plain JavaScript ES modules, CSS, native Pointer Events, requestAnimationFrame, Web Animations API, Node 24 `node:test`, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-15-tracker-inputs-and-benchmarks-design.md`; integration map: `docs/superpowers/specs/2026-11-15-mobile-tracker-refinements-design.md`.

## Global Constraints

- This is plan 1: implement inputs/benchmarks → overview interactions → nested navigation → Focus rounds. Plans are documentation for later implementation; writing this plan does not implement or deploy the app.
- Reuse plain JavaScript, CSS, native controls, the existing action icons, popovers/dialogs and motion patterns. Add no dependency.
- Keep one logger, controller and workout sync owner. Focus borrows canonical controls; it never clones live rows or mounts another logger.
- Preserve workout-log versions, validation, mirror/queue formats, autosave, history storage, exports/imports, AI review and analytics. No migration, data backfill, new persistence or deployment is required.
- Preserve pointer and keyboard access, readable labels, 44px touch targets, focus, caret, composition, invalid drafts and reduced motion. Add no settings.
- Best eligibility changes only to `candidate.reps >= min`; use `Best (8+ reps)` for minimum 8, including equal-bound ranges, and `Best` without a range. Weight, reps, finish instant and descending log ID remain the ranking order; retain bodyweight handling.
- Keep `bestPerRep`, its one winner per exact rep count (at most 100 per variant), the 40-variant request bound, repository filtering, request ownership, cache and unavailable/loading states unchanged. Rep guidance remains inclusive min–max.
- Complete preserves recorded RIR, including `null` and zero. No placeholder RIR highlight. Keep stored 5/displayed `5+`, explicit select/clear, intentional working-set copying and legacy warm-up RIR retention; no new warm-up copies of RIR.
- Readout feedback: whole number, 120ms ease-out, opacity .75→1, increase +3px→0/decrease −3px→0, one retargetable animation per input. Values and accessible values are immediate and exact; no interpolation, queued effects or motion on unchanged limit presses.
- No feedback for typing, focus/caret, invalid text, placeholder restoration, mounting, hydration, acknowledgements, history refresh, completion fallback or responsive relocation. Typing/composition, reduced motion, resize, disabling and teardown cancel pending/running feedback to the settled value.
- Preserve pointer capture, vertical drift ownership, 8px slop, 32px tick spacing, all 0.25/1/2.5/5kg increments, off-grid values, clamping, suggestions, direct entry and keyboard support. Drag translation has no transition; release settling remains 150ms.
- Phone feedback/lag calibration remains `pending (user)`. Browser traces and emulation establish neither hardware performance nor deployed behavior.

## Review Focus

1. Historical high-rep winners, repeated occurrences and excluded current/warm-up/incomplete/cross-variant data must obey lower-bound qualification without changing candidate eligibility — Task 1 tests `lower bound includes above-max and equal-bound performances` and existing repository filters.
2. A blank RIR with historical or earlier-set suggestions must stay blank after repeated completion, save/reload and explicit copy, while zero and legacy warm-up values survive — Task 2 unit and browser matrices.
3. Fractional drags, direction reversal and increment/width/range changes must reuse ticks only while their window is identical, without delaying canonical writes — Task 3 controlled-frame assertions and populated-path measurements.
4. A fast reversal or typing/IME during feedback must keep the same exact input, caret and invalid draft with at most one effect — Task 4 animation sampling and draft tests.
5. A queued frame or running effect followed by resize, disable, reduced motion or removal must not paint or animate a relocated/detached input — Task 3 cancellation and Task 4 lifecycle matrix.

---

## Files and Existing Interfaces

| Files | Responsibility |
|---|---|
| `src/workout-best.js`, `src/workout-history-summary.js` | Lower-bound selection and shared Best copy. |
| `src/workout-edit.js`, `src/workout-set-row.js`, `style.css` | Preserve optional RIR and remove its placeholder presentation. |
| `src/workout-ruler.js` | Immediate adjustments, synchronous slider semantics, frame-coalesced visual paint, tick cache, readout feedback and cleanup. |
| `test/workout-best.test.js`, `test/workout-edit.test.js`, `test/workout-sets.test.js`, `test/workout-repository.test.js` | Shared selection, completion, formatting/placeholder and server eligibility regression checks. The latter two generally need no edits. |
| `e2e/workout-best.spec.js`, `e2e/workout-set-row.spec.js`, `e2e/workout-ruler.spec.js`, `e2e/workout-focus-view.spec.js` | Presenter parity, persisted RIR, ruler behavior and canonical-input integration. |
| `AGENTS.md`, `docs/design-system/README.md`, `docs/superpowers/verification/2026-11-15-tracker-inputs-and-benchmarks.md` | Update the implemented rules and record actual command/measurement evidence with each owning task. |

Read callers before editing: `server/workout-repository.js` imports only `bestPerRep`; the Best presenter is mounted by `src/workout-logger-view.js` and `src/workout-focus-view.js`. The logger's `toggle()` calls `toggleSetDone(...,setPlaceholder(...))`; `inheritedValues()` intentionally copies recorded RIR for working sets and returns null for new warm-ups. Do not remove RIR from `setPlaceholder`: it remains historical data and existing intentional-copy inputs.

Preserve `mountWorkoutRuler(host,{input,kind,caption=null,onAdjust,onInteraction=()=>{}}) → {update(next),destroy()}`. Its `update` patch remains `{value,placeholder,increment,range,enabled}`; `onAdjust(number)` still invokes `setRowBindings(row).applyValue(kind,number)` synchronously. `src/workout-focus-view.js` needs no new feedback parameter or method. `e2e/workout-ruler.spec.js` already mounts this exact binding and refreshes synchronously in `onPatch`; `mountFocusFixture` in `e2e/workout-focus-helper.js` mounts the real logger/port/Focus. Reuse both fixtures.

### Task 1: Apply the shared Best lower bound and label

**Files:**
- Modify: `src/workout-best.js:selectBestPerformance`, `src/workout-history-summary.js:mountWorkoutHistory.update`.
- Test: `test/workout-best.test.js`, `e2e/workout-best.spec.js`.
- Read/regression: `server/workout-repository.js:bestPerformance`, `test/workout-repository.test.js`.
- Documentation: `AGENTS.md`, `docs/design-system/README.md`; create `docs/superpowers/verification/2026-11-15-tracker-inputs-and-benchmarks.md`.

**Interfaces:**
- Consumes: validated candidates `{weightKg:number,reps:number,finishedAt:string,logId:string}` and `repRange:{min:number,max:number}|null`.
- Produces: unchanged `selectBestPerformance(candidates,repRange=null) → candidate|null`; unchanged `mountWorkoutHistory(host,state) → {update,destroy}`. Only qualification and the ranged title change.

- [ ] **Step 1: Write the failing qualification and presenter assertions.** Extend the existing `c()` unit fixture; retain its tie, BW, immutable reduction and occurrence tests:

```js
test('lower bound includes above-max and equal-bound performances',()=>{
 const cases=[c(100,7),c(100,8),c(100,12),c(100,15)];
 for(const [i,eligible] of [[0,false],[1,true],[2,true],[3,true]])
  assert.equal(selectBestPerformance([cases[i]],{min:8,max:12}),eligible?cases[i]:null);
 assert.deepEqual(selectBestPerformance([c(100,9)],{min:8,max:8}),c(100,9));
 assert.deepEqual(selectBestPerformance([c(100,8),c(95,15)],{min:8,max:12}),c(100,8));
 assert.deepEqual(selectBestPerformance([c(100,8),c(100,15)],{min:8,max:12}),c(100,15));
 assert.deepEqual(selectBestPerformance([c(0,15)],{min:8,max:12}),c(0,15));
 assert.deepEqual(selectBestPerformance([c(110,1),c(100,100)]),c(110,1));
});
```

Name the new browser test `lower-bound presenter parity`, parameterized over active 390×844, active 1366×768 and finished 1366×768. Use existing `save()` with historical `100×8`, `100×15`, `95×20`, `110×5` and its excluded warm-up. Save repeated `v1` occurrences with targets 8–12, 8–8, 16–20 and null; keep current-log `150×10` excluded. Scope `best` to `.workout-focus .log-best` on active mobile, `.log-exercise .log-best` otherwise. Use one working set per mobile occurrence so there is one history group per exercise.

```js
await expect(best.nth(0)).toHaveText('Best (8+ reps) · 100 kg × 15 · 1 Nov 2026');
await expect(best.nth(1)).toHaveText('Best (8+ reps) · 100 kg × 15 · 1 Nov 2026');
await expect(best.nth(2)).toHaveText('Best (16+ reps) · 95 kg × 20 · 1 Nov 2026');
await expect(best.nth(3)).toHaveText('Best · 110 kg × 5 · 1 Nov 2026');
await expect(best.nth(0).locator('time')).toHaveAttribute('datetime','2026-11-01T11:00:00Z');
```

Update old ranged-copy expectations, including `Best (20+ reps) · No qualifying performance`, in the existing cache/empty test; its earlier fixture without a 15-rep set keeps its original winner. Retain BW, loading/error/offline, deletion refresh and delayed-request tests. The existing exhaustive original-vs-`bestPerRep` comparison must still pass for every min/max and leave candidates unchanged; do not weaken it.

- [ ] **Step 2: Run the new tests and observe the intended failures.**

Run: `node --test test/workout-best.test.js` and `npx playwright test e2e/workout-best.spec.js --grep "lower-bound presenter parity|Best renders"`.
Expected: above-max singleton returns null and browser copy/winner assertions fail against the old range filter/title. Existing unrelated history states should not be the reason for failure.

- [ ] **Step 3: Implement only the shared predicate and title.** In `selectBestPerformance(candidates,repRange=null)` reject only `repRange && candidate.reps < repRange.min`. In `mountWorkoutHistory.update(state)` use `Best (${range.min}+ reps)` for a range. Preserve the comparator, `bestPerRep`, date/weight formatting and all state branches. Add the new implemented Best rule to `AGENTS.md`, replace the older inclusive-upper-bound Best rule/copy in `docs/design-system/README.md`, and start evidence with the spec link and pending phone/deployment status.

- [ ] **Step 4: Verify the deliverable and record actual output.**

Run: `node --test test/workout-best.test.js test/workout-repository.test.js` and `npx playwright test e2e/workout-best.spec.js`.
Expected: PASS, including the repository's current-log, warm-up, incomplete, exact-variant, legacy, repeated-occurrence and 41-ID rejection checks. Record results in the evidence file; no server/API edits are required.

- [ ] **Step 5: Commit.**

```bash
git add src/workout-best.js src/workout-history-summary.js test/workout-best.test.js e2e/workout-best.spec.js AGENTS.md docs/design-system/README.md docs/superpowers/verification/2026-11-15-tracker-inputs-and-benchmarks.md
git commit -m "fix: qualify best performance by minimum reps"
```

### Task 2: Preserve optional RIR through completion and presentation

**Files:**
- Modify: `src/workout-edit.js:toggleSetDone`, `src/workout-set-row.js:render`, `style.css:.log-rir-option.is-placeholder`.
- Test: `test/workout-edit.test.js`, `e2e/workout-set-row.spec.js`; regression: `test/workout-sets.test.js`, `e2e/workout-focus-view.spec.js`.
- Documentation: `AGENTS.md`, `docs/design-system/README.md`, the shared evidence file.

**Interfaces:**
- Consumes: canonical current set and `setPlaceholder(exercise,index,lastSets)`; the placeholder's RIR remains available as historical data.
- Produces: unchanged `toggleSetDone(log,exerciseId,setId,placeholder) → {log}|{error:'Enter reps'}`. `createSetRow`/`updateSetRow` interfaces and pressed-state equality remain unchanged; remove only placeholder highlighting.

- [ ] **Step 1: Write the failing completion matrix and replace the two ghost-highlight browser expectations.** Change existing assertions expecting inferred `rir:2` on a blank working set to `rir:null`, including the warm-up test's working-set control case. Extend the existing `makeLog`, `set`, `exercise` fixtures:

```js
test('completion preserves optional RIR through repeat toggles and statuses',()=>{
 for(const status of ['active','finished'])for(const rir of [null,0,1,2,3,4,5]){
  let log={...makeLog(),status,exercises:[exercise('e1',[set('s',{rir})])]};
  for(let cycle=0;cycle<2;cycle++){
   log=toggleSetDone(log,'e1','s',{weightKg:80,reps:8,rir:4}).log;
   assert.deepEqual(log.exercises[0].sets[0],set('s',{weightKg:80,reps:8,rir,done:true}));
   log=toggleSetDone(log,'e1','s',{rir:2}).log;
   assert.equal(log.exercises[0].sets[0].rir,rir);
   assert.equal(log.exercises[0].sets[0].done,false);
  }
 }
});
```

This tests the pure edit function for both statuses; it does not claim an unchecked finished log passes persistence validation. Keep existing `Enter reps`, typed-weight precedence, immutability, missing-set and legacy warm-up `rir:3` assertions. Existing `test/workout-sets.test.js` still proves history/previous placeholders and `5+` formatting without changing those helpers.

Replace `last time RIR 5 suggests 5+` with `last time RIR 5 remains historical without a selected choice`, and the dashed-border test with `historical RIR never highlights a blank choice`. Reuse their linked-template/history creation. Name null-completion coverage `optional RIR survives completion and reload`, parameterized over mobile Focus and desktop active routes; turn Auto-next off on mobile before completing so the row stays viewed. With historical RIR 2 or 5, assert:

```js
await expect(history.locator('.log-last-time').first()).toContainText('@5+'); // history with RIR 5
await expect(rir.locator('[aria-pressed="true"]')).toHaveCount(0);
await expect(rir.locator('.is-placeholder')).toHaveCount(0);
await done.click();
await expect.poll(async()=>{
 const {record}=await (await page.request.get('/api/workouts/active')).json();
 return record.log.exercises[0].sets[0].rir;
}).toBe(null);
await page.reload();
await expect(rir.locator('[aria-pressed="true"]')).toHaveCount(0);
await rir.locator('[data-rir="0"]').click();
await expect(rir.locator('[data-rir="0"]')).toHaveAttribute('aria-pressed','true');
await rir.locator('[data-rir="0"]').click();
await expect(rir.locator('[aria-pressed="true"]')).toHaveCount(0);
```

Define `card` as the first `.focus-card[data-kind="working"]` on mobile and first `.log-exercise .log-set` on desktop; `rir=card.locator('.log-rir')`, `done=card.locator('.log-done')`, and `history` as the owning `.focus-group`/`.log-exercise`. After clearing zero, complete the next blank set with previous-set kg/reps suggestions; assert its API RIR stays null, then reload. Keep the touch border and sixth-option persistence tests.

For editable finished UI, reuse `setupFinished`, not hidden `.log-done` clicks: assert blank RIR has no highlight; Add set preserves null despite historical RIR; explicitly set zero, Add set again and assert the intentional new working-set copy has zero. Add warm-up from a legacy warm-up with RIR 3 and assert the new warm-up has null, the old value remains 3, and neither exposes RIR controls. Read the saved record to prove these values survive acknowledgement/reload. Do not add a finished-record completion affordance.

- [ ] **Step 2: Run the regression to establish the failures.**

Run: `node --test test/workout-edit.test.js` and `npx playwright test e2e/workout-set-row.spec.js --grep "historical|optional RIR"`.
Expected: blank working-set completion currently yields suggested RIR; historical RIR currently adds `.is-placeholder`.

- [ ] **Step 3: Implement the shared correction.** In `toggleSetDone`, keep `rir:current.rir` and existing nullish kg/reps fallback/required-reps refusal. Update its comment to say only kg/reps are filled. Remove the placeholder class assignment in `createSetRow.render` and the now-unused `.log-rir-option.is-placeholder` CSS rule after confirming its callers with `rg`. Keep strict equality for pressed options and click-to-clear; retain the existing selected/hover/focus styles. Leave `inheritedValues`, formatting and warm-up copy rules intact. Update implemented RIR rules and evidence in the three documentation files.

- [ ] **Step 4: Verify and record the result.**

Run: `node --test test/workout-edit.test.js test/workout-sets.test.js` and `npx playwright test e2e/workout-set-row.spec.js e2e/workout-focus-view.spec.js`.
Expected: PASS with null persisted after completion, explicit zero/5 retained, select/clear working and intentional copies unchanged. Record actual results and keep the phone touch-border confirmation `pending (user)`.

- [ ] **Step 5: Commit.**

```bash
git add src/workout-edit.js src/workout-set-row.js style.css test/workout-edit.test.js e2e/workout-set-row.spec.js AGENTS.md docs/design-system/README.md docs/superpowers/verification/2026-11-15-tracker-inputs-and-benchmarks.md
git commit -m "fix: keep unanswered workout RIR empty"
```

### Task 3: Measure and coalesce actual ruler painting

**Files:**
- Modify: `src/workout-ruler.js:draw/syncPosition/update/destroy` and visual scheduling at pointer/wheel/key callers.
- Test: `e2e/workout-ruler.spec.js`, `e2e/workout-focus-view.spec.js`.
- Reuse: `e2e/workout-focus-helper.js:mountFocusFixture`, `test/fixtures/workout-focus.js:focusFixture` without changing their production interfaces.
- Documentation: `AGENTS.md`, `docs/design-system/README.md`, the shared evidence file.

**Interfaces:**
- Consumes/produces: the unchanged `mountWorkoutRuler` API above; `onAdjust` and slider ARIA updates remain synchronous. Visual work alone runs on the next frame.
- Internal cache identity: visible `from/to` indices, increment, width, and target min/max (values, not range-object identity). The kind's min/max are fixed. The offset/transform is independent of cached tick nodes.
- Test-only fixture helpers in `e2e/workout-ruler.spec.js`: `holdFrames()` installs a controllable rAF/cancel queue after initial rendering; `flushFrame()` drains one queued frame; `restoreFrames()` restores globals in `finally`. `observeRulerWork()` installs probes for weight-track style mutations, its `replaceChildren` and root `clientWidth` reads; `readRulerWork()` drains observer records and returns a counter snapshot `{styleMutations,rebuilds,widthReads}`. Keep probes out of product code and restore them after each sample.

- [ ] **Step 1: Add tests `paint coalesces without delaying canonical writes` and `tick window reuse invalidates on geometry and targets`; collect a baseline before optimizing.** Use existing `mount(page)`, which routes pointer writes through `applyValue` and synchronous row/widget refresh. After initial ResizeObserver/frame settlement, type `80`, hold frames and reset counters. Dispatch a press at x=100 then moves to x=75, 76, 77, 78 and 79 in one browser evaluation (y unchanged). Take `workBeforeFrame=await readRulerWork()` before flushing and `workAfterFrame=await readRulerWork()` after; assert:

```js
expect(await page.evaluate(()=>value.weightKg)).toBe(82.5);
expect(await page.evaluate(()=>patches.at(-1))).toEqual({weightKg:82.5});
await expect(slider).toHaveAttribute('aria-valuenow','82.5');
expect(workBeforeFrame.styleMutations).toBe(0);
expect(workBeforeFrame.rebuilds).toBe(0);
await flushFrame();
expect(workAfterFrame.styleMutations).toBeLessThanOrEqual(3); // width, background origin, transform
expect(workAfterFrame.rebuilds).toBeLessThanOrEqual(1);
```

Then save the actual first tick node, move x=78→77→76 inside that same fractional tick window and flush once: assert that node is still identical, `rebuilds===0`, and `widthReads===0` since geometry was not invalidated. Repeat the same `widgets.weight.update(...)` twice without state/geometry changes: zero style mutations/rebuilds. Change increment to 5, width from 300px to 280px, and reps range from 8–10 to 10–12 in separate flushes; each must render the correct labels/target dimensions and refresh the cached window. Assert the reps target width remains `(max-min+1)*32`, not a widened Best range.

Cancel pending paint with `update({enabled:false})` and `destroy()` in separate cases, flush, and assert zero later mutations and no extra canonical patches. Re-enable a disabled widget and assert labels/ARIA correspond to the latest value and current width. Retain all existing pointer, limits, slop, off-grid, vertical-drift, wheel/key and direct-entry tests.

For measurement, add `populated ruler path records responsive writes and paint work` to `e2e/workout-focus-view.spec.js`, using `mountFocusFixture`. Build six exercises × four working sets locally in that test from the first `focusFixture()` exercise with unique IDs (no fixture-wide change); view the first set. Drive its real ruler through slow drags, 120 rapid pointer moves, and reversals while held, including vertical drift. Record synchronous dispatch duration with `performance.now()`, canonical value at each selected-step change, frame count, track style mutations and tick rebuild count. Attach JSON via `testInfo.attach('ruler-work',{body:JSON.stringify(samples),contentType:'application/json'})`; include the final input value, `port.read().log` value and `saved.at(-1)` value and assert they agree. Record before/after durations and counts under the same browser/workload; do not assert a hardware millisecond budget or claim a measured phone diagnosis.

- [ ] **Step 2: Run the new checks and capture baseline evidence.**

Run: `npx playwright test e2e/workout-ruler.spec.js --grep "paint|tick window" --trace on` and `npx playwright test e2e/workout-focus-view.spec.js --grep "populated ruler path" --trace on`.
Expected: the old ruler mutates/rebuilds during the held frame, violating the structural bound. The measurement run reports the actual synchronous logger/render path; store commands, browser/viewport, workload, counts and duration summary in evidence before editing. A noisy timing sample is evidence to repeat consistently, not proof of phone lag.

- [ ] **Step 3: Make the smallest local painting change.** Split synchronous semantic state (ARIA, suggestion/limit states) from visual track painting. Keep `adjust`/`onAdjust` synchronous. Route every visual request from `syncPosition`, pointermove, wheel, resize and update through one pending rAF per ruler; do not schedule a second identical draw when the synchronous callback re-enters `update`.

Cache width until ResizeObserver invalidates geometry; obtain the current width once when needed in the paint pass. Rebuild tick/target nodes only when the cache identity changes; update fractional translation without replacing labels. Skip identical track-style assignments. Resize, enable-after-hide, increment and target changes invalidate the appropriate cache. Disable/destroy cancel queued rAF, invalidate the cache and prevent stale writes, preserving existing observer/event/timer cleanup. Keep live pointer offset separate from canonical rounded values and retain `.is-settling`/150ms release CSS unchanged. No debounce, deferred data writes, inertia, new stepping or surrounding Focus refactor.

- [ ] **Step 4: Run regressions and repeat the same measured workload.**

Run: `npx playwright test e2e/workout-ruler.spec.js e2e/workout-focus-view.spec.js --trace on`.
Expected: PASS; canonical writes/ARIA precede the controlled frame, at most one paint occurs per frame, stable-window nodes survive and geometry changes invalidate them. Compare populated before/after JSON and traces; report measured differences honestly without a fabricated performance percentage. Update ruler rules/evidence, retaining physical-phone fluidity as `pending (user)`.

- [ ] **Step 5: Commit.**

```bash
git add src/workout-ruler.js e2e/workout-ruler.spec.js e2e/workout-focus-view.spec.js AGENTS.md docs/design-system/README.md docs/superpowers/verification/2026-11-15-tracker-inputs-and-benchmarks.md
git commit -m "perf: coalesce workout ruler painting and reuse ticks"
```

### Task 4: Add exact, retargetable ruler readout feedback

**Files:**
- Modify: `src/workout-ruler.js:adjust`, frame painting and lifecycle cleanup. No new public method or Focus callback.
- Test: `e2e/workout-ruler.spec.js`, `e2e/workout-focus-view.spec.js`.
- Documentation: `AGENTS.md`, `docs/design-system/README.md`, the shared evidence file.

**Interfaces:**
- Consumes: canonical `input`, enabled state, the accepted ruler-originated adjustment and Task 3's visual frame scheduler.
- Produces: one private Web Animation owned by that ruler/input. Captions, units, track, accessible values and the logger API do not animate or change shape.

- [ ] **Step 1: Write the failing feedback assertions, prefixing new test titles with `readout:`.** Use `page.emulateMedia({reducedMotion:'no-preference'})` (the config defaults to reduced motion). Define browser-side `readoutAnimations(el)` as `el.getAnimations().filter(a=>a.effect.getKeyframes().some(f=>Object.hasOwn(f,'opacity')&&Object.hasOwn(f,'transform')))` to exclude ordinary focus/border transitions. Seed `24.25`, nudge right at 2.5kg and inspect after the scheduled paint. Pause the effect for deterministic samples:

```js
await expect(weight).toHaveValue('26.75');
expect(await page.evaluate(()=>value.weightKg)).toBe(26.75);
const sampled=await weight.evaluate(el=>{
 const [a]=readoutAnimations(el);a.pause();a.currentTime=0;
 const f=a.effect.getKeyframes(),t=a.effect.getTiming();
 return {count:readoutAnimations(el).length,fromOpacity:+f[0].opacity,toOpacity:+f.at(-1).opacity,
  fromY:new DOMMatrixReadOnly(f[0].transform).m42,toY:new DOMMatrixReadOnly(f.at(-1).transform).m42,
  duration:t.duration,easing:t.easing,same:el===window.inputs.weight};
});
expect(sampled).toEqual({count:1,fromOpacity:.75,toOpacity:1,fromY:3,toY:0,duration:120,easing:'ease-out',same:true});
```

Add the decrease case with `fromY:-3`; assert final input text is exactly the authoritative decimal/reps immediately, with no interpolated value assignments. At 60ms in a paused increase animation, sample computed opacity/transform, reverse via the ruler, flush one frame and pause the replacement at zero: it starts from those sampled values (tolerance .01 opacity/.1px), settles at opacity 1/translateY(0), and the prior animation is idle. Burst 30 alternating adjustments with one flush per frame and assert at most one animation per input; no queue remains after its final 120ms. While held, the track has no transform transition; after release its existing transition duration remains .15s.

Cover drag, tap/nudge, horizontal wheel and ArrowLeft/Right/Home/End through existing routes; unchanged clamps at 0/999.75kg and 1/100 reps create no animation. All four weight increments and typed comma decimals retain their exact existing semantics. The caption/unit must have zero own animations and stable bounding boxes.

Add a parameterized cancellation/no-start matrix with concrete assertions:

```js
await expect(weight).toHaveValue(expectedText);
expect(await weight.evaluate(el=>el===window.inputs.weight)).toBe(true);
expect(await weight.evaluate(el=>readoutAnimations(el).length)).toBe(0);
expect(await weight.evaluate(el=>[getComputedStyle(el).opacity,getComputedStyle(el).transform])).toEqual(['1','none']);
```

Use `expectedText='24.25'` after direct input, focus/selection, initial mount, acknowledgement or range-only refresh; use `''` after restoring a null value/placeholder. For cancellation cases begin queued/running feedback at accepted value 26.75, then test input, `compositionstart`, resize, reduced-motion change, `update({enabled:false})` and `destroy()`; non-typing cases retain `'26.75'`. During composition use raw `'82,'` and invalid `'82.3'` as expected text, select 1–3 and refresh without changing authority: input/text/selection/`aria-invalid` survive. Finish with `'82,25'` and assert canonical 82.25 without feedback.

Extend the real Focus fixture test `set cards reuse canonical inputs and restore them to compact layout`: begin a ruler effect, type invalid `82.3`, set selection 1–3, dispatch compositionstart, disable/re-enable Focus and simulate a save/history refresh via the existing logger setters. Assert `originalWeight` identity, draft, focus and selection remain, with zero readout animations. End composition, then exercise removal/destroy and assert no stale input animation or scheduled paint. In a separate real Focus completion test leave kg/reps empty with suggestions, complete the set and assert the filled exact values produce zero input animations. Set Auto-next off to isolate readout behavior.

- [ ] **Step 2: Run the new tests and observe missing feedback.**

Run: `npx playwright test e2e/workout-ruler.spec.js --grep "readout"` and `npx playwright test e2e/workout-focus-view.spec.js --grep "readout|canonical inputs"`.
Expected: effect-existence/keyframe assertions fail because the old input has no readout animation; draft/lifecycle checks must not fail due to an unrelated selector or fixture problem.

- [ ] **Step 3: Implement the private ruler effect over immediate accepted writes.** In `adjust(n)`, capture the previous shown numeric value, run the unchanged synchronous `onAdjust(next)`, and request feedback only for an actual changed, accepted canonical value. Determine increase/decrease from the displayed numeric delta; an unchanged displayed value/limit has no motion. Use Task 3's frame to combine rapid visual requests without delaying the input/log write.

Use `input.animate` on opacity and transform only. For an idle effect start at .75 and signed 3px; for an interrupted effect read its current computed transform/opacity once in that paint, cancel it, and animate from that visual state to 1/translateY(0) over 120ms ease-out. Keep one animation reference; clear it on completion without allowing an older completion callback to clear a replacement. Do not use fill-forwards or a permanent inline transform/opacity. No number interpolation, clone/overlay input or wrapper is needed.

Typing, compositionstart and focus/selection entry cancel pending and running feedback; while composing do not start it. Disable, destroy, ResizeObserver geometry changes and a live reduced-motion media-query change cancel it and settle immediately. Remove the media listener with the existing event lifecycle and cancel any shared pending frame on teardown. Ordinary `update()` calls never start feedback; they may leave an accepted ruler effect running through its synchronous acknowledgement, but an unrelated authoritative value replacement cancels stale feedback. Preserve all canonical row, port and Focus APIs.

Update `AGENTS.md`/design-system rules to supersede only the earlier Best upper-bound/RIR placeholder/no-ruler-feedback rules, document exact animation/painting values and link the evidence. Mark implemented/local verification separately from pending phone calibration and deployment. Repeat Task 3's measured fast/reversal workload with feedback enabled and attach its results to catch work reintroduced by animation sampling.

- [ ] **Step 4: Verify the full deliverable and integration boundary.**

Run: `npm test`, `npm run build`, and `npx playwright test e2e/workout-ruler.spec.js e2e/workout-best.spec.js e2e/workout-set-row.spec.js e2e/workout-focus-view.spec.js e2e/workout-focus-fit.spec.js`.
Expected: PASS; accurate readouts and accessibility throughout, at most one effect, exact input/draft identity, stable tick reuse/paint bounds and existing Focus fit preserved. Record actual command outputs and the before/after/feedback-enabled work measurements in the evidence file. Note phone slow/fast/reversal feel and physical keyboard/viewport calibration `pending (user)`; do not turn emulation into a device claim. Later Focus execution must rerun these integrated tests after consuming the overview and navigation changes.

- [ ] **Step 5: Commit.**

```bash
git add src/workout-ruler.js e2e/workout-ruler.spec.js e2e/workout-focus-view.spec.js AGENTS.md docs/design-system/README.md docs/superpowers/verification/2026-11-15-tracker-inputs-and-benchmarks.md
git commit -m "feat: soften exact workout ruler readout changes"
```

## Plan Self-Review

Spec coverage maps to Tasks 1 (qualification, copy, unchanged reduction/ranking/filtering), 2 (optional RIR and intentional copies), 3 (measured immediate-write/paint work and reusable windows), and 4 (feedback, interruption, exactness and cleanup). Each task has a fail/implement/pass/commit cycle, owns its documentation/evidence, and preserves the existing caller signatures. The five Review Focus items have explicit owning tests. No app changes or future test results are claimed by this plan; physical-phone calibration and deployment remain pending.
