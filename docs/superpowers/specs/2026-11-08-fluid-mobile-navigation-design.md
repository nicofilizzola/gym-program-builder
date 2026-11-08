# Fluid mobile navigation under network latency

Date: 2026-11-08.
Status: Proposed execution contract based on the accepted recommendations; the user requested an implementation plan. Implementation has not started.

## Problem and scope

Production swipes can pause between finger release and settling. The current `app.js` awaits `prepareRoute()` before calling `mobilePager.complete()`, which starts the 220ms settling animation. Cached DOM previews do not bypass this dependency. History also awaits program/template/settings lists and enough history pages to restore the old extent. These are confirmed code paths, not a measured production trace; a separate rendering stall while the finger is still moving remains possible.

Implement the accepted combination: network-independent root transitions and session-cached list data with background refresh. Remove History's unnecessary dependency on start-sheet lists. Prefetching is deferred; it must not be necessary for smooth first visits. No production access or measurement is assumed.

This supersedes the prior navigation spec's rule to wait for required loads before settling and return to the source on a required-load failure. It preserves the rest of [mobile Library navigation](2026-11-07-mobile-library-navigation-design.md), including canonical routes, focus, gesture exclusions and offline ownership. The separate [Focus-view design](2026-11-08-mobile-workout-focus-design.md) remains independent; logger routes stay excluded from root swiping.

## Navigation and motion

- At <=760px, Home, Library, History and User keep their existing tap/swipe navigation. Library retains its Programs/Templates/Exercises selector and root routes.
- An accepted navigation first runs the existing leave/unsaved-change guards. Declining those guards retains the source. Once accepted, commit the target route and a lightweight loading/cached surface without waiting for GET requests.
- Finger release starts settling immediately using the existing approximate 220ms ease-out; cancellation stays approximately 180ms. Data is not a condition for starting or completing motion. Reduced motion remains instant.
- Existing inert target previews can carry the transition. Do not mount heavy lists or synchronously clone the arriving live page halfway through settling. Queue data-driven view updates until the visual transition has finished. The navigation indicator settles with the content.
- Once settled, clear the gesture lock and allow another root navigation even if the target's data request is still pending. Loading is indicated on content, not by making the whole app inert. Main navigation and User remain available.
- A canceled gesture changes no route/history. An accepted gesture/tap creates one navigation entry. Browser Back/Forward, resize, auth changes and rapid supersession retain their existing guards.
- Cache indicator geometry for the gesture; avoid reading link rectangles after transform/width writes on every frame. Profile source snapshot construction under CPU throttling; make additional snapshot changes only when that measurement identifies meaningful finger-down blocking.

## Root loading states

- First visit: render the real destination heading and a stable skeleton. Never render a success-style empty list before a successful empty response.
- Return visit: show previously loaded actual list data and restore its filter/disclosure/loaded-extent/scroll state, then refresh in the background. Inert DOM previews are not interactive cached pages.
- Delay the visible background `Updating...` indicator by 250ms to avoid flashing; first-visit skeletons appear immediately. Use existing typography/surfaces, no shimmer or decorative motion.
- A cold-load failure stays on the destination with a clear error and Retry. A refresh failure retains the last successful content with `Couldn't refresh. Showing previously loaded data.` and Retry. A 401 uses the existing sign-in/recovery flow and clears all navigation caches/previews immediately.
- Data arrival does not rerun the page-entry animation, steal focus, reset scroll or overwrite filters/IME composition. Preserve focused keyed controls when rows change; if a focused record disappears, move focus to the relevant list heading/search control without scrolling unexpectedly.
- First-load heading replacement transfers focus only if that loading heading still owns focus. Background refreshes never claim heading focus. Delay data application while a Catalog dialog/draft or pending star-toggle intent would be overwritten.

## Session data and freshness

- Use memory only, scoped to the authenticated lifetime. No localStorage/IndexedDB, service worker, HTTP-cache change, PWA support, new offline creation, new API or migration.
- Cache resources: programs, templates, catalog, settings, history first page and history visible extent. Cache successful empty responses. Never cache failures as empty data.
- Deduplicate concurrent reads for the same resource epoch. Clear/invalidation advances an epoch so older reads cannot refill cleared data, overwrite a newer mutation or update a superseded view.
- Every root entry refreshes in the background. No TTL or polling loop is introduced. Known mutations evict affected stale data immediately; a later entry can show a skeleton rather than resurrect a deleted record. Cache use never bypasses revision/conflict validation.
- Document mutations invalidate Programs/Templates summaries; catalog/tag mutations also invalidate Catalog and linked summaries; active-program writes invalidate Settings; workout mutations invalidate both history entries. Local pending finishes/discards invalidate history before server acknowledgement. Apply successful mutation-response values where complete enough to avoid losing the last active-program intent.
- Returning from an editor must not show pre-edit names/counts as fresh. Failed writes do not publish success or invalidate away the recoverable draft. Mutation invalidation covers the existing API command paths rather than a subset of click handlers.
- Home recommendations and active logs are not cached as actionable page models. Home keeps its existing controller, guards and fresh-data requirements; local Resume always wins. User needs no network data. Never retain multiple live Home/logger controllers.

## History and Start workout

- History renders independently of program/template/settings requests. Its cached visible extent may appear immediately; fresh first-page and extra previously viewed pages load without holding motion.
- Keep first-page history separate from the visible expanded list for Up next. Never fetch unbounded history. Load more and background refresh cannot overwrite each other's rows/cursors or shrink the visible extent. Deduplicate locally pending finishes against server IDs.
- Restore saved scroll only when enough corresponding content exists. If the user has already scrolled, focused a field or navigated, do not jump back later when extra rows arrive. Cached filter/scroll memory still clears across auth.
- Start workout opens its existing sheet immediately. Program/template/settings dependencies load on demand with real loading states, independent inline errors and Retry; Blank workout stays available. Preserve search, tabs, disclosures, swipe-to-close and per-sheet bundle/template caches.
- Up next waits for its required scheduling inputs; failed or unknown history must not become empty scheduling history. A retained pending finish is merged once. Manual session/template choices keep the existing server-authorized start flow.

## Acceptance and verification

- With required API responses held for at least 1,500ms, the stage becomes hidden, the target heading/current link are committed and navigation is usable before responses are released. A 750ms test allowance covers the 220ms animation without claiming a universal device performance guarantee.
- With a cached root, prior records/filters/extent remain usable before a held refresh is released. Cold/refresh errors, successful empties, 401, mutations racing reads and logout/sign-in are tested explicitly.
- Measure pointer-down-to-first-preview, release-to-settle and data-receive-to-render separately with populated Catalog/History and 4x CPU throttling. Test delayed, failed and out-of-order responses plus reduced motion. Do not claim CPU smoothness merely because a network test passes.
- Recheck active offline Resume, pending Finish, all sheet start flows, focus/caret/typing bars, root-only gesture exclusions, 760/761px resize and Back/Forward restoration. Desktop keeps its existing presentation and guarded editor behavior.
- Record actual local/browser/device evidence and outstanding production checks. Physical production responsiveness is not verified by localhost tests alone.
