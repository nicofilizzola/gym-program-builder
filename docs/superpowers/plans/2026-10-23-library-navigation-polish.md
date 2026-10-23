# Library and Navigation Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking. Subagent-driven-development is an alternative only if selected by the user.

**Goal:** Make navigation and both libraries cleaner and more responsive to interaction, with aligned creation actions, clickable titles, and accessible icon actions.

**Architecture:** Keep the existing vanilla JavaScript views and callbacks. Add a small shared action-icon/tooltip module for the shell and library; scope CSS to those surfaces so exercise controls keep their current appearance and behavior.

**Tech Stack:** Native HTML, CSS, JavaScript modules, inline SVG, Playwright, Node.js 24.

**Spec:** The design brief below records the user's requested changes and delegated design choices; no separate architectural spec is needed for this bounded UI change.

## Design brief

- Preserve the dark surfaces, orange accent, and current typography.
- Style the two text navigation links as rounded tabs. The active tab has a subtle orange background and a persistent visual indicator in addition to text colour; hover and keyboard focus are distinct. Use 150 ms ease-out colour/background/border transitions and a subtle pressed state, with no layout shifts or page transition animation.
- Replace visible logout text with a door-and-arrow SVG button. Keep its accessible name `Log out` and existing save/navigation safeguards.
- Put New and Import together in a horizontal toolbar in both libraries. New is orange with a plus icon; Import is secondary with an arrow-into-tray icon. Keep the existing text labels. Override the full-width `.add-btn` behavior only in the library toolbar. At 320 CSS px both actions must fit; allow graceful wrapping at larger text zoom rather than clipping.
- Make each record title a real link to its existing editor route, including untitled fallbacks. Remove Open. Use the existing guarded navigation path for ordinary activation; retain native modified-click/new-tab behavior.
- Show Duplicate, Export, and Delete as three directly visible 44 × 44 px icon buttons, separated by at least 8 px. Use copy, arrow-out-of-tray, and trash SVGs with consistent 20 px geometry and currentColor strokes. Neutral actions use a subtle surface on hover/focus; Delete uses the existing destructive colour. Keep the delete confirmation.
- Titles occupy the flexible left area. Long titles wrap; actions stay grouped and can move below the title on phones. No ellipsis that hides the only visible name, no whole-row click handler, and no overflow menu.
- Icon buttons have contextual accessible names such as `Duplicate Upper A`. Decorative SVGs are aria-hidden and not focusable. The title link's accessible name is its visible title.
- Provide visible tooltips for logout and row actions on pointer hover and keyboard focus, with a short 150 ms entrance delay. Labels are `Log out`, `Duplicate`, `Export`, and `Delete`. Dismiss on Escape, blur/pointer departure, action activation, scroll, route change, or view teardown. A hovered tooltip stays readable while the pointer is over it. Show only one at a time, keep it within 8 px of viewport edges, and avoid clipping. Do not require a first tap to reveal a tooltip before executing an action on touch. Native title attributes alone are insufficient.
- Tooltips fade over 150 ms; reduced motion disables all added transitions. Keep visible focus rings and readable contrast. Do not redesign save/conflict controls or workout rows inside programs.

## Global Constraints

- No frontend framework, icon library, animation dependency, or browser persistence.
- Icons are inline SVG in the markup, with no icon library or font.
- Preserve autosave, error recovery, confirmations, import/export validation, and existing domain behavior.
- Publish only index.html, style.css and browser src assets through the existing build.
- Verification: npm test, npm run test:e2e, npm run build.
- No database/schema changes; no migration is needed for this UI work.
- Existing unrelated changes in package.json must be preserved and excluded from these commits.

## Review Focus

1. Duplicate or empty record names: links and actions target the correct record ID and retain readable fallback names.
2. Narrow screens and long names: actions stay operable with 44 px targets and no horizontal overflow, including zoom.
3. Failed saves and ordinary title navigation: the existing navigation guard still protects edits; modified clicks retain browser semantics.
4. Tooltip lifecycle: fast focus/hover changes, removal, and routing never leave stale overlays or listeners.
5. Keyboard and reduced motion: every action remains named, focus-visible, and usable without hover or animation.

## File map

- Create `src/action-controls.js`: fixed inline SVG definitions and lifecycle-managed simple action tooltips.
- Modify `src/library-view.js`: toolbar markup, title links, contextual icon actions, tooltip lifecycle.
- Modify `index.html`: logout icon markup and tooltip trigger metadata.
- Modify `src/app.js`: initialize shell tooltips; provide library route URLs while retaining guarded navigation.
- Modify `style.css`: scoped navigation, library toolbar/row/action, and tooltip styles.
- Create `e2e/library-navigation.spec.js`: focused interaction and responsive coverage.
- Modify existing e2e files using Open button selectors to use title links.

### Task 1: Polish navigation and establish accessible shell action controls

**Files:** Create `src/action-controls.js`, `e2e/library-navigation.spec.js`; modify `index.html`, `src/app.js`, `style.css`.

**Interfaces:**
- Produce `actionIcon(name: 'plus'|'import'|'duplicate'|'export'|'delete'|'logout'): string`, returning trusted static decorative SVG markup only, never interpolating record data.
- Produce `mountActionTooltips(root: Element): {hide(): void, destroy(): void}`, using `[data-action-tooltip]` labels. It owns one tooltip and delegated hover/focus listeners within its root; destroy removes overlays, listeners, and pending timers. Reuse `tooltipPosition` from `src/tooltip.js` for placement. Use a native manual popover for the overlay and `role="tooltip"`; associate the currently shown trigger using aria-describedby without removing any preexisting descriptions.
- Consume existing logout listener and navigation links without changing their IDs or hrefs.

- [x] Add Playwright coverage for a `Log out` button with no visible text, an aria-hidden SVG, and a tooltip on focus/hover. Assert Escape hides the tooltip while focus remains, and clicking logs out successfully.
- [x] Run `npx playwright test e2e/library-navigation.spec.js` and confirm the new behavior assertions fail for the intended reason.
- [x] Implement the module interfaces and initialize shell tooltips once in `src/app.js`; hide them on route transitions and when showing login. Render the logout SVG without replacing the existing button or its listener.
- [x] Add scoped rounded navigation tabs, active background/indicator, hover/focus/pressed feedback, neutral shell action styles, and tooltip styles. Use 150 ms transitions with a reduced-motion override. Do not reuse `.icon-btn` unqualified: its existing hover rule makes every action red.
- [x] Verify tab selection on both library and editor routes, keyboard focus, logout behavior, and computed zero transition duration under reduced motion. Use a test with `reducedMotion: 'no-preference'` to confirm normal transition durations, since the Playwright configuration defaults to reduced motion.
- [x] Run the focused test file and commit only task files after it passes.

### Task 2: Align library toolbars and replace row controls

**Files:** Modify `src/library-view.js`, `src/app.js`, `style.css`, `e2e/library-navigation.spec.js`, and existing e2e files found by `rg -n 'Open ' e2e`.

**Interfaces:**
- Extend `mountLibrary` options with `recordHref(record): string`; provide it from `src/app.js` as the current library's existing editor route using record ID.
- Keep `onOpen(record)` and all create/import/duplicate/export/delete callback signatures unchanged.
- Consume Task 1's icon and tooltip interfaces. Mount one tooltip controller per library; hide before `update` removes row DOM and destroy before clearing the view.

- [x] Add parameterized tests for programs and templates: New/Import retain exact accessible names and show decorative icons; titles are links to the matching record ID; Open buttons are absent; Duplicate/Export/Delete have contextual names and invoke only their own actions.
- [x] Add duplicate-name and empty-name cases scoped by `.library-item`, asserting the distinct hrefs and expected untitled labels. Test hostile-looking names as literal text, with no HTML interpretation.
- [x] Run the focused tests and confirm the new title-link/markup assertions fail before implementation.
- [x] Implement toolbar icons and scoped sizing; create titles with DOM APIs/textContent. Intercept only an unmodified primary link activation to prevent default and call `onOpen(record)`; let modified clicks use the real href. Do not add a card-level click listener.
- [x] Render the three action buttons with static SVGs, data tooltip labels, contextual aria-labels, and existing callbacks. Preserve all native file-picker and confirmation behavior.
- [x] Update existing Open-button test selectors to title links, retaining the original behavioral assertions. Search all e2e files rather than only libraries.spec.js; programs, persistence, import/export, and recovery flows may open records too.
- [x] Test that canceled Delete preserves the row; Duplicate produces an independent record; Export still downloads a valid document; Import still opens its file picker. Test ordinary title activation through the existing navigation path and modified activation without invoking onOpen. Retain/run existing recovery coverage for blocked navigation during failed saves.
- [x] Run `npx playwright test e2e/library-navigation.spec.js e2e/libraries.spec.js e2e/programs.spec.js e2e/recovery.spec.js e2e/import-export.spec.js e2e/persistence.spec.js`; commit task files after passing.

### Task 3: Verify responsive layout, tooltip lifecycle, and release readiness

**Files:** Extend `e2e/library-navigation.spec.js`; adjust only affected UI files if verification reveals issues.

**Interfaces:** Consume the completed shell and library controls; add no domain or server interfaces.

- [x] Add layout assertions at 320, 375, 768, and 1280 CSS px for both library kinds: New and Import share a row at normal text size; document width does not exceed viewport width; action buttons remain at least 44 × 44 px with 8 px spacing. Use a long unbroken title and a duplicate name. Verify readable reflow with enlarged text, allowing the toolbar to wrap.
- [x] Add keyboard coverage: title links activate with Enter; icon buttons activate with Enter/Space; tooltips appear on focus, dismiss on Escape, and never intercept action clicks. Test reduced-motion behavior and visible focus styling.
- [x] Add tooltip lifecycle coverage: move quickly between actions, move onto the tooltip, scroll, remove a hovered row, update the library after duplication, and navigate away. Assert at most one visible tooltip, no detached/stale tooltip after teardown, and viewport containment near edges. Exercise a touch-enabled context to confirm one tap invokes each intended action without requiring tooltip dismissal.
- [x] Run `npx playwright test e2e/library-navigation.spec.js` and correct any failures.
- [x] Run `npm test`, `npm run test:e2e`, and `npm run build`. All must exit successfully. Do not run migrations for this change.
- [x] Visually inspect both libraries and an editor header at desktop and mobile sizes with normal motion. Check tab feedback, title wrapping, button alignment, tooltip contrast/placement, save/conflict control wrapping, and unchanged exercise controls. Capture screenshots as review evidence if browser tooling permits.
- [x] Review `git diff --check` and the scoped diff. Commit remaining task changes, leaving unrelated package.json edits intact. Record actual verification results and any limitations in the implementation handoff; do not publish or deploy as part of this plan.

## Handoff

Implemented on `feat/library-navigation-polish` in `.worktrees/library-navigation-polish`. Verified on Node.js 24: `npm test` (98 passed), `npm run test:e2e` (22 passed), and `npm run build` (passed). Independent final review found no critical, important, or minor issues. Desktop/mobile screenshots were inspected. Local integration or publication remains a user decision.

Execution notes: Windows commands used npm.cmd with a transient Node.js 24 runtime because the default shell blocks npm.ps1 and the default Node runtime is 22. Library headings also received scoped wrapping for enlarged-text/fallback-font layouts; the empty placeholder is hidden for populated libraries. Existing top-level navigation modifier-click behavior and server/domain internals retain their established behavior. No migrations were needed.
