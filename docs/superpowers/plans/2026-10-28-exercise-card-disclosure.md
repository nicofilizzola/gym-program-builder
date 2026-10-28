# Exercise Card Disclosure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans for native execution, or superpowers:subagent-driven-development if the user selects delegation. Steps use checkbox (`- [x]`) syntax. Implementation is a separate phase from this planning request.

**Goal:** Make collapsed exercises open on a normal card click or tap while retaining whole-card dragging and an explicit, nearby collapse button in both workout editors.

**Architecture:** Keep disclosure state and rendering in the shared session editor. Keep gesture arbitration and post-drag click suppression in the existing sortable controller. Relocate the existing native disclosure button next to the exercise identity; do not turn the entire card into a button or introduce a second tab stop for the same action.

**Tech Stack:** Plain JavaScript ES modules, CSS, inline SVG, Playwright, node:test; no new dependencies.

**Spec:** The confirmed conversation design recorded below, together with `AGENTS.md` and `docs/design-system/README.md`. The user explicitly requested a written implementation plan for this bounded interaction change.

## Confirmed design

- Apply to exercise cards in session templates and program workout editors, which share `mountSessionEditor`. Program overview workout/rest cards keep their current behavior.
- A normal primary click or short tap on collapsed noninteractive card content opens that exercise. This includes its heading, summary, tags and padding. Interactive controls retain their own behavior.
- Expanded card background, heading, tags and fields never collapse it. The explicit chevron button collapses it and expands it when closed.
- Put the chevron immediately before the exercise identity, in the same location in both states. Keep it a native button separate from the semantic heading. Reorder and Remove remain an intact right-side action strip. Names remain complete and wrap; preserve the decorative index and screen-reader position context.
- Keep multiple exercises open independently. Disclosure never changes data, autosave, volume or duration. State follows exercises through reorder; new exercises start expanded and saved/imported exercises start collapsed.
- Whole-card dragging remains available from noninteractive content, including the name and summary. The chevron, Reorder, Remove and all other controls remain excluded from drag initiation.
- Preserve mouse/pen drag threshold 5px, touch hold 350ms, pre-hold touch movement cancellation above 8px and existing drag preview/drop behavior. A completed or canceled drag, armed hold, swipe, secondary click or multitouch gesture must not expand a card.
- Expand on release/click, never on pointerdown. No new activation delay or double-click gesture. Two quick background clicks can open but cannot immediately collapse the card.
- Keep the native disclosure button as the keyboard equivalent: Tab, Enter and Space; preserve `aria-expanded`, `aria-controls` and the existing accessible labels `Expand exercise` / `Collapse exercise`. On background expansion, focus this button with `preventScroll`; opening through the button retains focus there. Never autofocus an editing field or open the mobile keyboard. If a programmatic collapse would hide focus, return it to the disclosure button before making the body inert.
- Retain fields/summary grid-row, opacity and spacing transitions at 200ms ease-out, and existing chevron rotation at 150ms. Reduced motion changes disclosure instantly. Rapid reversal uses the current rendered state without stale completion callbacks; initial render and routine data refresh do not animate.
- Reuse surfaces, spacing and the existing icon-button hover/focus appearance. Add a collapsed-state attribute for styling and event guarding. Keep the grab cursor on draggable content and the normal action cursor on the chevron; the close chevron and subtle existing surface/border hover treatment signal opening without misrepresenting drag capability. Do not add a new card, helper paragraph per exercise or persistent accent fill.
- Use the shared action tooltip on the chevron, displaying `Expand exercise` or `Collapse exercise` for its current state. Keep tooltip lifecycle synchronized with the action so stale text cannot remain after a toggle.

## Global constraints

- Preserve the dark palette, orange accent, Barlow typography and existing compact layout.
- Controls are 32px only on desktop with a fine primary pointer and no available coarse pointer; touch/hybrid controls remain at least 44×44px. Native slider hit boxes remain 44px.
- Both desktop body figures remain at least 180px high. Preserve normal scrolling and existing panel behavior.
- Reuse the established disclosure transitions, inert behavior and focus-ring clearance. No `transition: all`, artificial delays or animation dependencies.
- No schema, migration, persistence, API, import/export or exercise prescription changes.
- Required final checks: `npm test`, `npm run test:e2e`, `npm run build`. Never migrate or seed during builds/requests. Any database setup must be explicit and local.

## File responsibilities

- `src/session-editor.js`: card markup, explicit disclosure state, guarded card click handling, focus and tooltip integration.
- `src/sortable.js`: only targeted fixes if real gesture tests expose an activation/cancellation leak; preserve its public interface and other consumers.
- `style.css`: identity/chevron grouping, compact responsive placement and collapsed hover/focus feedback.
- `docs/design-system/README.md`: exercise-card and reordering interaction contract, updated alongside authoritative CSS changes.
- `e2e/session-editor.spec.js`: disclosure, semantics, focus, motion and responsive checks.
- `e2e/drag-reorder.spec.js`: actual mouse/pen/touch arbitration and sorter regression coverage.
- `e2e/exercise-disclosure.spec.js` (new): full-route parity between template and program workout editors, using existing authentication/fixture patterns.

## Review Focus

1. Pointer capture retargets stationary mouse clicks to the card: test actual mouse input, not only dispatched click events (Task 1).
2. Cancellation, scrolling or a released touch hold leaks a synthetic click: test real touch sequences and post-gesture state (Task 1).
3. Nested SVG clicks trigger both control action and card activation: exercise nested control targets and confirm one action (Task 1).
4. Rapid disclosure reversals or bulk collapse strand focus in inert content: test keyboard focus, final state and transition behavior (Task 2).
5. Shared markup changes produce a phone-only detached chevron or divergent program behavior: test long-name layout and both actual editor routes (Tasks 2–3).

## Task 1: Add guarded card activation without changing dragging

**Files:** Modify `src/session-editor.js`; extend `e2e/session-editor.spec.js` and `e2e/drag-reorder.spec.js`; modify `src/sortable.js` only if required by failing gesture tests.

**Interfaces:** Consume `mountSortable(root, options)` and its existing capture-phase click suppression. Produce editor-local `setExerciseCollapsed(index, nextCollapsed, { focusToggle = false } = {}) -> void`; it updates transient state and calls `refresh()`, returning focus before hiding a focused body. No new sorter API.

- [x] **Step 1: Add failing browser tests.** Reuse the mounted editor fixture and assert the following named cases:
  - `collapsed card opens from heading summary and padding`: each target opens a fresh collapsed exercise once; its body loses `inert`, toggle becomes expanded, focus reaches toggle and `onChange` remains untouched.
  - `expanded background never collapses`: repeated primary clicks on heading, padding and visible editing content leave it open; explicit toggle closes it.
  - `nested action targets do not activate card`: click SVG paths inside toggle/Remove, plus Reorder; toggle changes once, Remove removes only its target, Reorder opens only its menu.
  - `real mouse clicks survive pointer capture`: stationary press/release and movement below 5px expand; a 5px-or-greater drag does not expand on drop or cancellation.
  - `touch activation excludes scrolling holds and cancellation`: short tap expands; pre-hold swipe scrolls without expanding; a 350ms armed hold released without movement remains collapsed; drag/drop, touchcancel and multitouch remain collapsed. A subsequent independent short tap still works.
  - `drag cancellation does not open cards`: extend existing Escape, pointercancel, lostpointercapture and outside-drop cases to assert disclosure state after release; include cancellation before a preview starts. Secondary mouse clicks do not open.
- [x] **Step 2: Run `npx playwright test e2e/session-editor.spec.js e2e/drag-reorder.spec.js`.** Confirm new opening assertions fail for the missing card activation, not fixture/setup errors.
- [x] **Step 3: Implement guarded disclosure.** Add the state helper and route the toggle through it. Handle noninteractive collapsed-card clicks only after explicit controls; exclude interactive ancestors, including disabled controls, labels, custom widgets and nested icons. Respect canceled/default-prevented events and non-primary activation. Use an explicit collapsed-state data attribute refreshed alongside ARIA. Rely on sortable capture-phase suppression rather than starting another gesture recognizer. If cancellation tests reveal suppression gaps, fix only those paths in the sorter; do not synthesize duplicate clicks or change its thresholds. Preserve default behavior in program overview consumers.
- [x] **Step 4: Rerun the targeted suites.** All new cases and existing drag/order/focus assertions pass; verify no new data change callback on disclosure.
- [x] **Step 5: Commit the behavior and tests** with `feat: open collapsed exercise cards on click and tap`.

## Task 2: Put the disclosure control beside the name and preserve complete motion

**Files:** Modify `src/session-editor.js`, `style.css`, `docs/design-system/README.md`; extend `e2e/session-editor.spec.js`.

**Interfaces:** Consume Task 1's disclosure helper/state attribute. Preserve `.card-identity`, `.card-name`, `.card-index`, `[data-action="toggle"]`, body IDs and existing heading accessible names. Use the existing `mountActionTooltips(root)` lifecycle and `data-action-tooltip` convention; reuse the editor's controller when already mounted.

- [x] **Step 1: Add failing layout/accessibility tests.** Assert the chevron precedes and sits beside the identity rather than the right action strip; Reorder/Remove remain separate, usable controls. Use long/duplicate/blank names, error and muscle tags. Assert Enter and Space toggle once, `aria-controls` resolves, closed fields are inert, and tooltip text tracks state. At normal motion, rapidly open/close/open and assert final expanded state and focus; test bulk collapse from a focused body and invalid-export expansion/focus. At reduced motion assert disclosure has zero transition duration.
- [x] **Step 2: Run `npx playwright test e2e/session-editor.spec.js`.** Confirm the new proximity/layout assertions fail against current markup.
- [x] **Step 3: Relocate the existing button into a compact identity group before the heading.** Keep heading semantics intact and the button outside it. Scope CSS so mobile's full-width identity row includes the chevron, not a detached control row. Reset the toggle's old auto margin in this group; preserve target sizes, wrapping and focus halos. Add collapsed-only hover feedback using existing tokens and explicit transition properties. Retain existing disclosure and reduced-motion CSS; synchronize tooltip text/hiding on state changes and teardown. Apply focus restoration before closing content becomes inert. Update the design system's Exercise card and Card reordering sections in the same change, distinguishing exercise cards from program overview cards.
- [x] **Step 4: Run `npx playwright test e2e/session-editor.spec.js e2e/drag-reorder.spec.js`.** Confirm the relocated button does not reduce drag surfaces, duplicate names, affect order or change prescription summaries.
- [x] **Step 5: Commit layout, documentation and tests** with `feat: move exercise disclosure beside its name`.

## Task 3: Verify both editor routes and ship a reviewable change

**Files:** Create `e2e/exercise-disclosure.spec.js`; make only fixes justified by the checks below in Task 1–2 files.

**Interfaces:** Consume the unchanged `mountSessionEditor` integration in the template and program workout routes. Reuse the actual route and authenticated fixture setup from existing e2e tests; do not add a second editor implementation or new testing dependency.

- [x] **Step 1: Add route-level parity tests.** For a populated saved template and a program workout, open via card name, close via nearby chevron, drag the collapsed exercise and verify it remains collapsed at its new position. Open two cards and confirm independence. Verify normal editing still autosaves while disclosure alone sends no document mutation; navigate away/back and verify saved data is unchanged and loaded exercises start collapsed.
- [x] **Step 2: Run `npx playwright test e2e/exercise-disclosure.spec.js`.** Expect both route cases to pass; fix integration failures before continuing.
- [x] **Step 3: Inspect populated screens in a real browser.** Cover 1366×768, 1440×900, 1920×1080, phone 390px and tablet 768px; include 200% text and a hybrid touch context. Use mixed open/closed cards, long names, errors, muscle highlight tags and linked/custom exercises. Check overflow, control grouping, density, body figures >=180px on desktop and reachable content. Save screenshots as review artifacts without committing temporary fixture data.
- [x] **Step 4: Play the interactions with normal and reduced motion.** Exercise tap/click, actual mouse and touch dragging, swipe scrolling, rapid reversal, bulk controls, keyboard/focus, Reorder menu, tooltip state and invalid-export focus. Observe intermediate motion and moving neighbors, not just final screenshots. Confirm no initial animation and no abrupt removal of closing content. Record checked contexts and any gaps in the implementation handoff.
- [x] **Step 5: Run `npm test`, `npm run test:e2e`, `npm run build`.** Require all commands to exit successfully; report actual evidence and any environment blockers rather than claiming unrun checks passed. No deployment or database operation is implied.
- [x] **Step 6: Review the final diff against every confirmed design bullet and global constraint.** Check shared-sorter changes against program overview dragging if any were needed. Commit parity coverage and justified fixes with `test: verify exercise disclosure across workout editors`.

## Planning review

This plan covers the approved click-to-expand behavior, explicit nearby collapse, both editor contexts, preserved drag gestures, motion, accessibility and required verification. It makes no implementation or browser-verification claim. The first task deliberately tests native input because source inspection alone cannot establish how pointer capture and synthetic touch clicks behave.


## Implementation verification (2026-10-28)

- Implemented in `feat/exercise-card-disclosure`, shared by templates and program workout editors.
- `npm.cmd test`: 148 passed. `npm.cmd run test:e2e`: 186 passed. Final editor/layout checks after the hybrid alignment correction: 9 passed. `npm.cmd run build`: passed.
- The first full browser run had one timeout in `stale clone variant drafts refresh their reference without losing fields`; it passed isolated and in the repeated full suite without a catalog code change. No evidence connects that intermittent timeout to this change.
- Inspected populated Chromium layouts at 1366?768, 1440?900, 1920?1080, 390px phone and 768px tablet, plus 200% text and hybrid targets. Included linked/custom exercises, long names, muscle tags and a collapsed invalid exercise.
- Exercised native mouse, emulated pen/touch, touch scroll/hold/drag, cancellation, nested control clicks, keyboard/focus, Reorder, export-error focus, rapid disclosure reversal and reduced motion. A real-browser motion probe measured intermediate heights/opacity in both directions, moving neighbors, immediate inert state on closing and no initial animation.
- Independent review: no Critical/Important findings. Corrected its minor hybrid alignment finding: name/summary x positions changed from 116/104 to 116/116, with a persistent hybrid regression assertion. No deferred findings.
- Verification gaps: physical devices, manual screen-reader use and non-Chromium browsers were not tested.

Execution decisions: use equivalent Windows `.cmd` launchers because PowerShell blocks `.ps1` launchers (no product effect); add optional scoped tooltip ownership to avoid overlapping picker controllers (existing caller defaults retained, catalog checks passed); overlap read-only final review with repeated full verification (both completed before handoff); correct the minor hybrid offset within this feature's alignment acceptance criteria (final layout checks passed).
