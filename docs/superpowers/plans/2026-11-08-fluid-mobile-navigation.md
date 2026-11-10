# Fluid Mobile Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans for the user's preserved Native preference, or superpowers:subagent-driven-development if the user changes that choice. Steps use checkbox (`- [ ]`) syntax for tracking. Review this plan and its linked design before implementation; no agents or product changes are authorized by this planning task alone.

**Goal:** Make root swipes settle smoothly regardless of API latency, with useful cached content on return visits and honest first-load/error states.

**Architecture:** Separate guarded route acceptance, visual settlement and asynchronous data hydration. Add a bounded session resource cache and route-owned data sessions, adapt existing root views for stable updates, and load History's start-sheet dependencies on demand. Retain one live page/controller owner and the existing workout/offline authority.

**Tech Stack:** Existing vanilla JavaScript ES modules, native DOM/CSS, requestAnimationFrame, Node 24, node:test and Playwright. No runtime dependencies, schema changes or new endpoints.

**Spec:** `docs/superpowers/specs/2026-11-08-fluid-mobile-navigation-design.md`; supplements `2026-11-07-mobile-library-navigation-design.md`. The user accepted the recommendations and requested this plan; the detailed contract is ready for review, not an implementation claim.

## Global Constraints

- Mobile breakpoint is <=760px. Keep Home / Library / History / User, existing canonical routes and root-only touch gestures; desktop presentation and editor leave guards remain.
- Finger release starts settling immediately using the existing approximate 220ms ease-out; cancellation stays approximately 180ms. Data is not a condition for starting or completing motion. Reduced motion remains instant.
- Once settled, clear the gesture lock and allow another root navigation even if the target's data request is still pending.
- Delay the visible background `Updating...` indicator by 250ms. First-visit skeletons appear immediately. Cold failure stays on the target with Retry; refresh failure retains last successful content.
- Cache resources: programs, templates, catalog, settings, history first page and history visible extent. Successful empties are data; failed/unknown loads are not empties.
- Use memory only, scoped to the authenticated lifetime. No persistence, service worker, HTTP-cache change, prefetching, new offline creation, API or migration.
- Every root entry refreshes in the background. No TTL or polling loop is introduced. Invalidation/clear rejects obsolete responses and evicts known-invalid display data.
- Never cache active logs or Home recommendations as actionable page models. Preserve local Resume, pending-finish deduplication, first-page Up next and revision/conflict rules.
- Data arrival does not rerun the page-entry animation, steal focus, reset scroll or overwrite filters/IME composition. No extra live Home/logger instances or semantic previews.
- Keep native vertical scrolling, edge gestures, typing bars, safe areas, 44px targets, focus recovery and resize/Back/Forward behavior.
- Do not modify the separate Focus-view plan/implementation. Logger routes remain outside root swiping. At execution time re-read HEAD and current AGENTS.md because another feature is planned in the same repository.
- Network acceptance tests hold responses for at least 1,500ms and require settlement before release, within a 750ms allowance. Timing evidence is local, not a production-device guarantee.

## Review Focus

- A response resolving during a drag/settle must not synchronously mount a large Catalog or reset the indicator; Tasks 1, 3 and 8 test the render gate separately from fetch latency.
- A successful delete/save/active-program write racing an older GET must not resurrect stale data or undo the last intent; Tasks 2, 6 and 8 pin epochs and mutation ownership.
- A cold or stale failed History refresh must never invent empty scheduling history or overwrite the local pending finish; Tasks 5, 7 and 8 cover the first-page/visible-extent distinction.
- Background replacement of a focused row, Catalog draft or filter composition must preserve input and scroll, including removal of the focused record; Tasks 4–5 and 8 exercise these cases.
- Navigating away, logout/re-auth, resize or browser Back while hydration remains pending must neither re-lock the new page nor publish into its new auth/view lifetime; Tasks 2–3 and 8 cover this.

## File map and execution boundaries

| File | Responsibility |
| --- | --- |
| Create `src/root-resource-cache.js` | Successful data snapshots, deduplicated loads, resource/auth epochs and invalidation |
| Create `src/root-page-session.js` | View-owned loading/refresh/error state and post-settlement publication gate |
| Create `src/root-page-surface.js` | Lightweight root loading/error/status UI and first-content focus handoff |
| Create `src/history-page-data.js` | First-page/visible-extent refresh and pagination ownership |
| Create `src/root-cache-invalidation.js` | Successful-mutation resource classification and workout/auth subscriptions |
| Modify `src/app.js` | Guarded acceptance vs data preparation, root adapters, cache lifecycle and mutation wiring |
| Modify `src/mobile-page-transition.js`, `src/mobile-navigation.js` | Data-independent settlement and cached per-gesture indicator geometry |
| Modify `src/library-view.js`, `src/catalog-view.js`, `src/workout-history-view.js` | Update existing views without replacing controls or losing local state |
| Modify `src/api-client.js` | Optional successful-mutation observer; keep existing method contracts |
| Modify `src/workout-start-launcher.js`, `src/workout-start-sheet.js` | Non-blocking on-demand list loading and guarded list updates |
| Modify `style.css` and design/verification docs | Stable skeletons/status surfaces, motion contract and actual evidence |

Keep caches/read models out of `workout-sync.js` and persisted log documents. Reuse `catalog-store.js` for pickers; bridge root Catalog refreshes through its existing invalidation boundary rather than creating competing sources of truth.

Tasks execute sequentially with focused commits. Task 1 delivers a passing characterization of the current pause; Tasks 2–7 each use failing-then-passing tests. Establish isolation with `using-git-worktrees` at execution time, inspect new commits since this plan, read both specs, create the plan ledger and run one baseline. Do not start a worktree or implement while authoring this document. The Native workflow includes one independent whole-branch review after implementation.

### Task 1: Pin the network pause and distinguish rendering cost

**Files:** Create `e2e/mobile-navigation-latency.spec.js`; extend `e2e/mobile-swipe-helper.js` with controlled release support only if needed. Store traces/timing output in this plan's ignored execution workspace.

**Interfaces:** Reuse existing navigation links, `dragDestination`, CDP touch dispatch and route interception. Test helper `holdResponse(page,pattern) -> {requested,release}` holds only the intended GET; cleanup always releases it. Do not add production telemetry for this probe.

- [x] **Step 1:** Add a temporary characterization `current cold swipe waits for held destination data`: use normal motion, hold Programs GET, swipe Home→Library, and record that the stage is still visible after 750ms without releasing the request. Release it and assert eventual settlement. Task 3 replaces this characterization with the desired regression; it must not remain as a permanent requirement for the pause.

```js
await page.waitForTimeout(750); // Bounded diagnostic observation, not an application delay.
await expect(page.locator('#mobile-page-stage')).toBeVisible();
held.release();
await expect(page.locator('#mobile-page-stage')).toBeHidden();
```

- [x] **Step 2:** Run `npm.cmd run test:e2e -- e2e/mobile-navigation-latency.spec.js`; expect the characterization to pass against the current implementation. Record the actual stage/route state before and after release. If the expected pause does not reproduce, inspect the trace and current HEAD before choosing a fix.
- [x] **Step 3:** Capture one populated Catalog/History gesture with CDP 4x CPU throttling and delayed responses. Record finger-down-to-preview, release-to-settle and response-to-render independently. Existing snapshot cloning and per-frame link geometry are suspected secondary costs; inspect the trace before assigning a cause to a finger-down stall. Repeat without throttling for comparison; restore throttling afterward.
- [x] **Step 4:** Commit the passing characterization and reusable interception helper as `test: characterize network-gated mobile settlement`. Record the trace findings in the execution ledger. No implementation begins from production timing assumptions alone.

### Task 2: Add session resource data with race-safe invalidation

**Files:** Create `src/root-resource-cache.js`, `test/root-resource-cache.test.js`; extend `test/api-client.test.js` and `src/api-client.js` for the optional observer.

**Interfaces:** `createRootResourceCache({now=Date.now}={}) -> {read(key),load(key,loader),replace(key,value),invalidate(keys),subscribe(listener),clear()}`. Keys are the six literal resources in Global Constraints (`history:first`, `history:visible` for the two history entries). `read -> {value,updatedAt,epoch}|null` returns a data copy. `load -> Promise<{status:'accepted',snapshot}|{status:'superseded'}>` deduplicates only the same resource/auth epoch; successful empties are accepted. Rejections remain rejections. `replace` publishes a complete known value with a new resource epoch; `invalidate` removes known-invalid values and advances epochs; `subscribe` reports invalidation/clear only and returns unsubscribe. `clear` advances a separate auth epoch and clears pending ownership so an old request cannot refill a new session. `createApiClient({fetch,onMutation=()=>{}}={})` calls `onMutation({path,method,value,result})` after a successful non-GET, including 204, before resolving to its caller. Observer exceptions cannot turn a committed server write into a reported failed save.

- [x] **Step 1:** Add cases `deduplicates in-flight reads`, `successful empty is cached`, `failure is not empty`, `invalidate rejects old reads`, `replace wins over old GET`, `clear prevents cross-auth refill`, and `copies isolate view mutations`.

```js
assert.equal(cache.read('programs'),null);
assert.equal((await cache.load('programs',async()=>[])).status,'accepted');
assert.deepEqual(cache.read('programs').value,[]);
cache.invalidate(['programs']);
assert.equal(cache.read('programs'),null);
```

- [x] **Step 2:** Run `node --test test/root-resource-cache.test.js test/api-client.test.js`; expect missing cache/observer assertions to fail.
- [x] **Step 3:** Implement the interfaces. Add observer tests for PUT success, DELETE 204, rejected 409 and an observer that throws: only successful writes notify, and the API caller still receives its original successful result if a subscriber fails. Keep cookie credentials, JSON validation, conflict details and `cache:'no-store'` unchanged.
- [x] **Step 4:** Run the same command; expect all tests to pass. Commit as `feat: cache root resources within the auth session`.

### Task 3: Separate route acceptance, visual settlement and hydration

**Files:** Create `src/root-page-session.js`, `src/root-page-surface.js`, `test/root-page-session.test.js`; modify `src/app.js`, `src/mobile-page-transition.js`, `src/mobile-navigation.js`, `style.css`; extend `e2e/mobile-page-transition.spec.js` and Task 1's latency suite.

**Interfaces:** `createRootPageSession({key,cache,load,onState,onAuthError,isCurrent}) -> {start(),settled(),refresh(),destroy()}`. State is `{phase:'loading'|'ready'|'error',data,refreshing,error,fromCache}`. `start` reads cache and launches one refresh; it does not await that refresh. Until `settled()`, hold DOM publication of loaded data; auth errors bypass the gate. `destroy` invalidates callbacks/timers and unsubscribes. `mountRootPageSurface(host,{title,onRetry}) -> {show(state),setContent(mount),destroy()}` supplies a stable root wrapper, immediate heading/skeleton, delayed refresh status and inline errors. `setContent(mount)` is a one-time transition into an existing root view; transfer focus from the loading heading only if it still owns focus. Later ready states update that view through Tasks 4–5 interfaces.

- [x] **Step 1:** Add unit cases `held load does not block settled`, `cached initial state is available`, `data received during motion waits for settled`, `stale view and destroyed session cannot publish`, `401 bypasses publication gate`, and `250ms refresh status cancels without flash` using controllable promises/timers. Replace Task 1's temporary characterization with `cold swipe settles while destination data is held`: require the target route/current Library link, loading surface and hidden stage within 750ms while the GET remains held for at least 1,500ms. Add `response during settlement does not mount rows until settlement ends`, `User accepts a second swipe while the first page still loads`, cold-error, empty-success and reduced-motion assertions.
- [x] **Step 2:** Run `node --test test/root-page-session.test.js` and the latency/renderer browser suites; expect the new session and timing assertions to fail before implementation.
- [x] **Step 3:** For accepted mobile root transitions, run `leave()` first, then commit the URL, current nav and lightweight target shell without awaiting required GETs. Preserve the existing heavy `prepareRoute` path for nested editors and desktop. Root shells and sessions are one route owner; `#app` stops being inert/route-busy after settlement even while their content remains loading. Background content gets its own busy/status semantics. Guard each callback by route and auth lifetime; cancel immediately on auth loss and supersession.
- [x] **Step 4:** Change `mobilePager.complete` so settling uses its existing incoming preview/skeleton and never waits for a fetch, live-list mount or arriving-page clone. After the motion ends, publish queued cached/fresh view data and remove the inert stage. Cache navigation indicator rectangles once at gesture/tap begin and reset on resize; the update loop writes transforms without repeated layout reads. Preserve selected control state in any preview copies this path changes. If Task 1 shows material source-clone blocking, prepare/invalidate the source snapshot after a stable render/idle period and use a lightweight loading preview when it is not ready; do not add unconditional virtualization or keep extra live controllers.
- [x] **Step 5:** Keep Home's existing controller as sole recommendation/presentation authority, with immediate local Resume and post-settle view-update gating. User stays a synchronous page. Do not feed cached Home Start actions or duplicate controllers into the new root sessions. Keep page-heading save control parking and editor dirty-leave confirmations intact.
- [x] **Step 6:** Run `node --test test/root-page-session.test.js` and `npm.cmd run test:e2e -- e2e/mobile-navigation-latency.spec.js e2e/mobile-page-transition.spec.js e2e/mobile-destination-swipes.spec.js e2e/navigation-transitions.spec.js`. Update old failed-root-load assertions to the newly approved destination error behavior; retain declined-leave and nested-route failure expectations. Expect held reads not to delay settlement and stale/auth cases to pass. Commit as `fix: settle mobile navigation independently of data`.

### Task 4: Hydrate and refresh Programs, Templates and Catalog safely

**Files:** Modify `src/app.js`, `src/library-view.js`, `src/catalog-view.js`; create `e2e/root-cache-refresh.spec.js`. Use Task 2's cache, Task 3's session/surface and existing `catalog-store.js` invalidation.

**Interfaces:** Library retains `update(records,{activeProgramId})`; extend focus preservation to all keyed row actions. Catalog gains `setData(data)` and `isEditing()`, while keeping `getNavigationState`, current filters and existing form APIs. Root Catalog accepts `loadCatalog` as an optional injected fresh-data loader (default remains `api.catalog`) so mutation refreshes share the root cache's in-flight read. Root adapters bind loaders `programs:api.list('program')`, `templates:api.list('template')`, `catalog:api.catalog()`, `settings:api.getSettings()`. Programs publishes records independently of the optional Settings request.

- [x] **Step 1:** Add `cached rows are usable while refresh is held`, `new rows update without remounting search`, `successful empty replaces cached rows`, `failed refresh retains rows and Retry`, `slow Settings does not block Programs`, and `Catalog draft/IME and focused action survive changed data`. Seed via API; use actual list/filter controls rather than inert preview text for cached assertions.

```js
await expect(page.getByRole('searchbox',{name:'Search catalog'})).toHaveValue('curl');
await expect(page.getByRole('searchbox',{name:'Search catalog'})).toBeFocused();
await expect(page.locator('[data-root-state]')).toHaveAttribute('data-root-state','ready');
await expect(page.getByText("Couldn't refresh. Showing previously loaded data.",{exact:true})).toBeVisible();
```

- [x] **Step 2:** Run `npm.cmd run test:e2e -- e2e/root-cache-refresh.spec.js`; expect missing warm-cache/update behavior to fail.
- [x] **Step 3:** Implement the three root adapters and stable update hooks. Skip unchanged data renders; retain filter nodes/caret/composition. Preserve focused row identity and current scroll, falling back to search/heading only when that record was removed. Defer changed Catalog data while a form/draft is open, apply the latest after close, and never overwrite its revision-aware draft. Reuse its mutation-load path with deduplication rather than two independent refreshes.
- [x] **Step 4:** Keep the Programs star's single-flight latest-intent queue and 500ms re-sort tap guard. A background Settings response cannot reset an in-flight optimistic choice; apply the latest confirmed setting after the queue settles. Keep imports, duplication, deletion, exports and revision/conflict handling server-authorized.
- [x] **Step 5:** Run the new suite plus `e2e/active-program.spec.js`, `e2e/catalog-loading.spec.js`, `e2e/catalog-metadata-forms.spec.js` and `e2e/mobile-page-memory.spec.js`; expect cached data/error/focus cases and existing actions to pass. Commit as `feat: refresh cached Library pages without blocking navigation`.

### Task 5: Cache History extent without blocking motion or losing pagination

**Files:** Create `src/history-page-data.js`, `test/history-page-data.test.js`; modify `src/app.js`, `src/workout-history-view.js`; extend `e2e/mobile-page-memory.spec.js` and `e2e/root-cache-refresh.spec.js`.

**Interfaces:** `createHistoryPageData({api,cache,pendingSummary,isCurrent,onState}) -> {start({visibleCount}),settled(),refresh(),loadMore(),destroy()}` uses Task 3's publication gate. `history:first` stores the normal `{records,hasMore}` response; `history:visible` stores `{records,hasMore,visibleCount}` for only the extent the user loaded. History view gains `setData({records,hasMore,pending,error,refreshing})`, retains `getNavigationState`, and uses `onLoadMore:()=>data.loadMore()`. Only history first-page records feed recommendations. Existing local pending summaries remain controller-owned and merged at render.

- [x] **Step 1:** Add `cached expanded extent renders before a held request`, `first page remains distinct`, `load more racing refresh cannot shrink or duplicate rows`, `failed extra-page restore retains prior complete extent`, `pending finish appears once`, `later restoration does not override user scroll`, and `successful empty removes old finished rows but retains pending local finish`.

```js
assert.equal(new Set(state.records.map(r=>r.id)).size,state.records.length);
assert.deepEqual(cache.read('history:first').value.records,firstPage.records);
assert.equal(state.records.length,60); // Load more was completed while a stale 30-row refresh was pending.
```

- [x] **Step 2:** Run `node --test test/history-page-data.test.js` and relevant memory browser cases; expect the new adapter/race assertions to fail.
- [x] **Step 3:** Load the fresh first page without program/template/settings dependencies. For a retained expanded extent, refresh only enough previously viewed pages, keep the current complete cached rows usable until reconciliation is ready, and deduplicate by ID. Track refresh/page-load generations so a late short refresh cannot overwrite a newer append. Cache successes only; update first-page data separately even when extra-page refresh fails. Do not auto-retry forever or fetch all history.
- [x] **Step 4:** Preserve scroll anchoring when refreshing content. Restore a saved off-screen position only once enough rows exist and the user has not already scrolled/focused/left since entry. Keep Load more ownership/cursor guards and use the current local pending summary at each publish, never a cached active-log object.
- [x] **Step 5:** Run `node --test test/history-page-data.test.js` and `npm.cmd run test:e2e -- e2e/mobile-page-memory.spec.js e2e/root-cache-refresh.spec.js e2e/workouts.spec.js e2e/workout-home.spec.js e2e/workout-offline.spec.js`; expect first-page, failure, offline Finish and extent cases to pass. Commit as `feat: restore and refresh cached History independently`.

### Task 6: Invalidate cached roots after real mutations and auth changes

**Files:** Create `src/root-cache-invalidation.js`, `test/root-cache-invalidation.test.js`; modify `src/app.js`, `src/root-resource-cache.js` only as necessary; extend `e2e/root-cache-refresh.spec.js` and `e2e/mobile-destination-swipes.spec.js`.

**Interfaces:** `affectedRootResources({path,method}) -> string[]` classifies API-client paths without `/api/`, stripping query parameters. `bindRootCacheInvalidation({cache,workouts}) -> {onMutation(event),destroy()}` consumes Task 2's observer and `workouts.subscribe`. Map: `documents` and descendants / `document-commands/*` writes invalidate programs/templates/settings (a deleted program can invalidate the active setting); `catalog` and descendants invalidate catalog/programs/templates; `settings/active-program` writes invalidate settings; `workouts` and descendants invalidate both history keys. GETs never invalidate. Local workout reasons finish/discard invalidate both history keys before acknowledgement; signout clears everything. Auth hiding also clears cache/page memory/previews through app ownership.

- [x] **Step 1:** Add table-driven cases for create/edit/delete/copy/import/attach, variant/reference/tag edits, active program, finished-log edits/deletes and profile/auth paths that must not be misclassified. Add browser `delete racing GET never reappears`, `last star intent survives old Settings`, `failed write keeps recoverable data`, and `logout/sign-in cannot reuse old cached rows`.
- [x] **Step 2:** Run `node --test test/root-cache-invalidation.test.js test/root-resource-cache.test.js test/api-client.test.js`; expect missing classification/wiring to fail.
- [x] **Step 3:** Wire one API mutation observer, not per-button copies. Apply a complete successful active-program response via `cache.replace('settings',result.settings)` after invalidating older reads; do not let an observer exception change HTTP success. Invalidate all linked summaries for catalog writes. Current `server/document-commands.js` import/attach persist documents through the repository, without catalog-definition writes; pin that boundary in the table tests and recheck it if HEAD changes before execution.
- [x] **Step 4:** Connect local finish/discard/signout observation, unsubscribe on disposal and protect cached History from delayed acknowledgements. Never clear the workout mirror to clear navigation data. Let active root sessions react to invalidation with one deduplicated refresh; preserve the current mutation/dialog/optimistic ownership before applying it.
- [x] **Step 5:** Run the unit cases and `npm.cmd run test:e2e -- e2e/root-cache-refresh.spec.js e2e/active-program.spec.js e2e/mobile-destination-swipes.spec.js e2e/recovery.spec.js`; expect all classification, late-response and recovery assertions to pass. Commit as `fix: invalidate navigation data across mutations and auth`.

### Task 7: Load Start workout lists inside the sheet

**Files:** Modify `src/workout-start-launcher.js`, `src/workout-start-sheet.js`, History wiring in `src/app.js`; extend `test/workout-start-launcher.test.js`, `e2e/workout-start-sheet.spec.js`, `e2e/workout-start.spec.js` and `e2e/mobile-navigation-latency.spec.js`.

**Interfaces:** Extend launcher `open({data,loadLists=null,...existing})`; optional `loadLists({onUpdate}) -> Promise<void>` starts independent shared-cache loads and emits `onUpdate({resource,status,value,error})` as each settles. Resource is `programs|templates|settings|firstPage`; status is `loading|ready|error`. It must not wait for the slowest resource before publishing another result. The launcher maps these events to sheet handle `updateLists({programs,templates,activeProgramId,logs,listStatus})`, with per-resource loading/ready/error status; preserve query, selected tab, disclosures and focused controls. Existing callers without `loadLists` retain their data-driven behavior. On-demand program bundles/template documents keep the existing per-sheet cache.

- [x] **Step 1:** Add `History settles while sheet lists are held`, `Start sheet opens before lists resolve`, `Blank starts while lists load`, `list arrival keeps search/tab focus`, `list error retries independently`, and `failed/unknown history never enables fabricated Up next`.

```js
await expect(page.getByRole('dialog')).toBeVisible();
await expect(page.getByRole('button',{name:'Blank workout',exact:true})).toBeEnabled();
await expect(page.getByText('Loading programs...',{exact:true})).toBeVisible();
// Program/template/settings responses remain held here.
```

- [x] **Step 2:** Run launcher unit tests and the new sheet cases; expect absent lazy-list behavior to fail. Keep the old list-failure, search retry and active-program selection cases.
- [x] **Step 3:** Open the sheet synchronously with cached/unknown inputs; show genuine loading indicators rather than pre-emptive failure messages. Load missing or invalidated lists/settings and the required fresh first-page scheduling input after open, guard by sheet/auth lifetime, and update each independent result. Manual list choices stay disabled only where their own required data is missing or a start is running; Blank stays available. Unknown scheduling inputs hide Up next until known; explicit failed history stays an error, not `logs:[]` presented as success.
- [x] **Step 4:** Retain Resume/Finish/Discard prompts, exact start source snapshots, search/disclosure state, close/swipe/focus behavior and Home's active local Resume priority. Activation publishes the successful Settings change through Task 6. Closing/reopening cannot let an old list response populate the new sheet.
- [x] **Step 5:** Run `node --test test/workout-start-launcher.test.js` and `npm.cmd run test:e2e -- e2e/workout-start-sheet.spec.js e2e/workout-start.spec.js e2e/workout-home.spec.js e2e/mobile-navigation-latency.spec.js`; expect all existing starts and held-list cases to pass. Commit as `perf: load workout picker lists on demand`.

### Task 8: Verify latency, motion and lifecycle behavior; record evidence

**Files:** Extend the new latency/cache/memory suites and existing mobile navigation/offline suites as required; update `AGENTS.md`, `docs/design-system/README.md`, the linked spec/plan; create `docs/superpowers/verification/2026-11-08-fluid-mobile-navigation.md` with selected screenshots/traces under its own assets directory.

- [x] **Step 1:** Run populated normal/reduced-motion cases at 360, 390, 760 and 761px plus desktop. Hold API responses for 1,500ms, reject them, resolve during settlement and resolve in reverse order. Assert stage clearance and another usable destination before release, cached interactive rows before refresh, correct first-load errors/empties and no duplicate live controller/status regions. Keep uncached API failures inside the newly committed root; preserve editor leave refusal and 401 sign-in behavior.
- [x] **Step 2:** Repeat Task 1's 4x CPU trace and compare the three timings. Check DOM/list mounting does not occur during the settle interval, indicator geometry is stable, cached previews retain select values and no page data is refreshed on every pointer move. Document actual observed frame costs and remaining device gaps; if finger-down cloning still causes a measured stall, apply only the profiled snapshot fix from Task 3 with a regression case.
- [x] **Step 3:** Run `npm.cmd test`, `npm.cmd run build` and `git diff --check`. If the already documented Windows temporary-SQLite cleanup issue reproduces, use the existing evidence's temporary GC preload to run the same assertions, and report ordinary and workaround results separately; do not modify database code or hide failures to obtain a green summary.
- [x] **Step 4:** Run the focused latency/cache/memory, root-navigation, active-program, recovery, Catalog, Home, start-sheet and offline suites. Then run `npm.cmd run test:e2e` once. Investigate failures, fix regressions with red/green tests, and repeat only the affected checks unless new production changes require broader verification. Distinguish a full green invocation from full-run-plus-retry evidence. Do not rerun the entire suite solely for a documentation edit.
- [x] **Step 5:** Obtain the Native workflow's single independent whole-branch review using `requesting-code-review`; provide both specs, this plan's Review Focus, measured timings, cache invalidation table and execution rulings. Resolve functional findings in one verified fix pass. Record all remaining minors and the exact real-device/production coverage; do not claim hosted verification from localhost.
- [x] **Step 6:** Record measured evidence and the revised failure/cache/motion contracts in the verification doc and AGENTS.md; update design-system loading/motion guidance and plan checkboxes truthfully. Commit as `docs: record fluid mobile navigation verification`. Keep other worktrees/plans and their artifacts intact; use the finishing-branch workflow for any later integration decision.

## Self-review and handoff

Coverage: Task 1 proves network-vs-render timing; Task 2 owns resource/auth epochs; Task 3 owns early route acceptance, loading surfaces and independent motion; Task 4 owns Library updates; Task 5 owns History extent/scroll; Task 6 owns mutation invalidation; Task 7 owns lazy sheet dependencies; Task 8 owns integrated evidence and review. Each Review Focus item has a named test. Cache keys, epoch result types, session publication gating and view update methods are shared consistently across tasks.

Implemented with Native execution; evidence and open items are in docs/superpowers/verification/2026-11-08-fluid-mobile-navigation.md. Native is the preserved execution preference from this conversation; ask the user to review this plan and confirm it captures the intended behavior before execution. No additional preference question is needed to write or review the plan.
