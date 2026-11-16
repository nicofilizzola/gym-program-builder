# Nested mobile navigation verification

Design: [2026-11-15-nested-mobile-navigation-design.md](../specs/2026-11-15-nested-mobile-navigation-design.md).

Status: Task 1 parent metadata implemented and unit verified. Navigation chrome, compact parent links and geometry integration remain planned/pending. Not deployed.

## Task 1 — immediate-parent metadata

- Added `mobileParentFor(hash, {program, reference})` using existing parsed views and `isSwipeRoot`.
- Unit matrix covers mobile roots, all nested route types, owning-root fallbacks, resolved canonical parent IDs, Home History queries, both tag kinds/query replacements, empty/unknown queries, malformed IDs and unrelated paths.
- Existing destination ownership, page memory, entry replacement and explicit mobile/desktop route behavior remain covered.
- RED: `node --test test/mobile-navigation-state.test.js test/router.test.js` exited 1: missing `mobileParentFor` export; 5 parser tests passed, 1 file failed.
- GREEN: same command exited 0: 10 tests passed, 0 failed.
- Regression: `npm.cmd test` exited 0: 519 tests passed, 0 failed.
- `git diff --check` exited 0.

## Pending verification

- Browser: enter/leave each nested type, errors/deep links, canonical parent activation, roots/Library links, desktop breadcrumbs and resize.
- Guards/loading: denied leave, failed required nested load, stale responses, cancelled prompts and rapid Back/Forward.
- Workout: active Back/Resume, finish/discard/delete/Done exits, pending/offline finish and recap ownership.
- Geometry/accessibility: effective tab height, Resume/pinned panels/refresh status, hidden focus targets, safe-area simulation, typing transitions, 200% text and Focus at 660px.
- Physical phone: safe areas, keyboard transitions and momentum remain pending (user). Browser simulation is not physical-device evidence.
- Deployment verification remains pending (user); no deployment performed.

