# Focus Rounds and Presentation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Present each mobile superset working round as one page with two selectable exact sets, order-independent completion and stable, accessible movement, while removing peeks and simplifying Focus controls.

**Architecture:** Keep `projectWorkout` and the logger port as the flat execution/write contracts; derive round pages and a set-key membership map beside them. The feed owns canonical row placement, selected refs and vertical travel; a small pair presenter owns selectors and coordinated visual motion. Extend the existing advance coordinator and measured fit model rather than creating parallel logging, navigation or scheduling systems.

**Tech Stack:** Node.js 24.x, plain JavaScript/CSS, native controls/popovers/dialogs, `node:test`, Playwright; existing dependencies only.

**Spec:** `docs/superpowers/specs/2026-11-15-focus-rounds-and-presentation-design.md` (approved in conversation). Also read the 2026-11-15 mobile-tracker design map, inputs/benchmarks, overview-interactions and nested-navigation specs, plus `AGENTS.md` and `docs/design-system/README.md`.

## Global Constraints

- Presentation applies to editable active mobile Focus at ≤760px; desktop and finished records retain the regular tracker.
- Every address remains `{exerciseId,setId}`; preserve `jump(ref,{animate,focus})`, `visibleRef()`, flat `projectWorkout` items and individual working-set progress segments.
- Keep one logger, controller and workout sync owner; canonical row/input/note/RIR/done nodes stay mounted exactly once, including hidden partners. Preserve focus, caret, composition and invalid drafts.
- No migration, new dependency, persistence, log fields, placeholder sets, API, mirror/queue/export/import/history/AI/analytics changes. Last time/Best stay keyed by exact variant, notes retain their scopes, and Finish/recap ownership remains unchanged.
- Auto-next remains auth-scoped session memory, default true and shared across attachments. Only explicit accepted completion can move or celebrate; completing never fills RIR.
- Partner content and the 3px underline move for 200ms with `cubic-bezier(.22,1,.36,1)`; content enters ±12px and opacity 0→1. Surface/text colors use 180ms ease-out; new 20px checks fade/scale .65→1 over 160ms without bounce. Reduced motion applies final states instantly.
- Complete-round Auto-next waits 650ms, then uses existing smooth travel; arrival is `scrollend` or 150ms without scroll events. Reduced motion removes the artificial delay and jumps instantly.
- Remove every Focus next-set/next-exercise peek and its reservation/calculation. Preserve straight group pinning, `--focus-gap`, container density tiers and reachable sticky Complete; measured refits add no animation.
- Use the existing single orange accent and inline action icons. Touch targets remain ≥44px; long names wrap without losing accessible names.
- Footer base row is 50px, with 3px block padding around a 44px overview button, an 8px gap and separate safe-area clearance; enlarged text may grow it.
- Implementation evidence must distinguish browser results from physical-phone, preview and production verification; those latter checks remain pending until actually performed.

## Review Focus

1. A2-first completion after browsing past earlier holes must finish only real members and advance forward, preserving earlier work — Task 3 unit/browser order-and-holes matrix.
2. A composing field, invalid numeric draft or pending blur trim must survive a requested switch, acknowledgement and breakpoint without a hidden focused input — Task 4 composition/draft tests.
3. Unequal/zero member counts and a removed/unlinked partner must retain unique canonical rows, truthful checks and an existing exact-ref fallback — Tasks 1 and 2 membership/identity tests.
4. A taller inactive partner, 200% text or keyboard shrink must not move the resting snap position or hide controls behind a stale pin — Task 5 measured geometry tests.
5. A queued advance/animation must not outlive a menu, conflict, preference toggle, target removal, auth/view teardown or changed reduced-motion preference — Tasks 3, 4 and 6 cancellation tests.

---

## Integration order and file ownership

Implement the sibling plans in this order: inputs/benchmarks → overview interactions → nested navigation → this plan. Their independent work can land separately; before this plan starts, reread overlapping source/tests and retain their changes. No implementation is authorized by writing this document.

| Files | Responsibility here |
|---|---|
| `src/workout-focus-model.js`, `test/workout-focus-model.test.js` | Derived pages/membership, stable keys, existing-set completion and milestones; preserve flat projection/progress |
| `src/workout-focus-pair.js` (new) | Named native selector buttons, selected/completed presentation and coordinated cancellable motion |
| `src/workout-focus-view.js`, `e2e/workout-focus-view.spec.js` | Canonical pane placement, exact-ref resolution, selection memory, travel and restoration |
| `src/workout-focus-advance.js`, `test/workout-focus-advance.test.js` | Existing single explicit-completion coordinator, partner switching and forward-only round advance |
| `src/workout-focus-fit.js`, `test/workout-focus-fit.test.js`, `e2e/workout-focus-fit.spec.js` | Remove peek model; measured regular/pair/oversized fit |
| `src/workout-logger-view.js`, `src/reorder-menu.js`, `style.css` | Checkable Auto-next action, footer and pair presentation styles |
| `test/fixtures/workout-focus.js`, `e2e/workout-focus-helper.js` | Preserve existing fixture/export and mounting API; add only fixture data needed by tests |
| Existing Focus motion/progress/integration, overview, offline and recap suites | Behavioral integration and preservation of independent data/sync assertions |
| `AGENTS.md`, `docs/design-system/README.md`, new verification document | Record implemented contracts and actual evidence at implementation time |

Navigation owns `measureFocus()`'s effective tab/safe-area inputs and its mounted logger `refreshGeometry()` connection, plus old tests that expect nested tabs. Its measurement reads actual rendered nav height only when route-visible, otherwise zero; never `parseFloat` the raw custom property containing `calc()`/`env()`. Consume those changes; do not create another route/height classifier. This plan owns the growing footer and new round fitting. Overview keeps `onJump(ref)` and stored-order set chips; its menu additions are `toggle(button,choices,{initialIndex}={})` and CSS scoped by dialog ancestry. This plan adds a backwards-compatible checkbox choice, preserving its button choices and initial-focus behavior. Inputs/benchmarks owns ruler readout feedback, optional-RIR completion and shared Best corrections; retain the existing `mountWorkoutRuler` API and `onAdjust` path when adding partner motion.

### Task 1: Derive exact-set pages and truthful round completion

**Files:** Modify `src/workout-focus-model.js`, `test/workout-focus-model.test.js`; use `test/fixtures/workout-focus.js` unchanged unless a small reusable fixture addition is needed.

**Interfaces:**
- Preserve `projectWorkout(log) -> {items,workingKeys,doneKeys,current}`, `setKey(ref)`, `focusFallback(previousItems,items,viewed)` and `progressClusters(items)`.
- Add `focusPages(log,items,previous=[]) -> {pages,pageByKey}`. `pageByKey` is `Map<setKey,page>` containing each real item once. A page is `{key,kind:'set'|'round',keys,pairId,round,members}`; ordinary pages have one key and no round, and round members are ordered descriptors `{exerciseId,member,ref,key}` for both exercise identities, with `ref:null,key:null` for an absent set. `pairId` is the first exercise ID; retain the projected A1/A2 letters. Allocate identity in two passes: in new execution order, match the first unused previous page sharing a surviving set key and reserve its inherited key; then assign unmatched pages their first real set key if unreserved, otherwise that key plus `#1`, `#2`, etc., taking the smallest unreserved suffix. Reserve each assignment immediately. Matching also rejects an already reserved key, so every output key is unique even after split/reorder; no random IDs.
- Add `roundComplete(page,doneKeys) -> boolean`: nonempty real `page.keys` all done. Extend existing `completionMilestone(before,after,ref)` to use real working sets, including a one-member round/pair with one zero-working-set member.

- [ ] **Step 1: Add failing model assertions.** Use the existing fixture (`straight: sw/s1/s2`, `a: aw/a1/a2`, `b: bw/b1`, zero-set `empty`):

```js
const log=focusFixture(),p=projectWorkout(log),{pages,pageByKey}=focusPages(log,p.items);
assert.deepEqual(pages.map(p=>p.keys.map(k=>JSON.parse(k)[1])),
 [['sw'],['s1'],['s2'],['aw'],['bw'],['a1','b1'],['a2']]);
assert.equal(pageByKey.get(setKey({exerciseId:'a',setId:'a1'})),
 pageByKey.get(setKey({exerciseId:'b',setId:'b1'})));
const last=pages.at(-1);
assert.deepEqual(last.members[1],{exerciseId:'b',member:'A2',ref:null,key:null});
assert.equal(roundComplete(last,new Set(last.keys)),true);
assert.equal(roundComplete({...last,keys:[]},new Set()),false);
assert.deepEqual(p.workingKeys.map(k=>JSON.parse(k)[1]),['s1','s2','a1','b1','a2']);
```

Add named cases `pages preserve IDs across repeated variants, zero counts and either longer member` and `page inheritance never duplicates an element after split or merge`: same variant IDs across distinct exercises, zero working sets on either/both members, no warm-ups, multiple pairs, additions/removals, reorder, unlink and removal of either exercise. Assert all real keys occur once, absent refs never enter membership, inherited keys are unique and surviving refs still use `focusFallback`'s next/previous order. Verify input log is unchanged. Retain existing projection, group, rep guidance and progress assertions; only change milestone expectations superseded by the spec.

Pin the exact split/reorder collision: reduce the fixture to paired a1/b1, derive the old round keyed by a1, unlink and encounter b1 before a1. The first page inherits a1's page key; the second must receive a distinct deterministic fallback:

```js
const log=focusFixture();log.exercises=log.exercises.slice(1,3);
log.exercises[0].sets=log.exercises[0].sets.filter(s=>s.id==='a1');
log.exercises[1].sets=log.exercises[1].sets.filter(s=>s.id==='b1');
const old=focusPages(log,projectWorkout(log).items).pages;
const aKey=setKey({exerciseId:'a',setId:'a1'}),bKey=setKey({exerciseId:'b',setId:'b1'});
assert.deepEqual(old.map(p=>p.key),[aKey]);
delete log.exercises[0].superset;log.exercises.reverse();
const split=focusPages(log,projectWorkout(log).items,old).pages;
assert.deepEqual(split.map(p=>p.keys),[[bKey],[aKey]]);
assert.deepEqual(split.map(p=>p.key),[aKey,aKey+'#1']);
assert.equal(new Set(split.map(p=>p.key)).size,split.length);
```

- [ ] **Step 2: Run `node --test test/workout-focus-model.test.js`.** Expected RED: new exports/membership and one-member milestone assertions fail; existing projection tests remain valid.
- [ ] **Step 3: Implement the pure derivation and milestone correction.** Derive working rounds from projected `pairId`/round and both real exercise identities; keep warm-ups individual. Keep `focusGroups` for ordinary pinned groups, never merge two working rounds just because an unequal pair has consecutive sets from one exercise. Superset feedback requires at least one real working set and every real working set in both members done; a missing set never gets a check.
- [ ] **Step 4: Rerun the model command.** Expected PASS, including stable split/merge keys and unchanged flat projection/progress tests.
- [ ] **Step 5: Commit only the task files:** `git add src/workout-focus-model.js test/workout-focus-model.test.js` then `git commit -m "feat: derive Focus round pages from exact sets"` (include fixture file only if changed).

### Task 2: Mount paired pages and resolve every exact-ref navigation path

**Files:** Create `src/workout-focus-pair.js`; modify `src/workout-focus-view.js`, `style.css`, `e2e/workout-focus-view.spec.js`, `e2e/workout-focus-progress.spec.js`, `e2e/workout-overview.spec.js`; use the existing `mountFocusFixture(page,{log,enable})` helper.

**Interfaces:**
- Feed continues exporting `mountWorkoutFocus(host,{port,ui,onInteraction,onViewed,onFinish})` and its existing `jump`, `visibleRef`, `focusContext`, `setEnabled`, `suspend`, restoration/teardown methods.
- Add `mountWorkoutFocusPair(host,{onSelect,onInteraction,reduced}) -> {update,cancelMotion,destroy}`; `reduced` is the existing `MediaQueryList`. `update({page,members,selected,animate=false,completedKey=null})` receives Task 1's page, exact selected ref and member descriptors extended with `{name:string,pane:HTMLElement|null,context:HTMLElement|null}` (null nodes for absent members). `onSelect(ref)` requests an existing member; the feed owns the selected-ref change. `pane` contains the existing exercise presenters and canonical row, `context` is the card's focusable context. This task implements final states; Task 4 supplies motion and composition deferral.
- The feed resolves refs through `pageByKey`; review remains `null`. Track `Map<pageKey,exactRef>` only for this attachment, clearing stale entries on recomputation. Keep the session's one per-log exact viewed ref, not the per-page map.

- [ ] **Step 1: Write browser failures for page and selector identity.** Mount the existing fixture; jump to a1 and capture both canonical rows/inputs with `port.row(ref)`. Assert two `.focus-round` elements, seven set/round pages total plus review, and exactly one DOM instance of each canonical input. The round owns two native buttons in `role=group` named `Superset A partners`; selectors expose full exercise/member names, current selection and completion, wrap and remain ≥44px. Use `.focus-partner` and `.focus-partner-check` for stable presentation assertions. Cover the four selected/completed combinations without marking/undoing on manual selection.

```js
await page.evaluate(()=>focusView.jump({exerciseId:'a',setId:'a1'}));
const round=page.locator('.focus-round').first();
await expect(round.getByRole('group',{name:'Superset A partners'})).toBeVisible();
await page.evaluate(()=>{window.roundTop=document.querySelector('.focus-feed').scrollTop;
 window.partnerInput=port.row({exerciseId:'b',setId:'b1'}).querySelector('[data-field="reps"]');
 focusView.jump({exerciseId:'b',setId:'b1'},{animate:true,focus:true});});
expect(await page.evaluate(()=>focusView.visibleRef())).toEqual({exerciseId:'b',setId:'b1'});
expect(await page.evaluate(()=>document.querySelector('.focus-feed').scrollTop)).toBeCloseTo(await page.evaluate(()=>roundTop),0);
await expect(round.locator('.focus-card[data-set-id="b1"] .focus-context-text')).toBeFocused();
expect(await page.evaluate(()=>partnerInput===port.row({exerciseId:'b',setId:'b1'}).querySelector('[data-field="reps"]'))).toBe(true);
```

Add missing-partner assertions: two identities remain, `No set this round` is visible and disabled/unselectable, no completion check/target exists for it. Add both same-round overview-chip and scrub-target cases: distinct individual segments select a1/b1 without vertical movement; chips/working counts remain individual and exercise-grouped. Cross-page jumps focus target context at travel start and publish viewed/progress/ticker only at arrival. Interrupt by pointer/key/wheel/dialog/resize/removal and assert the nearest actual page selects an existing ref with no hidden focus. Add Back to current for an unfinished partner on the same page, page revisit selection memory, first-unfinished/first-existing fallback, exact cursor reattachment, reorder/unlink/member removal identity tests (Review Focus 3).

- [ ] **Step 2: Run `npx playwright test e2e/workout-focus-view.spec.js e2e/workout-focus-progress.spec.js e2e/workout-overview.spec.js`.** Expected RED on missing round/selector elements and old set-per-round geometry; keep unrelated overview actions and progress gesture tests.
- [ ] **Step 3: Implement pages over the existing borrowed rows.** Keep `createCard` and port commands; share its existing exercise name/tags/note/history presentation between straight groups and pair panes using a view-local presenter, not copied business rules. Each round outer `li.focus-round` alone snaps; member rows have no snap alignment. Give its own context `Superset A`/`Round n of N`, existing link icon and accent rail; no pair header pins across rounds. Use two panes in one grid area, inactive `visibility:hidden` and `inert`, so both remain measurable without double flow; only the selected pane is operable. Place/move canonical nodes through `port.relocate`; move focus to a visible destination before hiding/inerting the old pane. Keep note-host transfers/restoration correct when groups split or retire.

Adapt `snapTop`, `inView`, travel target resolution, fit anchoring and nearest-page tracking to outer pages while exact refs remain public. Restore remembered existing member, else first unfinished, else first existing. Same-page jump selects in place; cross-page travel exposes the requested member for context focus, suspends publication until arrival, and uses existing scrollend/150ms settlement. Restore all rows and borrowed controls on desktop/finished presentation without replacing nodes. Enable rulers only for visible selected/appropriate nearby panes; never repeatedly redraw zero-width hidden inputs.

- [ ] **Step 4: Rerun the three browser suites.** Expected PASS for new final states and exact-ref addressing; adjust only obsolete superset-page expectations, retaining independent navigation/gesture/action checks. Motion-specific expectations follow in Task 4.
- [ ] **Step 5: Commit the task files:** `git add src/workout-focus-pair.js src/workout-focus-view.js style.css e2e/workout-focus-view.spec.js e2e/workout-focus-progress.spec.js e2e/workout-overview.spec.js` then `git commit -m "feat: render Focus superset rounds with exact-set navigation"`.

### Task 3: Complete either partner first using the single advance coordinator

**Files:** Modify `src/workout-focus-advance.js`, `src/workout-focus-view.js`, `src/workout-focus-pair.js`, `style.css`, `test/workout-focus-advance.test.js`, `e2e/workout-focus-motion.spec.js`, `e2e/workout-focus-view.spec.js`.

**Interfaces:** Preserve `createWorkoutAdvance({read,onAdvance,timers,reduced}) -> {completed,cancel,destroy}` and its existing event/state shapes. `onAdvance(ref)` still calls `jump(ref,{animate:true,focus:true})`: same-page resolution is an immediate partner selection with its 200ms presentation, cross-page resolution is vertical travel. Read fresh accepted log/page membership inside the coordinator rather than storing log mutations. `completed({before,after,ref,viewed,autoNext})` continues to be called only for the port's explicit accepted `edit`/`toggle` false→true transition.

- [ ] **Step 1: Add unit and browser failures for both orders and holes (Review Focus 1).** Extend the existing fake-timer harness with optional log/ref inputs rather than a second scheduler. For a1→b1 and b1→a1: first accepted completion calls `onAdvance(otherRef)` immediately, logs exactly one member, increments working count by one and never vertically scrolls; the round's second completion emits no vertical target at 649ms and the next forward unfinished page at 650ms. Add a three-round fixture test asserting exactly three vertical advances (round 1→2→3→next exercise/review), not six. An earlier unfinished straight/warm-up/round must remain unchanged while an explicitly completed later round advances forward; when no later unfinished page exists, the target is `null` (the review card). Straight/warm-up guidance retains its existing first-current gate.

```js
// In the extended harness, start with a1 selected and both round-1 members open.
h.c.completed({before,after,ref:a1,viewed:a1,autoNext:true});
assert.deepEqual(h.jumps,[b1]); // immediate in-place switch; no 650ms timer
// With a1 already done, explicitly accept b1's completion while b1 is viewed.
h.c.completed({before:secondBefore,after:secondAfter,ref:b1,viewed:b1,autoNext:true});
h.timers.advance(649);assert.deepEqual(h.jumps,[b1]);
h.timers.advance(1);assert.deepEqual(h.jumps,[b1,a2]);
```

Add absent/removed-partner and one-zero-working-member tests: every existing member done completes the nonempty round; no fictional set/check is created. Browser labels must be exact visible **and accessible** action names: `Log A1 & switch to A2` (reverse too) when on with other unfinished; `Log A1`/`Log A2` when off; `Complete round` when other done/absent; `Undo A1 completion`/`Undo A2 completion` when selected done. Keep the canonical done button/handler, overriding its Focus label accessibly rather than changing logger write commands; restore regular accessible labels when leaving Focus. Assert invalid/missing reps focuses the existing error input without completion, movement or RIR inference; undo retains values and affects only one member.

Add a cancellation matrix for pointer/key/wheel, direct input, notes, dialog/menu, undo, resize, suspension, hidden document, destroy, changed log/status/auth owner, completion conflict, membership/target removal and preference off/on. At firing, compare source-round membership/completion and target validity against fresh state; an acknowledgement/history update alone never schedules or celebrates. Test all these at 649ms; repeated flourish stays suppressed for an already rewarded exact set. Reduced motion switches/advances instantly.

- [ ] **Step 2: Run `node --test test/workout-focus-advance.test.js` and `npx playwright test e2e/workout-focus-motion.spec.js e2e/workout-focus-view.spec.js`.** Expected RED: the old `b.current===ref` gate rejects A2-first/later-round completion and old labels differ. Replace the old missing-partner/no-advance expectation with the approved forward-round rule.
- [ ] **Step 3: Extend the existing coordinator and labels.** Ordinary sets retain current behavior. A visible real round accepts either member: incomplete after completion resolves the unfinished partner immediately; incomplete→complete resolves the first later page with unfinished work (choose its first unfinished real ref), else review, after 650ms. Cancel pending work on every explicit edit/interaction and revalidate owner, viewed ref, source membership/completion and target at firing. No render/hydration scheduling and no second timer owner. Keep canonical one-set completion and shared optional-RIR validation; use neutral filled/accent-outline/directional-arrow treatment for first-member Log, orange for Complete round and existing tint for Undo. Preserve set/round/superset feedback precedence and rewarded keys.
- [ ] **Step 4: Rerun the unit and browser commands.** Expected PASS for both orders, earlier holes, no auto movement when off and every cancellation class; regular straight/warm-up cases remain green.
- [ ] **Step 5: Commit the task files** with `git commit -m "feat: advance Focus only after real round completion"` after explicitly staging the seven files listed above.

### Task 4: Coordinate partner motion without disturbing input ownership

**Files:** Modify `src/workout-focus-pair.js`, `src/workout-focus-view.js`, `style.css`, `e2e/workout-focus-motion.spec.js`, `e2e/workout-focus-view.spec.js`, `e2e/workout-focus-integration.spec.js`.

**Interfaces:** Implement Task 2's `animate`/`completedKey` inputs and `cancelMotion()`; the feed commits exact selection immediately except while the current field is composing. Add only attachment-local composition state/latest requested ref; `compositionend` applies the latest still-existing target. Use existing canonical input/note blur paths, `port.relocate` and the inputs plan's readout cancellation; no new draft model or forcibly dispatched blur/input events.

- [ ] **Step 1: Add motion/focus failures (Review Focus 2 and 5).** With `reducedMotion:'no-preference'`, assert incoming details and controls share 200ms easing/±12px motion; anchored selectors/context and exactly one 3px underline remain in place. Assert surface/text 180ms, new check 160ms/.65→1, persistent unselected completion check and final initial stored completion; undo reverses the check's fade/scale without removing A1/A2 identity. Trigger A1→A2→A1 rapidly: only latest pane is operable, old animations cancel, no queued callbacks can restore A2. Verify manual selector retains focus; completion/same-page jump focuses context, never numeric fields; ticker is active only after settling for the selected visible noncompact title and remains suspended through vertical travel.

Write `partner switching waits for composition and preserves invalid drafts`: hold references to both weight/reps inputs and both note scopes, type an invalid weight such as `82.3` (invalid quarter-step), place a caret/selection, begin composition on a note, request A2 then A1 then A2 through `focusView.jump`, apply a logger acknowledgement, and resize 760→761→760. Assert composing node, value, selection and focus survive until `compositionend`; then latest A2 context is visible/focused, A1 retains invalid text and no set silently completes. Repeat ending with A1 (the currently selected ref): this last request cancels the queued A2 switch and compositionend leaves A1 selected; update the pending request before any same-ref early return. Ordinary note blur trims through the existing path only after composition ends. Test an A2 target removed during composition falls back safely. Repeat for direct typing, acknowledgement/history refresh, initial render, restore and resize: no partner entry/check flourish. A press on a ruler or numeric input cancels enclosing partner-pane motion so the pointer target stays still; switching/compact restoration disables the previous ruler and cancels its readout animation. Only an explicit ruler-origin adjustment may start readout feedback. Enabling reduced motion mid-switch, suspending/disabling and destroying cancel animations and listeners, settle final values, and leave no hidden focused field.

- [ ] **Step 2: Run `npx playwright test e2e/workout-focus-motion.spec.js e2e/workout-focus-view.spec.js e2e/workout-focus-integration.spec.js`.** Expected RED on missing motion and immediate composition switch; use the suite's existing clock tools for scheduled work and actual browser animation inspection for motion.
- [ ] **Step 3: Implement the coordinated transition.** Use cancellable browser animations/styles over the same pane/control nodes, one latest transition and one moving underline; no cloned outgoing controls. Change accessibility/selection immediately, move required focus before making old content inert, then animate the new pane. Defer selection while composing, applying only its latest request afterward. Cancel/retarget effects on new selection; typing, routine patches, restoration and measurement settle instantly. Keep motion out of canonical values and avoid competing transforms with ruler readout feedback. Handle a mid-flight reduced-motion change and clear every animation on teardown.
- [ ] **Step 4: Rerun the three suites.** Expected PASS; inspect real rapid reversals and keyboard focus in addition to screenshots. Inputs stay identical before/after switching, acknowledgement and desktop restoration.
- [ ] **Step 5: Commit the task files** with `git commit -m "feat: coordinate accessible Focus partner transitions"` after explicitly staging the six listed files.

### Task 5: Remove peeks and fit regular and round pages to real space

**Files:** Modify `src/workout-focus-fit.js`, `src/workout-focus-view.js`, `src/workout-focus-pair.js`, `style.css`, `test/workout-focus-fit.test.js`, `e2e/workout-focus-fit.spec.js`, `e2e/workout-focus-view.spec.js`, `e2e/workout-focus-motion.spec.js`.

**Interfaces:**
- Keep `stackHeight(heights,gap,paddingBlock)`.
- Replace `fitGroup({feedHeight,nameHeight,detailsHeight,contentHeights,editing=false}) -> {nameOnly,pinned,rows:[{offset,minHeight}]}`; remove `peekHeights`, `peekless`, `focusCardFit` and all their imports/callers/assertions. Each row fills the available height under its applicable pin; oversized content grows naturally.
- Add `fitPair({feedHeight,headerHeight,fullHeights,compactHeights}) -> {compact,minHeight,paneMinHeight}`. `headerHeight` measures only the shared round context and partner-selector band, including its own padding/gaps and the relocated exercise-note action in compact mode; it excludes each exercise's title, tags, note/history and set controls. Height arrays measure each existing member pane below that band through Complete, including pane-local gaps/padding exactly once: `fullHeights` includes its title/action, details and controls; `compactHeights` excludes the visually hidden duplicate title and action relocated into the shared context, retaining details and controls. Compact when `headerHeight+max(fullHeights)>feedHeight`; use compact heights when compact, otherwise full heights. `paneMinHeight=max(max(chosenHeights),feedHeight-headerHeight)` and `minHeight=headerHeight+paneMinHeight`. Exclude absent members; never add title/details to both header and pane. DOM measurement provides actual wrapped names/note-action geometry; refit if compact relocation changes the header, and write only changed values.

- [ ] **Step 1: Replace peek unit expectations with failing full-space/compact assertions.**

```js
assert.deepEqual(fitGroup({feedHeight:600,nameHeight:50,detailsHeight:70,contentHeights:[300,350]}),
 {nameOnly:false,pinned:120,rows:[{offset:120,minHeight:480},{offset:120,minHeight:480}]});
assert.deepEqual(fitPair({feedHeight:600,headerHeight:100,fullHeights:[420,550],compactHeights:[360,430]}),
 {compact:true,minHeight:600,paneMinHeight:500});
assert.deepEqual(fitPair({feedHeight:420,headerHeight:100,fullHeights:[600],compactHeights:[540]}),
 {compact:true,minHeight:640,paneMinHeight:540});
```

Retain name-only first-row/full-details offsets, editing full pin and `stackHeight` assertions with no peek fields. Add exact-fit/noncompact and asymmetric member cases. Browser tests must assert zero next-set header/next-exercise name/review pixels at rest everywhere, including transitions between straight groups, warm-ups, rounds and review; delete obsolete whole-or-none/`.is-peekless` assertions and old helpers instead of passing zeros through dead branches.

Add paired geometry cases to the actual app `open()` helper, creating a paired log with representative wrapped names, one tag row and ordinary Last time/Best. Run visible browser heights 660, 740 and 844 at 360/390px, plus the existing phone-size matrix. Default text must show selected inputs/RIR through Complete at 660px; ruler/target sizes remain existing tiers. Compare feed scrollTop/round bounds before and after selecting the taller member: difference ≤1px and no layout animation. Verify compact selected selector is the visible name, duplicate title is visually hidden but remains a semantic heading, and the same note button moves into round context and back. At 200% text, long notes and 380px keyboard height: native scrolling reaches Complete and back to details/selectors; only viewed Complete sticks, focused pair controls use zero obsolete pin and 64px bottom clearance, top edge wins if both edges cannot fit. Straight pin/name-only behavior remains correct (Review Focus 4).

Add straight boundary and warm-up assertions: one 2px full-width `--accent` name-row rule per incoming exercise block, never per set; warm-up context is `--surface`/existing border with prominent `Warm-up · W1`/W2, no partner selector or RIR, and equivalent notes/inputs/validation/Complete targets.

- [ ] **Step 2: Run `node --test test/workout-focus-fit.test.js` and `npx playwright test e2e/workout-focus-fit.spec.js e2e/workout-focus-view.spec.js e2e/workout-focus-motion.spec.js`.** Expected RED on removed peek expectations/new fit API and round compact/oversized geometry.
- [ ] **Step 3: Implement no-peek fitting and final quiet/boundary presentation.** Delete peek height reads/reservations and `.is-peekless` handling from renderer/styles/tests. Measure both inert partner panes in the shared grid without enabling hidden ruler geometry; reserve the larger chosen pane. Use measured feed space, fluid gaps and current tiers, preserving the viewed outer-page anchor through refits. Compact immediately before controls are crowded, retaining/reusing heading/note elements. Oversized rounds scroll their own context away without a cross-round sticky header; keep sticky-bottom Complete and focused-field top-edge precedence. Keep the existing regular-group editing/40%-textarea behavior. No new fit transitions, interstitials, flashes, exercise colors or “next” snippet.
- [ ] **Step 4: Rerun the unit/browser commands.** Expected PASS; manually inspect default and fallback screenshots plus native scrolling, not only fixed-height fixture pictures. Run `rg -n 'peekHeight|peekless|focusCardFit' src/workout-focus-model.js src/workout-focus-view.js src/workout-focus-fit.js src/workout-focus-pair.js test/workout-focus-fit.test.js`; expected no matches (exit 1), proving obsolete implementation was removed.
- [ ] **Step 5: Commit the task files** with `git commit -m "feat: fit Focus rounds without next-set peeks"` after explicitly staging the eight listed files.

### Task 6: Move Auto-next into Workout actions and finish the footer

**Files:** Modify `src/reorder-menu.js`, `src/workout-logger-view.js`, `src/workout-focus-view.js`, `style.css`, `test/workout-focus-session.test.js`, `e2e/workout-focus-integration.spec.js`; retain `src/workout-focus-session.js` unchanged unless its existing ownership needs a demonstrated fix.

**Interfaces:**
- Extend menu choices backwards-compatibly: existing `{label,disabled?,current?,run()}` button choices remain; `{label,checked:boolean,disabled?,run(checked:boolean)}` renders a native checkbox with a label and visible `On`/`Off` (state text does not change accessible name `Auto-next`). On change `close(true)` before `run(newChecked)`. Constructor stays `mountReorderMenu({label='Reorder options'}={})`; preserve overview's optional `toggle(button,choices,{initialIndex}={})`, including checkbox inputs in enabled-choice focus fallback.
- Add Focus methods `setAutoNext(value:boolean) -> void` and `cancelMovement() -> void`. `cancelMovement` is the narrow external interruption entry: cancel the advance timer, stop active vertical travel through the existing `cancelTravel`/nearest-actual-page resolution, and settle/cancel every active partner-pane/underline/check transition at its latest committed selection. Without travel it keeps the viewed exact ref; with travel it publishes the nearest page's existing member by the established interruption/selection-memory rules. It changes no completion/value/draft, starts no animation, moves no focus itself and neither sets `suspended` nor creates a new owner/lifecycle. Logger calls it before opening Workout actions (outside the Focus root); the menu then owns normal initial option focus and returns focus to its trigger on close. Setter calls the same interruption even when selecting the same value, updates future labels/behavior and emits existing `onInteraction({type:'preference',patch:{autoNext:value}})` when changed. Enabling it never advances from an already-complete round.

- [ ] **Step 1: Add failing menu/footer integration assertions.** Update the existing preference-reentry test to open Workout actions before querying checkbox; after uncheck, assert popover closes, trigger focused and future partner/vertical automatic movement stops. Reopen: checkbox unchecked and visible `Off`; enable: no movement until a future explicit completion. Use Tab/Space, Escape and pointer; measure ≥44px label target and `Auto-next` accessible checked state. Assert it follows Weight steps and preserves note/weight-step/discard/delete behavior. It exists only for editable active Focus, absent on desktop, finished and read-only records. Retain session default/shared-preference/auth-clear tests and add that per-page selections are never session fields.

```js
await page.getByRole('button',{name:'Workout actions',exact:true}).click();
await expect(page.getByRole('checkbox',{name:'Auto-next',exact:true})).toBeChecked();
await page.getByRole('checkbox',{name:'Auto-next',exact:true}).uncheck();
await expect(page.getByRole('button',{name:'Workout actions',exact:true})).toBeFocused();
await expect(page.locator('.focus-toolbar input')).toHaveCount(0);
await expect(page.locator('.focus-overview')).toHaveCSS('min-height','44px');
```

At 649ms open Workout actions without changing anything: no advance occurs. Also open it during an active smooth cross-page travel and midway through a 200ms partner switch: travel stops at the nearest real page with an existing exact ref, a same-page switch settles its latest selected partner, all obsolete animation/timer completions remain inert, and log values/completion are unchanged. Assert menu initial-option focus remains visible, closing restores Workout actions, no numeric field/hidden pane gains focus, and scrolling/selection still work afterward without an extra resume call. Include the same cases under reduced motion; weight-step submenu and overview opening also cancel. Test shared menu button consumers (including overview move choices/current weight option), ensuring no checkbox branch changes their execution/focus (Review Focus 5). Footer assertions: overview icon + visible label, `--surface-2`/1px border/`--text`, fills remaining row; Back to current only when exact refs differ, 8px gap, 50px default base excluding inset, growth at 200% text and no overlap. Progress-row opener and existing 200ms overview dialog/inert-close/focus return remain valid.

- [ ] **Step 2: Run `node --test test/workout-focus-session.test.js` and `npx playwright test e2e/workout-focus-integration.spec.js e2e/workout-overview.spec.js`.** Expected RED on missing checkbox menu choice/footer behavior; existing memory tests stay green.
- [ ] **Step 3: Implement the native checkbox choice and logger integration.** Remove footer checkbox/`.focus-auto` styles; add Auto-next directly after Weight steps for active editable Focus. Call `focusView.cancelMovement()` before Workout actions opens, including when merely dismissed; reuse its existing timer/travel/pair-motion cancellation paths without `suspend(true)`/a paired resume lifecycle. Invoke `setAutoNext` through existing session interaction ownership; restore trigger focus before callbacks. Preserve overview's button-choice/initial-index/scoped-motion additions and every other menu caller. Style the neutral, filling overview/footer with 3px block padding and separate device inset; let wrapped text grow and let navigation's actual-geometry measurement observe it.
- [ ] **Step 4: Rerun the commands plus `npx playwright test e2e/workout-focus-fit.spec.js`.** Expected PASS for native pointer/keyboard operation, shared callers and new real footer geometry.
- [ ] **Step 5: Commit the task files** with `git commit -m "feat: move Focus Auto-next into Workout actions"` after explicitly staging the six listed files.

### Task 7: Verify saved partial rounds, lifecycle integration and implementation evidence

**Files:** Modify `e2e/workout-focus-integration.spec.js`, `e2e/workout-offline.spec.js`, `e2e/workout-recap.spec.js` only for new round integration cases; update `AGENTS.md`, `docs/design-system/README.md`; create `docs/superpowers/verification/2026-11-15-focus-rounds-and-presentation.md`.

**Interfaces:** No production API/storage changes. Use existing `login`, `resetWorkouts`, `createLinkedTemplate`, `headers` from `e2e/workout-helper.js`, existing API PUT/GET workout records, active mirror/offline helpers and app routes. Reuse actual controller/queue and Finish flows; do not prove persistence solely with the standalone `saved` fixture array.

- [ ] **Step 1: Add failing integration cases for a partially completed round.** Using the existing log fixture shape persisted through `/api/workouts/:id`, log A2 first, read the acknowledged server record and assert only b1 is done with its exact values/note/RIR; a1 remains untouched. Navigate away/resume and reload: the accepted partial completion remains, selection restores the exact partner on same-session reattachment, and stored completion never animates/advances. Repeat offline: inspect `gpb.activeWorkout` after the first completion, reload offline, reconnect and assert one real saved completion with no added round/selection/preference fields. Queue an advance, then inject a conflicting accepted record reopening/removing source/target: no stale switch/travel. Finish a partial pair: unchecked sets prune, invalid pair dissolves under existing rules, recap/pending read-only handoff remains truthful and has one writer. Retain independent sync/revision/deduplication assertions.

Also verify final integration with sibling plans: lower-bound Best labels in both partner panes, optional blank RIR after completion/acknowledgement, readout animation cancellation during switching, overview reorder/unlink and exact set chips/scrub, hidden nested tabs/compact Home back link, Resume after ordinary Back, actual 660px feed with safe area and keyboard changes, and desktop/finished/read-only controls. Use existing tests for covered storage/recap semantics; add only the pair-specific inputs/expectations.

- [ ] **Step 2: Run `npx playwright test e2e/workout-focus-integration.spec.js e2e/workout-offline.spec.js e2e/workout-recap.spec.js`.** Expected new tests fail if any integration gap remains. If they already pass, record that they exercise existing correct integration; do not manufacture a product change to force RED.
- [ ] **Step 3: Fix only demonstrated integration gaps in their owning Focus files.** Recheck exact-ref contracts and canonical node/sync ownership after predecessor changes. Do not change storage schemas, add a second owner or relax assertions to fit the old alternating presentation.
- [ ] **Step 4: Run final checks sequentially:** `npm test`, `npm run test:e2e`, `npm run build`. Expected: all Node tests pass, all Playwright tests pass with no unexpected failures, static build exits 0. The full browser run includes shared reorder-menu consumers and navigation regressions; do not run migrations or seed/deploy commands. Inspect populated 360/390/412px mobile screens, the real 660px-height case, 200% text/touch/hybrid, and desktop 1366×768, 1440×900, 1920×1080 for unchanged regular logging; play both logging orders, rapid switches, ruler interaction mid-transition, menus, undo, scroll, keyboard focus and reduced motion in a browser.
- [ ] **Step 5: Record actual implementation results and commit.** Update the governing Focus rules/design system only after code lands; document the final interfaces, superseded peeks/set-only round gate/footer placement, commands/results and screenshots/interaction observations. Mark phone partner-transition feel, ruler interaction while transitioning, scrolling through rounds, keyboard/safe areas, momentum, preview/production and deployment `pending (user)`/unverified unless actually checked. Stage only files changed for this task and commit `test: verify Focus round lifecycle and document behavior`.

## Plan self-review

Spec coverage checked against sections 1–7 and Architecture/acceptance: membership/identity (Tasks 1–2), both completion orders and forward holes (3), transition/focus/composition (4), progress/jumps/recovery (2), no peeks/boundaries/warm-ups/compact/oversized fit (5), menu/footer (6), sibling integration and persistence/ownership evidence (7). All five Review Focus conditions have explicit owning tests. Interfaces use exact refs throughout, existing port commands and the one advance coordinator; proposed new helper interfaces are defined above before use. Cross-review corrections pin collision-free two-pass page keys with the exact b1-before-a1 split case, nonoverlapping header/pane height measurements, cancellation of a queued composition switch by a final same-ref request, explicit null-review wording, and the outside-root menu's timer/travel/partner-motion interruption without a new suspension lifecycle. No implementation or test command was executed while authoring this plan. Remaining uncertainty is physical-phone fit/feel/performance, safe-area/keyboard/momentum behavior and deployed behavior, not an unspecified code interface.
