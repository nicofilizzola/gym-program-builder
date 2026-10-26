# Whole-card Dragging Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans for native execution, or superpowers:subagent-driven-development if the user selects delegation. Steps use checkbox (`- [ ]`) syntax. Implementation is a separate phase from this planning request.

**Goal:** Let users reorder every currently draggable card from its noninteractive content, while preserving editing, touch scrolling and accessible movement alternatives.

**Architecture:** Extend the shared sortable controller to distinguish card drag initiation from accessible Reorder actions. Views retain ownership of ordering, day assignments, rendering and persistence. Keep the existing ghost, placeholder, drop targeting and single-commit behavior; introduce a touch hold state without disabling normal page scrolling.

**Tech Stack:** Plain JavaScript ES modules, CSS, inline SVG, Playwright and node:test; no new dependencies.

**Spec:** Confirmed conversation decisions in the following section; preserve `AGENTS.md`, `docs/design-system/README.md` and the compact desktop design. The user explicitly requested a written implementation plan for this bounded change.

## Confirmed behavior and implementation decisions

- Scope: exercise cards in template editors and program workout editors; program workout cards in Sequence, weekday groups and Unscheduled. Expanded and collapsed exercises both support dragging.
- Mouse/pen: drag from backgrounds, headings, summaries and other noninteractive content. Preserve the existing 5px movement threshold. A stationary click must not reorder or open anything.
- Exclude buttons (including disabled and aria-disabled actions), inputs, sliders, selects, textareas, links, labels, editable content and custom interactive widgets. Check ancestors inside the originating card, including clicks on SVGs inside controls. Excluded controls retain native click, focus, selection and slider behavior.
- Touch: a normal swipe scrolls. A 350ms stationary hold on eligible card content arms dragging; movement beyond 8px before that cancels the candidate and allows scrolling. After arming, movement starts the existing preview. Touch release without dragging does not reorder. These numeric values are implementation defaults for the approved brief hold.
- Remove the dotted drag affordance. Replace it with a compact visible `Reorder` button using existing control tokens; it is an action, excluded from pointer drag initiation. Eligible desktop content uses a grab cursor; controls retain their usual cursors. Show concise helper text: `Drag a card to reorder. On touch, press and hold. Use Reorder for movement options.`
- Reorder opens Move up/Move down options. Program Week additionally offers destination choices Monday through Sunday and Unscheduled, allowing movement into empty groups without dragging. Reuse existing domain operations. Keep existing program movement buttons/day selector while present; removing them belongs to the separate program-update plan.
- Up/Down on the focused Reorder button retains current within-list/group keyboard movement. Menu Escape closes and returns focus; movement restores focus to the moved Reorder button and announces its position/destination. Existing day assignments and canonical ordering rules remain authoritative.
- No persisted gesture, menu or disclosure state, no timing/domain/JSON changes, no migration and no production deployment in this task.

## Global constraints

- Preserve the dark palette, orange accent, Barlow typography and existing compact layout.
- Desktop compact controls apply only at the existing fine-pointer breakpoint with no coarse pointer. Touch/hybrid actions remain at least 44×44px; native slider hit boxes remain 44px.
- Both desktop body figures remain at least 180px high. Preserve normal document scrolling, panel flow fallback, reduced motion, tooltips, focus and live volume.
- Required final checks: `npm test`, `npm run test:e2e`, `npm run build`. Database setup, if needed, is explicit and local; never migrate or seed on builds/requests.
- Another untracked plan exists at `docs/superpowers/plans/2026-10-24-program-week-sequence-updates.md`. Do not overwrite or implement it here. Recheck actual renderers at execution time; if that work has landed, include any newly draggable rest cards and preserve its keyboard/day movement contract.

## File responsibilities

- `src/sortable.js`: eligible targets, gesture state, touch arbitration, cancellation and preview lifecycle.
- `src/session-editor.js`: exercise Reorder action, menu lifecycle, keyboard focus and announcements.
- `src/program-view.js`: program Reorder action, group/destination choices, focus and announcements.
- `style.css`: card cursors, Reorder button layout and removal of drag-only touch suppression.
- `docs/design-system/README.md`: final interaction, helper copy and control sizing.
- `e2e/drag-reorder.spec.js`: real mouse/touch gesture and cancellation coverage; extend relevant editor/program/layout tests where their selectors or controls change.

## Review Focus

1. Touch swipe becomes trapped by card-wide touch suppression: Task 2 tests actual touch scrolling before a hold.
2. Nested icons, labels or disabled actions accidentally initiate a drag: Task 1 tests ancestor-based exclusion.
3. A delayed hold fires after navigation, cancellation or a second finger: Task 2 tests timer and listener cleanup.
4. Removing handles leaves keyboard users unable to move across days: Task 3 tests destination menus including empty days and Unscheduled.
5. A drop triggers a stray click or stale save: Tasks 1 and 4 test click suppression, exactly one mutation and persisted order.

## Task 1: Enable eligible card surfaces in the shared sorter

**Files:** Modify `src/sortable.js`, `src/session-editor.js`, `src/program-view.js`; test `e2e/drag-reorder.spec.js`.

**Interfaces:** Change `mountSortable(root, {itemSelector, reorderSelector, getGroups, getKey, onCommit})`; replace both callers' `handleSelector` with `reorderSelector`. The selector locates the card's focus restoration action, not a drag region. Retain `{cancel(), destroy()}` and commit payload `{key, groupKey, beforeKey}` unchanged. Initially the selector may still match the existing handle until Task 3 replaces it.

- [ ] Add failing browser tests starting drags from exercise headings, collapsed summaries, expanded card padding, workout titles and metadata; verify preview follows the pointer and commit happens only on release.
- [ ] Add exclusion tests for editable name/combobox, slider track/thumb, muscle label/chip, equipment select, nested button SVG, disabled action, link and contenteditable fixture. Exercise their normal interactions and assert no ghost or reorder mutation. Test right-click and sub-5px movement as no-ops.
- [ ] Run `npx playwright test e2e/drag-reorder.spec.js`; confirm new eligible-surface assertions fail on the current implementation.
- [ ] Resolve the nearest owned item from the event target; reject interactive ancestors before preventing defaults or capturing input. Keep exclusions within card boundaries and reject items outside the mounted root. Capture only eligible gestures; restore focus to `reorderSelector` after an actual drag, never steal focus on a rejected gesture or ordinary click.
- [ ] Update both callers and cancellation tests. Preserve Escape, outside-drop cancellation, pointer cancellation, clone ID stripping, reduced motion, edge scrolling and exactly one data commit. Suppress the click generated by an actual drag without swallowing the next independent click.
- [ ] Run the targeted suite; expected PASS. Commit as `feat: allow dragging from noninteractive card content`.

## Task 2: Add touch hold while preserving browser scrolling

**Files:** Modify `src/sortable.js`, `style.css`; test `e2e/drag-reorder.spec.js`.

**Interfaces:** Internal states are idle → pending hold → armed → dragging. Mouse/pen continue through the existing threshold path. Touch uses the 350ms/8px contract above and shares preview/finish logic; no public API change.

- [ ] Add real Chromium touch tests using CDP input: immediate swipe scrolls with zero mutations; moving beyond 8px before 350ms never arms; stationary hold then move previews and drops once; hold then release without moving does not commit. Include touch on sliders and buttons.
- [ ] Add cancellation tests for second finger, touchcancel, teardown during pending hold, view rerender and cancellation after arming. Assert no late ghost, stuck capture, blocked scroll or mutation. Verify hybrid mouse dragging still works.
- [ ] Run `npx playwright test e2e/drag-reorder.spec.js`; confirm touch-contract failures before implementation.
- [ ] Implement native-touch arbitration: keep browser panning enabled at rest; use narrowly scoped nonpassive touch handling to prevent default on movement only after an eligible hold has armed. Track a single touch identifier and avoid duplicate handling through pointer and touch streams. Clear hold timers on every cancellation/finish/destroy path; remove all listeners on destroy.
- [ ] Do not solve arbitration with permanent card-wide `touch-action:none` or a late touch-action toggle: the former blocks scrolling and the latter cannot reliably change an already-started gesture. Validate the chosen touch path on real browser input before proceeding.
- [ ] Remove obsolete handle-specific touch suppression; prevent text selection/context menu only for the active eligible touch hold/drag, without disabling controls or ordinary link menus. Give arming subtle accent-border feedback using existing tokens and reduced-motion rules.
- [ ] Run the targeted suite and check touch scrolling in a mobile browser, including Safari/iOS when available. Record unavailable device coverage explicitly. Expected automated checks PASS. Commit as `feat: add hold-to-drag touch gestures without blocking scroll`.

## Task 3: Replace dotted handles with accessible Reorder actions

**Files:** Modify `src/session-editor.js`, `src/program-view.js`, `style.css`, `docs/design-system/README.md`; update `e2e/drag-reorder.spec.js`, `e2e/session-editor.spec.js`, `e2e/programs.spec.js`, `e2e/compact-desktop.spec.js` as needed.

**Interfaces:** Both views render `.reorder-action` buttons; sorter `reorderSelector` becomes `.reorder-action`. Exercise accessible name remains `Reorder exercise`; program name remains `Reorder {workout name}`. Use these selectors for focus restoration instead of `.drag-handle`.

- [ ] Add tests asserting visible Reorder text, no dotted handles, Up/Down movement with retained focus, menu activation by mouse/tap/Enter/Space, boundary options disabled, outside dismissal and Escape focus return. Assert no drag begins on Reorder itself.
- [ ] Add Week tests moving via Reorder to an empty day, another populated day and Unscheduled; verify destination, within-group append order, one mutation and a live announcement. Exercise menu cleanup on rerender/navigation and no stale menu indices after reorder/remove.
- [ ] Run the targeted editor/program/drag suites and confirm failures for the new action/menu expectations.
- [ ] Replace handle markup and selectors, retaining the exercise menu's current behavior. In program menus use current `moveWorkout` for relative moves and `assignDay`/`placeWorkout` for destination changes; selecting the current destination is a no-op. Ensure menus are not clipped by collapsible exercise wrappers or schedule columns and have viewport-safe placement.
- [ ] Replace drag-only positioning/left gutters with normal header/action layout sized for the Reorder text. Add eligible-content grab cursor with interactive-descendant overrides. Keep focus rings, target sizes, long-name wrapping and all existing header actions. Update authoritative CSS first, then document behavior and helper copy in the design-system README.
- [ ] Run `npx playwright test e2e/drag-reorder.spec.js e2e/session-editor.spec.js e2e/programs.spec.js e2e/compact-desktop.spec.js`; expected PASS. Commit as `feat: replace drag handles with accessible reorder actions`.

## Task 4: Verify integrated behavior and prepare the shipping change

**Files:** Extend `e2e/drag-reorder.spec.js`, `e2e/persistence.spec.js` and affected layout assertions; record execution evidence in this plan.

**Interfaces:** Final rendered UI and existing save/revision flow; no new storage interface.

- [ ] Update existing gesture helpers to target eligible surfaces and focus assertions to target Reorder. Preserve all existing cancellation, animation, schedule-crossing and autosave/reload coverage; do not merely delete old handle tests.
- [ ] Add an integrated exercise reorder inside a program workout and a cross-day whole-card drop with save/reload. Assert names, prescriptions, rest/timing, collapse state during movement, volume and day assignments remain correct; previews/cancelled holds never save. Verify immediate control activation after a finished drag works.
- [ ] Run the targeted browser cases and fix any integration regressions.
- [ ] Inspect populated template and program views at 1366×768, 1440×900, 1920×1080, 390×844 mobile and 820×1180 tablet. Include long names, expanded/collapsed cards, scheduled groups and Unscheduled. Check normal scrolling, no overflow, visible Reorder actions, reachable menus and body figure prominence.
- [ ] Check 200% text, keyboard-only use, reduced motion, touch and hybrid input. Verify 44×44px touch/hybrid actions, 44px sliders and desktop figures at least 180px. Record screenshots/findings and any physical-device testing limitation.
- [ ] Run `npm test`, `npm run test:e2e`, `npm run build`; expected all exit 0. If test database setup is missing, run the documented explicit local setup before rerunning; never target production.
- [ ] Review the diff for obsolete `.drag-handle` dependencies, leaked timers/listeners, unintended data changes, dependencies and unrelated edits. Record actual results, then commit as `test: verify whole-card reordering across input methods`.

## Planning self-review

Confirmed decisions map to Tasks 1–3; Task 4 verifies persistence and responsive behavior. Each review-focus failure has an owning test. Touch-scroll arbitration is explicitly verified rather than assumed. Current draggable surfaces share one controller; future rest cards are covered only if present at execution time. Implementation and deployment have not been performed by this planning task.
