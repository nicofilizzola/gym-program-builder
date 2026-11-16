# Nested mobile navigation verification

Design: [2026-11-15-nested-mobile-navigation-design.md](../specs/2026-11-15-nested-mobile-navigation-design.md).

Status: Tasks 1–3 parent metadata, compact breadcrumbs, committed-route tab visibility and recoverable error chrome implemented and verified locally. Bar/Focus geometry integration and complete workout lifecycle checks remain pending. Not deployed.

## Task 1 — immediate-parent metadata

- Added `mobileParentFor(hash, {program, reference})` using existing parsed views and `isSwipeRoot`.
- Unit matrix covers mobile roots, all nested route types, owning-root fallbacks, resolved canonical parent IDs, Home History queries, both tag kinds/query replacements, empty/unknown queries, malformed IDs and unrelated paths.
- Existing destination ownership, page memory, entry replacement and explicit mobile/desktop route behavior remain covered.
- RED: `node --test test/mobile-navigation-state.test.js test/router.test.js` exited 1: missing `mobileParentFor` export; 5 parser tests passed, 1 file failed.
- GREEN: same command exited 0: 10 tests passed, 0 failed.
- Regression: `npm.cmd test` exited 0: 519 tests passed, 0 failed.
- `git diff --check` exited 0.

## Task 2 — stable compact breadcrumbs

- `mountBreadcrumbs` retains links by href, patches labels and preserves the immediate-parent anchor/focus across current-record edits, save acknowledgements and responsive changes. Omitted update metadata retains the previous mobile parent; empty desktop items can show mobile-only parent chrome.
- At ≤760px only the immediate parent is visible/accessible, with a decorative currentColor left arrow, full `Back to {parent label}` name, one-line ellipsis and a ≥44×44px target. At 761px the existing desktop trail/current-page semantics return. A focused desktop-only crumb transfers to the surviving parent; a mobile-only link hiding on desktop transfers to the heading. Focus is captured before the compact display class changes.
- App callers consume resolved program/reference parent metadata. Templates/Exercises use compact aliases; Profile returns to User. Moved/archived variants use their canonical reference href. Missing variants keep an available reference parent; missing references fall back to Exercises. Existing desktop error trails remain unchanged.
- Browser coverage exercises held template PUT acknowledgement focus/identity, current-record and parent-label updates, HTML-like/long labels, exact 760/761 boundaries, native modified clicks and ordinary Enter/click callbacks, program return-to-occurrence focus/scroll, variant → reference → Exercises, tags, Profile and root-no-trail behavior. Existing desktop/shared-template trails remain covered.
- RED: `npx.cmd playwright test e2e/breadcrumbs.spec.js e2e/mobile-library-navigation.spec.js` exited 1: 3 failed, 5 passed (39.8s). Expected missing compact links: Back to Programs, Back to Strength and Back to User.
- Additional RED: `npx.cmd playwright test e2e/breadcrumbs.spec.js -g "moved archived variant"` exited 1: 1 failed (test 20.1s); missing variant did not yet retain its available reference parent.
- Final GREEN: `npx.cmd playwright test e2e/breadcrumbs.spec.js e2e/mobile-library-navigation.spec.js` exited 0: 8 passed (10.8s). The pre-existing NO_COLOR/FORCE_COLOR warning remains.
- Regression: `npm.cmd test` exited 0: 519 passed, 0 failed (10977.0828ms).
- Visually inspected generated screenshots at 390×844 (one compact parent link) and 761×844 (full desktop trail). Screenshots are local Playwright artifacts, not physical-device evidence. Tabs remain visible in this Task 2 snapshot; route visibility belongs to the next integration task.
- `git diff --check` exited 0. No deployment performed.

## Task 3 — committed route visibility and recovery

- `mobileNav.commit` applies the parsed root/nested classification at the existing route swap, retains it through desktop resize and updates the optional synchronous, argument-free geometry callback. Hidden navigation is not measured for its indicator; visible width/height changes notify once. Full mobile height remains separate from effective reservation, which is zero on nested routes and desktop. No effective-height animation was added.
- Initial mount skips entrance motion; ordinary nested transitions retain 75ms outgoing/100ms incoming ease-out content fades. The motion test records the outgoing animation with source chrome, the incoming animation with destination chrome and no Main animation at the swap. Reduced motion records no content animation.
- Workout Home links mount outside the logger subtree and survive Focus recap. Unknown/missing workout errors gain mobile-only Home parents without adding desktop trails. Initial required-load errors keep the requested nested treatment, available parent and Retry; missing occurrences retain the loaded program parent. Resolved catalog missing-target errors can commit, while thrown required-load failures preserve the mounted source URL, nodes, focus and chrome.
- Actual-app matrix covers Home/Programs/Templates/Exercises/User roots, all eight nested route types, active and finished workouts, tag queries, parent hrefs and return destinations. Every nested type also uses a fresh document deep link (`?nested-entry=…`) so direct-entry behavior is not confused with same-document hash navigation. Catalog reference/variant entry uses the existing guarded hash route from its parent because catalog expand/edit controls do not navigate; no new UI was invented. Roots retain exactly Home/Library/User with equal ≥44px targets and Library section links.
- Lifecycle coverage holds a required nested GET, checks unchanged source parent identity and zero reservation, fulfills 503 and checks source URL/controller node/focus. Profile PUT failure plus denied Back keeps the exact field value; finished-log incomplete reps plus denied Back keeps its draft and Home link. A held destination across browser Back/Forward cannot publish stale chrome. Root cold errors keep tabs and Retry.
- Auth coverage uses a real logout, a required Profile GET that triggers the existing 401 sign-in path and source URL restoration, then successful sign-in. A separately held template GET is released only after sign-in has restored the Templates source; its stale completion cannot publish nested chrome. This is a held stale-success request spanning an actual 401/sign-in, not a claim that the held request itself returned 401. The existing authentication-expiry swipe test also remains passing.
- Resize checks retain the explicit route at 760/761px, transfer focus from newly hidden Main to the compact parent, and cover 375×700 portrait and 700×375 landscape. Existing desktop full trails and labels, desktop Workouts resize, mobile Workouts history replacement, root typing/script focus, 200% root labels, root swipes, cache latency and 220/180ms settlement/cancellation assertions remain passing. Tests using formerly visible nested tabs now activate their visible parent; original guard/stale/auth/desktop assertions remain.

Commands and actual results (Windows, workspace `C:/Users/NicoF/.codex/worktrees/eb87/gym-program-builder`):

- RED: `npx.cmd playwright test e2e/nested-mobile-navigation.spec.js e2e/mobile-navigation.spec.js e2e/mobile-destination-swipes.spec.js --max-failures=3` exited 1: 22 passed, 3 failed, 1 not run (46.9s). All three failures reported visible Main navigation on nested program/template/missing routes. The max-failures stop also produced the runner's final stop error.
- First complete focused GREEN: `npx.cmd playwright test e2e/nested-mobile-navigation.spec.js` exited 0: 9 passed (23.5s).
- Final required browser regression: `npx.cmd playwright test e2e/nested-mobile-navigation.spec.js e2e/mobile-navigation.spec.js e2e/mobile-destination-swipes.spec.js e2e/breadcrumbs.spec.js e2e/mobile-library-navigation.spec.js e2e/mobile-navigation-latency.spec.js e2e/mobile-page-transition.spec.js` exited 0: 45 passed (1.1m).
- Regression: `npm.cmd test` exited 0: 519 passed, 0 failed (12943.9882ms).
- `git diff --check` exited 0. The pre-existing NO_COLOR/FORCE_COLOR runner warning remains unchanged.
- Visually inspected the 375×700 nested Profile screenshot: one compact User parent, current heading/save controls and no bottom tabs. Local artifact: `test-results/nested-mobile-navigation-c-dbbbc--navigation-transfers-focus/nested-mobile-profile.png`. This is browser evidence, not a phone/device claim.

## Pending verification

- Workout: complete finish/discard/delete/Done exit semantics, cancelled discard, pending/offline finish and ownership checks remain with the workout integration task; Task 3 covers active Back/Resume, valid recap Home link and finished-log denied leave only.
- Geometry/accessibility: Resume unchanged-height reservations and safe-area ownership, pinned panels/refresh status with insets, keyboard transitions, 200% nested text and Focus at 660px remain with geometry integration. Task 3 covers effective tab height, hidden accessible links/focus targets, visible-size callbacks, ordinary zero-inset panel placement and root typing policy only.
- Physical phone: safe areas, keyboard transitions and momentum remain pending (user). Browser simulation is not physical-device evidence.
- Deployment verification remains pending (user); no deployment performed.

