# Interaction Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Ship interactive dragging, smooth navigation and highlighting, clearer export controls, and more compact workout-building layouts.

**Architecture:** Add a small reusable pointer-sort controller and an opacity transition helper. Existing views continue owning data and commits; navigation prepares destinations before replacing mounted views. Keep existing domain and autosave boundaries.

**Tech Stack:** Native ES modules, CSS, Node.js 24, node:test, Playwright; existing SQLite/libSQL backend unchanged.

**Spec:** `docs/superpowers/specs/2026-10-24-interaction-polish-design.md`

## Global Constraints

- Native JavaScript and CSS; no new dependencies or frontend framework.
- Preserve save revisions, failed-save recovery, conflict handling, independent workout copies, and strict import/export validation.
- Persist only committed data changes; never persist drag previews, animation, hover, or collapse state.
- Respect prefers-reduced-motion: reduce throughout.
- Preserve readable text, visible focus, keyboard controls, and minimum 44 × 44 px interaction targets.
- Preserve existing edits to package.json and package-lock.json.
- Run npm test, npm run test:e2e, and npm run build before shipping. No database schema changes or migration are needed for this work.

## Review Focus

1. Mixed-height exercise cards and scrolling: insertion previews remain correct; cancel restores order/collapse state (Task 2).
2. Empty weekdays and Unscheduled: cross-day moves preserve every workout exactly once and survive mode changes/reload (Task 3).
3. Slow, failed, or superseded requests: old views remain visible, stale responses cannot mount, and save errors retain edits (Task 5).
4. Reduced motion and interrupted transitions: immediate swaps, correct final focus, no stranded inert/busy state or visual copies (Tasks 2 and 5).
5. Long text, 320 px width, and 200% text: compact controls and highlights do not overlap, shift on hover, or overflow the page (Task 4).

## File responsibilities

- Create `src/sortable.js`: pointer preview, drop targeting, auto-scroll, cleanup; no model mutation.
- Create `src/view-transition.js`: cancellable fade/swap lifecycle; no routing or fetching.
- Modify `src/session-editor.js`: exercise sorting adapter, alternatives, shared export icon.
- Modify `src/program.js`: immutable canonical workout placement operation.
- Modify `src/program-view.js`: workout sorting adapter, stable highlights, compact add row, internal transitions.
- Modify `src/app.js`: prepare/commit navigation and delayed loading feedback.
- Modify `src/action-controls.js`, `style.css`, `index.html`: icon geometry, motion/density styling, loading status host.
- Extend existing test files and add focused browser tests below; preserve existing fixture/login patterns.

### Task 1: Clarify export icons

**Files:** Modify `src/action-controls.js`, `src/session-editor.js`, `src/program-view.js`.

**Interfaces:** Consume existing `actionIcon(name): string`; preserve its public API.

- [x] Inspect every Export call site and replace hand-written variants with `actionIcon('export')`.
- [x] Separate the upward shaft, upward arrowhead, and tray paths; preserve currentColor, stroke width, aria-hidden, labels, and tooltips. Do not change Import geometry.
- [x] Visually compare Import/Export in both libraries and editors at desktop/mobile widths; verify export still downloads and import still opens a picker with `npx playwright test e2e/library-navigation.spec.js e2e/import-export.spec.js` (all pass). Do not add a test that merely asserts SVG path strings.
- [x] Commit only this task's changes: `fix: clarify export icon direction`.

### Task 2: Interactive exercise dragging

**Files:** Create `src/sortable.js`; modify `src/session-editor.js`, `style.css`; create `e2e/drag-reorder.spec.js`.

**Interfaces:**
- Produce `mountSortable(root: HTMLElement, {itemSelector: string, handleSelector: string, getGroups: () => Array<{element: HTMLElement, key: string}>, getKey: (item: HTMLElement) => string, onCommit: ({key: string, groupKey: string, beforeKey: string|null}) => void}): {cancel(): void, destroy(): void}`.
- Groups are distinct list containers; beforeKey null means append within that group. Controller excludes placeholder/copy from targeting. A single controller supports multiple program groups in Task 3.
- Exercise adapter uses original render indices as ephemeral keys and one group; commit through existing `commitMove(from,to)` so collapsed flags, announcements, and focus move together.

- [x] Add browser tests named `exercise follows pointer before release`, `exercise drop commits once`, `exercise cancel restores mixed collapsed order`, and `exercise reorder supports keyboard and click alternatives`. Assert copy displacement tracks pointer displacement within 2 px, placeholder changes position before pointerup, exported order remains original before drop, final order changes once, and collapsed state/focus stay with the exercise. Cover Escape, pointercancel, lost capture, outside release, and a sub-5-px click.
- [x] Run `npx playwright test e2e/drag-reorder.spec.js` and confirm new behavior fails before implementation.
- [x] Implement the controller with a 5 px activation threshold, pointer capture, inert aria-hidden copy without duplicate IDs, same-height placeholder, and transform-based 180 ms ease-out neighbour movement. Keep the capture owner mounted; preview DOM changes never call onChange.
- [x] Add requestAnimationFrame auto-scroll within 48 px of viewport edges, up to 12 px per frame proportional to edge proximity; refresh hit geometry after scrolling. Cancel outside valid group rectangles. Complete/cancel must clean up frames, transforms, capture, and copy even when the root is destroyed.
- [x] Replace the editor's existing pointer handlers with the adapter. Destroy/cancel it before list rebuild and editor destruction. Keep handle ArrowUp/ArrowDown behavior. Clicking the handle opens a compact menu with Move up/Move down actions, disabled at boundaries; Escape closes it and restores handle focus. Suppress the post-drag click.
- [x] Extend tests to mixed card heights, viewport scrolling, touch-pointer input, and destruction mid-drag. In no-preference mode verify nonzero neighbour animation; in reduce mode verify immediate layout with pointer tracking preserved. Assert no duplicate IDs or remaining copies after cancellation.
- [x] Run `npx playwright test e2e/drag-reorder.spec.js e2e/session-editor.spec.js` (all pass), then commit `feat: preview exercise order while dragging`.

### Task 3: Program workout sorting across days

**Files:** Modify `src/program.js`, `src/program-view.js`, `style.css`, `test/program.test.js`, `e2e/drag-reorder.spec.js`.

**Interfaces:**
- Consume Task 2 `mountSortable`.
- Produce `placeWorkout(program: Program, workoutId: string, {day: number|null|undefined, beforeId: string|null, afterId: string|null}): Program` in `src/program.js`. undefined day preserves assignment; null means Unscheduled. Exactly one anchor may be non-null; both null appends. Missing workout/anchor or invalid day throws without mutating input.
- Adapter translates controller beforeKey into beforeId; for append to a nonempty group use its last other workout as afterId. Empty group uses no anchors.

- [x] Add unit tests for sequence moves preserving day, insertion before/after anchors, empty-day append, null assignment, immutability, invalid anchors, and moving a single workout within its current day without duplication. Assert canonical ID order and day values explicitly.
- [x] Run `node --test test/program.test.js` and confirm failure for the missing operation.
- [x] Implement immutable placement by removing the moved workout first, resolving the anchor in the remaining array, inserting once, and assigning day only when supplied.
- [x] Add browser tests for sequence preview/drop, Monday→Sunday, Sunday→Unscheduled, Unscheduled→empty Monday, same-day reorder, cancellation, and mode toggles. Assert weekly totals unchanged, saved day/order survive reload, and original library templates remain unchanged. Run `npx playwright test e2e/drag-reorder.spec.js` to confirm program cases fail before UI implementation.
- [x] Add accessible workout drag handles and explicit group list containers with at least 48 px empty drop areas. Use stable workout IDs. Commit one `placeWorkout` result and emit once on valid changed drop; restore handle focus and announce destination/position. Preserve Move buttons and Day selectors; cancel before re-render or mode change.
- [x] Run `node --test test/program.test.js` and `npx playwright test e2e/drag-reorder.spec.js e2e/programs.spec.js` (all pass), then commit `feat: drag program workouts between days`.

### Task 4: Stable highlights and compact layouts

**Files:** Modify `src/program-view.js`, `style.css`, `e2e/program-overview.spec.js`, `e2e/programs.spec.js`, `e2e/library-navigation.spec.js`; create `e2e/layout-polish.spec.js`.

**Interfaces:** Preserve `mountProgramView` and volume-panel callbacks. Keep `data-add-template`, `data-add-empty`, and template selector hooks; button text becomes Add template and Empty workout.

- [x] Add `workout highlight never changes geometry`: record all card bounds before hover, during highlight, after moving between muscles, and after exit; positions/heights differ by at most 1 px. Assert complete accessible Trains <muscle> text and selected-muscle fallback. With no-preference verify 150 ms background/border/opacity transitions; reduce mode resolves immediately.
- [x] Add layout checks at 1280, 768, 375, and 320 px plus 200% root text: desktop add controls share a row with visible or separator; narrow controls wrap without horizontal overflow; all actions remain at least 44 px. Cover long workout/template names, empty template library, and validation errors. Run targeted files and confirm the new geometry/layout expectations fail.
- [x] Replace highlight hidden toggling with a reserved metadata slot and opacity state. Show exercise count and marker in the same metadata row; truncate visually when necessary with complete accessible text. Add 150 ms ease-out border/background/marker transitions and reduced-motion overrides.
- [x] Implement the agreed compact add row, explicit or separator, disabled Add template until selection, empty-library option, and always-enabled Empty workout action. Update existing test button labels without weakening behavior assertions.
- [x] Apply spec spacing values to libraries, overview, and editor, scoped to avoid shrinking panel contents or slider/touch targets. Update the existing overview test's 24 px toolbar gap assertion to the selected compact 16 px toolbar margin; retain its error-placement coverage.
- [x] Run `npx playwright test e2e/layout-polish.spec.js e2e/program-overview.spec.js e2e/programs.spec.js e2e/library-navigation.spec.js` (all pass). Capture 1280 px and 375 px screenshots of each affected page in an ignored artifact directory; inspect clipping, density, and long labels.
- [x] Commit `style: compact builders and smooth workout highlights`.

### Task 5: Prepare destinations and transition between views

**Files:** Create `src/view-transition.js`, `e2e/navigation-transitions.spec.js`; modify `src/app.js`, `src/program-view.js`, `index.html`, `style.css`; extend `e2e/recovery.spec.js` if save recovery assertions belong there.

**Interfaces:**
- Produce `createViewTransition(root: HTMLElement): {swap(commit: () => void, {focus: (() => void)|undefined} = {}): Promise<boolean>, cancel(): void, destroy(): void}`. swap returns false if superseded before commit, true after successful commit/entrance. cancel resolves pending work without a late callback. The helper owns opacity only; callers own busy/inert state.
- Refactor app route work into `prepareRoute(route, version): Promise<() => void>`: fetch record/list, import program module, and fetch template list before returning a synchronous mount closure. The closure must not run if its version is stale. Keep active queue disposal/track at accepted commit time.
- Make internal `openWorkout(workoutId): Promise<void>` and `renderOverview(): Promise<void>` await swaps where appropriate; initial mount remains immediate. Explicit error-field focus occurs after editor mounting.

- [x] Add browser cases `fast navigation retains source without loading flash`, `slow navigation shows delayed status`, `failed destination retains source`, `superseded response cannot mount`, `browser history remains consistent`, and `navigation waits for autosave`. Use intercepted existing API requests to hold/release responses rather than arbitrary sleeps. Assert source DOM remains mounted before destination response; no Loading… replacement; busy/progress only after 250 ms; failed loads restore route and source usability.
- [x] Add tests for Back during an in-flight fetch, failed save with declined discard, login expiry during load, and destination error following successful save. Assert edits/queue are retained correctly, no old callback overwrites the latest view, and inert/aria-busy clear on every completion path. Run `npx playwright test e2e/navigation-transitions.spec.js` and confirm new expectations fail.
- [x] Implement the opacity helper: 75 ms exit + synchronous commit + 100 ms entrance, ease-out; instant reduced-motion swap. Cancel pending animation promises safely; never leave opacity at zero after errors. Keep the outgoing page inert while waiting and transitioning.
- [x] Refactor route preparation to remove eager clearView()/queue disposal/Loading… replacements. Keep leave()/flush() before departure. Cover create, duplicate refresh, delete refresh, copy recovery, reload saved, login, initial load, and not-found in the same lifecycle. Distinguish refresh from route changes so routine refresh does not unnecessarily reset focus/scroll.
- [x] Add the delayed status host with role=status and aria-live=polite, and aria-busy on the content region. Guard timers, accepted URL/currentHash, mounts, and final cleanup using navigation generation. In-flight Back/hash requests supersede preparation; preserve queue and source until the accepted destination commits. Restore source URL on failure; authentication failure retains existing resume behavior.
- [x] Integrate the helper into overview↔workout transitions. Capture overview scroll before editing; restore it and the workout Edit focus on return. Preserve onChange callbacks and clean up the old panel/editor only at swap time. Await export-error editor expansion before focusing its invalid field.
- [x] Add no-preference assertions for source/destination opacity phases and final heading focus; test rapid internal transitions and error-focus priority. Repeat reduce mode for immediate swaps and correct focus. Run `npx playwright test e2e/navigation-transitions.spec.js e2e/recovery.spec.js e2e/persistence.spec.js e2e/import-export.spec.js e2e/programs.spec.js` (all pass).
- [x] Commit `feat: transition between prepared views without loading flashes`.

### Task 6: Verify and prepare the shipping handoff

**Files:** All task files; optional report `docs/superpowers/reports/2026-10-24-interaction-polish.md`.

**Interfaces:** No additional product API changes.

- [x] Run `npm test`, `npm run test:e2e`, and `npm run build`; require exit code 0 for each. Investigate failures rather than loosening unrelated assertions. Do not run database migration for this UI-only change.
- [x] Manually inspect desktop and mobile with motion enabled: long mixed-height drag, scrolling, empty-day drop, cancel, navigation under slow network, keyboard-only reorder, compact row wrapping, and repeated muscle highlighting. Verify reduced motion separately.
- [x] Review the diff for unpublished server files, new dependencies, persisted transient state, accidental package-file changes, stale text labels, detached pointer listeners, and unhandled animation promises.
- [x] Record actual commands/results, screenshots, and limitations. Do not claim deployment from a local build. Commit remaining task documentation and provide a reviewable branch/diff for the user's chosen shipping workflow.

## Execution order and review

Tasks 1–6 run in order; Task 3 relies on Task 2, and Task 5 should integrate against the final overview markup from Task 4. The shared view/editor ownership makes native execution a reasonable default; subagent-driven execution is available if the user prefers per-task independent review. Review this plan and select execution before implementing.
