# Mobile Library Navigation and Swiping Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. The user must review this plan and choose an execution method before implementation; do not dispatch agents without that choice.

**Goal:** Replace the mobile utility header and five-tab bar with Home, Library, History and a full-page User destination, with responsive save feedback and horizontal swipe navigation.

**Architecture:** Keep existing canonical routes and live view/controller ownership. Introduce a small navigation-state model, shell controls, a gesture recognizer and a visual transition layer; send accepted swipes through the existing guarded navigation transaction. Restore list state explicitly and use inert visual previews instead of retaining multiple live pages.

**Tech Stack:** JavaScript ES modules, native DOM/CSS and Web Animations, Node 24, node:test and existing Playwright. No new runtime dependencies or backend/schema changes.

**Spec:** `docs/superpowers/specs/2026-11-07-mobile-library-navigation-design.md`. Read the complete approved spec before this plan; it defines the product behavior and supersedes older mobile navigation requirements where they conflict.

## Global Constraints

- Apply the new shell at widths up to and including 760px.
- Keep the desktop navigation, Profile and Log out controls and desktop save-feedback placement.
- The ordered sequence is **Home ↔ Library ↔ History ↔ User**. Each gesture moves at most one destination. Stop at either end without wrapping.
- Existing roots remain `#/home`, `#/programs`, `#/templates`, `#/catalog`, `#/workouts`; add `#/user`. Empty mobile entry remains Home; desktop remains Programs. Explicit routes survive viewport changes.
- Library's labels are Programs, Templates and Exercises; its selector navigates by links and is shown on list roots only. User contains Training profile and Log out, with no modal semantics.
- Remember Library section, root scroll and relevant list state in memory only; clear state/previews on authentication changes. No new browser persistence, exports or server settings.
- Touch targets remain at least 44px. Preserve safe areas, typing-driven bar behavior, active-workout bar reservations and editor volume-panel positioning.
- Recognition defaults: 12px movement, horizontal distance greater than 1.5 times vertical distance; commit at 25% viewport width or at least 24px travel with release velocity at least 0.5px/ms in the travel direction. Leave 24px at both viewport edges to browser/system gestures.
- Settling is approximately 220ms ease-out; cancellation approximately 180ms. Reduced motion omits page/indicator translation and switches instantly after navigation succeeds.
- Root swipes only, touch only. Exclude editors, catalog details/Tags, Profile, loggers, open modals, controls, text selection, multitouch, typing, reordering and pending navigation/logout.
- A canceled swipe changes no route/history/selection/ownership/scroll. A successful swipe creates one navigation entry. Commit `aria-current` only after successful navigation.
- Previews are inert, hidden from assistive technology and free of duplicate IDs and live announcements. Never mount extra Home/logger controllers for previews.
- Preserve one live save-status region, existing recovery conditions, Home lifetime/request guards, first-page recommendation semantics, log ownership and offline sync. Never convert failed required loads into empty history.
- Reuse existing list views, editors, APIs and domain models. No database migration, data regrouping, export changes or new exercise-selection flow.
- Record local evidence separately from any pending deployment verification. This plan authorizes no deployment.

## Review Focus

- A slow destination response after browser Back, logout or a newer tap must not revive its view, preview or indicator; pin this in Tasks 6–8.
- A real browser can cancel touch pointers when it begins scrolling; vertical scrolling, browser edge navigation, zoom and nested controls must stay usable; pin this in Tasks 5 and 8 using real touch input.
- Rebuilding a heading or crossing 760px during a failed save must preserve live-region identity, focused recovery controls and typed values; pin this in Task 3.
- Returning to filtered Catalog or History after loading multiple pages must restore enough content before scroll, without polluting Home's first-page recommendations; pin this in Task 4.
- User logout failure and an unsynced active workout must preserve signed-in state, the mirror and controller ownership; pin this in Tasks 2 and 8.

## File map and dependencies

New production modules:

| File | Responsibility |
| --- | --- |
| `src/mobile-navigation-state.js` | Pure destination/route grouping and session-only last-section/page-state memory |
| `src/mobile-navigation.js` | Main navigation links, responsive presentation and interpolated indicator |
| `src/library-navigation.js` | Library root heading and section links |
| `src/user-view.js` | Full User page and guarded action callbacks |
| `src/save-controls-host.js` | Relocate the existing feedback nodes into explicit view slots |
| `src/swipe-gesture.js` | Pure gesture recognition and release decision |
| `src/mobile-swipe.js` | Touch DOM input, exclusions and gesture lifecycle |
| `src/mobile-page-transition.js` | Inert visual previews, drag/settle animation and cleanup |

Modify `src/router.js`, `src/app.js`, `index.html`, `style.css`, the slot-providing editor/Profile/logger views, and Catalog/History state interfaces. Keep domain repositories, APIs and workout controllers intact. Relevant test files are named per task below; existing mobile-navigation assumptions must be updated when their behavior changes, not hidden behind compatibility shims.

Execution is sequential: 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9. Task 4 consumes Task 1's memory; Task 6 consumes Task 2's indicator; Task 7 connects the previously tested pieces. At execution time, use `using-git-worktrees` to establish isolation, preserve unrelated changes and run `npm.cmd test` once as the baseline. Do not create an implementation worktree merely to write this plan.

### Task 1: Model the four destinations and route memory

**Files:** Create `src/mobile-navigation-state.js`, `test/mobile-navigation-state.test.js`; modify `src/router.js`, `test/router.test.js`.

**Interfaces:** Export `destinationFor(hash) -> 'home'|'library'|'history'|'user'|null`, `isSwipeRoot(hash) -> boolean`, `adjacentDestination(destination, direction) -> Destination|null` (`direction` is `previous|next`), and `createMobileNavigationState()`. The state instance exposes `href(destination)`, `commit(hash)`, `readPage(hash) -> {scrollY,state}|null`, `writePage(hash,{scrollY,state})`, and `clear()`. `commit` remembers the matching Library root after successful navigation into its root or descendants. `writePage` stores structured-cloned JSON-compatible view state for root routes only; reads return copies. `href('library')` defaults to `#/programs`; other destinations use their fixed root. `parseRoute('#/user')` returns `{view:'user'}`.

- [ ] **Step 1:** Add named unit cases `groups nested routes without making them swipe roots`, `library changes only on commit`, `adjacency stops at both ends`, `page memory copies values and clears on auth change`. Assert these exact examples:

```js
assert.deepEqual(parseRoute('#/user'), {view:'user'});
assert.equal(destinationFor('#/catalog/tags?kind=focus'), 'library');
assert.equal(destinationFor('#/profile'), 'user');
assert.equal(destinationFor('#/workouts/log-1'), 'history');
assert.equal(isSwipeRoot('#/profile'), false);
assert.equal(isSwipeRoot('#/catalog'), true);
assert.equal(adjacentDestination('user','next'), null);
assert.equal(adjacentDestination('home','previous'), null);
```

- [ ] **Step 2:** Run `node --test test/router.test.js test/mobile-navigation-state.test.js`; expect the new assertions/import to fail because the route/model is absent.
- [ ] **Step 3:** Implement those interfaces. Use parsed route views, not prefix slicing, to group destinations; unknown/malformed routes map to null. Remember Catalog for catalog descendants and Templates for template descendants; a program occurrence belongs to Programs. Keep every existing route/default intact. `clear()` resets Library to Programs and empties page memory.
- [ ] **Step 4:** Run the same command; expect all cases to pass, including existing malformed-route and entry-default assertions.
- [ ] **Step 5:** Commit only this task's files with message `feat: model mobile navigation destinations`.

### Task 2: Add Library navigation and the full-page User destination

**Files:** Create `src/mobile-navigation.js`, `src/library-navigation.js`, `src/user-view.js`, `e2e/mobile-library-navigation.spec.js`; modify `index.html`, `style.css`, `src/app.js`, `e2e/mobile-navigation.spec.js`, `e2e/workout-home.spec.js`. Update mobile-only Profile/navigation locators in existing suites as they become affected.

**Interfaces:** `mountMobileNavigation(nav,{state,onNavigate}) -> {commit(hash),preview({from,to,progress}),resetPreview(),destroy()}`; `preview` affects only a decorative indicator and never changes `aria-current`. `mountLibraryNavigation(host,{hash,onNavigate}) -> {destroy()}` prepends the mobile-only root heading/section links without replacing content. `mountUserView(root,{onNavigate,onLogout}) -> {destroy()}` renders heading User, a native Training profile link and a separate Log out button; await logout and re-enable on rejection/decline. Shared app-level `logout() -> Promise<boolean>` returns false for a declined leave and propagates an API failure.

`from` and `to` are Task 1 destination names; progress is clamped to 0–1. Navigation `commit(hash)` calls state `commit(hash)` and updates the current visible link/Library href; `resetPreview()` returns the indicator to that committed link. Main navigation stays the same native nav element across responsive changes.

- [ ] **Step 1:** Add browser cases `four mobile destinations are links`, `Library selects each canonical section`, `User is a full page`, `desktop retains original navigation`, `logout failure preserves session and mirror`. At 390px assert visible Main link labels exactly `['Home','Library','History','User']`, `User.href` ends with `#/user`, User has no `aria-expanded`, and the User route has no dialog/backdrop. Assert Library section links have Programs/Templates/Exercises labels, correct URLs and one current section.

```js
await expect(page.getByRole('navigation',{name:'Main'}).getByRole('link').filter({visible:true})).toHaveText(['Home','Library','History','User']);
await expect(page.getByRole('heading',{name:'User',exact:true})).toBeVisible();
await expect(page.getByRole('link',{name:'Training profile',exact:true})).toHaveAttribute('href','#/profile');
```
- [ ] **Step 2:** Run `npm.cmd run test:e2e -- e2e/mobile-library-navigation.spec.js`; expect new navigation/User assertions to fail.
- [ ] **Step 3:** Implement the modules and static navigation entries. Use existing Home/history/profile icons and the existing template icon for Library. Retain the existing four desktop links and hide mobile-only links above 760px; mobile has four grid columns. Handle modified link clicks natively. Set visible links' current state from Task 1. Make `preview` interpolate one shared indicator using measured link geometry; keep committed text colors until `commit` and remove the old duplicate per-link indicator on mobile.
- [ ] **Step 4:** Wire `#/user` into `prepareRoute`, mount the selector only on the three list roots and share the exact logout transaction with the desktop button: `leave()` → `workouts.flush()` → `api.logout()` → signed-out marker → controller/queue/view cleanup → login. Do not run later cleanup after an earlier failure. Add the mobile Profile → User breadcrumb. Keep explicit User URLs usable on desktop. Clean up selector and User handlers with the owning view.
- [ ] **Step 5:** Update the existing center-Home/order assertions and mobile locators to the approved navigation. Do not change desktop expectations or globally redefine a desktop login helper. Run `npm.cmd run test:e2e -- e2e/mobile-library-navigation.spec.js e2e/mobile-navigation.spec.js e2e/workout-home.spec.js e2e/library-navigation.spec.js e2e/profile.spec.js`; expect pass for the new hierarchy, existing desktop controls and active-workout behavior.
- [ ] **Step 6:** Commit with message `feat: group mobile Library and add User page`.

### Task 3: Integrate shared save feedback into mobile page headings

**Files:** Create `src/save-controls-host.js`, `e2e/mobile-save-controls.spec.js`; modify `index.html`, `style.css`, `src/app.js`, `src/session-markup.js`, `src/session-editor.js`, `src/program-view.js`, `src/profile-view.js`, `src/workout-logger-view.js`. Check `src/workout-home-view.js` and `src/exercise-picker.js` geometry consumers; change only calculations broken by the collapsed mobile utility row.

**Interfaces:** `mountSaveControlsHost({controls,desktopHost,mobileFallback,media}) -> {setSlot(slot),park(),destroy()}` moves one existing `[data-save-feedback]` wrapper containing status/Retry/Reload/copy nodes; desktop Profile/logout stay outside it. Editor, Program, Profile and logger mounts accept optional `onSaveStatusSlotChange(slot: HTMLElement|null)`. Call null synchronously before replacing/removing a heading, then supply its new slot. Logger additionally accepts `sharedSaveStatus=false`; finished editable logs use true, while active logging retains its controller-owned status and Retry.

- [ ] **Step 1:** Add browser cases `feedback identity survives resize`, `failed save remains recoverable after heading rebuild`, `finished logger uses one feedback surface`, `active logger keeps owned sync status`. Store status/Retry element references in the page, create 503 and 409 save responses, and assert reference identity, appropriate visibility and focus after 390→761→390px. Assert typed name/caret survive resize, only the applicable copy action appears, active logger has exactly one visible sync-status region, and Home has no Saved label.

```js
await expect(page.getByTestId('save-status')).toHaveText('Conflict');
await expect(page.getByRole('button',{name:'Reload saved version',exact:true})).toBeVisible();
await expect(page.getByRole('button',{name:'Save as copy',exact:true})).toBeVisible(); // program/template conflict
```
- [ ] **Step 2:** Run `npm.cmd run test:e2e -- e2e/mobile-save-controls.spec.js`; expect missing slots/mobile header behavior to fail.
- [ ] **Step 3:** Split feedback from desktop account controls in markup; implement the host and explicit slots. `clearView()` parks controls before destroy. Invoke callbacks around every Program heading rebuild, including its embedded editor path, and before a slot-owning view destroys itself. Transfer a focused recovery node with focus/caret preservation; do not move unrelated focused inputs. If a mobile slot is temporarily absent while feedback exists, use the visible fallback near app content, not a hidden node. Hide the fallback when empty. Do not clone live regions or re-register action handlers.
- [ ] **Step 4:** Collapse the mobile utility row to zero height while retaining its fixed navigation. Keep desktop placement, safe areas, Home sizing, logger sticky geometry, review dock and picker anchors valid. In shared finished-log mode, omit the logger's unused owned-status/Retry surface. Preserve `saveStatus` messages and all recovery predicates; do not alter autosave or sync controllers.
- [ ] **Step 5:** Run `npm.cmd run test:e2e -- e2e/mobile-save-controls.spec.js e2e/recovery.spec.js e2e/navigation-transitions.spec.js e2e/workout-home-view.spec.js e2e/workout-logger.spec.js e2e/program-review-dock.spec.js`; expect pass. Include a failed destination preparation while Conflict is visible: original draft and Save as copy must remain usable.
- [ ] **Step 6:** Commit with message `feat: place mobile save feedback in page headings`.

### Task 4: Restore root-page state before restoring scroll

**Files:** Modify `src/app.js`, `src/catalog-view.js`, `src/workout-history-view.js`; create `e2e/mobile-page-memory.spec.js`; extend `e2e/catalog-loading.spec.js` and `e2e/workouts.spec.js` where the load contract changes.

**Interfaces:** Root views may expose `getNavigationState() -> JSON|null`. Catalog accepts `navigationState` with `{query,equipment,primaryMuscle,secondaryMuscle,exerciseType,showArchived,expanded,searchExpanded,searchSeen,filterKey}`; the last three lists/keys preserve deliberate disclosure choices during filtering. History exposes `{visibleCount}`. App wrappers forward this interface and Task 1 stores it with `window.scrollY`. Root restoration uses fresh successful data, not cached data presented as a successful fetch.

- [ ] **Step 1:** Add cases `Catalog restores filters and disclosures before scroll`, `History restores loaded extent without changing Home recommendations`, `failed required loads retain source`, `clearing auth clears page memory`. Seed enough finished logs for multiple API pages, Load more, record a visible row and scroll, visit User and return; assert the row exists and scroll is within 2px after layout settles. Filter/collapse a matching Catalog reference and assert both selections and disclosure survive a round trip.

```js
await expect(page.getByRole('searchbox',{name:'Search catalog'})).toHaveValue('curl');
await expect(page.getByRole('combobox',{name:'Equipment',exact:true})).toHaveValue(savedEquipment);
expect(Math.abs(await page.evaluate(()=>scrollY)-savedScrollY)).toBeLessThanOrEqual(2);
```

`savedEquipment` and `savedScrollY` are captured from that test's source page before departure; restore assertions run after the destination is no longer busy.
- [ ] **Step 2:** Run `npm.cmd run test:e2e -- e2e/mobile-page-memory.spec.js`; expect absent restoration behavior to fail.
- [ ] **Step 3:** Add the explicit view-state interfaces; snapshot state before a successful departure can destroy the source. Restore Catalog values before its initial render and discard no-longer-valid filter choices safely. For History, fetch the normal first page, then only enough pages to recover the saved visible count or exhaustion; deduplicate by log ID and retain the pending-finish dedup rule. Pass only the first fetched history page to start-sheet recommendation data. Clamp scroll naturally if content shrinks; do not retain live controllers or document drafts in memory.
- [ ] **Step 4:** Prepare required Catalog root data before committing cross-destination navigation; use `initialData` in `mountCatalog` to avoid a duplicate initial fetch. For failed required History/Catalog preparation, retain a mounted source and show the error. On a direct cold entry with no source, show an explicit failure/Retry surface; never render a successful empty history. Preserve optional start-sheet list errors and its Blank workout action. Restore scroll after initial content layout, with `preventScroll` heading focus; repeated successful list loads must not later reset it.
- [ ] **Step 5:** Run `npm.cmd run test:e2e -- e2e/mobile-page-memory.spec.js e2e/catalog-loading.spec.js e2e/workouts.spec.js e2e/workout-home.spec.js e2e/workout-start-sheet.spec.js`; expect pass, including network failures and changed/deleted rows on revisit.
- [ ] **Step 6:** Commit with message `feat: restore mobile destination list state and scroll`.

### Task 5: Recognize horizontal intent without taking over native gestures

**Files:** Create `src/swipe-gesture.js`, `src/mobile-swipe.js`, `test/swipe-gesture.test.js`, `e2e/mobile-swipe-input.spec.js`.

**Interfaces:** `createSwipeGesture({width,canPrevious,canNext}) -> {start(point),move(point),end(point),cancel()}`, where `point={x,y,time}` uses CSS pixels and milliseconds. `start -> boolean`; `move -> {phase,offset,direction,progress}` with phases pending/vertical/dragging/canceled and direction previous/next/null; `end -> {commit,direction,offset}`. `mountMobileSwipe(root,{enabled,canStart,begin,update,release,cancel}) -> {cancel(),destroy()}` adapts touch input: `begin(direction) -> boolean`, `update(offset)`, `release(result)`, `cancel()` are callbacks. `enabled` and `canStart(target)` are predicates supplied by app integration. No route mutation in either module.

- [ ] **Step 1:** Add unit cases for all numeric boundaries at width 400: 11px stays pending, horizontal 13/vertical 10 stays pending, 16/10 locks; 99px with a slow release cancels, 100px commits; a 23px flick cancels, 24px at 0.5px/ms commits; inward starts within either 24px edge strip reject. Assert vertical locking never later becomes horizontal, no next gesture from User, no previous from Home, canceled pointers never commit, and a returning drag ending near its source cancels despite earlier speed. Calculate velocity from the last 100ms, ignoring a release after a stationary pause rather than averaging the entire gesture.
- [ ] **Step 2:** Run `node --test test/swipe-gesture.test.js`; expect the missing recognizer to fail. Add browser fixture assertions that touching links, controls, horizontal scrollers, selected text and multitouch never calls `begin`, while a drag on a neutral content area does.
- [ ] **Step 3:** Implement the pure recognizer with the spec constants, clamped progress and per-gesture axis locking. Preserve the travel-direction requirement for flicks and clear all samples on cancel/restart. Implement a single touch-event path for touch gestures (avoid duplicate Pointer+Touch handling): a scoped non-passive `touchmove` prevents default only after horizontal lock; vertical/pending moves remain native. Do not put blanket `touch-action:none` on content. Handle `touchcancel`, additional fingers, visibility changes and teardown; ignore non-touch pointer input.
- [ ] **Step 4:** Build fixture tests with real Chromium CDP touch events, following `e2e/drag-reorder.spec.js`. Assert a vertical drag actually changes scrollY and creates no navigation request; a canceled horizontal drag releases the recognizer; an excluded horizontal scroller still scrolls. Keep synthetic-event tests only for deterministic exclusion/cleanup assertions.
- [ ] **Step 5:** Run `node --test test/swipe-gesture.test.js` and `npm.cmd run test:e2e -- e2e/mobile-swipe-input.spec.js`; expect pass. Check actual iOS Safari edge/scroll behavior during Task 9; Chromium emulation alone is not device evidence.
- [ ] **Step 6:** Commit with message `feat: recognize guarded mobile swipe gestures`.

### Task 6: Render inert swipe previews and synchronized transitions

**Files:** Create `src/mobile-page-transition.js`, `e2e/mobile-page-transition.spec.js`; modify `index.html`, `style.css`. Consume Task 2's `preview/resetPreview` API; do not replace `src/view-transition.js` or globally change its fade behavior.

**Interfaces:** `createMobilePageTransition({app,stage,navigation,media,reduced}) -> {capture(hash),begin({fromHash,toHash,direction,width}),update(offset),complete({commit,restore,focus,isCurrent}),rollback(),cancel(),clear(),destroy()}`. `capture` stores a decorative root snapshot plus viewport/scroll geometry; `begin -> boolean`; `complete -> Promise<boolean>` runs synchronous `commit():void` once, awaits target state/scroll restoration via `restore():void|Promise<void>`, settles and calls `focus():void` only if `isCurrent():boolean` remains true. Recheck `isCurrent` before commit and after each await. `direction` uses previous/next and `update` takes signed CSS-pixel displacement. `rollback -> Promise<void>`. `cancel()` synchronously cancels effects/layers and restores source presentation; `clear()` also discards all snapshots. No route/history/data requests inside this module.

- [ ] **Step 1:** Add DOM-fixture cases `progress moves content and one indicator`, `unknown target shows labeled loading preview`, `cancel leaves live source untouched`, `supersession suppresses commit and focus`, `reduced motion creates no slide animation`, `snapshots have no semantic duplicates`. Assert at half-width drag the outgoing/incoming translations differ by one viewport width; overlay contains no IDs, live roles/regions, autofocus or tabbable controls; original input/status nodes stay connected and unchanged.

```js
await expect(page.locator('#mobile-page-stage')).toHaveAttribute('aria-hidden','true');
await expect(page.locator('#mobile-page-stage [id], #mobile-page-stage [aria-live]')).toHaveCount(0);
expect(await page.locator('#mobile-page-stage').evaluate(el=>el.inert)).toBe(true);
```
- [ ] **Step 2:** Run `npm.cmd run test:e2e -- e2e/mobile-page-transition.spec.js`; expect missing renderer behavior to fail.
- [ ] **Step 3:** Add an inert, aria-hidden fixed content-stage sibling outside `#app` and outside the navigation/workout-bar hosts. Render decorative outgoing and incoming clones in clipped viewport layers; account for page origin and each stored scroll position so scrolled content does not jump. Keep the original live source mounted below the overlay. Strip IDs, ID references, inline event attributes and live-region attributes from clones, including cloned control values/disclosures as needed for visual fidelity. Cached previews are visual only; first-visit preview says the destination name and Loading…. Store snapshots only for swipe roots in the current authenticated session; replace per-route entries and drop entries whose width no longer matches.
- [ ] **Step 4:** Implement finger tracking, 220ms completion and 180ms rollback, flat translations, anchored navigation and a single interpolated indicator. At completion, replace the loading/stale incoming preview with a snapshot of the newly committed target before settling. Use generation tokens so cancellation always resolves outstanding animation promises and removes effects. Preserve the live page's scroll/height until its actual commit. Reduced motion creates no translated clones or moving indicator. Clear stage transforms/overflow/pointer state after every path, including errors.
- [ ] **Step 5:** Run the same renderer suite; expect pass for cancellation, viewport change and destroy during an unfinished animation. Assert there is never a second live Home controller/logger mount and the workout bar remains outside translated layers.
- [ ] **Step 6:** Commit with message `feat: animate mobile destination previews`.

### Task 7: Connect swipe and tap transitions to guarded navigation

**Files:** Modify `src/app.js`, `src/mobile-navigation.js`, `src/mobile-swipe.js`, `src/mobile-page-transition.js` only where integration requires it; create `e2e/mobile-destination-swipes.spec.js`; extend `e2e/navigation-transitions.spec.js`.

**Interfaces:** Extend app-local `navigate(hash,{push=true,gesture=null}={}) -> Promise<{status:'committed'|'blocked'|'failed'|'superseded',hash}>`; existing callers may ignore the result. `gesture` carries `{fromHash,toHash,direction,offset,width}`. Forward a transition context to `renderRoute(version,{mobileTransition=null}={})`; root-to-root mobile taps create the same context with zero initial offset. Nested/section/desktop navigation keeps `createViewTransition(app)`. Task 6's `complete` owns the mobile visual swap; do not also run the opacity swap.

- [ ] **Step 1:** Add integrated cases `swipes commit each of four destinations`, `tap skips pages with correct direction`, `canceled swipe has no history side effect`, `held load keeps source and committed selection`, `failed load rolls back`, `Back and newer taps supersede load`, `logout clears preview memory`. Assert Home→Library→History→User and back; Library resolves to its remembered section; User contains Training profile and Log out; each successful gesture adds exactly one history entry and heading focus follows successful settlement.

```js
await expect(page).toHaveURL(/#\/user$/);
await expect(page.getByRole('navigation',{name:'Main'}).getByRole('link',{name:'User',exact:true})).toHaveAttribute('aria-current','page');
await expect(page.getByRole('heading',{name:'User',exact:true})).toBeFocused();
```
- [ ] **Step 2:** Run `npm.cmd run test:e2e -- e2e/mobile-destination-swipes.spec.js`; expect disconnected app gesture integration to fail.
- [ ] **Step 3:** Wire recognizer predicates to authentication, media, `isSwipeRoot(currentHash)`, `body.is-typing`, open native modals, `.sort-drag-host`, existing captures/selection and navigation/logout pending state. On accepted gesture, invoke `navigate` once. Source stays mounted until `prepareRoute` succeeds; renderer owns overlay only. Preserve `leave()`, routeVersion/mountedVersion checks and exact active-controller ownership. Do not invoke Home/start-sheet work to populate a preview. An accepted pending navigation ignores additional gestures; Main links and browser Back can still supersede it.
- [ ] **Step 4:** Make busy/idle transition-aware: the existing `busy()` cancels opacity animations but must not erase the accepted swipe's own overlay. Cancel any older pager context before creating a new one. Keep existing 250ms delayed Opening status and source view through required loads. Check the route token immediately before actual commit and immediately after every awaited transition; update remembered Library, current navigation and page-memory ownership only for the successful latest commit. Failure restores the source URL, indicator and scroll; declined leave returns blocked. Do not create an extra history entry while settling or rolling back.
- [ ] **Step 5:** Cancel input/visual work on breakpoint changes and auth changes without redirecting explicit routes. On `showLogin` clear snapshots, page memory and remembered section, including 401 reauthentication paths; clear on successful logout too. Keep desktop Profile/logout and focus fallback usable when a focused mobile link becomes hidden. Browser hashchange/Back uses existing guarded routing; canceled pointer input must not cancel an unrelated newer route.
- [ ] **Step 6:** Run `npm.cmd run test:e2e -- e2e/mobile-destination-swipes.spec.js e2e/navigation-transitions.spec.js e2e/mobile-page-memory.spec.js e2e/mobile-library-navigation.spec.js`; expect pass. Include a pending Library request followed by History/User tap, release stale response and assert final route, heading, indicator and ownership remain at the last intent.
- [ ] **Step 7:** Commit with message `feat: connect four-page mobile swipe navigation`.

### Task 8: Pin interaction and ownership regressions

**Files:** Extend `e2e/mobile-destination-swipes.spec.js`, `e2e/mobile-navigation.spec.js`, `e2e/mobile-save-controls.spec.js`, `e2e/workout-home.spec.js`, `e2e/workout-offline.spec.js`; adjust affected mobile locators in `e2e/active-program.spec.js`, `e2e/workout-start-sheet.spec.js`, `e2e/workout-start.spec.js`, `e2e/workout-final-fixes.spec.js`, `e2e/workout-history-edit.spec.js` only where tests actually use removed Main links. Reuse `e2e/workout-helper.js` and `e2e/confirmation-helper.js`.

- [ ] **Step 1:** Add named regressions `active mirror survives attempted root swipes offline`, `Profile dirty edit declines User navigation`, `resize during drag keeps explicit route`, `auth changes reject pending commits`, `root gestures leave editor and sheet input alone`. With the network offline, an attempted Home→Library navigation whose required request fails must remain on Home with Resume and its mirror intact; cached decorative previews cannot authorize offline list navigation. Restore the network before exercising a successful four-page swipe cycle. Assert Home suppresses the workout bar only while its live controller owns that reservation, Library/History/User restore the floating bar, and mirror/log ID/set edits remain unchanged. Keep pending-finish dedup and first-page recommendations intact.
- [ ] **Step 2:** Add real-touch checks for scrolling Catalog/History, dragging from a link/control, interacting with the start sheet and reordering exercises. Add reduced-motion cases with zero translated overlays/animations and keyboard-only access to every destination/action. At 200% root font size assert all four labels and recovery actions are reachable without horizontal document overflow.
- [ ] **Step 3:** Run `npm.cmd run test:e2e -- e2e/mobile-destination-swipes.spec.js e2e/mobile-swipe-input.spec.js e2e/mobile-navigation.spec.js e2e/mobile-save-controls.spec.js e2e/workout-home.spec.js e2e/workout-offline.spec.js e2e/workout-start-sheet.spec.js e2e/drag-reorder.spec.js e2e/profile.spec.js`. If a new regression fails, diagnose its ownership/gesture cause before a targeted fix; do not weaken the test to match an unintended behavior.
- [ ] **Step 4:** Audit mobile suites for old Programs/Templates/Catalog Main-link selectors using `rg -n 'getByRole.*(Programs|Templates|Catalog|Profile)|data-nav|center Home' e2e`. Update only scenarios actually running on mobile to navigate through Library/User. Keep test intent, desktop labels and existing isolated view fixtures intact. Check existing full-suite failures against the baseline rather than treating every historical fixture mismatch as caused by this work.
- [ ] **Step 5:** Repeat only affected focused checks after any fixes and commit with message `test: cover mobile swipe and workout lifecycle regressions`.

### Task 9: Verify the complete change and record evidence

**Files:** Create `docs/superpowers/verification/2026-11-07-mobile-library-navigation.md` and screenshot assets in `docs/superpowers/verification/assets/mobile-library-navigation/`; update the top of `AGENTS.md` with the implemented rules and links only after verification. Update this plan's checkboxes and spec status truthfully.

- [ ] **Step 1:** Run `npm.cmd test`, `npm.cmd run build` and `git diff --check`; expect zero unit failures, `Built public assets.`, and no whitespace errors. Confirm the new modules are copied under `public/src` by the existing recursive build. No database migration is needed or authorized.
- [ ] **Step 2:** Run `npm.cmd run test:e2e` once after focused suites pass. The existing Playwright config runs one worker against `node scripts/dev-server.js --test` at port 3199 and defaults to reduced motion; animation suites must explicitly request no-preference. Record actual pass/fail counts and resolve regressions introduced here. A failure is pre-existing only if reproduced against the unmodified base under the same environment; older verification documents alone do not establish that. Do not claim the full suite passes if it does not.
- [ ] **Step 3:** Inspect screenshots at 360×800, 390×844, 760×900, 761×900 and 1440×900, plus 390px at 200% root font size. Capture Home, all three Library sections, History, User, Profile, template/program editing, an active logger and a save conflict. With normal motion capture mid-drag/rollback and verify content/indicator alignment, no clipping or duplicate indicators, and stable workout-bar/panel geometry. Use the existing design/UI skills for the visual inspection and fix only demonstrated issues.
- [ ] **Step 4:** Manually check actual iOS Safari and Android Chrome where available: native vertical scroll, screen-edge Back, pinch zoom, diagonal drags, quick flicks, interrupted gestures, keyboard/typing bars and reduced motion. If device/browser access is unavailable, list that limitation explicitly; CDP touch emulation is supporting local evidence only. Tune thresholds/durations only from observed behavior and update spec/tests for any deliberate adjustment.
- [ ] **Step 5:** Record commands, results, screenshots, ownership checks, browser/device coverage and limitations in the verification doc. Add the new AGENTS.md section documenting four destinations, full-page User, Library canonical routes, root-only swipe scope, heading save feedback and preserved desktop/offline behavior. Request whole-change code review using `requesting-code-review` under the execution method chosen by the user; address concrete findings and rerun the affected checks.
- [ ] **Step 6:** Commit evidence/docs with message `docs: record mobile Library navigation verification`. Report the implementation outcome and any remaining release checks. Use the finishing-branch workflow for integration only after the work is actually verified; never imply a deployment happened.

## Plan self-review and handoff

Coverage: Task 1 owns route grouping/memory; Task 2 owns Library/User and desktop compatibility; Task 3 owns feedback and geometry; Task 4 owns root restoration and required-load behavior; Tasks 5–7 own gesture recognition, inert motion and guarded integration; Tasks 8–9 own lifecycle, accessibility, visual/device verification and evidence. The five Review Focus conditions each have explicit tests above. The existing `busy()` cancellation and first-page history preparation are integration constraints, not permission to replace workout/domain controllers.

Plan review and an execution-method choice are still required. Recommended: **Native**, because these tasks depend on the same routing/view-lifecycle boundaries and shared interfaces. One implementer can keep that context consistent, followed by whole-change review. **Subagent-driven** remains available if the user prefers fresh implementation and review per task. No implementation or delegation has started.
