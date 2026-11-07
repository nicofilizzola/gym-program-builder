# Mobile Library navigation verification

Implementation: 2026-11-07–08. Verification date: 2026-11-08. Branch: `feat/mobile-library-navigation`.
Design: [approved specification](../specs/2026-11-07-mobile-library-navigation-design.md).
Plan: [implementation steps](../plans/2026-11-07-mobile-library-navigation.md).

## Local checks

- Baseline unit suite: 431 passed.
- Unit suite: an ordinary pre-review invocation passed all 437 cases. Later ordinary and serialized invocations reached 436/437 with the existing Windows temporary SQLite cleanup lock described below. After the review fixes, all 437 cases passed with a test-process GC preload; no application/database code changed for this environment workaround.
- `npm.cmd run build`: passed; the existing recursive build includes the new ES modules.
- `git diff --check`: passed before final evidence commit.
- Navigation/Profile/Home regression: 34 passed.
- Save-feedback, route-transition, recovery, Home view, logger and review-dock regression: 60 passed.
- State restoration, required-load failures and Catalog refresh: three focused cases passed; the broader History/Home/start-sheet invocation passed its other 45 cases.
- Pure gesture recognition: three cases passed; real Chromium touch-input fixture: two passed.
- Inert preview renderer: two cases passed, covering visual translation, node identity, rollback, stale commits and reduced motion.
- Integrated swipes and offline workouts after corrections: 16 passed. The broader interaction invocation passed 113 other cases.
- Populated layout matrix: one case passed across 360, 390, 760, 761, 1366, 1440 and 1920px, plus 390px at 200% root font size. Forty screenshots capture root pages, Library sections, Profile, editors, logs, a conflict and an in-progress drag.

The preliminary full browser invocation exercised 497 cases: 493 passed and four older mobile fixtures expected the removed direct Catalog/Templates entry points. All four fixtures were updated to use Library, retaining their original feature assertions. Their focused follow-up passed.

The final full invocation against the review fixes exercised 501 cases: 500 passed and one workout-start case timed out while awaiting the first server acknowledgement (the logger remained in Saving). An unchanged scoped retry of that exact case passed in 6.3 seconds, with the original assertions and timeout. No product code changed between those runs.

Every browser case therefore has a passing run on the fixed implementation, but there was no single combined green 501-case invocation. Do not describe these results as one. All new navigation/swipe/memory/focus cases and the four updated mobile entry fixtures passed in the full invocation.

## Independent review and fix pass

One independent read-only reviewer examined `d2e6e1b..7e93ac2`. No Critical findings. Four functional findings were reproduced and fixed in `9ca3967`:

1. A superseded swipe kept the new page's gesture lock until the obsolete request resolved. Settlement now follows the current gesture generation.
2. A resize within the mobile breakpoint retained old-width preview geometry. Both the input adapter and renderer now cancel on viewport resize.
3. Browser Back/Forward could overwrite the outgoing page's remembered scroll with native restoration. Mobile routing now coordinates restoration explicitly; desktop retains the prior browser setting.
4. Breakpoint reordering lost focus for hidden Home/User links and for still-visible links. The navigation tracks focus before CSS hides a link, restores visible links and falls back to the page heading.

Each finding has a failing-then-passing regression case. The scroll regression was additionally verified by temporarily omitting restoration coordination, observing a 500px Forward-position error, then restoring the fix. All four review cases and the four navigation-fixture corrections passed together (eight cases).

Deferred Minor: a cached decorative Catalog preview can show the default select label while displaying filtered results. The committed page restores the correct selection and results. This transient preview mismatch is recorded rather than treated as a functional navigation failure.

## Decisions carried from execution

- Preserve the existing offline Finish exception rather than strand a locally finished log in its logger; a failed history load stays explicit. If this distinction regresses, a pending finish could appear lost or history could look falsely empty.
- Treat responsive keyboard-focus loss as a functional finding and fix it, including the still-visible link and hidden Home fallback cases; otherwise keyboard users lose their place.
- Use the temporary test-process GC workaround for the reproduced base Windows cleanup issue, with no runtime or assertion changes. Ordinary unit invocations can still hit that pre-existing cleanup failure.
- Keep physical-device and hosted-release checks explicitly unverified. Chromium emulation does not establish platform edge/zoom/keyboard behavior or deployment state.
- The executor owns the final full-suite assessment because the reviewer declined to judge an unfinished run. The exact combined-run/retry distinction is retained above to avoid overstating test evidence.

## Windows unit-run cleanup workaround

The ordinary full run intermittently fails while deleting a temporary SQLite `test.db` after the assertions in `test/repository.test.js` have completed. An archive of unmodified base `d2e6e1b`, using the same installed dependencies and environment, reproduced the same `EBUSY` cleanup failure: 430/431. The repository file passes in isolation on both base and feature (3/3 each). Serializing the feature's complete run did not avoid the cleanup lock.

A temporary test-process preload runs garbage collection periodically so closed native database resources are released before temporary-file cleanup:

```js
const timer = setInterval(() => globalThis.gc?.(), 100);
timer.unref();
```

With that snippet saved as `gc.mjs`, the complete suite command is:

```text
node --expose-gc --import ./gc.mjs --test "test/*.test.js"
```

Actual feature result: 437 passed, zero failures, approximately four seconds. The preload was held only in this plan's ignored scratch directory; it is not an application dependency, runtime change or weakening of assertions. Ordinary `npm.cmd test` may still encounter the pre-existing Windows cleanup issue.

## Visual evidence

- [Mobile Library](assets/mobile-library-navigation/390-programs.png)
- [Full User page](assets/mobile-library-navigation/390-user.png)
- [Training Home](assets/mobile-library-navigation/390-home.png)
- [Finger-tracked transition](assets/mobile-library-navigation/390-mid-swipe.png)
- [Template heading and save status](assets/mobile-library-navigation/390-template-editor.png)
- [Desktop navigation](assets/mobile-library-navigation/1440-programs.png)
- [Enlarged conflict state](assets/mobile-library-navigation/390-enlarged-conflict.png)

Visual inspection confirmed the four mobile destinations, grouped Library selector, dedicated User controls, anchored bottom bar, page-heading feedback and unchanged desktop navigation. The transition preview contains no duplicate IDs or live announcements. Enlarged pages can scroll; recovery controls remain part of the heading rather than being placed in the account navigation.

## Retained behavior and implementation ruling

An ordinary required destination-load failure retains the current page and selection. The existing offline Finish flow is a necessary exception: leaving the just-finished logger can show its local pending finish in History alongside an explicit failed-load message. It never presents that state as successfully loaded empty history. The failing existing offline-finish regression was reproduced, the condition corrected, and all affected offline cases passed afterward.

Root route/list state and decorative previews remain in memory only. Authentication changes clear them. Logging controllers, mirrors, autosave, revisions, portable formats, recommendation arithmetic and server schemas retain their existing ownership and contracts.

## Limits

Browser evidence uses local Chromium with CDP touch input, plus keyboard, reduced-motion and enlarged-text checks. Physical iOS Safari and Android Chrome testing has not been performed. Browser/system edge behavior and physical keyboard/viewport behavior still need device coverage.

Nothing has been pushed, merged into main or deployed. Deployment has not been verified.
