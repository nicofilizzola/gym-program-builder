# Workout overview interactions verification

Spec: [approved design](../specs/2026-11-15-workout-overview-interactions-design.md). Plan: [implementation plan](../plans/2026-11-15-workout-overview-interactions.md).

Local implementation, not deployed. Physical-phone touch, momentum scrolling and scroll-edge feel remain **pending (user)**.

Environment: Windows, Node 24.22.1, Playwright Chromium 159, native managed worktree, branch `feat/workout-overview-interactions`. Baseline unit suite: **518 passed**. Port 3199 belonged to another session; an ignored config and dev-server copy ran this worktree on 3299, with the shared test helper's origin adapted in that config. Tracked server, config, dependencies and auth checks are unchanged.

## Task gates

- Task 1: **118 browser checks passed** across overview, drag-reorder, reorder-regressions, supersets and workout-supersets. RED reproduced actual invisible painted pixels, missing resize/removal cleanup, missing modal-edge scrolling and incomplete copy sanitization. Added logger copy-fidelity checks also caught lost ancestor padding/header context. The original element remains the pointer-capture owner; no pre-drop writes, one accepted drop write, exercise/set IDs unchanged.
- Task 2: **145 passed, 3 existing skips** across overview, reorder-regressions, drag-reorder, exercise-actions, workout-logger and workout-supersets. RED showed missing movement items/handle focus, absent fade and ignored initial index. Additional RED→GREEN checks caught a rapid-reopen opacity flash from needless reparenting and inherited sheet motion on the preview host. Singles and pairs now pass painted/fidelity/direct-follow checks with both motion preferences. Default shared menus retain their existing presentation.
- Task 3: **196 passed, 3 existing skips**. Unit/build/browser commands and exact final counts below.

## Checks and screenshots

Real logger/port/Focus fixtures cover both movement entry points, all existing commands and limits, both superset members, live reorder/unlink/removal, one-block boundaries, keyboard moves, focus after movement/removal, modal status announcements, native popup fade/inertness/reversal, actual-anchor versus queued scroll dismissal, shared caller geometry, cancellation and CDP touch hold/cancel. No extra logger/controller or movement API was introduced.

Populated layouts were checked at 360/390/412px with default and 200% text, desktop fine pointer and a wide viewport with a simulated coarse primary pointer. This does not establish a fine primary pointer plus secondary touchscreen; genuine mixed-pointer checks remain pending (user). Checks retain chip borders/surfaces, done/check, viewed ring, next dot, warm-up names/values, touch bounds, wrapping and overflow, reachable last chips/actions/Close, six-exercise density, repeated-variant targets, borrowed notes and swap identity. Opposite partner chips call their distinct exact refs once, after the 200ms sheet exit; the viewed chip only closes.

Screenshots are local ignored artifacts under `.superpowers/verification/2026-11-15-workout-overview-interactions/`:

- [Single preview](../../../.superpowers/verification/2026-11-15-workout-overview-interactions/drag-single-no-preference.png), [whole-pair preview](../../../.superpowers/verification/2026-11-15-workout-overview-interactions/drag-pair-no-preference.png).
- [Open menu](../../../.superpowers/verification/2026-11-15-workout-overview-interactions/menu-open.png), [reopened menu](../../../.superpowers/verification/2026-11-15-workout-overview-interactions/menu-reopened.png).
- [390px](../../../.superpowers/verification/2026-11-15-workout-overview-interactions/layout-390-1.png), [360px / 200% text](../../../.superpowers/verification/2026-11-15-workout-overview-interactions/layout-360-2.png), [412px](../../../.superpowers/verification/2026-11-15-workout-overview-interactions/layout-412-1.png), [desktop](../../../.superpowers/verification/2026-11-15-workout-overview-interactions/layout-desktop.png), [wide viewport / simulated touch](../../../.superpowers/verification/2026-11-15-workout-overview-interactions/layout-touch-wide.png).

These are browser checks, not physical-device or deployment evidence. Focus round pages have not landed: exact-ref delivery is verified here; selecting opposite partners on a shared derived round page remains pending that separate implementation.

## Final commands

- `npm test` (`npm.cmd test`): **518 passed, 0 failed** (11.1s).
- `npm run build` (`npm.cmd run build`): **passed**, static assets built.
- `npx playwright test e2e/workout-overview.spec.js e2e/drag-reorder.spec.js e2e/reorder-regressions.spec.js e2e/supersets.spec.js e2e/workout-supersets.spec.js e2e/exercise-actions.spec.js e2e/workout-logger.spec.js e2e/workout-focus-integration.spec.js e2e/workout-focus-progress.spec.js`: **196 passed, 3 existing skips, 0 failed** (3.2m). Invoked through the same Playwright Node CLI with the ignored port-3299 config, using the repository's default Chromium headless shell.

Local logs: [unit](../../../.superpowers/verification/2026-11-15-workout-overview-interactions/final-unit.log), [build](../../../.superpowers/verification/2026-11-15-workout-overview-interactions/final-build.log), [nine browser suites](../../../.superpowers/verification/2026-11-15-workout-overview-interactions/final-browser.log).

The first nine-suite run used the full Chromium channel while the headless-shell download completed: 194 passed, 3 skipped, and the logger horizontal-swipe test navigated through native browser history. App root-swiping was disabled on that route. The same isolated test and the full rerun pass with the repository's default headless shell. No navigation code/test was changed to swallow browser history gestures.

The final author pass also reproduced and fixed copied ancestor styles overriding preview host surface/clipping constraints and an `InvalidStateError` when a source disappeared before the drag threshold. Five targeted lifecycle/paint checks passed afterward. Screenshot inspection found long tags could widen a modal grid member; new overflow assertions failed before the two small width fixes and pass across the full viewport/text matrix.

## Execution decisions and independent review

The approved spec supplied the design; no new direction, dependency, schema, endpoint, migration or stored-order format. Shared browser APIs and existing logger commands were reused. The work stays on its feature branch without a merge, push or deployment.

Rulings:

- Native isolation and `.cmd`/direct Node invocations avoid changing the source checkout or PowerShell execution policy.
- The existing logger drag regression released below the viewport. It now scrolls the destination into view, consistent with required clipped-drop rejection.
- Geometry assertions exclude `display:none` controls and scope the real source inside the dialog, since inert previews intentionally preserve ancestor classes.
- Live stale actions run immediately after external updates, before native queued moved-anchor scroll dismissal. Actual scrolling still dismisses.
- Two pre-existing logger assertions expected completion to infer historical RIR. They now assert no pressed option and stored null, matching the superseding implemented tracker specification. Product RIR code is unchanged.

Fresh-context read-only review of `2231cc4..ef0bbd8`: **no Critical or Important findings; ready to merge**. The reviewer inspected code, tests and screenshots but did not independently rerun the broad suites. Its one minor finding was an overstated hybrid-coverage label: that test exercises a coarse primary pointer at a wide viewport, not simultaneous fine/coarse inputs. The test and evidence now say so. Genuine mixed-pointer coverage remains deferred; the pre-existing fine-pointer chip rule is unchanged and may produce 32px chips when a secondary touchscreen is present. Physical-device calibration remains pending (user).

Other declined judgments were explicitly ruled on: numeric `initialIndex` fallback covers current callers; non-numeric property names are not supplied by a user path; native browser history gestures remain outside app root navigation; derived Focus round/partner selection awaits its separate implementation; deployment and physical-device feel have no verification claim. No implementation fix pass was required.

Review artifacts: [independent review](../../../.superpowers/verification/2026-11-15-workout-overview-interactions/review.md), [reviewed diff](../../../.superpowers/verification/2026-11-15-workout-overview-interactions/review.diff), [execution ledger](../../../.superpowers/verification/2026-11-15-workout-overview-interactions/progress.md). Final renamed wide-touch check: **1 passed** (3.0s); only the evidence label/artifact name changed after the full green suite.
