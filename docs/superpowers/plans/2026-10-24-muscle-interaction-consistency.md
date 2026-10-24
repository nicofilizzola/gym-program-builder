# Muscle Interaction Consistency Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans or superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make program muscle selection and workout cards consistent with the existing session template editor, retaining one workout badge.

**Architecture:** Keep panel preview state separate from selected-muscle state. Connect the program's card highlighting to the existing selection callback, and share the exercise card's surface, selected treatment, and badge CSS with program cards. Keep each page's rendering and domain rules intact; no component rewrite is needed.

**Tech Stack:** Vanilla JavaScript ES modules, CSS, Node.js 24, Playwright, existing Node test runner.

**Spec:** The bounded design below records the user's request and single-badge clarification. Existing context: `docs/superpowers/specs/2026-10-24-program-overview-design.md`; this change supersedes its hover-driven workout highlighting.

## Agreed scope and design

- The existing session template page is the reference. Hover and keyboard focus preview the panel readout and body map. They do not change exercise/workout card emphasis.
- Click, tap, Enter, or Space selects a muscle; activating it again clears selection. Selecting another muscle switches the matching cards. Apply this to both volume rows and body map regions, as on the session page.
- While muscle A is selected, previewing B leaves A's cards highlighted. Clearing selection restores all cards immediately, even if the pointer remains over a muscle.
- Program workout cards use the exercise card's neutral surface, 4px left border, radius, 16px padding rhythm, and 200ms opacity/border/shadow transitions. Preserve space for the existing drag handle.
- Any matching workout uses the exercise card's **primary** highlight treatment: accent outline and soft shadow on the normal surface. Nonmatching workouts dim to opacity 0.45 while a selection exists. With no selection, every card is neutral and fully opaque.
- Keep exactly one `Trains [muscle]` badge for each matching workout, styled like the existing filled `.hit-tag` pill. Primary-only, secondary-only, and mixed workouts all receive the same treatment. The session editor retains its primary/secondary distinction.
- Preserve card controls, workout counts, day selectors, sequence/schedule behavior, drag and keyboard reorder, and existing selection reset on returning from a workout or replacing a program.
- Reserve the badge's layout space so selection changes do not move cards or controls. At narrow widths or enlarged text, allow the metadata area to wrap based on available space, consistently whether a badge is shown or hidden. Keep the badge text accessible and do not truncate the muscle name.

## Global Constraints

- No frontend framework, dependency, persistence schema, or database changes.
- Muscle selection and preview remain transient and must never trigger autosave.
- Preserve volume, goals, heat levels, readout text, hover grace, readout fade, and accessible row pressed states.
- Preserve the session template page's current interaction and appearance.
- Reduced motion disables the new card/badge transitions; controls retain visible keyboard focus and touch targets.
- Run `npm test`, `npm run test:e2e`, and `npm run build` before claiming implementation complete. No migration is needed for this UI-only change; never migrate production automatically.
- Existing uncommitted `package.json` and `package-lock.json` changes belong to the user; preserve them and exclude them from task commits.

## Review Focus

1. Hover/focus on another muscle while selected must not replace or clear the selected cards.
2. Deselecting under the pointer restores cards immediately, despite continued readout preview.
3. Secondary-only and mixed workouts receive one badge and the same selected styling as primary-only workouts.
4. Rerenders from mutation/reordering/day changes retain selection, while overview replacement/navigation resets it.
5. Narrow screens, enlarged text, long names, and reduced motion preserve readable badges, stable geometry, and operable controls.

## File responsibilities

- `src/program-view.js`: selected-muscle ownership, card emphasis, and badge state.
- `src/volume-panel.js`: existing selection callback consumed unchanged; retain preview callback unless repository-wide usage proves it obsolete. No API expansion required.
- `style.css`: shared visual declarations for exercise/workout surfaces, matched states, dimming, and badges; program-specific layout remains scoped.
- `e2e/program-overview.spec.js`: interaction, transient state, lifecycle, touch, and keyboard assertions.
- `e2e/layout-polish.spec.js`: shared appearance, stable geometry, responsiveness, and reduced motion.
- `e2e/session-editor.spec.js`: regression coverage for the reference behavior.
- `AGENTS.md`: update the release requirement that currently says hover highlights workouts.

## Task 1: Highlight workout cards only from selection

**Files:** Modify `src/program-view.js`, `e2e/program-overview.spec.js`, `e2e/session-editor.spec.js`, `AGENTS.md`.

**Interfaces:** Consume `mountVolumePanel(root, {onMuscleSelect: (muscle: string | null) => void, ...})`. Retain `updateWorkoutHighlights(): void` as the program's DOM-only update, without `emit()` or `onChange()`.

- [x] **Step 1: Update/add failing interaction tests.** In `program-overview.spec.js`, replace the existing expectation that hovering Lats highlights Pull. Assert the following with the existing four-workout fixture:
  - Before selection, hover Chest row/map: readout previews Chest; `.is-muscle-match` count remains 0.
  - Click Chest: matching titles equal `['Press', 'Assistance']`; both badges read `Trains Chest`.
  - Hover Lats row/map: readout previews Lats; matching titles remain `['Press', 'Assistance']`.
  - Keyboard focus Lats previews Lats without changing cards; Enter selects Pull; Space clears matching cards immediately.
  - Click Chest twice without moving the pointer: matching count becomes 0 before pointer leave.
  - Touch row and map selection/deselection produces the same matching-card sets.
  - Extend the fixture with a workout containing both primary and secondary Chest involvement across different exercises: it matches once and has one badge.
  - Preserve the existing request listener assertion `expect(writes).toEqual([])` around all selection/preview actions.
  Add a session editor reference test using Bench/Chest and Row/Lats: hover causes no card hit, select Chest highlights Bench, hover Lats keeps Bench selected, activate Chest again restores neutral cards. Use existing `data-hit` values rather than changing the reference implementation.
- [x] **Step 2: Run the targeted tests and confirm the new program selection assertions fail on current hover-driven behavior.** Run `npx playwright test e2e/program-overview.spec.js e2e/session-editor.spec.js`.
- [x] **Step 3: Change the program panel subscription from `onMuscleFocusChange` to `onMuscleSelect`.** Assign its muscle argument to the program's selected card state and call `updateWorkoutHighlights()`. Rename `highlightedMuscle` to `selectedMuscle` locally for clarity. Leave panel preview logic intact. Preserve primary OR secondary membership matching and existing reset semantics.
- [x] **Step 4: Update the release requirement in `AGENTS.md`.** Replace the statement that hovering or selecting highlights workouts with: hover/focus previews panel details; selecting a muscle highlights contributing workouts, matching the session template editor. Do not rewrite historical design documents.
- [x] **Step 5: Run `npx playwright test e2e/program-overview.spec.js e2e/session-editor.spec.js`.** Expect all tests to pass, including existing mutation/import/navigation coverage. Add explicit no-selection-after-return assertions where needed.
- [x] **Step 6: Commit only the Task 1 files.** Suggested message: `fix: highlight program workouts only for selected muscles`.

## Task 2: Match workout card and badge appearance to exercise cards

**Files:** Modify `src/program-view.js`, `style.css`, `e2e/layout-polish.spec.js`, `e2e/program-overview.spec.js`.

**Interfaces:** Preserve `.workout-item.is-muscle-match` and `[data-muscle-match]` selectors. Add `.is-muscle-muted` for nonmatching cards only while a muscle is selected. `updateWorkoutHighlights()` sets both classes and badge visibility; no stored style state.

- [x] **Step 1: Update/add failing visual regression assertions.** Change `workout highlight never changes geometry` to activate rows instead of hover. Assert hover alone leaves cards neutral. At 1280px, 375px, and 320px, record card and control bounds; selecting Chest, switching to Front delts, and deselecting must preserve those bounds. Compare computed base background, border-left width, radius, and selected border/shadow against an exercise card mounted in a separate reference fixture. Assert selected workout background remains the neutral surface, its single badge matches `.hit-tag` fill/text/radius, nonmatches reach opacity `0.45`, and deselection restores opacity `1`. Under normal motion expect the shared exercise transition timing of 200ms; under reduced motion expect no transition.
  Include `Front delts` and `Upper back` badge cases at 200% text and long workout titles: no horizontal document overflow, readable complete badge text, controls remain operable. Extend the existing program fixture with one nonmatching workout for dimming assertions.
- [x] **Step 2: Run `npx playwright test e2e/layout-polish.spec.js` and confirm the new style assertions fail for the current orange-background workout treatment.**
- [x] **Step 3: Share only the visual declarations in `style.css`.** Group `.workout-item` with `.exercise` for neutral surface, border geometry, radius, and opacity/border/shadow transition. Group `.workout-item.is-muscle-match` with `.exercise[data-hit="primary"]` for accent border and shadow, and `.is-muscle-muted` with `.exercise[data-hit="none"]` for opacity. Remove competing late workout background/transition overrides. Preserve exercise secondary styling and all existing layout-specific declarations.
- [x] **Step 4: Apply the shared badge treatment and stable layout.** Reuse `.hit-tag` on the existing program marker, with scoped rules to reserve its space while visually and accessibly hidden for nonmatches. Keep `aria-hidden` accurate. Reserve space using a hidden placeholder label when no muscle is selected, sized for the longest fixed muscle label in the current font; don't hardcode a width that clips enlarged text. Keep the count and badge in a responsive metadata layout. Retain drag-handle clearance and day/action controls; do not add exercise collapse functionality to workout cards.
- [x] **Step 5: Extend `updateWorkoutHighlights()` to set `.is-muscle-muted` when `selectedMuscle !== null && !matches`.** Clear both match/muted classes on deselection. Ensure each newly rendered card gets the current state after duplicate, remove, move, drag reorder, mode toggle, and day assignment.
- [x] **Step 6: Run `npx playwright test e2e/layout-polish.spec.js e2e/program-overview.spec.js e2e/drag-reorder.spec.js e2e/session-editor.spec.js`.** Expect pass. Inspect desktop/mobile screenshots with and without selection, comparing workout cards to collapsed exercise cards; verify neutral surfaces, accent edge/shadow, pill badge, dimming, readable focus rings, and stable layout. Save review screenshots outside published assets.
- [x] **Step 7: Commit only the Task 2 files.** Suggested message: `style: align program workout cards with exercise cards`.

## Task 3: Verify the complete change for shipping

**Files:** No product changes expected; adjust only files above if verification exposes a regression.

**Interfaces:** Task 1 selection behavior and Task 2 shared styles must work together in both sequence and schedule modes.

- [x] **Step 1: Run `npm test`.** Expect exit code 0 and no failing unit tests.
- [x] **Step 2: Run `npm run test:e2e`.** Expect exit code 0 and no failing Playwright tests, including program mutations, drag reorder, layout, and session editor regressions.
- [x] **Step 3: Run `npm run build`.** Expect exit code 0; inspect the resulting diff to ensure no secrets/server files were added to published assets.
- [x] **Step 4: Review `git diff --check`, the scoped branch diff, and `git status --short`.** Confirm no unrelated package changes are included. Check all five Review Focus cases against the tests and screenshots. If fixes are required, rerun the affected checks before claiming success.
- [x] **Step 5: Hand off the verified change with test results and screenshots.** Publishing/deployment is a separate action; this plan prepares the implementation for review and shipping.

## Plan self-review

The plan covers row/map preview versus selection, click/tap/keyboard toggles, a single badge for all contribution types, visual parity including nonmatch dimming, transient state, rerender/reset behavior, responsive geometry, reduced motion, and the required verification commands. It preserves the session editor as the reference and avoids a shared-component rewrite or persistence changes.
