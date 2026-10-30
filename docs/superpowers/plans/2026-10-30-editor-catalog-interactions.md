# Editor and Catalog Interaction Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking. Use subagent-driven-development only if the user selects delegation.

**Goal:** Simplify exercise cards and catalog forms, smooth slider movement, distinguish library duplicates, and add muscle/type catalog filters.

**Architecture:** Extend the existing plain JavaScript editor, catalog controls and grouping functions. Keep shared-template semantics, native input behavior and persistence contracts intact; introduce one small shared slider presentation module and one pure duplicate-name helper.

**Tech Stack:** Native ES modules, CSS, native HTML inputs/dialogs, Node test runner and Playwright; existing SQLite/libSQL persistence.

**Spec:** The user-approved design in this conversation (2026-10-30), reproduced below. This is bounded work in existing flows; the user explicitly requested a written implementation plan. No separate architectural spec is required.

## Approved Design

- Remove the standalone exercise disclosure icon in both states. Clicking a collapsed card background opens it; clicking the heading row toggles it across the available card width. Preserve keyboard activation and independent heading actions/dragging. Use a subtle hover/focus surface and action tooltip as the hint.
- On desktop, align collapsed equipment and tags with the prescription summary. Remove the obsolete disclosure gutter rather than preserving an empty column.
- Keep all slider limits, steps and immediate model/readout updates. Smooth the visible thumbs and fills together; preserve responsive dragging and disable animation for reduced motion.
- Library Duplicate creates `ABC 1`, then `ABC 2`, choosing the lowest available positive suffix. Apply to program and session-template libraries. Duplicating an occurrence inside a program still links the same template and keeps its name.
- Display reference and variant descriptions as always-visible textareas labeled optional, retaining the 2,000-character limit.
- Brand uses single-selection pills, with a way to clear the selection, beside the existing multi-selection Focus pills.
- Catalog adds separate Primary muscle, Secondary muscle and Exercise type filters. All active filters combine with AND. Muscle filters inspect actual variant mappings, type inspects the owning reference. All filters have an All option.
- Replace the exercise Reorder text button with an icon matching Delete's size/style; retain its menu, keyboard shortcuts, accessible name and tooltip.

## Global Constraints

- Preserve the dark palette, orange accent and Barlow typography; reuse existing surfaces, spacing and control styles.
- Native slider hit boxes remain 44px on every device. Other actions are 32px only at the existing desktop fine-pointer/no-coarse breakpoint; touch/hybrid actions remain at least 44px.
- Both desktop body figures remain at least 180px tall. Do not sacrifice volume-panel prominence for added controls.
- Card body/summary transitions remain 200ms ease-out in both directions. Closing content becomes inert/aria-hidden immediately after focus restoration; rapid reversal must not run stale callbacks.
- Values, typing, selection and derived data update immediately. Initial rendering/import/refresh do not animate. Reduced motion settles synchronously.
- No new dependencies, database migrations, seed operations, JSON format changes or persistence of filter/disclosure/animation state.
- Preserve catalog propagation, dirty drafts, save retries/revisions, archived source-copy rules and shared-template identities.
- Update authoritative CSS first and `docs/design-system/README.md` in the same implementation change.

## Review Focus

1. A drag or touch-hold release on a heading must never accidentally toggle disclosure; test post-drag click suppression.
2. Native slider input and visible thumbs can diverge during rapid changes; test reversal, rep-thumb pushing and reduced motion.
3. Removing the old toggle can break focus restoration, bulk collapse and export validation; test each path in both editor contexts.
4. Retained archived Brand assignments must remain visible without permitting fresh archived assignments; test clearing and source-verified cloning.
5. Empty-reference fallback can bypass new filters; test empty/archived/unconfigured references and combined variant-role filters.

## File Map

- `src/session-editor.js`: card markup, heading activation, focus restoration, Reorder presentation and slider mounting.
- `src/action-controls.js`: reusable reorder icon and existing tooltip machinery.
- `src/sortable.js`: inspect existing gesture exclusions; change only if needed to keep heading-background dragging.
- `style.css`: card alignment, disclosure hint, slider presentation and wrapping filter/form layout.
- `src/slider-presentation.js` (new): native-input-backed visible thumb/fill synchronization and lifecycle.
- `src/duration-controls.js`, `src/volume-panel.js`: shared slider lifecycle integration.
- `src/duplicate-name.js` (new), `src/app.js`: collision-aware names at the library Duplicate boundary.
- `src/catalog-controls.js`: direct optional description fields and single-selection Brand pills.
- `src/catalog-groups.js`, `src/catalog-view.js`: filter predicate and visibly labeled filter controls/state.
- Existing tests listed in tasks below; add focused tests only where behavior needs verification.
- `docs/design-system/README.md`: final authoritative interaction/layout documentation.

### Task 1: Exercise heading disclosure, alignment and Reorder icon

**Files:** Modify `src/session-editor.js`, `src/action-controls.js`, `style.css`, `docs/design-system/README.md`; inspect `src/sortable.js`. Test `e2e/exercise-disclosure.spec.js`, `e2e/exercise-actions.spec.js`, `e2e/reorder-regressions.spec.js`, `e2e/drag-reorder.spec.js`, `e2e/compact-desktop.spec.js`.

**Interfaces:** Keep the editor's public API and collapsed-state array. Replace internal toggle references with one heading disclosure target. Add `actionIcon('reorder')` using a 20px currentColor up/down movement glyph.

- [x] Update disclosure tests first: background opens a collapsed card; heading name and blank heading area toggle; expanded body background does not collapse; no separate disclosure icon exists. Run for library templates and program-workout editors.
- [x] Add assertions for Enter/Space, stateful accessible names, `aria-expanded`/`aria-controls`, bulk collapse focus return, refused-export expansion/focus, rapid reversal and zero save requests for disclosure-only changes. Preserve the visible heading's h2 semantics.
- [x] Add action/gesture assertions: Reorder and Delete never toggle; movement menu and Up/Down shortcuts still work; pointer drags, touch holds, cancellation and post-drag clicks do not toggle. Run the targeted specs to confirm new expectations fail.
- [x] Make `.card-head` a noninteractive layout container. Place a native heading disclosure button inside its title area, retaining the h2 outside the button; let its pseudo-element cover blank heading space. Position other native action controls above that hit area without nested buttons. Make the hit overlay pointer-transparent during eligible pointer drags if necessary; do not mark the whole header as an interactive sortable exclusion.
- [x] Route heading activation through `setExerciseCollapsed`; update every old `[data-action="toggle"]` focus/ARIA lookup, including bulk operations. Keep normal collapsed-background activation and sortable's consumed-click guard. Restore focus to the heading button before hiding fields.
- [x] Remove disclosure chevron markup/CSS. Use an existing neutral surface on heading hover/focus (150ms ease-out color/background only), immediate focus outline and stateful shared tooltip `Expand exercise` / `Collapse exercise`. No new text row or permanent button gutter.
- [x] Replace Reorder's text/secondary styling with the same neutral icon-button geometry as Delete, retaining `.reorder-action`, existing ARIA/menu wiring and `aria-describedby="reorder-hint"`. Add the shared `Reorder exercise` tooltip.
- [x] Give collapsed metadata and summary the same logical left/right padding at desktop widths; remove the old 68px summary inset and obsolete toggle spacing. Preserve complete wrapped tags, About trigger, long names and mobile action layout.
- [x] Run `npx playwright test e2e/exercise-disclosure.spec.js e2e/exercise-actions.spec.js e2e/reorder-regressions.spec.js e2e/drag-reorder.spec.js e2e/compact-desktop.spec.js`. Expected: all pass. Update older toggle selectors throughout affected tests to assert the new heading behavior rather than deleting coverage.
- [x] Document heading interaction, icon presentation and alignment; commit this independently reviewable change.

### Task 2: Smooth all native sliders

**Files:** Create `src/slider-presentation.js`, `e2e/slider-motion.spec.js`; modify `src/session-editor.js`, `src/duration-controls.js`, `src/volume-panel.js`, `style.css`, `docs/design-system/README.md`. Check all `input[type=range]` creation sites before integration.

**Interfaces:** Export `mountSliderPresentation(root: HTMLElement): {sync(): void, destroy(): void}`. Call `sync()` after existing code writes native values and `--from`/`--to`; it must never dispatch input/change events or mutate domain values. Mount once per owning view/region and destroy on teardown.

- [x] Add browser tests with `reducedMotion: 'no-preference'` covering Sets, both Reps thumbs, Rest, session goals, weekly goals, Extra time and Buffer. Assert values/ARIA/readouts update in the input event turn, while thumb and fill pass through an intermediate position and settle at the correct endpoint. Confirm initial render has no movement.
- [x] Test rapid direction reversal, min crossing max (both thumbs end together), held keyboard repeat, Home/End, pointer/touch dragging, resize and rerender/teardown during movement. Reduced-motion tests assert immediate final positions and no pending animation. Run to establish failure.
- [x] Keep native range inputs, values, steps, event flow and 44px hit boxes. Add pointer-transparent, aria-hidden visible thumb elements; visually hide the native knob but retain its hit testing. Derive the visual focus/hover/active rings from the native input. Never hide the native input from assistive technology.
- [x] Synchronize visual endpoints from native values using existing track geometry (half-thumb inset). Use one cancellable requestAnimationFrame loop per mounted region to interpolate all visible thumbs and fill endpoints over 80ms ease-out from their current positions. New input retargets immediately; never queue old destinations. Initial mounting and ordinary programmatic refresh snap to final positions; animate only user input changes. Track rendered values so same-value refreshes cannot restart motion.
- [x] Match reduced-motion preference changes immediately, cancel frames on destroy, and retain the native thumb as a usable fallback before mounting. Preserve upper-thumb hit ordering for overlapping rep thumbs. Do not combine the new animation with an independent fill transition.
- [x] Integrate with the three existing owners and existing render/update/teardown paths. Rebuild presentation only when inputs are actually rebuilt. Do not smooth readouts, volume calculation, saved data or goal status.
- [x] Run `npx playwright test e2e/slider-motion.spec.js e2e/session-editor.spec.js e2e/duration.spec.js e2e/program-overview.spec.js`. Expected: all pass. Inspect actual dragging in Chromium and an available second browser; record any browser verification gap.
- [x] Update slider documentation with the 80ms visual-only timing and lifecycle; commit.

### Task 3: Distinct names for library duplicates

**Files:** Create `src/duplicate-name.js`, `test/duplicate-name.test.js`; modify `src/app.js`, `e2e/libraries.spec.js`, `e2e/shared-sessions.spec.js`.

**Interfaces:** Export `duplicateName(sourceName: string, existingNames: string[], fallback: string): string`. Return trimmed base plus the lowest unused positive integer suffix; compare candidate names case-insensitively after trimming. Empty base uses `Untitled template` or `Untitled program`. Keep an existing numeric suffix as part of the base (`ABC 1` duplicates to `ABC 1 1`).

- [x] Write unit assertions: `ABC` with no collision becomes `ABC 1`; with `ABC 1`, `abc 2` becomes `ABC 3`; a suffix gap is reused; whitespace/case collisions are skipped; blank names use the supplied fallback; numeric source suffixes remain part of the base. Run `node --test test/duplicate-name.test.js`; expect failure before implementation.
- [x] Implement the pure helper. At library `onDuplicate`, fetch the latest same-kind list and source, retain mounted-version guards, clone through existing template/program paths, and assign the computed name before `create`. Preserve `copyOf` provenance and the existing creation retry request so retries reuse the same ID/name.
- [x] Add browser assertions for repeated duplication in both libraries, reload persistence and source name remaining unchanged. Verify program duplicates preserve shared template IDs while occurrence Duplicate inside a program keeps the template's original name. Do not alter conflict Save as copy or import naming.
- [x] Run `node --test test/duplicate-name.test.js` and `npx playwright test e2e/libraries.spec.js e2e/shared-sessions.spec.js`. Expected: all pass. This selects an unused name from the current library snapshot; no new cross-device global uniqueness constraint is introduced.
- [x] Commit.

### Task 4: Direct optional descriptions and Brand pills

**Files:** Modify `src/catalog-controls.js`, `style.css`, `docs/design-system/README.md`, `e2e/catalog-metadata-forms.spec.js`, `e2e/catalog-tags.spec.js`; inspect `src/catalog-form.js` and `src/reference-form.js` call sites.

**Interfaces:** Preserve `mountDescriptionField`'s `{getValue,setValue,input}` and `mountVariantTags`'s `{getValue,setValue,setTags}` contracts. No metadata/wire changes.

- [x] Update browser tests: empty and populated Reference description and Variant description textareas are immediately visible with accessible labels ending `(optional)`, three initial rows and `maxlength=2000`; no description-specific disclosure trigger remains. Editing/reload/validation and new-reference-inside-variant creation retain values. Keep unrelated reference-default disclosures.
- [x] Add Brand assertions for native single-selection radio pills, an explicit `No Brand` pill, selection replacement/clearing, retained archived selection, focus through updates, many/long labels, source-verified clone retention and rejected fresh archived assignment. Keep Focus multi-selection unchanged. Run targeted specs to confirm failure.
- [x] Render the description label/textarea directly in `mountDescriptionField`, removing only its own disclosure wrapper. Preserve plain text, max length and getter/setter behavior.
- [x] Replace the Brand select with a labeled fieldset of radio pills styled like Focus chips, stable shared radio name and stable tag-ID values. Include No Brand mapping to null. Only show active tags plus the retained selected archived tag; clearing an archived value removes it from fresh choices. Patch/update nodes without losing active focus. Reuse the Focus search pattern for Brand when more than eight available choices exist, with label `Filter Brand tags`.
- [x] Keep Brand and Focus aligned side by side when space permits and stacked at narrow widths. Labels wrap and actions remain reachable in the existing scrolling modal. Selections/typing are immediate; existing dialog entry/exit remains 150ms ease-out with reduced motion. No animation is needed for always-visible descriptions.
- [x] Run `npx playwright test e2e/catalog-metadata-forms.spec.js e2e/catalog-tags.spec.js e2e/reference-exercises.spec.js`. Expected: all pass. Update design-system descriptions of these controls and commit.

### Task 5: Catalog primary/secondary muscle and type filters

**Files:** Modify `src/catalog-groups.js`, `src/catalog-view.js`, `style.css`, `docs/design-system/README.md`, `test/catalog-groups.test.js`, `e2e/catalog.spec.js`, `e2e/catalog-layout.spec.js`.

**Interfaces:** Extend `groupCatalog(data, query, options)` with `primaryMuscle=''`, `secondaryMuscle=''`, `exerciseType=''`; existing defaults and picker behavior remain unchanged. Filter values use fixed `MUSCLE_GROUPS` labels and `compound` / `isolation` wire values.

- [x] Add unit cases for separate role matches, AND across both roles and other filters, type inherited from reference, missing type excluded only when a type is selected, archived visibility, zero matches and matching reference text with nonmatching children. Empty references may match type/search but must not appear with either muscle filter active; the empty-reference fallback must also obey type. Confirm picker ordering/caps and default behavior remain unchanged. Run `node --test test/catalog-groups.test.js`; expect the new cases to fail.
- [x] Extend the existing predicate without changing catalog search text or counts. Never match reference default muscles in place of actual variant mappings.
- [x] Add three visibly labeled native selects in the existing compact toolbar: Primary muscle / All primary muscles, Secondary muscle / All secondary muscles, Exercise type / All types / Compound / Isolation. Populate muscle options in canonical order. Use wrapping toolbar columns rather than another card or disclosure.
- [x] Include all three values in filtering detection and the search-state key; wire change events to render. Keep selected filters across catalog reload/mutations; clearing all filters restores ordinary manual group state. New matches expand as current search does; counts describe filtered variants. No filter state persistence or autocomplete filter additions.
- [x] Add browser checks for combined filters, no-match message, clearing, filtered auto-expansion and reload retention. Check wrapped toolbar at mobile and enlarged text with long names and Show archived still reachable.
- [x] Run `node --test test/catalog-groups.test.js` and `npx playwright test e2e/catalog.spec.js e2e/catalog-layout.spec.js e2e/catalog-loading.spec.js`. Expected: all pass. Document filter semantics/layout and commit.

### Task 6: Integrated browser review and release checks

**Files:** Any focused fixes from the tasks above; `docs/design-system/README.md` and this plan's completion notes.

- [x] Inspect populated template and program-workout editors, both libraries, filtered catalog and reference/variant forms at 1366x768, 1440x900, 1920x1080, tablet and mobile widths. Include long names/tags, empty/archived metadata and both body figures. Check alignment, useful density, wrapping, overflow and modal action reachability.
- [x] Exercise card open/close, blank heading area, rapid reversals, bulk actions, keyboard/focus, drag/touch conflicts, Reorder menu and sliders with motion enabled. Repeat relevant interactions with reduced motion, touch/hybrid input and 200% text. Screenshots supplement these interaction checks; they do not prove motion.
- [x] Run `npm test`, `npm run test:e2e`, `npm run build` after final fixes. Expected: all succeed. Do not migrate or seed databases as part of these UI changes.
- [x] Inspect `git diff --check` and final diff for obsolete toggle selectors, unintended data changes, new dependencies and unrelated edits. Confirm every approved requirement maps to a completed task and report any browser/device verification gaps candidly.
- [x] Record verification evidence and commit final focused fixes. Present the completed change for review; deployment is outside this plan.


## Completion and Verification (2026-10-30)

Implemented all approved changes in the existing components, with no dependency, schema or portable-file format changes. Implementation commits: `5861c42` (cards/sliders), `615dd1c` (duplicate names), `ef5619f` (description/Brand controls), `5efe285` (catalog filters), `737bfcc` (async import test synchronization).

- `npm test`: **202 passed, 0 failed** on the final implementation tree.
- `npm run test:e2e`: **224 passed, 0 failed**, fresh test server/database, after updating the old duplicate-name assertion and waiting for asynchronous import completion in the duration/catalog regression.
- `npm run build`: **passed**. `git diff --check`: **clean**.
- Populated screenshots inspected at 1366x768, 1440x900, 1920x1080, 768x1024 and 390x844. Browser tests also cover 200% text, coarse/hybrid input, focus, keyboard, rapid disclosure reversal and reduced motion. Both desktop body figures retain their existing heights.
- Additional Chromium runtime checks verified native mouse and CDP touch slider dragging, an intermediate visual position with the new value already applied, rapid reversal, a reduced-motion preference change during movement, and teardown during movement.
- Visual review reproduced a mobile heading stacking regression; a failing browser assertion pinned it, and isolating the heading stacking context fixed it.
- Independent read-only review found no Critical issues. Its Important accessible-name finding was fixed and verified RED to GREEN: heading button labels now include the visible exercise name while tooltips remain concise.
- Deferred minor: strengthen the Brand focus regression test so it proves focus survives updates without explicitly restoring focus before the assertion. Runtime focus retention was independently checked; no known product defect remains from this finding.
- Verification limits: Chromium only; Firefox/WebKit binaries are not installed. Touch/hybrid input was emulated, not tested on physical devices.

Execution adjustments: Windows-native ledger handling replaced bash wrappers; card/slider tasks overlapped because they share editor lifecycle code; focused checks reused a temporary server, then final verification used a fresh database; an earlier full run was interrupted for the accessibility fix and rerun. These process choices required extra verification time and manual bookkeeping, without changing approved product behavior. The final green suites and committed task history provide the completion record.

Integration is pending the user's choice; nothing has been pushed, merged or deployed.
