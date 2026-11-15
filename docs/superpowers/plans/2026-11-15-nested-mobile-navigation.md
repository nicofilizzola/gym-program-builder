# Nested Mobile Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hide tabs on committed nested mobile screens, provide a stable immediate-parent link, and reclaim the space without changing navigation, editing or workout ownership.

**Architecture:** Extend the existing parsed-route helpers, committed-route boundary and breadcrumb renderer. Keep full and effective tab heights separate; notify the existing Resume reservation and logger measurement when committed chrome geometry changes. Preserve root caching/restoration, guarded navigation and the single workout controller.

**Tech Stack:** Existing plain JavaScript modules, CSS, Node 24 `node:test`, Playwright and the test server; no new dependency.

**Spec:** `docs/superpowers/specs/2026-11-15-nested-mobile-navigation-design.md`; integration boundaries: `docs/superpowers/specs/2026-11-15-mobile-tracker-refinements-design.md`. The specifications are approved. This plan records future work, not implementation or passing results.

## Global Constraints

- At ≤760px, hide bottom tabs on nested routes and provide an obvious one-level return. At >760px, preserve current desktop navigation and full breadcrumbs.
- Visibility is derived from the committed view, not simply from the requested hash or URL depth.
- Use a real link with the canonical parent href, an accessible name `Back to {parent label}`, visible text, and at least a 44px target height/width.
- The effective `--tab-bar-height` is zero on nested mobile routes, full-height on mobile roots and zero on desktop.
- Use the existing nested-route fade (75ms outgoing, 100ms incoming, ease-out) and commit chrome visibility with the route swap.
- Root swipes remain Home↔Library↔User under the existing eligibility rules, with 220ms settlement and 180ms cancellation.
- Initial load and reduced motion commit final states immediately. Typing keeps its existing user-initiated hide/restore behavior and reserved-padding policy.
- Preserve exact routes, guards, save controls, controller/mirror/sync ownership, drafts, caret/composition, viewed set, Home History extent/scroll and `exitWorkout` semantics.
- No new persistence, API, migration, prefetch or deployment. No dependency, schema, export/import, analytics or workout-sync change.
- Physical-phone safe areas, keyboard transitions, momentum and deployed verification remain pending. Browser inset/viewport simulation is not physical-device evidence.

## Review Focus

1. A moved/archived variant arrives through an old reference URL: its compact parent and canonical href must follow the resolved reference, including unavailable-parent fallback (Tasks 1–3).
2. A focused back link survives an unrelated current-record rename, acknowledgement and 760↔761px resize; label-only parent updates retain its node and full accessible name (Task 2).
3. A held destination finishes after browser Back/Forward or auth changes: it cannot replace the committed source chrome, focus, saved scroll or reservation (Task 3).
4. A typing-exit click navigates to a root as delayed restore runs: that click retains ownership, roots restore their full reservation and nested screens never flash tabs (Task 4).
5. An unchanged-height Resume bar crosses root/nested routes while safe area/text size changes: it reserves the right total once; Focus preserves its viewed set and input through the refit (Tasks 4–5).

---

## File responsibilities and integration order

| File | Responsibility |
|---|---|
| `src/mobile-navigation-state.js` | Existing `destinationFor`/`isSwipeRoot` stay authoritative; add pure parent metadata from parsed routes and resolved context. |
| `src/breadcrumbs.js` | Patch the existing trail in place; use its immediate-parent anchor for compact mobile presentation, retain the full desktop trail and link behavior. |
| `src/mobile-navigation.js` | Derive tab visibility from its committed hash plus breakpoint; notify optional geometry consumer at commit/breakpoint/visible height changes. |
| `src/app.js` | Supply resolved parent context, mount workout/error return links, preserve guarded route swap/focus, bridge geometry callbacks to mounted views and Resume. |
| `src/workout-bar.js` | Refresh its existing measured reservation explicitly when tab ownership changes, even without a bar resize. |
| `src/workout-logger-view.js` | Expose its existing scheduled measurement as `refreshGeometry()` and reserve only route-visible tabs; retain all canonical logger/port behavior. |
| `style.css` | Separate full/effective tab geometry, hide nested navigation, compact breadcrumbs and assign safe-area ownership to visible bottom surfaces. |
| `test/mobile-navigation-state.test.js`, `test/router.test.js` | Complete route/query/fallback/ownership matrix and preserved entry semantics. |
| `e2e/breadcrumbs.spec.js`, new `e2e/nested-mobile-navigation.spec.js` | Compact identity, deep links, route/error/guard lifecycle and geometry checks in the actual app. |
| Existing suites named in Tasks 3–5, `e2e/navigation-helper.js` | Update public-navigation callers whose mobile tabs are now intentionally absent; retain their original assertions. |
| `AGENTS.md`, `docs/design-system/README.md`, new `docs/superpowers/verification/2026-11-15-nested-mobile-navigation.md` | Document each implemented slice and its actual evidence in the same task, with pending checks explicit. |

Execute Tasks 1–5 in order. This plan is independently implementable before Focus rounds. Its `style.css` changes own navigation/breadcrumb/bar/panel rules; the Focus plan owns `.focus-*` presentation and the direct overview footer's own safe-area padding. Integrate this plan's narrow `measureFocus`/`refreshGeometry` hunk in `src/workout-logger-view.js` before, or reconcile it explicitly with, the Focus plan's logger hunk; keep both. The logger continues measuring its current toolbar, so no new Focus footer is required here. Overview and inputs plans do not own navigation or these geometry callbacks. When Focus lands later, rerun Task 5 against its actual footer and round page.

### Task 1: Define immediate-parent metadata on the existing route model

**Files:** Modify `src/mobile-navigation-state.js`; test `test/mobile-navigation-state.test.js`, `test/router.test.js`; create the verification document above with planned/pending status.

**Interfaces:**
- Consume unchanged `parseRoute(hash)`, `destinationFor(hash)` and `isSwipeRoot(hash)`.
- Produce `mobileParentFor(hash, {program = null, reference = null} = {}) -> {label: string, href: string} | null`. Resolved context values are `{id: string, name: string}`; do not load data inside this helper. Missing context means use the owning-root fallback.

The exhaustive matrix is the task's test table and the later browser fixture matrix:

| Parsed route / example | Tabs on mobile | Parent label → href |
|---|---|---|
| `home`, including `?section=history` | Visible | None |
| `programs`, `templates`, `catalog`, `user` | Visible | None; keep Library section links on the three list roots |
| `workouts` | Visible | None; mobile entry still replaces to Home/History; a desktop Workouts view resized to mobile retains its explicit URL |
| `program`: `#/programs/p` | Hidden | Programs → `#/programs` |
| `program-workout`: `#/programs/p/workouts/o` | Hidden | Resolved program name → `#/programs/p`; absent program → Programs |
| `template`: `#/templates/t` | Hidden | Templates → `#/templates` |
| `catalog-reference`: `#/catalog/references/r` | Hidden | Exercises → `#/catalog` |
| `catalog-variant`: `#/catalog/references/r/variants/v` | Hidden | Resolved reference name → its canonical reference href; absent reference → Exercises |
| `catalog-tags`: `#/catalog/tags?kind=focus&q=upper+chest` | Hidden | Exercises → `#/catalog` |
| `profile` | Hidden | User → `#/user` |
| `workout`: `#/workouts/w`, active/finished/recap/missing | Hidden | Home → `#/home` |
| `not-found`: unrelated/malformed/invalid tag kind | Hidden | Home → `#/home`; no invented path parent |

- [ ] **Step 1: Add `mobile parent matrix uses resolved context and owning-root fallbacks` and expand existing route tests.** Iterate every row, both tag kinds/query replacements, empty/unknown query values, invalid IDs and unknown paths. Pin representative assertions:

  ```js
  assert.deepEqual(mobileParentFor('#/programs/p/workouts/o', {program:{id:'p',name:'Upper / Lower'}}), {label:'Upper / Lower',href:'#/programs/p'});
  assert.deepEqual(mobileParentFor('#/catalog/references/old/variants/v', {reference:{id:'new',name:'Current reference'}}), {label:'Current reference',href:'#/catalog/references/new'});
  assert.deepEqual(mobileParentFor('#/programs/missing/workouts/o'), {label:'Programs',href:'#/programs'});
  assert.deepEqual(mobileParentFor('#/unrelated/depth'), {label:'Home',href:'#/home'});
  assert.equal(mobileParentFor('#/catalog'), null);
  assert.equal(destinationFor('#/workouts/w'), 'home');
  assert.equal(isSwipeRoot('#/catalog/tags?kind=brand&q=x'), false);
  ```

  Test all matrix ownership values with `destinationFor`; preserve `resolveEntryHash('#/workouts',{mobile:true}) === '#/home?section=history'` and explicit nested/desktop URLs. Callers retain the existing `Untitled program` fallback for blank draft program names; reference names use validated catalog data. Do not add a second catalog-name validation policy.
- [ ] **Step 2: Run `node --test test/mobile-navigation-state.test.js test/router.test.js`.** Expected RED: missing `mobileParentFor` export; existing parser tests still run once the import exists.
- [ ] **Step 3: Implement `mobileParentFor` in `src/mobile-navigation-state.js`.** Switch on the existing parsed view; call `isSwipeRoot` for roots and use resolved context IDs for canonical parents. Preserve existing destination/page-memory functions and route parsing; do not infer nesting from slash counts.
- [ ] **Step 4: Rerun the Step 2 command.** Expected GREEN: all route, query, ownership, page-memory and entry tests pass. Create evidence with the actual command/result and unresolved browser/device checks; do not prefill success.
- [ ] **Step 5: Commit only this task's files:** `git add src/mobile-navigation-state.js test/mobile-navigation-state.test.js test/router.test.js docs/superpowers/verification/2026-11-15-nested-mobile-navigation.md`, then `git commit -m "feat: define mobile parent navigation metadata"`.

### Task 2: Preserve one parent anchor through compact and desktop breadcrumbs

**Files:** Modify `src/breadcrumbs.js`, `src/app.js` (`prepareRecord`, catalog/tag/profile breadcrumb mounts and `onTargetChange`), breadcrumb rules in `style.css`, `e2e/breadcrumbs.spec.js`, `e2e/mobile-library-navigation.spec.js`, design-system Breadcrumbs section and verification evidence.

**Interfaces:**
- Consume Task 1's parent metadata from resolved program/reference data, including catalog moves.
- Extend `mountBreadcrumbs(root, {items = [], mobileParent = null, onNavigate}) -> {update, destroy}`; `update(items, {mobileParent} = {}) -> void` retains its previous mobile parent when omitted. Existing one-argument callers remain valid.
- The same immediate-parent `<a>` survives updates and breakpoint changes when its href is unchanged. An empty desktop `items` list plus `mobileParent` produces mobile-only chrome for later workout/error callers without introducing a desktop breadcrumb.

- [ ] **Step 1: Add `compact parent link survives updates and responsive changes` to `e2e/breadcrumbs.spec.js`.** Reuse its populated program/shared-template/reference fixtures. At 390px assert exactly one visible trail link named `Back to Strength`, canonical program href, one-line ellipsis for a long parent, full accessible name and ≥44px height/width. Hold a template PUT acknowledgement, edit its name, save a JS reference to the parent anchor, focus it, then release the response; assert the same node remains focused. Use a small renderer fixture to call `update` with a current-record rename and parent-label-only change while the parent is focused. At 761px assert the full existing desktop trail; at 760px assert compact presentation and the same surviving parent anchor. Add reference/variant, Templates/Exercises aliases, Profile/User, HTML-like names and root-no-trail assertions. Test ordinary Enter/click invokes guarded navigation and modified click is not prevented. Check program return-to-occurrence focus/scroll and variant → reference → Exercises ordering.

  ```js
  await expect(trail.getByRole('link')).toHaveCount(1); // mobile visible/accessible links
  await expect(back).toHaveAttribute('href', '#/programs/'+fixture.program.id);
  await expect(back).toBeFocused();
  expect(await back.evaluate(node => node === window.savedBack)).toBe(true);
  ```
- [ ] **Step 2: Run `npx playwright test e2e/breadcrumbs.spec.js e2e/mobile-library-navigation.spec.js`.** Expected RED: missing `Back to …` names, multiple mobile breadcrumb items and anchor replacement on updates.
- [ ] **Step 3: Implement the extended renderer and caller metadata.** Patch links/text by identity rather than rebuilding the whole list when only the current crumb changes. Reuse the parent anchor in the desktop trail; show a decorative currentColor left arrow and compact parent label only at ≤760px, hide all other mobile crumbs from focus/accessibility, retain desktop items/current-page semantics. Use the existing guarded click/modified-click behavior. Update catalog parent metadata and href when `onTargetChange` resolves a moved variant; label changes patch in place. Keep headings/save slots and existing shell tooltip teardown; add no tooltip or duplicate persistent breadcrumb row. When a breakpoint hides the actually focused crumb, restore focus to a surviving visible parent/current heading; do not move focus away from a surviving parent anchor.
- [ ] **Step 4: Rerun Step 2.** Expected GREEN: old desktop trails and new mobile identity/deep-link/modified-click assertions pass. Update the Profile assertion to `Back to User`. Update design-system Breadcrumbs rules and record actual browser evidence in the same change.
- [ ] **Step 5: Commit:** `git add src/breadcrumbs.js src/app.js style.css e2e/breadcrumbs.spec.js e2e/mobile-library-navigation.spec.js docs/design-system/README.md docs/superpowers/verification/2026-11-15-nested-mobile-navigation.md`, then `git commit -m "feat: show stable compact parent links on mobile"`.

### Task 3: Commit tab visibility with routes, including recoverable errors

**Files:** Modify `src/mobile-navigation.js`, `src/app.js` (`renderRoute`, `openRecord`, `prepareWorkout`, error/unknown branches and canonical in-place changes), navigation rules in `style.css`, new `e2e/nested-mobile-navigation.spec.js`, `e2e/mobile-navigation.spec.js`, `e2e/mobile-destination-swipes.spec.js`, `e2e/navigation-helper.js`, `AGENTS.md`, design-system mobile navigation sections and evidence.

**Interfaces:**
- Extend `mountMobileNavigation(nav, {state, onNavigate, onGeometryChange = () => {}})`; retain `{commit, preview, resetPreview, destroy}`. `commit(hash,{preservePreview=false})` remains the only route-change input; breakpoint changes reapply its stored committed hash. The callback is optional, synchronous after geometry state updates, and receives no arguments.
- Set `data-mobile-nested` on the document element from committed route classification (retained on desktop for a later resize). On mobile it hides Main navigation from paint/focus/accessibility. Use `--tab-bar-full-height: calc(max(56px, 34px + .9rem) + env(safe-area-inset-bottom,0px))` on mobile; effective `--tab-bar-height` is that value on roots and `0px` on nested routes/desktop. Never animate the effective height.
- Workout/unknown/cold-error links use Task 2's `mobileParent` with no desktop trail where none exists today. App routing still returns its existing `committed`/`blocked`/`failed`/`superseded` status.

- [ ] **Step 1: Write actual-app matrix and lifecycle tests in `e2e/nested-mobile-navigation.spec.js`.** Reuse `login`/API fixtures and the complete Task 1 matrix. Enter every nested type from its parent and through a fresh deep link; assert `Main` hidden, zero accessible tab links, effective reservation zero, correct parent href and return destination. On all roots assert exactly `Home, Library, User`, three equal ≥44px tabs and Library sections retained. Keep `#/workouts` replacement/history-count and desktop-Workouts-resize assertions in `mobile-navigation.spec.js`.

  Add `committed chrome survives blocked failed superseded and auth navigation`: hold required nested GETs and assert the source's nav/back node/reservation remain unchanged; fulfill 503 and assert source URL/controller/focus restored. Fail a Profile PUT, decline the existing unsaved-leave confirmation after pressing `Back to User`, and assert field value, nested parent and zero reservation survive; repeat with a finished-log unsaved-reps guard. Hold/release a destination across Back then Forward, and across a 401/sign-in; assert stale completion cannot publish its chrome. Root cold failure must stay on the root with tabs and Retry.

  Add missing-record cases: direct missing program/template/program occurrence/reference/variant/workout and an unrelated unknown route each show an accessible error plus their available parent. Missing occurrence with a loaded program links to that program; missing program/reference context falls back to Programs/Exercises. A resolved catalog missing-target error can commit; a thrown required load with a mounted source retains that source. Initial unavailable-record/load errors with no source keep the requested nested treatment, parent and Retry where already applicable. Preserve desktop error treatment.

  ```js
  await expect(page.getByRole('navigation',{name:'Main'})).toBeHidden();
  await expect(page.getByRole('link',{name:'Back to User',exact:true})).toHaveAttribute('href','#/user');
  await expect(page.getByRole('textbox',{name:'Training background and approach',exact:true})).toHaveValue('Keep my training background');
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--tab-bar-height').trim())).toBe('0px');
  ```
- [ ] **Step 2: Run `npx playwright test e2e/nested-mobile-navigation.spec.js e2e/mobile-navigation.spec.js e2e/mobile-destination-swipes.spec.js`.** Expected RED: nested tabs remain painted/accessibly available, reservation is 56px, workout/unknown errors lack compact parents.
- [ ] **Step 3: Implement route visibility and recovery at existing boundaries.** Apply visibility in `mobileNav.commit` inside `renderRoute`'s `commitView`, after the outgoing 75ms fade and before the incoming 100ms fade/refit. Cover `openRecord`/creation/reload commits and catalog/tag canonical replacements without creating a second navigation pipeline. Do not update chrome for requested hashes, stale data or rejected guards. Preserve root previews, indicator settlement, cache loading and auth-memory clearing. Only initial no-source errors mount fallback chrome; keep the existing mounted source for thrown required failures. Mount the compact Home link outside the logger-owned subtree so `showRecap` retains it. Add accessible mobile unknown/error text without rewriting desktop errors.

  In `mobile-navigation.js`, hide navigation synchronously, invalidate cached indicator geometry when visibility changes, and notify `onGeometryChange` after commit/arrange and real visible-size changes. Check visibility before indicator measurement. Preserve stored full height when hidden, and focus a visible current control/parent/heading if the previously focused navigation becomes hidden. Do not create a slide or leave the hidden nav focusable. Adapt `openLibrarySection(page,section)` to follow visible compact parents on mobile until Main is available, then use existing tabs/Library section links; desktop behavior stays unchanged. Replace the nested Profile leave test's hidden User-tab click with `Back to User` and update superseded nested-tab expectations in `mobile-navigation.spec.js`.
- [ ] **Step 4: Rerun Step 2 plus `npx playwright test e2e/breadcrumbs.spec.js e2e/mobile-library-navigation.spec.js e2e/mobile-navigation-latency.spec.js e2e/mobile-page-transition.spec.js`.** Expected GREEN: committed-source/error checks, root loading/Retry and 220/180ms settlement remain correct. In the motion test, observe chrome state only at the content swap; capture 75/100ms content animation timings and no independent nav/reservation animation. Reduced motion/initial load have no entrance animation. Document the implemented visibility/compact-link slice in `AGENTS.md`, design-system and evidence; leave geometry/workout checks pending until their tasks pass.
- [ ] **Step 5: Commit:** `git add src/mobile-navigation.js src/app.js style.css e2e/nested-mobile-navigation.spec.js e2e/mobile-navigation.spec.js e2e/mobile-destination-swipes.spec.js e2e/navigation-helper.js AGENTS.md docs/design-system/README.md docs/superpowers/verification/2026-11-15-nested-mobile-navigation.md`, then `git commit -m "feat: hide mobile tabs at committed nested routes"`.

### Task 4: Reassign bottom space and safe area without losing typing or inputs

**Files:** Modify `src/workout-bar.js`, geometry bridge in `src/app.js`, `measureFocus` and returned logger object in `src/workout-logger-view.js`, bottom-reservation rules in `style.css`; test `e2e/nested-mobile-navigation.spec.js`, `e2e/mobile-navigation.spec.js`, `e2e/mobile-navigation-layout.spec.js`, `e2e/workout-focus-integration.spec.js`; update design-system geometry/typing/Resume descriptions and evidence.

**Interfaces:**
- `mountWorkoutBar(...).refreshGeometry() -> void` calls its existing reservation calculation, even when the bar's own height is unchanged; hidden bars clear only their own reservation as today.
- `mountWorkoutLogger(...).refreshGeometry() -> void` schedules the existing `measureFocus`, no-ops when destroyed/disabled/recap, and keeps the same logger port. `prepareWorkout`'s `mounted` adapter forwards it.
- The app's optional `onGeometryChange` callback calls `workoutBar.refreshGeometry()` and `mounted?.refreshGeometry?.()`. No event bus, new sync owner or persistence. Existing resize/header/page/toolbar/visualViewport observation remains.
- In measurement, the effective tab reservation is the rendered nav height only when route-visible at the mobile breakpoint; otherwise zero. Do not `parseFloat` the custom property's unresolved `calc(...)`, count Resume on its own suppressed logger, or reserve a hidden full-height bar.

- [ ] **Step 1: Add `bottom reservations change even when Resume height does not` and `typing restore cannot resurrect nested tabs` in the nested suite.** Start a workout, Back Home, open Library, then a nested editor: root bar bottom equals tabs top; nested bar bottom equals viewport bottom; body padding equals effective tabs plus measured Resume height, both directions with unchanged bar content. For no Resume assert no stale tab-sized body gap; assert `#app` min-height uses the effective value, editor `.panel` is at the effective bottom and its controls clear the inset, root refresh status sits above both visible bars, and Home History status stays inside its section.

  Repeat geometry with 0px and simulated 20px bottom inset by intercepting the actual `style.css` response and substituting only `env(safe-area-inset-bottom[,0px])` with the test length. Leave selectors/layout declarations unchanged so missing inset ownership still fails. Assert the full root tab height includes the inset once, Resume has no second root inset and owns 20px on nested pages. This is arithmetic evidence, not a phone check. At 200% text verify full tab height grows/restores rather than retaining a prior zero/56px cache.

  Root search: script focus leaves bars visible; user press/key enters typing and translates bars without changing reservation. Tap a lower control while leaving the field and assert that control activates before restore. Nested editor: user typing/blur never reveals tabs or changes effective zero. Click its compact parent as the 700ms typing fallback is pending; assert the destination root gets correct reservation with no stolen click. Slider/script-focus tests on nested Profile assert tabs remain absent rather than expecting the old bar.

  Add `hidden-tab geometry refits active Focus at 660px`: actual app at 390×660, Last time/Best/tags populated, Complete reachable, toolbar within visual viewport, no 56px gap, hidden Main and no accessible tab. Resize viewport/visualViewport while an invalid reps draft is focused: preserve exact input node/value/caret, composition and viewed set; no new save/completion/auto-next. Repeat 760→761→760 and reduced motion.

  ```js
  const barBox = await page.locator('.workout-bar').boundingBox();
  expect(barBox.y + barBox.height).toBeCloseTo(844,0); // nested, no keyboard
  expect(await page.evaluate(() => parseFloat(getComputedStyle(document.body).paddingBottom))).toBeCloseTo(barBox.height,0);
  await expect(page.getByRole('navigation',{name:'Main'})).toBeHidden();
  expect(await reps.evaluate(node => node === window.savedReps)).toBe(true);
  ```
- [ ] **Step 2: Run `npx playwright test e2e/nested-mobile-navigation.spec.js --grep "bottom reservations|typing restore|hidden-tab geometry"`.** Expected RED: Resume loses nested safe-area padding or retains stale reservations, and logger lacks the explicit post-commit refit; use assertion output to identify the actual failing consumer rather than adding a generic observer framework.
- [ ] **Step 3: Implement the two `refreshGeometry()` methods and callback bridge.** Keep `workout-bar.js`'s existing show/hide/reserve lifecycle and suppression tokens; recalculate at geometry commit, not just ResizeObserver. Adjust mobile Resume padding so tabs own the inset on roots and Resume owns it on nested screens; pinned editor/bottom actions retain their own clearance. Audit every `--tab-bar-height` consumer: body padding, `#app`, Home cover/history, Resume bottom/space, `.panel`, `.root-page-feedback` and Focus measurement. Keep root typing reservation policy and 700ms click grace in `typing-state.js` unchanged; route-hidden rules must dominate typing restore. The Focus plan owns the later footer's own safe-area padding; reserve its measured height once when integrating it.

  Update existing mobile tests that measured translated nav boxes while on nested pages: move root typing assertions to a root search, retain nested click-through/control assertions, and replace Profile/editor tab geometry with absence/zero/inset assertions. In Focus integration tests compare footer/feed to the actual viewport bottom, not a hidden Home-tab box; use `Back to Home` for exits and only tap User after returning to a root. Keep all logger ownership, long-note, input identity and reanchor assertions.
- [ ] **Step 4: Run `npx playwright test e2e/nested-mobile-navigation.spec.js e2e/mobile-navigation.spec.js e2e/mobile-navigation-layout.spec.js e2e/workout-focus-integration.spec.js e2e/workout-focus-fit.spec.js e2e/mobile-save-controls.spec.js`.** Expected GREEN: actual measured geometry, unchanged saves/drafts/caret and no hidden focus targets. Preserve current card/peek semantics until the separate Focus plan lands; adjust only numeric expectations invalidated by the reclaimed height, never weaken through-Complete/reachability assertions. Update design-system and evidence with measured inset/viewport limitations.
- [ ] **Step 5: Commit:** `git add src/workout-bar.js src/app.js src/workout-logger-view.js style.css e2e/nested-mobile-navigation.spec.js e2e/mobile-navigation.spec.js e2e/mobile-navigation-layout.spec.js e2e/workout-focus-integration.spec.js docs/design-system/README.md docs/superpowers/verification/2026-11-15-nested-mobile-navigation.md`, then `git commit -m "fix: reclaim nested navigation space across bottom surfaces"`.

### Task 5: Verify workout exits, restoration and responsive lifecycle end to end

**Files:** Extend `e2e/nested-mobile-navigation.spec.js`, `e2e/workout-home.spec.js`, `e2e/workout-recap.spec.js`, `e2e/workout-offline.spec.js`, `e2e/workout-logger.spec.js` only where the assertions below need a new parent or reservation check; finish `AGENTS.md`, `docs/design-system/README.md`, verification document. Reuse `e2e/mobile-page-memory.spec.js`, existing focus/layout/motion/root-latency suites and their fixtures.

**Interfaces:** Consume unchanged `navigate`, `exitWorkout`, controller attach/detach, Home memory, recap handoff and Task 4 geometry. Ordinary Back uses `navigate('#/home')`; only Finish/Discard/Delete/Done use `exitWorkout`. No production interface is introduced by this task.

- [ ] **Step 1: Add `parent Home return retains workout and remembered History` and `explicit workout exits clear Home memory` tests.** Seed ≥50 history rows, restore an older-page extent and nonzero scroll, open an active log, edit a set, press `Back to Home`, and assert remembered extent before scroll, Resume available, same active ID/status, mirror retained, background save acknowledged and no finish/delete request or recap. Resume returns to the same viewed set. Test other-screen Resume under root and nested chrome without changing suppression-token lifetimes. Replace active-log Home-tab calls in `workout-home.spec.js` with compact Home links while keeping offline/snapshot-cover assertions.

  Test Finish → recap → Done, discard, finished-log delete and finish without recap: final Home top, tabs visible, page memory cleared and newest/pending history correct; desktop still exits to `#/workouts`. In recap assert `Back to Home` remains available before and after acknowledgement, pending/offline finishes read-only with truthful status, and returning Home does not create a second writer. Keep existing retry/conflict/acknowledgement cases from the recap/offline suites.

  Add `responsive chrome preserves drafts and visible focus`: populated program workout/reference variant/log/recap at 360,390,760,761,1366×768,1440×900,1920×1080, plus 200% text and touch/hybrid. Assert no horizontal overflow, compact parent size/ellipsis, full desktop trail/header and unchanged explicit href/data/draft/viewed ref; focused desktop navigation that becomes hidden transfers to a visible parent/heading. Verify resize does not issue a route-data reload or clear cached Home extent. Check tooltips/menus close if their anchors leave and root gestures remain disabled on nested pages, typing, dialogs and reorder.

  ```js
  await page.getByRole('link',{name:'Back to Home',exact:true}).click();
  await expect(page.getByRole('button',{name:'Resume workout',exact:true})).toBeVisible();
  expect((await (await page.request.get('/api/workouts/active')).json()).record.id).toBe(log.id);
  await expect.poll(() => page.evaluate(() => Math.abs(scrollY-rememberedScroll))).toBeLessThanOrEqual(2);
  ```
- [ ] **Step 2: Run `npx playwright test e2e/nested-mobile-navigation.spec.js e2e/workout-home.spec.js e2e/workout-recap.spec.js e2e/workout-offline.spec.js e2e/workout-logger.spec.js`.** Expected RED only if these new integration cases reveal a gap: ordinary Back resetting Home scroll, a missing recap parent or changed ownership. If already correct after Tasks 1–4, record the passing baseline honestly; no artificial implementation change is needed.
- [ ] **Step 3: Correct only a demonstrated integration gap in its owning function.** Keep `exitWorkout` and mirror/controller lifetimes intact; no generic router rewrite, new back stack or migration. Update only mobile tests/helpers that previously clicked now-hidden tabs. Keep root history replacement, Home re-tap without remount/request, restore-before-scroll and pending-finish deduplication assertions.
- [ ] **Step 4: Run required completion checks sequentially:** `npm test`, `npm run test:e2e`, `npm run build`, then `git diff --check`. Expected GREEN: all tests pass, static build succeeds and diff check has no output. The full browser run includes mobile navigation/layout/latency/page-memory/swipe/save-control, breadcrumbs, Home/history, Focus, recap, offline, desktop library and editor suites. Do not run migrations or seed commands. Inspect populated screenshots and interaction/motion at the sizes above; record exact commands, actual results, artifact paths and any pre-existing/unresolved failures in the evidence document. Keep phone safe-area/keyboard/momentum and deployed verification explicitly `pending (user)`/not deployed. If the separate Focus plan is already integrated, repeat the actual-app 660px test with its direct overview footer and same surviving viewed set.
- [ ] **Step 5: Update documentation to the final implemented contract and commit.** Add the new AGENTS rule above older mobile tab/breadcrumb rules and state exactly which rules it supersedes; update the design-system mobile-tab, Breadcrumbs, active-workout bar, Focus geometry and recap wording (remove the old recap claim that tabs stay). Evidence must distinguish automation, browser layout/motion inspection, pending physical checks and deployment status. Do not mark this feature implemented before these checks succeed. Run `git add e2e/nested-mobile-navigation.spec.js e2e/workout-home.spec.js e2e/workout-recap.spec.js e2e/workout-offline.spec.js e2e/workout-logger.spec.js AGENTS.md docs/design-system/README.md docs/superpowers/verification/2026-11-15-nested-mobile-navigation.md`, then `git commit -m "test: verify nested navigation restoration and workout ownership"`; include a demonstrated production fix only in its owning task's explicit path.

## Plan self-review

- Spec coverage: route matrix/query/fallback and ownership → Task 1; compact links/deep links/identity/modified clicks → Task 2; commit/load/error/guard/stale/auth/motion → Task 3; every reservation/inset/typing/Focus consumer → Task 4; workout ordinary/explicit exits, restoration, recap handoff, resize and final documentation → Task 5.
- Step scan: each task has concrete assertions, a RED command/expected failure, bounded implementation, GREEN command/expected outcome and an explicit scoped commit. Task 5 distinguishes already-passing integration behavior from a newly observed regression; no implementation result is claimed here.
- Interface consistency: `mobileParentFor`, `mobileParent`, optional `onGeometryChange()` and both `refreshGeometry()` methods are defined before callers; existing logger port and navigation-state interfaces survive.
- Review Focus: all five conditions map to named tests in their owning tasks; none is left to screenshot-only verification.
- Proportion: five independently reviewable deliverables; no product implementation bodies, new subsystem, dependency or execution approval flow. Actual phone behavior and deployment remain outside local verification.
