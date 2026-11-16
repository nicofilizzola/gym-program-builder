# Nested mobile navigation verification

Design: [2026-11-15-nested-mobile-navigation-design.md](../specs/2026-11-15-nested-mobile-navigation-design.md).

Status: Tasks 1–2 parent metadata and compact breadcrumbs implemented and verified locally. Route tab visibility, workout/error integration and geometry remain planned/pending. Not deployed.

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

## Pending verification

- Browser: remaining workout/error integration, each nested type's committed tab visibility and root/Library navigation chrome. Breadcrumb canonical parent activation, desktop trails and resize were checked in Task 2 above.
- Guards/loading: denied leave, failed required nested load, stale responses, cancelled prompts and rapid Back/Forward.
- Workout: active Back/Resume, finish/discard/delete/Done exits, pending/offline finish and recap ownership.
- Geometry/accessibility: effective tab height, Resume/pinned panels/refresh status, hidden focus targets, safe-area simulation, typing transitions, 200% text and Focus at 660px.
- Physical phone: safe areas, keyboard transitions and momentum remain pending (user). Browser simulation is not physical-device evidence.
- Deployment verification remains pending (user); no deployment performed.

