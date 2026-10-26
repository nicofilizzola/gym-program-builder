# Inline Exercise Actions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans or superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Make linked exercise actions directly available in both session template and program workout editors, removing the Actions menu interaction.

**Architecture:** Change the shared `mountExercisePicker` presentation without changing its public interface or persistence. Reuse `actionIcon` and `mountActionTooltips` from `src/action-controls.js`; keep autocomplete suggestions in their existing popover. Use existing action-button sizing and visual tokens.

**Tech Stack:** Vanilla JavaScript, CSS, native popovers, Playwright, Node.js 24; no new dependencies.

**Spec:** The agreed bounded design is recorded below, based on the user's inline-actions request and confirmation that it applies to both editors. Follow `docs/design-system/README.md` and the repository AGENTS.md.

## Agreed design

- Replace Actions with three always-visible icon buttons in this order: Replace exercise, Create variant, View in catalog. They appear beside the linked exercise name inside the expanded card. Collapse behavior stays unchanged.
- Use swap arrows (`move`), overlapping sheets (`duplicate`), and a book/catalog outline (new `catalog` icon) respectively. All icons are 20px currentColor strokes with decorative SVG semantics.
- Each button has the exact accessible name listed above; the surrounding exercise card provides context. Each uses the same text as its shared hover/focus tooltip.
- Keep the three-button strip together with 8px gaps. Let the strip wrap beneath the complete name when space is limited; never truncate names, stretch individual buttons or add horizontal scrolling.
- Targets are 32px square only at desktop >=1100px with a fine primary pointer and no available coarse pointer; otherwise 44px square, including hybrid devices.
- Create variant is focusable with `aria-disabled="true"` when the reference exercise is archived. Its tooltip says `Restore the reference exercise before creating a variant.` Hover, focus and touch activation expose the reason; activation never opens a form or sends a mutation. Refresh updates the restriction in place.
- Replace opens the existing picker immediately. Cancel selection and exiting replacement with Escape return focus to Replace exercise. Existing confirmation and selection behavior remain intact.
- Create variant opens the existing form immediately. Canceling the form returns focus to Create variant; successful selection retains the editor's existing focus behavior. View in catalog uses the existing navigation callback immediately.
- Keep custom/unlinked exercise linking and new-exercise autocomplete controls unchanged. No action menus are introduced elsewhere.

## Global Constraints

- Preserve dark surfaces, orange accent, Barlow typography and existing focus and reduced-motion behavior.
- Preserve prescriptions, especially independent `restSeconds`, sets and reps, across replacement and variant creation.
- Preserve autosave acknowledgement coordination, dirty edits, revisions, recovery and open form drafts during background refresh/save.
- No database, migration, seed, wire-format or persisted UI-state changes.
- Change authoritative styling in `style.css`, then document the resulting pattern in `docs/design-system/README.md` in the same change.

## Review Focus

1. Long names, narrow cards and 200% text: whole strip wraps with every action reachable (Task 2).
2. Archived parent changing during focus refresh: restriction updates without losing focus or permitting creation (Task 1).
3. Replacement cancellation and form cancellation: focus returns to the corresponding inline action (Task 1).
4. Repeated mount/collapse/navigation: no orphaned tooltip or duplicate event handlers (Task 1).
5. Touch/hybrid input: 44px targets and disabled reason available without hover (Task 2).

## File responsibilities

- `src/exercise-picker.js`: inline controls, action state, focus and tooltip lifecycle; delete obsolete menu state/listeners/DOM.
- `src/action-controls.js`: add only the missing catalog/book icon path; reuse existing tooltip controller unchanged unless a demonstrated lifecycle defect requires a fix.
- `style.css`: wrapping action strip, name sizing and unavailable-action appearance; remove obsolete exercise-menu rules after checking remaining usages.
- `docs/design-system/README.md`: replace in-card action-menu guidance with the inline pattern; preserve autocomplete popover guidance.
- `e2e/exercise-actions.spec.js` (new): behavioral and layout coverage for both editors.
- Existing affected specs: `e2e/catalog.spec.js`, `e2e/catalog-layout.spec.js`, `e2e/duration-catalog.spec.js`, `e2e/reference-exercises.spec.js`.

### Task 1: Expose the three shared exercise actions directly

**Interfaces:** Consume `actionIcon(name): string` and `mountActionTooltips(root): {hide(), destroy()}`. Preserve `mountExercisePicker(host,{api,exercise,onSelect,onView,legacy=false})` and its returned `{close,update,refresh,destroy}` controller. Add icon key `catalog`; add `.exercise-definition-actions` for the strip and stable `data-exercise-action="replace|variant|catalog"` selectors.

- [x] **Step 1: Write behavioral tests** in `e2e/exercise-actions.spec.js`, following existing authenticated/API fixture patterns. Parameterize a linked template and a linked program workout. Assert all three named buttons are visible on expansion, in the agreed order, and Exercise actions is absent. Assert direct Replace opens the combobox, cancel/Escape restore focus, rejected replacement changes nothing, accepted replacement preserves sets/reps/rest. Assert direct Create variant opens its dialog, cancel restores focus, and saving switches only the invoking exercise. Assert direct View in catalog navigates via the existing route.
- [x] **Step 2: Add lifecycle and restriction tests.** Assert an archived reference produces `aria-disabled="true"`, focus reveals the exact restriction tooltip, activation opens no dialog and sends no catalog mutation. Change archive state through the existing API fixture and dispatch window focus: assert restriction refreshes in place and focused button remains focused. Open a tooltip, collapse/navigate away, and assert no visible orphan tooltip; revisit and verify a single activation opens one form. Retain the existing delayed-save/open-variant-draft regression.
- [x] **Step 3: Run** `npx playwright test e2e/exercise-actions.spec.js`. Expect failures because inline buttons do not yet exist.
- [x] **Step 4: Implement** the strip in `src/exercise-picker.js` and the `catalog` icon in `src/action-controls.js`. Build controls once, update metadata/aria-disabled during `display()`, and guard variant activation against current store state. Mount tooltips on the picker host; hide on actions, replacement, close and collapse, destroy on teardown. Remove menu DOM, `menuOpen`, menu positioning, menu-specific Escape/outside/scroll handling and obsolete cleanup. Keep suggestion handling intact. Replace references to the old Actions focus target with the Replace control. Use the form's existing `onClosed` option for cancellation focus, guarded against disposed/disconnected hosts; do not force focus during a successful selection/rerender.
- [x] **Step 5: Update existing tests** in all four affected specs: remove menu-opening clicks and target direct action buttons. Change the archived-reference assertion from native disabled to `aria-disabled`, and explicitly focus/activate to reveal its reason. Preserve their original assertions about duration, navigation, dirty saves and catalog drafts.
- [x] **Step 6: Run** `npx playwright test e2e/exercise-actions.spec.js e2e/catalog.spec.js e2e/catalog-layout.spec.js e2e/duration-catalog.spec.js e2e/reference-exercises.spec.js`. Expect all tests to pass.
- [x] **Step 7: Commit** only Task 1 files with message `feat: expose inline exercise actions in shared editor`.

### Task 2: Make the strip compact, responsive and documented

**Interfaces:** Consume Task 1's `.exercise-definition-actions`, existing `.action-button`, and `[aria-disabled=true]`. Keep visual values authoritative in `style.css`.

- [x] **Step 1: Add layout assertions** to `e2e/exercise-actions.spec.js` using populated fixtures with a long exercise name. At 1366x768, 1440x900 and 1920x1080 fine-pointer desktop, assert each target is at least 32x32, buttons remain horizontal with 8px gaps, and no page overflow. At 390px phone and 768px tablet, assert targets >=44x44 and the strip fits inside its card. Emulate hybrid input at desktop width and assert >=44x44. At 200% text assert the full name and complete strip fit without clipping or overlap. Verify both body figures retain at least 180px desktop height.
- [x] **Step 2: Run** `npx playwright test e2e/exercise-actions.spec.js`. Expect the new wrapping/style assertions to expose any missing layout rules; do not require an artificial failure if existing shared styles already satisfy a case.
- [x] **Step 3: Implement CSS and documentation.** Make the definition head wrap; give the name a flexible basis and `min-width:0`, keep the strip `flex:none`, horizontal and nonwrapping, with 8px gaps. Reuse shared action-button sizing and add scoped unavailable opacity/cursor styling. Remove unused `.exercise-menu` rules after a repository search. Update the design-system exercise catalog section to describe this strip, icon meanings, responsive placement, focus destinations, and archived-parent tooltip behavior.
- [x] **Step 4: Inspect screenshots** of populated template and program workout editors at the three desktop sizes, phone/tablet widths, 200% text, and touch/hybrid input. Check strip wrapping, name readability, focus rings, unclipped top-layer tooltips, figure prominence and reachable content; fix defects and rerun affected assertions. Include normal-motion and reduced-motion tooltip checks.
- [x] **Step 5: Run required release verification:** `npm test`, `npm run test:e2e`, `npm run build`. Each must exit 0. No migrations or seeds are required for this UI change; use the existing test server fixtures.
- [x] **Step 6: Review** the final diff against the agreed design and all five Review Focus conditions. Ensure no stale Exercise actions references remain in active code/tests, autocomplete still works by keyboard, and unrelated work is excluded.
- [x] **Step 7: Commit** Task 2 files with message `style: compact inline exercise action strip`.

## Handoff

Implemented natively on `feat/inline-exercise-actions`, based on `main` at `73e9036`. Feature commit: `442a2bb`. Deployment and integration remain separate decisions.

## Execution record

- Required verification passed: `npm.cmd test` (140 tests), `npm.cmd run test:e2e` (136 tests), `npm.cmd run build` (exit 0). `.cmd` avoids the workstation's PowerShell script execution restriction.
- Fresh read-only whole-change review found no actionable issues and declined to judge no behavior. Independent Chromium checks confirmed 32px mouse and 44px touch controls.
- Inspected populated template screens at 1366x768, 1440x900 and 1920x1080, program workout screens at these sizes, 390px phone and 768px tablet, plus 200% text. Narrow-screen tests click Replace and cancel to prove reachability around the fixed volume panel. Both body figures retain >=180px desktop height.
- Existing form invoker restoration already supplies cancellation focus. It was reused instead of adding an onClosed override; both editor tests prove the result. If this assumption changes, cancellation focus could regress.
- Kept the valid git-created isolated worktree after discovering the native tool later; recreating it would add state without improving isolation. Cost if wrong: native UI worktree management may not list it automatically.
- Implemented the two closely related tasks together and committed source, styles, tests and authoritative design documentation atomically to keep the feature reviewable and the commit passing. Cost: the tasks cannot be reverted independently.
- Started the read-only final review during full-suite runtime, then completed verification before handoff. Cost if wrong: a later code change would need review; none followed.
- Corrected test fixture synchronization and selector scope, and measured alignment in a single DOM snapshot so expansion motion cannot move coordinates between measurements. These were test defects; production behavior did not change during final verification.
- No deferred review findings. No database migrations or seeds were run outside the test server's existing isolated fixture setup.
