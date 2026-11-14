# Workout flow verification

Design: [specification](../specs/2026-11-12-workout-flow-design.md). Plan: [implementation steps](../plans/2026-11-12-workout-flow.md).

## Part 1: grouped feed (2026-11-12)

Commits: `729dfc1` (pure exercise groups and pinned-block fit), `1ca7fcd` (pinned exercise block), `88c48d0` (note editing ends when the field closes), `79ba9d0` (note editor cap, focus margins, keyboard clamp, docs), and the fix-round commit (set 1 reachability test, precise docs). Implemented on localhost only; not deployed.

### Commands (localhost, Chromium via Playwright)

- `npm test`: 494 passed, 0 failed. The first run had one failure, `test/repository.test.js:30` with `EBUSY: resource busy or locked, unlink …test.db` (a Windows file lock on the temporary SQLite file). That file passes on its own (3/3), and a second full run passed 494/494.
- `npm run test:e2e` (full, one invocation, 15.5 min): 649 passed, 7 skipped, 0 failed. The suite rewrites `docs/superpowers/verification/assets/mobile-library-navigation/*.png` as a side effect; those changes were reverted, not committed.
- `npm run build`: passed (`Built public assets.`).

### Task 3 tests

- `e2e/workout-focus-view.spec.js`: `an open exercise note stays pinned and capped` (at 390x740, because at 390x844 the logger's own 14rem cap is already below 40% of the feed), `tight screens pin only the name row`, `a focused field clears the pinned block`, and `structure changes keep the group and the viewed set` (a guard).
- `e2e/workout-focus-fit.spec.js`: `200% text pins only the name row and keeps Complete reachable at the second set`, and `opening the keyboard at the second set at 200% text keeps the reps input clear of the pinned block`. The keyboard copy runs at 200% text because with default text the feed never drops below 180px, so shrinking to 390x380 (or 330, 300, 280) leaves the input clear without the clamp (measured: name-only, pin 44px, input top 73.6px).
- RED before the change: the cap test failed (editor 224px against a 189px limit), the focus-margin test failed (input top 293.0px under the details' bottom at 312.8px), and the keyboard test failed (input 13px under the name row). The structure, tight-screen and 200% set-2 Complete tests already passed, as Task 2's design predicted. All pass after the change.

### What was inspected

A scratch Playwright script (not committed) ran the real app against a populated log: a straight exercise with one warm-up and three working sets, a long name (`Single-arm incline dumbbell chest press with a long name`), brand and two focus tags and a 260-character exercise note, followed by a superset of two three-set exercises. At each viewport it scrolled to every set's snap position and measured the geometry. Screenshots are in the git-ignored `.superpowers/sdd/2026-11-12-workout-flow/`.

- 360x660, 390x664, 412x760, 390x844 and 412x839, plus the short tiers 360x560 (feed 319px) and 390x500 (feed 259px), at default text with `reducedMotion: reduce`: no horizontal overflow, the name row is at the feed top (0px) on every set, each non-first row rests exactly under the pin (0px), and every set's Complete is inside the feed. The straight exercise falls back to name-only at 360x660, 390x664, 412x760 and both short tiers (the long note pushes the block too tall), and keeps the whole block at 390x844 and 412x839. At boundaries, the next group's name row is either fully visible (44/44px) or absent.
- 200% text at 390x664 and 360x740: every group is name-only. Every set except the group's first shows through Complete. See the observation below.
- 390x844 with `reducedMotion: no-preference`: same geometry as reduced motion. Pinning adds no animation.
- Open exercise-note editor at 390x664 (feed 423px), filled with 960 characters: the block stays whole (not name-only), the textarea is 169.2px (40% of the feed), it scrolls inside, and the warm-up's Complete stays visible beneath.
- 1366x768, 1440x900 and 1920x1080: Focus hidden, regular tracker shown (3 exercise cards, no groups).

Not inspected: touch scrolling feel and momentum. Emulation cannot show them.

### First set under the name-only fallback (review fix round 1)

At 200% text, the first set of a name-only group whose details are tall (485px here: long name, tags, a 260-character note, history) snaps to the group's top, with the whole block above it (`fitGroup` row 0 offset = name + details). With a 319–395px feed, that set's card starts below the fold, so its Complete is off-screen at the snap position. By decision this stays: snapping row 0 under the name row would make the details unreachable under mandatory snap. Because the set's snap area is larger than the snapport, the user can scroll within it.

Check: `200% text with tall details lets the user scroll to set 1 Complete and back to the details` (`e2e/workout-focus-fit.spec.js`, 390x664 at 200%, one line of tags, a 279-character note, history). Measured: at the snap position `scrollTop` is 0 and Complete is outside the feed. Mouse-wheel steps of 60px, with 250ms to settle, reach `scrollTop` 300. After a further 600ms, `scrollTop` is still 300 (Chromium did not snap back), Complete is inside the feed (the viewed card's sticky Complete) and set 1 is still `.is-viewed`. Wheeling back up returns the details to directly under the name row. Touch-momentum behaviour on a real phone is `pending (user)`.

### Phone checks

- Pinning under momentum scrolling (block stays put while sets snap underneath; it leaves with the group's last set): `pending (user)`.
- Scrolling within a tall first set (200% text or a long note) to its Complete without snapping back: `pending (user)`.
- The open exercise-note editor and a focused field with the keyboard open, on a real phone: `pending (user)`.

## Part 2 task 5: compact rows and actions menu

Tests in `e2e/workout-overview.spec.js`: `the actions menu holds every exercise command`, `rows show reorder, name, tags and actions; pairs show one header`, `six exercises with four sets fit without scrolling at 390x844`, `removing an exercise from its menu keeps focus in the sheet`; the other overview tests, `e2e/workout-logger.spec.js` (overview swap) and `e2e/workout-focus-integration.spec.js` (overview warm-up) now open `Actions, {name}` first. RED before the change: 11 of the 18 overview tests failed (no `Actions, ...` buttons).

### What was inspected

A scratch Playwright script (not committed) rendered the sheet populated (a tagged straight exercise with a done set, a superset pair, a zero-set exercise) at 360x800, 390x844 and 412x915 on touch, 1366x768 with a fine pointer and 390x844 with reduced motion: no horizontal overflow in any (scrollWidth equals clientWidth), the actions button is 44px on touch and 32px on the fine pointer, tags sit muted beside the name, the pair shows one header with `A1`/`A2` members. At 390x844 with the root font size at 200% the sheet still had no horizontal overflow; the superset summary wraps to three lines and the tags line wraps under the name. That 200% check is a font-size override, not browser text zoom. Screenshots are in `.superpowers/sdd/2026-11-12-workout-flow/` (git-ignored). The density test passes at 390x844 (six exercises, four sets each, no scrolling) by arithmetic and measurement in that test; no spare margin was measured beyond the assertion.

Not inspected: real text zoom, the menu popup under the 200% font override.

### Phone checks

- Chip tapping accuracy and reading the sheet at a glance on a real phone: `pending (user)`.

## Part 3 task 6: animated jumps (travel)

Tests in `e2e/workout-focus-motion.spec.js` (motion on): `an overview chip travels through the sets in between` (real overview open, chip click, travel after the sheet closes), `Back to current travels too`, `a touch during travel stops at a set`, `an interrupted travel never sticks` (suspend and target removal mid-travel), `reduced motion jumps at once`; `warmup completion advances…` now polls the viewed set. RED before the change: the chip and Back to current tests failed (viewed set changed at the start; Back to current was instant) and the touch test ended on the target.

Headless Chromium does produce intermediate scroll samples for programmatic smooth scrolls (the tests assert at least three between start and end), so the Step 2 fallback was not needed. The browser sets the duration; how long jumps feel against snapping on a real phone: `pending (user)`.

Known flake, not from this task: `e2e/workout-focus-view.spec.js` `opening a long exercise note keeps the viewed set anchored` misses its 2px tolerance by 1px in about half of runs, on HEAD 487bfe3 before this change as well.

## Part 3 task 8: progress scrubbing (2026-11-13)

Resumed from the interrupted implementation on `39b7f30` (task 7, progress row button). The scrub module, integration, styles and tests were already present as uncommitted changes. They were inspected and retained; no original Task 8 RED run is available from this resumed session. The results below are fresh verification of that implementation, not a claimed test-first cycle. Implemented on localhost only; not deployed.

### Commands

Commands use `npm.cmd` / `npx.cmd` on Windows because PowerShell blocks the installed `.ps1` launchers. Logs are in `.superpowers/sdd/2026-11-12-workout-flow/` (git-ignored).

- `node --test test/workout-focus-model.test.js`: 9 passed, 0 failed (`task-8-model.log`), including nearest-centre selection, clamping, a tie, a single segment and an empty list.
- `npx.cmd playwright test e2e/workout-focus-progress.spec.js`: 7 passed, 0 failed, exit 0 (`task-8-progress-clean.log`). Coverage includes the row's tap/Enter/Space behavior, clusters and extended target; smooth travel after scrubbing; end clamps and bubble bounds; far release, pointer cancellation and lost capture; Auto-next cancellation; and `touch-action:none` with button semantics.
- `npm.cmd test`: 497 passed, 0 failed, exit 0 (`task-8-npm-test.log`).
- `npm.cmd run test:e2e`: **exit 1**, 649 passed, 21 failed, 7 skipped (25.6 min; `task-8-full-e2e.log`). All seven progress/scrub tests passed in this full run. The suite is not green.
- `npm.cmd run build`: exit 0, `Built public assets.` (`task-8-build.log`).

Full-suite failures (Windows, Node 24.22.1, Chromium, one Playwright worker, localhost test server):

- `e2e/root-cache-refresh.spec.js:110`, cold Catalog heading: loading/loaded heading Y differs by 2px against a 1px tolerance (assertion at line 121).
- Nine `e2e/workout-focus-integration.spec.js` cases (lines 29, 42, 56, 74, 79, 110, 121, 129, 140) timed out at 20s in the login helper's `page.goto('/')`, waiting for `load`.
- `e2e/workout-history-edit.spec.js:99` timed out waiting for the Password field in the login helper.
- Nine `e2e/workout-notes.spec.js` cases (lines 86, 100, 113, 142, 159, 176, 184, 209, 220): eight navigation/reload/login timeouts, and the warm-up-note case at line 142 timed out taking its screenshot after waiting for fonts.
- `e2e/workout-overview.spec.js:105`, six-exercise density: the last chips end at 853.671875px against the dialog bottom at 844px (assertion at line 109).

Exact names and stack locations are in `.superpowers/sdd/2026-11-12-workout-flow/task-8-report.md` and the full log. These failures were recorded for the controller's consolidated fix/review wave; their root causes and relationship to this change were not established, and they were not waived or repaired in Task 8. The previously reported `opening a long exercise note keeps the viewed set anchored` test passed in this run. The suite rewrites mobile-library screenshot artifacts; those are excluded from this commit and the controller retains their pre-resume backup.

### Visual inspection

A scratch Playwright script (`.superpowers/sdd/2026-11-12-workout-flow/task-8-inspect.mjs`) mounted the real logger and Focus presentation with a populated straight exercise (brand and focus tag), a superset with a long exercise name, warm-ups, working sets and a zero-set exercise. All checks used Chromium, touch emulation and `reducedMotion: reduce` at real browser viewport sizes. Measurements are in `task-8-inspect.json` beside the script; screenshots were opened and inspected.

- 360×800, 390×844 and 412×915: no horizontal page overflow; the bubble sits above the strip, contains the exercise and `A1 · Round 1` label, and remains inside the viewport (left/right: 23.5/342.2px, 38.5/357.2px and 49.5/368.2px respectively). The row and strip retain their compact height; the bubble overlays the header area without moving the feed. Its transition duration is `0s` with reduced motion. Screenshots: `task-8-360x800.png`, `task-8-390x844.png`, `task-8-412x915.png` in the scratch directory.
- Short tier, 360×560 (290px feed): the bubble remains in bounds with no horizontal page overflow; the viewed card uses the existing compact layout and sticky Complete. Screenshot: `task-8-360x560.png`.
- 390×844 with a 200% root font-size override: the bubble's long exercise name ellipsizes while `A1 · Round 1` stays readable; its edges are at 8px and 382px, with no horizontal page overflow. This is a font override, not real browser text zoom. Screenshot: `task-8-390x844-200pct.png`.

### Phone checks and limits

- Long travels against snapping: `pending (user)`.
- Scrub comfort and that dragging the row never scrolls the page on a phone: `pending (user)`. The browser test checks the CSS touch policy and mouse-pointer behavior; it does not establish physical-device behavior.
- Existing pinning/momentum and enlarged-text phone checks above remain pending. No physical phone or deployment was verified. Task 9's conditional travel tween was not run; no user phone-failure report was provided.


## Consolidated final review fixes (2026-11-13)

The final whole-plan review reproduced three defects beyond Task 8: note growth selected its fit anchor after layout had shifted; unlink restored a retired group's borrowed open editor into the hidden regular tracker; fallback fonts made the overview header wrap and pushed the sixth set-chip row below the sheet. These are fixed locally, not deployed.

- Focus captures the viewed row/snap delta before opening an exercise note and retains it through its growth, input and collapse, without native scroll anchoring. User feed interactions, explicit jumps, resize, suspension and presentation restoration release that hold. The fit pass refreshes the canonical editor state directly; closing a removed textarea no longer relies on an incidental scroll/focusout to reveal the exercise-note button.
- Regrouping transfers the exact borrowed canonical note host to the surviving exercise group before retiring its old group. The regression preserves field identity, value, focus and selection 3-5, dispatches synthetic composition events and continues editing after unlink. This is not hardware IME verification.
- The overview's existing close button visibly reads `Close` and retains the accessible name `Close overview`. The compact header fits with the intended and fallback fonts, preserving 44px touch controls, wrapping exercise names and the specified exercise-row spacing. The sixth chip row measures 815.28125px against the sheet bottom at 844px, at 390x844/default text. Add exercise may be below the fold as allowed by the plan.

Test readiness is now deterministic: the `--test` server serves local copies of the same five Barlow/Barlow Condensed Latin WOFF2 faces, with upstream OFL licenses and provenance under `e2e/fixtures/fonts`. Normal server/index, product hosting and build output are unchanged. A browser regression blocks external font hosts and loads all five intended faces successfully. Explicit fallback variants abort the local stylesheet; the pre-existing program-overview fallback check was updated to preserve its meaning. No timeout or geometry tolerance was increased.

An initial fallback-only full-suite policy was stopped after 238/681 cases: it exposed two unrelated existing typography assumptions (`compact-desktop.spec.js:102`, one complete card instead of two; `library-navigation.spec.js:74` template New/Import Y difference 52px). Both existing assertions pass unchanged with the intended fonts served locally. That stopped run is recorded as a failed infrastructure experiment, not a completed release gate or a waiver.

Fresh logs and detailed per-case dispositions: `.superpowers/sdd/2026-11-12-workout-flow/final-fix-report.md` (scratch), with logs in the same directory.

- `final-red.log`: 5 expected failures before production changes: native-anchoring-disabled growth drifts 94/124px, hidden editor after unlink, original density and fallback density at 853.671875 > 844px.
- `final-focused.log`: 151 passed, 1 failed, 4 pre-existing skips; every one of Task 8's 21 failing cases reached and passed. The one failure was the related close-note button-state issue, corrected above.
- `final-focus-view-green.log`: all 27 Focus view tests passed after that correction, including the original 2px anchor check, both motion modes without native anchoring, browser wheel scrolling after editing and canonical-editor unlink.
- `final-font-wiring-red.log`: the new test-font check failed with five empty loaded-face arrays before server wiring.
- `final-local-font-green.log`: 10 passed (9.7s): all five intended font faces with external hosts blocked, both typography-sensitive existing checks, close-note state, original/no-native-anchor regressions, editor unlink and intended/fallback density.
- `final-font-diagnostic.json`: separate browser diagnostics confirmed actual loaded Barlow/Barlow Condensed faces and request timings; native-anchoring-disabled delta stays 0.406 -> 0.406px with both motion modes at 390x900, viewed set and focused field retained. The original historical 3px observation's precise font/settlement cause is not claimed to have been reconstructed.

The final unit/browser/build gate is recorded below. No physical phone, real OS text zoom, Safari/Firefox, deployment or production verification is claimed. Existing user phone checks remain `pending (user)`; Task 9 remains conditional on a user phone-failure report, which is absent.


### Final correction and gate (2026-11-14)

Source commits: `6aae2ca` (consolidated fixes and deterministic test typography), `22720d6` (keyboard departure correction). Source stayed frozen during the final complete browser run.

The first complete intended-font run exposed a resize race (`674 passed, 1 failed, 7 skipped`, `final-full-e2e-before-resize-fix.log`): geometry had reached another set before the scroll rAF published its viewed ref. A deterministic same-turn scroll/height-measurement regression failed with s1 instead of s2 before the fix (`final-resize-race-red.log`). Height measurement now synchronizes the set actually in view before changing geometry, only when enabled, unsuspended, previously measured and not already measuring; a held note anchor still protects note growth. The original resize case passed ten unchanged repeats before this deterministic reproduction; those repeats were not used to waive the failure.

Scoped review then found that Tab could leave the exercise-note editor while its temporary anchor remained held. Actual browser Tab focused a warm-up button above the feed after the refit (top -91/-89px vs feed top 186px). The new check failed in both motion modes (`final-keyboard-red.log`, 2 failed/2 passed). Non-composing Tab now releases the hold before native focus moves; Shift+Tab is covered too. Ordinary editing/composition keys retain their hold. The four checks assert caret/selection and stable position for ArrowRight before leaving, then correct visible keyboard focus for Tab/Shift+Tab in both motion modes. These are browser/synthetic-keyboard checks, not hardware IME verification. `final-keyboard-affected.log`: 110 passed (1.5m).

Final commands on `22720d6`:

- `npm.cmd test`: **exit 0, 497 passed, 0 failed**, 10775.7793ms (`final-npm-test.log`).
- `npm.cmd run test:e2e`: **exit 0, 680 passed, 7 pre-existing skipped (12.7m)**, 687 total (`final-full-e2e.log`). All 21 original failures, the original resize failure and every new regression passed. Entire-log failure/timeout scan is empty; no assertion tolerance was increased and no test newly skipped.
- `npm.cmd run build`: **exit 0**, `Built public assets.` (`final-build.log`).
- `git diff --check`: exit 0.

An intermediate complete run before the final keyboard correction was stopped at 382/683 checks with no failures; `final-full-e2e-before-keyboard-partial.log` is explicitly a partial baseline, not a full result. Earlier unit runs twice hit existing Windows SQLite cleanup `EBUSY` at `test/repository.test.js:30` (496 passed/1 failed; logs `final-npm-test-concurrent-failure.log` and `final-npm-test-isolated-cleanup-failure.log`). A focused repository rerun passed 3/3, and the final unchanged unit run passed 497/497. No repository/dependency or cleanup-test changes were made; this intermittent environment issue remains disclosed in the detailed report.

Physical-phone momentum pinning, long travel/snapping, scrub comfort and native page-scroll suppression remain `pending (user)`. No deployment or production verification. Task 9 remains conditional on the absent user phone-failure report.
