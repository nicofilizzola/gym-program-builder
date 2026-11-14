# Home and History Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On phones, move workout history into a section of Home below the cover, drop the History tab, and land every finished workout on Home.

**Architecture:** Two parts, built in order and released together. Part 1 adds a History section to Home: a new view (`src/home-history-view.js`) that reuses the history rows and is fed by the existing `createHistoryPageData` loader. The loader now reports page loads separately from refreshes. Part 2 changes mobile navigation: three destinations, a `#/home?section=history` entry for mobile `#/workouts`, a Home-tab re-tap that scrolls to the top, and one exit function that sends ended workouts to Home. The desktop Workouts page keeps its own markup and messages.

**Tech Stack:** Vanilla ES modules, plain CSS, IntersectionObserver, `node:test`, Playwright.

**Spec:** docs/superpowers/specs/2026-11-12-home-history-design.md. Read it with this plan; §1–§5 refer to it. It does not depend on plans 1 or 2.

## Decisions

- **Separate page-load state.** The loader publishes `loadingMore` and `moreError` beside `error`. On desktop, the app maps `error || moreError` to today's single message, so the Workouts page reads exactly as before.
- **Shared rows.** `historyRow` is extracted from `workout-history-view.js` and used by both views. Desktop markup is unchanged; Home passes `titleTag:'h4'` and renders day headings as `h3`.
- **Opening `#/workouts` on mobile.** `resolveEntryHash` maps it to `#/home?section=history`. The Home route sets `commit.canonicalHash = '#/home'` and a `commit.focus` that scrolls the History heading under the app header and focuses it, so the URL ends as `#/home` without an extra history entry.
- **Leaving a workout.** `exitWorkout()` in `app.js` calls `mobileNavigationState.forget('#/home')` and then navigates to `#/home` on mobile, or to `#/workouts` on desktop. That gives "Home at the top with only the first page" without a hidden flag. The workout controller takes `onExit` (default `() => navigate('#/workouts')`).
- **Auto-load stall.** IntersectionObserver only fires on changes, so after every render the view re-checks `canAutoLoad` with the last `nearEnd` value. A first page that doesn't fill a tall screen keeps loading until the end leaves the zone or no pages remain.
- **Two Retry buttons on one page.** Both cover and history can fail at once. The History Retry keeps the visible text `Retry` with the accessible name `Retry loading history`; the cover's Retry is unchanged.

## Global Constraints

- Changes apply at ≤760px only. Desktop keeps its four links, the Workouts page, its Start workout button, its markup and its messages.
- No server, schema, export, migration, prefetch, polling or persistence change. Page memory stays in memory and clears on auth changes. Cache keys `history:first` and `history:visible` are unchanged.
- Rows keep `.workout-history-row`, day grouping, the meta line and the `Not synced yet` pending row. On Home, day headings are `h3` and names `h4` under the `h2` `History`.
- Copy, exactly:
  - `History`
  - `Loading…`
  - `Workouts could not be loaded. Connect to see your history.`
  - `Couldn't refresh. Showing previously loaded data.`
  - `No workouts yet. Your finished workouts appear here.`
  - `Couldn't load older workouts.`
  - `Retry`
  - `Load more`
- Motion: the only motion added is the Home tab's scroll to the top (smooth, instant with reduced motion). Pages that load later and refreshes appear without animation.
- Targets ≥44px; status never by colour alone; tests at real browser heights.
- Change values in `style.css` first, then `docs/design-system/README.md`, and update `AGENTS.md` in Task 5.
- Never claim physical-device or production verification from localhost or emulation. Never claim a pending deployment was verified. Phone checks are recorded as user-confirmed or `pending (user)`.
- Commit on `main` after each task; messages end with the session's `Co-Authored-By` attribution line. Each task ends green on `npm test`; each part ends green on `npm test`, `npm run test:e2e` and `npm run build`. Do not deploy Part 1 without Part 2.

## Review Focus

1. A first page that doesn't fill a tall screen while more pages exist: loading continues until the list's end leaves the near-end zone or no pages remain; it never stalls with nothing to scroll. (Task 2)
2. Cover and history both failing offline: two Retry controls with distinct accessible names, each retrying only its own source. (Task 3)
3. Signing out and back in while on Home: no previous session's rows, loaded extent or scroll position. (Task 3)
4. A failed page on the desktop Workouts page: it still reads `Couldn't refresh. Showing previously loaded data.` (Task 1)
5. A desktop `#/workouts` page resized to 390px: it stays, the Home tab is current, and a swipe from it goes to Library. (Task 4)

---

# Part 1 — History on Home

### Task 1: The loader reports page loads separately

**Files:**
- Modify: `src/history-page-data.js` (`loadMore`, `refresh`, `publish`), `src/app.js:471` (desktop text mapping)
- Test: `test/history-page-data.test.js`, `e2e/workouts.spec.js`

**Interfaces:**
- Produces: published state `{phase, data, error, refreshing, pending, loadingMore: boolean, moreError: Error|null}`.
  - `loadMore()` sets `loadingMore` and publishes. On failure it sets `moreError` (never `error`) and does not retry by itself. A successful `loadMore()` or `refresh()` clears `moreError`.
  - A 401 still goes to `onAuthError`.

- [x] **Step 1: Failing unit tests** in `test/history-page-data.test.js`:
  - `'a failed page reports moreError and keeps the rows'`: the cache has `history:visible` `[a]` with `hasMore:true`. `listWorkouts()` resolves `{records:[a],hasMore:true}`, and with arguments it rejects `Error('offline')`. After `start`, `settled`, `tick` and `await loadMore()`, the last state has `phase:'ready'`, `error:null`, `moreError.message:'offline'`, `loadingMore:false` and records `['a']`.
  - `'one page request at a time, published while in flight'`: a pending page promise. After `loadMore()` (not awaited), the last state has `loadingMore:true`. A second `loadMore()` makes no second request (the call count stays 1). Resolving `{records:[b],hasMore:false}` gives `loadingMore:false`, `moreError:null` and records `['a','b']`.
  - `'a retried page clears its error'`: fail once, then resolve `[b]`. After the second `await loadMore()`, `moreError` is `null`.
- [x] **Step 2:** Run `node --test test/history-page-data.test.js`. Expected: FAIL (no `moreError`; the failure lands in `error`).
- [x] **Step 3:** Implement. In `app.js:471` the desktop/History mapping uses `state.error || state.moreError` where it used `state.error`.
- [x] **Step 4: e2e guard** (Review Focus 4), in `e2e/workouts.spec.js` at the default desktop viewport: seed 45 finished logs as the existing paging test does, and abort requests whose URL contains `before=`. Clicking `Load more` shows `Couldn't refresh. Showing previously loaded data.` and keeps 30 rows.
- [x] **Step 5:** Run `npm test` and `npx playwright test e2e/workouts.spec.js`. Expected: PASS.
- [x] **Step 6:** Commit `feat(history): report page loads separately from refreshes`.

### Task 2: The Home History section view

**Files:**
- Create: `src/home-history-view.js`, `test/home-history-view.test.js`, `e2e/home-history-view.spec.js`
- Modify: `src/workout-history-view.js` (extract `historyRow`), `style.css` (new `.home-history` rules next to the Home rules ~53–79)

**Interfaces:**
- Consumes: the Task 1 state.
- Produces:
  - `historyRow(item, {unsynced = false, titleTag = 'h3', onOpen, workoutHref, signal}): HTMLLIElement`, exported from `src/workout-history-view.js`. Desktop markup is unchanged.
  - `canAutoLoad({nearEnd, phase, hasMore, loadingMore, moreError}): boolean`. True only for `nearEnd && phase === 'ready' && hasMore && !loadingMore && !moreError`.
  - `mountHomeHistory(root, {onOpen, workoutHref, onRetry, onLoadMore}): {setState(state): void, heading: HTMLHeadingElement, getNavigationState(): {visibleCount: number}, destroy(): void}`.
  - DOM: `section.home-history[aria-labelledby=home-history-title]` holding, in order:
    - `h2#home-history-title` `History` (`tabIndex=-1`);
    - the pending list;
    - `div.home-history-status`: a `p[role=status]` and a `Retry` button named `Retry loading history`;
    - the day groups (`h3` day, `ul.workout-history-list`);
    - `p.home-history-empty`;
    - `div.home-history-end`.

- [x] **Step 1: Failing unit test**, `'canAutoLoad needs the end near, a ready list, more pages and nothing pending'`: true for `{nearEnd:true,phase:'ready',hasMore:true,loadingMore:false,moreError:null}`; false when any one of `nearEnd:false`, `phase:'loading'`, `hasMore:false`, `loadingMore:true` or `moreError:Error()` is set.
- [x] **Step 2: Failing e2e** in `e2e/home-history-view.spec.js`. Mount the view in the page at 390×844 (the `workout-home-view.spec.js` pattern), with `window.calls` counting `onRetry` and `onLoadMore`.
  - `'states read in the section'`:
    - loading without data → `Loading…`, no Retry;
    - error without data → `Workouts could not be loaded. Connect to see your history.` plus `Retry loading history`, and clicking it counts one `onRetry`;
    - error with data → the rows plus `Couldn't refresh. Showing previously loaded data.`;
    - ready with no rows and no pending → `No workouts yet. Your finished workouts appear here.`;
    - error or loading never shows the empty text;
    - a pending row comes first with `Not synced yet`, followed by the status line.
  - `'headings nest under History'`: the `h2` is `History`, day headings are `h3`, workout names are `h4` links, and every row has `.workout-history-row`.
  - `'the end of the list'`: `loadingMore:true` → `Loading…` (`role=status`). `moreError` → `Couldn't load older workouts.` and `Retry`, which calls `onLoadMore`. `hasMore` and idle → a `Load more` button that calls `onLoadMore`. No more pages → nothing after the rows.
  - `'scrolling near the end loads once at a time'`: 30 rows with `hasMore`. Scroll to the bottom → 1 call. Setting `loadingMore:true` and scrolling again → still 1. A `moreError` state → no calls until Retry.
  - `'a short first page keeps loading on a tall screen'` (Review Focus 1): at 390×1400 with 3 rows and `hasMore`, one call on mount. Then `setState` with 6 rows and `hasMore` → a second call without any scroll. Then `hasMore:false` → no third.
  - `'focus stays on a row link across updates'`: focus row 2's link, then `setState` with one more record → the same href stays focused.
- [x] **Step 3:** Run `node --test test/home-history-view.test.js` and `npx playwright test e2e/home-history-view.spec.js`. Expected: FAIL (module missing).
- [x] **Step 4: Implement.**
  - `mountHomeHistory` renders from the state with `historyRow(…,{titleTag:'h4'})` and `groupByLocalDate`. It keeps the focused href as `mountWorkoutHistory.render` does.
  - The IntersectionObserver on `.home-history-end` uses `rootMargin:'0px 0px 100% 0px'` and keeps `nearEnd`. After each observer callback and each render, it calls `onLoadMore()` when `canAutoLoad` holds.
  - `getNavigationState` returns `{visibleCount: records.length}`.
  - Desktop `mountWorkoutHistory` switches to `historyRow` with no visible change (`e2e/workouts.spec.js` stays green).
- [x] **Step 5: CSS.**
  - `.home-history {padding:8px 4px 0}`.
  - `.home-history h2 {margin:0 0 8px;font:600 20px/1.2 var(--font-body);text-transform:none;scroll-margin-top:var(--home-shell-height)}`.
  - Day `h3` reuses `.workout-history-day`; rows reuse the History row rules.
  - `.home-history-end {min-height:44px;display:grid;place-items:center}`; its button and Retry are ≥44px.
- [x] **Step 6:** Run `npm test`, `npx playwright test e2e/home-history-view.spec.js e2e/workouts.spec.js`. Expected: PASS.
- [x] **Step 7:** Commit `feat(home): a History section view that loads as you scroll`.

### Task 3: History on the Home page

**Files:**
- Modify: `src/workout-home-view.js` (wrap the first screen, add the history host), `src/app.js:498–506` (Home route mounts the loader and the section), `style.css:53–58`
- Test: `e2e/workout-home.spec.js`, `e2e/workout-home-view.spec.js:14`

**Interfaces:**
- Consumes: `mountHomeHistory`, `createHistoryPageData`, `mobileNavigationState.readPage('#/home')`.
- Produces: `mountWorkoutHome` returns `historyHost: HTMLElement` (a `div.home-history-host` after the feedback). Heading, cover, alternative and feedback move into `div.home-first`. The Home route's `mounted` gains `getNavigationState()` and forwards `suspend`/`settled`/`destroy` to both the controller and the loader.

- [x] **Step 1: Failing e2e** in `e2e/workout-home.spec.js` (real app, `login`, `resetWorkouts`, `saveFinishedLog`):
  - `'History sits under the cover with a peek'`: at 390×844 with three finished logs, the History `h2` lies fully above the tab bar's top and the first row's top lies above the tab bar's top, so it is cut. At 360×660 the cover is ≥340px tall. At 200% text the cover is ≥340px and the page scrolls to every row.
  - `'older workouts load as you scroll'`: 45 finished logs; scrolling to the bottom gives 45 rows, and then no `Load more` and no `Loading…`.
  - `'returning restores history and scroll'`: load 45, scroll row 40 into the middle, open it, go back. 45 rows, and row 40's top is within 2px of where it was.
  - `'history and cover fail independently'` (Review Focus 2): with `/api/workouts` list requests aborted, the section shows its load error and `Retry loading history` while the cover's primary action stays enabled. With every API request aborted, both Retry controls exist with different accessible names, and `Retry loading history` re-requests only the list (one new `/api/workouts?` request, no settings or programs request).
  - `'a new session never sees the old history'` (Review Focus 3): on Home with rows, scroll down, log out and log in as the same user after `resetWorkouts`. Home shows the empty text and `scrollY` is 0.
  - In `e2e/workout-home-view.spec.js:14`, the view still renders no rows: mounting the view alone leaves `.home-history-host` empty.
- [x] **Step 2:** Run `npx playwright test e2e/workout-home.spec.js`. Expected: FAIL (no History section).
- [x] **Step 3: View.** Wrap the first screen in `div.home-first`, append `div.home-history-host` and return `historyHost`.
- [x] **Step 4: Route.**
  - In the `home` branch, create the loader exactly as `prepareMobileHistory` does: `isCurrent`, `pendingSummary`, `onAuthError` and the `interacted` listeners.
  - Mount `mountHomeHistory(view.historyHost, {onOpen, workoutHref, onRetry: () => data.refresh(), onLoadMore: () => data.loadMore()})`.
  - `onState` calls `historyView.setState(state)`. On the first data, unless the user interacted, scroll to `readPage('#/home')?.scrollY`.
  - Start with `data.start({visibleCount: saved?.state?.visibleCount ?? 0})`.
- [x] **Step 5: CSS.**
  - `:root {--home-history-peek:72px}`.
  - `.workout-home` drops its `min-height`.
  - `.home-first {display:flex;flex-direction:column;gap:12px;min-height:calc(100dvh - var(--home-shell-height) - var(--tab-bar-height) - 8px - var(--home-history-peek))}`; the cover keeps `flex:1 0 auto;min-height:340px`.
  - Measure at 390×844. If the first row is fully hidden or fully shown, adjust the peek token until the heading is whole and the first row is cut, and record the value in the Task 5 verification file.
- [x] **Step 6:** Run `npm test` and `npx playwright test e2e/workout-home.spec.js e2e/workout-home-view.spec.js e2e/home-history-view.spec.js e2e/mobile-page-memory.spec.js`. Expected: PASS. `mobile-page-memory` still passes, because the History tab is still there until Task 4.
- [x] **Step 7:** Commit `feat(home): show workout history under the cover`.

---

# Part 2 — Mobile navigation

### Task 4: Three tabs, `#/workouts` opens Home at History, Home tab scrolls to the top

**Files:**
- Modify:
  - `src/mobile-navigation-state.js` (`MOBILE_DESTINATIONS`, `destinationFor`, `roots`)
  - `src/router.js` (`resolveEntryHash`, `parseRoute` for `home`)
  - `src/mobile-navigation.js` (desktop selection, arrangement, re-tap)
  - `src/mobile-page-transition.js:22` (loading labels)
  - `src/app.js` (Home route: `section` → `canonicalHash` and `focus`)
  - `style.css:2387,2394` (hide the Workouts tab on mobile; three columns)
- Test:
  - `test/mobile-navigation-state.test.js`, `test/router.test.js`
  - `e2e/mobile-navigation.spec.js`, `e2e/mobile-library-navigation.spec.js:7`, `e2e/mobile-destination-swipes.spec.js`, `e2e/mobile-page-memory.spec.js`, `e2e/workout-home.spec.js:20–24`
  - `e2e/workout-focus-integration.spec.js` (History link → Home link at lines 8, 9, 19, 26, 36, 66), `e2e/workout-picker-latency.spec.js:8,28,42`, `e2e/root-cache-refresh.spec.js:100`, `e2e/mobile-save-controls.spec.js:38`, `e2e/workout-start-sheet.spec.js:282,335,349,361`, `e2e/workout-warmups.spec.js:88,101`

**Interfaces:**
- Produces:
  - `MOBILE_DESTINATIONS = ['home','library','user']`.
  - `destinationFor` maps `workouts` and `workout` to `'home'`.
  - `resolveEntryHash('#/workouts', {mobile:true}) === '#/home?section=history'`.
  - `parseRoute('#/home?section=history')` deep-equals `{view:'home', section:'history'}`; any other query gives `{view:'home'}`.
  - New e2e helper `openStartSheet(page)` in `e2e/workout-helper.js` clicks Home's visible `Choose another workout` or `Choose a workout`.

- [x] **Step 1: Failing unit tests.**
  - `test/mobile-navigation-state.test.js`: `#/workouts/w` and `#/workouts` map to `'home'`. `adjacentDestination('library','next')==='user'`, `adjacentDestination('user','previous')==='library'`, and `MOBILE_DESTINATIONS` deep-equals `['home','library','user']`.
  - `test/router.test.js`: the `resolveEntryHash` and `parseRoute` cases above. `resolveEntryHash('#/workouts')` and `resolveEntryHash('#/workouts/w',{mobile:true})` are unchanged, and `parseRoute('#/home')` still deep-equals `{view:'home'}`.
- [x] **Step 2:** Run `node --test test/mobile-navigation-state.test.js test/router.test.js`. Expected: FAIL.
- [x] **Step 3: Failing e2e** in `e2e/mobile-navigation.spec.js` (390×844):
  - `'three tabs and workout pages under Home'`: the visible links are `['Home','Library','User']` in three equal columns (±1px). On `#/workouts/{id}`, Home has `aria-current="page"`.
  - `'#/workouts opens Home at History'`: from Home, set `location.hash='/workouts'`. The URL becomes `#/home` with `history.length` up by exactly 1, the History `h2` is focused, and its top is within 2px of the app header's bottom. `page.goBack()` returns to the previous Home entry.
  - `'tapping Home on Home scrolls to the top'`: with 45 logs, scroll to 2000 and keep `window.homeNode = document.querySelector('.workout-home')`. Tap Home: `scrollY` polls to 0, the same `.workout-home` node is still mounted, no `/api/` request is made, and the Home tab is focused. Under `reducedMotion:'reduce'`, `scrollY` is 0 right after the tap.
  - `'a desktop Workouts page resized to a phone'` (Review Focus 5): at 1366×768 on `#/workouts`, resize to 390×844. The Workouts page stays, Home is current, and a `dragDestination` next lands on Library.
  - Desktop guard in `e2e/workouts.spec.js`: at 1366×768 the links are Programs, Templates, Catalog, Workouts, and Workouts is `aria-current` on `#/workouts/{id}`.
- [x] **Step 4:** Run `npx playwright test e2e/mobile-navigation.spec.js`. Expected: FAIL.
- [x] **Step 5: Implement.**
  - Destinations, router and the loading label map (drop `history`).
  - `arrange()` drops `workouts` from the mobile order. CSS hides `[data-nav=workouts]` at ≤760px and uses `grid-template-columns:repeat(3,minmax(0,1fr))`.
  - Desktop selection derives `workouts` from the route view (`workouts` and `workout`) instead of from `destinationFor`.
  - The nav click handler: on mobile, when the tapped link is `home` and the committed route's view is `home`, call `preventDefault()` and `scrollTo({top:0, behavior: reduced ? 'instant' : 'smooth'})`; no navigation.
  - The Home route with `route.section==='history'`: set `commit.canonicalHash='#/home'` and `commit.focus` to scroll the History heading into view (`block:'start'`, instant) and focus it. Skip the page-memory scroll restore for that visit.
- [x] **Step 6: Move the existing tests.**
  - Expected tab lists become `['Home','Library','User']`.
  - The swipe sequence becomes Home ↔ Library ↔ User, and the History-unavailable swipe case is deleted.
  - Page-memory tests use Home's History section (load more by scrolling; restore after User ↔ Home).
  - Links named `History` become `Home`.
  - Mobile tests that opened `#/workouts` to press Start workout use `openStartSheet(page)` from Home.
  - Mobile tests that open a finished workout from `#/workouts` open it from Home's `.home-history .workout-history-row a`.
- [x] **Step 7:** Run `npm test`, `npm run test:e2e`. Expected: PASS.
- [x] **Step 8:** Commit `feat(nav): three mobile tabs; Workouts opens Home at History`.

### Task 5: Workouts end on Home, and docs

**Files:**
- Modify: `src/mobile-navigation-state.js` (`forget`), `src/workout-controller.js` (`onExit` replaces the three `navigate('#/workouts')` at 155, 313, 318), `src/app.js` (`exitWorkout`; recap `onDone` at 390, delete at 403, controller creation at 86), `AGENTS.md`, `docs/design-system/README.md` (Home and mobile navigation entries)
- Create: `docs/superpowers/verification/2026-11-12-home-history.md`
- Test: `test/mobile-navigation-state.test.js`, `test/workout-controller.test.js`, `e2e/workout-recap.spec.js:48,79`, `e2e/workout-offline.spec.js:53–65`, `e2e/workout-history-edit.spec.js:157`, plus any test at ≤760px that expects `#/workouts` after Finish, Discard, Delete or Done

**Interfaces:**
- Produces:
  - `mobileNavigationState.forget(hash): void`.
  - `createWorkoutController({…, onExit = () => navigate('#/workouts')})`.
  - `exitWorkout(): Promise`: on mobile, `forget('#/home')` then `navigate('#/home')`; on desktop, `navigate('#/workouts')`.

- [x] **Step 1: Failing unit tests.**
  - `forget('#/home')` makes `readPage('#/home')` `null` and leaves other pages.
  - In `test/workout-controller.test.js`, `'a workout end leaves through onExit'`: with an `onExit` spy, a legacy finish, a discard and the saved-copy-gone path each call it once and never `navigate('#/workouts')`. The existing `'legacy finish still flushes and navigates to History'` keeps passing with the default.
- [x] **Step 2:** Run `node --test test/mobile-navigation-state.test.js test/workout-controller.test.js`. Expected: FAIL.
- [x] **Step 3: Failing e2e.**
  - `e2e/workout-recap.spec.js`, `'Done lands on Home at the top with the workout first'`: with enough logs to scroll, scroll Home to 800, then start the workout from Home; leaving Home saves that position. Finish it and press Done. The URL is `#/home`, `scrollY` is 0, and the first `.home-history .workout-history-row` contains the workout's name with its top above the tab bar's top. At 1366×768 the same flow lands on `#/workouts`.
  - `e2e/workout-offline.spec.js`: after an offline Finish on a phone, Home shows the `Not synced yet` row first, then the section's load error, and the cover's actions stay enabled. After reconnecting, the row loses the tag.
  - Delete in `e2e/workout-history-edit.spec.js:157` lands on `#/home` on a phone.
- [x] **Step 4:** Run those three files. Expected: FAIL.
- [x] **Step 5: Implement** `forget`, `onExit` and `exitWorkout`, and wire the recap's Done, Delete and the controller.
- [x] **Step 6:** Run `npm test`, `npm run test:e2e`, `npm run build`. Expected: PASS.
- [x] **Step 7: Docs.**
  - `AGENTS.md`: add a top section `## Home and history (2026-11-12)` naming the spec, this plan and the verification file, with the spec's rules (§1–§3).
  - Rewrite the replaced phrases the spec's table lists:
    - in "Mobile training home": "never a history section" and "`#/workouts` remains history";
    - in "Mobile Library navigation": the four destinations, the swipe order and the offline Finish exception;
    - in "Fluid root navigation": the History extent and the pinned status for this section.
  - Mirror them in the design system's Home and mobile navigation entries (three-column tab bar, `--home-history-peek`, the History section).
- [x] **Step 8: Verify and record.** Inspect Home populated with a recommendation, a Resume, an empty history and 45 workouts at 360, 390 and 412px, at 200% text, with reduced motion and with touch. Confirm 1366×768, 1440×900 and 1920×1080 are unchanged. Write the verification file with the commands and results, the peek value measured in Task 3, and `Phone checks` `pending (user)`: the peek, and scrolling past the cover.
- [x] **Step 9:** Commit `feat(home): workouts end on Home; document home and history`.

---

## Self-review

- **Spec coverage:**
  - §1 tabs and swipes → Task 4; workout pages under Home → Task 4; `#/workouts` → Task 4; workouts ending on Home → Task 5; the Home tab re-tap → Task 4; empty entry is unchanged.
  - §2 order, peek and rows → Tasks 2–3; empty text → Task 2; loading as you scroll → Tasks 1–2; returning → Task 3; motion → Task 4 (the only one); accessibility → Task 2.
  - §3 independent sources → Task 3; section states → Task 2; offline Finish → Task 5; session memory → Tasks 3 and 5; desktop → Tasks 1 and 4.
  - §4 → the two parts. §5 → each task's tests plus Task 5's verification.
- **Names:** `loadingMore`, `moreError`, `historyRow`, `canAutoLoad`, `mountHomeHistory`, `historyHost`, `forget`, `onExit`, `exitWorkout`, `section:'history'`, `--home-history-peek` and `Retry loading history` keep one spelling and one signature throughout.
- **Known gaps:**
  - The 72px peek is a starting value that Task 3 measures.
  - IntersectionObserver near-end timing and the Home tab's smooth scroll are verified in emulation only.
  - The feel of scrolling past the cover can only be confirmed on the user's phone.
