# Disclosure, Glutes and Confirmation Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking. Use subagent-driven-development only if the user chooses delegation.

**Goal:** Improve exercise disclosure and session navigation, add Glutes throughout the muscle model, simplify catalog interactions, and replace in-app browser confirmations.

**Architecture:** Extend the existing native JavaScript/CSS flows and central muscle registry. Add one reusable asynchronous confirmation controller using native `<dialog>` and existing dialog motion; callers retain ownership of mutations, revisions and lifecycle checks. No database migration or new dependency is needed.

**Tech Stack:** Native ES modules, CSS, native dialogs, Node.js 24 test runner, Playwright, existing SQLite/libSQL persistence.

**Spec:** User-approved conversational design, reproduced below; user confirmed existing muscle assignments stay unchanged and program Edit icons are removed. This is bounded work with an explicitly requested written shipping plan.

## Agreed Design and Implementation Decisions

- Exercise cards retain click-to-expand when collapsed. Only expanded headings show a subtle full-width hover surface indicating collapse. Align the number, name and actions vertically and give the surface consistent internal spacing. Keyboard focus remains visible in both states. Preserve whole-card drag, separate About/Reorder/Remove actions and existing disclosure accessibility.
- Use the header's existing 12px desktop card inset as internal padding, with the surface extending to the card's inner border rather than drawing another cramped inset box. Retain the card's top corner geometry. Let long names wrap and header height grow; never overlap actions or truncate names. Keep collapsed summary alignment with its existing content edge.
- Header hover/focus surface changes use background-color over 150ms ease-out. Card body/summary disclosure remains 200ms ease-out in both directions. Reduced motion is immediate; initial construction and data refresh do not animate.
- Add `Glutes` after `Abs` and before `Quads` in the shared muscle order. Include selectors, default/actual mappings, goals, session/weekly volume, filters, analysis input, validation, file round trips and the back body figure in both panel contexts. Add mirrored glute regions between the lower back and hamstrings without overlapping their interactive areas. Keep front anatomy unchanged.
- Do not reassign any existing catalog mappings, edit starter assignments, migrate, seed or backfill the database. Existing files without Glutes stay valid; retain file versions 1/2/3 and reject other unknown muscles. Older app versions may reject files containing the newly supported muscle.
- Program session titles become native links to the existing program-occurrence editor route. Retain context, save safeguards and return focus/scroll behavior. Remove the Edit icon; preserve Reorder, Duplicate and Remove. Hover/focus changes accent color and underline with a 150ms ease-out color/decoration transition, immediate under reduced motion. Modified clicks retain native link behavior. Do not animate layout.
- Reference-scoped Add variant initializes its name to the reference name once. User typing is never overwritten by catalog refresh, saving, validation errors or reference changes. Cloning a variant keeps the source variant name and fields. Existing explicit initial-name flows remain intact.
- Catalog variant names become plain headings with no link, underline or pointer treatment. Keep Edit actions, catalog routes, breadcrumb targets and workout View in catalog links. Existing links supplied navigation context, not editing, which explains their apparently redundant reload.
- Every application `confirm()` becomes a branded modal with a clear title, message, Cancel and a specific action label. Reuse dark surfaces, orange accent, Barlow typography, existing button geometry and modal motion: opacity plus 4px translation, 150ms ease-out in both directions. No new confirmation step is added to flows that already have custom dialogs.
- Confirmation defaults to Cancel focus; Escape and backdrop cancel. Keep native focus containment through closing, restore a connected invoker or logical fallback, resolve once after exit, and guard stale continuations. Use textContent for user names/messages. Tab-close/reload `beforeunload` protection stays native because browsers do not permit an asynchronous branded replacement.

## Global Constraints

- Read `docs/design-system/README.md`, including the Feature design and review checklist, before implementation. Use the design skills for review within the existing visual system.
- Preserve dark palette, orange accent and Barlow typography. Update authoritative values in `style.css` before documenting them in the design system.
- Fine-pointer desktop controls may be 32px only without any coarse pointer; touch/hybrid controls remain at least 44×44px. Native sliders retain 44px hit areas.
- Desktop body figures remain at least 180px tall. Preserve mobile panel behavior, weekly heat bands, goal limits and direct/indirect weighting.
- Preserve shared-template identity, occurrence counting, prescriptions/rest, dirty drafts, retries, save/revision protection, archives and catalog propagation.
- Never persist disclosure/modal/hover state. No new dependencies, automatic migrations, seed operations, deployment or unrelated refactoring.

## Review Focus

1. Releasing a heading drag or touch hold must not toggle disclosure; include drag-release and rapid reversal coverage in Task 1.
2. Repeated occurrences must count Glutes repeatedly without guessing mappings from names; include Task 2 volume/analysis assertions.
3. Removing Edit can break export-error focus and return-to-program focus targets; cover both in Task 3.
4. Reference refresh or an error can erase a typed variant name; cover draft retention in Task 4.
5. Async confirmation can outlive its view or allow duplicate actions; test abort, repeated activation and revision changes in Tasks 5–6.

## File Map

- `src/session-editor.js`, `style.css`: exercise header alignment, hit region and state-specific surface.
- `src/muscles.js`, `src/body.js`: authoritative muscle registry/info and back anatomy. Audit derived consumers before editing them; retain centralized behavior.
- `src/program-view.js`, `src/app.js`: native occurrence links, navigation interception and focus restoration after removing Edit.
- `src/catalog-form.js`, `src/catalog-view.js`: initial reference name and plain catalog variant heading.
- New `src/confirm-dialog.js`: confirmation lifecycle only; reuse `src/dialog-motion.js`.
- `src/app.js`, `src/program-view.js`, `src/session-editor.js`, `src/exercise-picker.js`: await confirmations and validate their continuations.
- `test/`, `e2e/`: extend existing relevant suites; new confirmation-specific browser suite.
- `docs/design-system/README.md`, new verification report: final authoritative behavior and evidence.

### Task 1: Align exercise headers and restrict the collapse surface

**Files:** Modify `src/session-editor.js`, `style.css`, `docs/design-system/README.md`; test `e2e/exercise-disclosure.spec.js`, `e2e/reorder-regressions.spec.js`.

**Interfaces:** Retain the native `.heading-toggle`, existing collapse state/ARIA, independent sibling controls and sorter click-suppression contract. No new public interface.

- [x] Extend disclosure browser coverage: expanded hover surface appears across the header; collapsed hover does not paint it; keyboard focus is visible in either state. Exercise template and program editor contexts.
- [x] Run `npx playwright test e2e/exercise-disclosure.spec.js` and confirm the new state assertion fails before the CSS change.
- [x] Replace baseline alignment with centered alignment; size/inset the header surface using existing card padding and corner tokens. Preserve full-row hit behavior without making independent controls toggle. Keep text wrapping and summary edges aligned. Implement only expanded-state hover background while retaining all-state focus indication.
- [x] Verify open/close, rapid reversal, bulk collapse, export-invalid expansion, drag-release suppression, touch hold and separate action activation. Run `npx playwright test e2e/exercise-disclosure.spec.js e2e/reorder-regressions.spec.js` with passing results.
- [x] Document the surface/state behavior and commit as `fix: align exercise headers and clarify collapse affordance`.

### Task 2: Add Glutes end to end without changing saved mappings

**Files:** Modify `src/muscles.js`, `src/body.js`; audit `src/volume.js`, `src/program-volume.js`, `src/catalog-controls.js`, `src/catalog-view.js`, `src/validate.js`, `src/session-file.js`, `src/document-bundle.js`, `src/analysis-input.js` and server validators for hard-coded lists. Extend `test/volume.test.js`, `test/program-volume.test.js`, `test/session-file.test.js`, `test/document-bundle.test.js`, `test/analysis-input.test.js`, `e2e/session-editor.spec.js`, `e2e/catalog.spec.js` as needed.

**Interfaces:** `MUSCLE_GROUPS` has 13 values with Glutes between Abs and Quads; `MUSCLE_INFO.Glutes` supplies the existing info shape. `bodySvg('back')` emits mirrored `data-muscle="Glutes"` paths. Existing compute/validate/file APIs remain unchanged.

- [x] Add meaningful regression cases: 3 primary Glutes sets produce 3 direct sets; 4 secondary sets produce 2 indirect sets; repeating the same occurrence twice doubles its contribution; a suggestive exercise name with no Glutes mapping produces zero. File versions 1/2/3 accept Glutes in mappings/goals and round-trip through applicable serializers; legacy files stay valid and `Unknown muscle` stays invalid. Analysis normalization retains Glutes without inferring additional mappings.
- [x] Run `node --test test/volume.test.js test/program-volume.test.js test/session-file.test.js test/document-bundle.test.js test/analysis-input.test.js` and confirm new Glutes cases fail.
- [x] Extend the shared registry and add concise muscle info using the existing format. Do not invent a new numeric recommendation: reuse the existing hip-extension guidance/range pattern and describe hip-extension/abduction options without prescribing new app behavior. Draw back glute regions in the existing SVG style, separated from the hamstrings. Change derived consumers only where hard-coded assumptions require it.
- [x] Update tests that explicitly treated Glutes as unknown to use a truly unsupported value; audit hard-coded 12-muscle counts across code/tests/docs. Verify API persistence accepts manually assigned Glutes with existing validation and no schema change.
- [x] Run the targeted unit suites and browser checks showing Glutes chips/defaults, catalog filters, goals, row/readout, session and weekly body heat/selection/highlights. Verify an existing saved entry's mapping remains unchanged.
- [x] Update design-system muscle order/count documentation and commit as `feat: support glutes across muscle tracking`.

### Task 3: Navigate from program session titles and remove Edit icons

**Files:** Modify `src/program-view.js`, `src/app.js`, `style.css`, `docs/design-system/README.md`; extend `e2e/programs.spec.js`, `e2e/breadcrumbs.spec.js`, `e2e/shared-sessions.spec.js` and affected program suites.

**Interfaces:** Add optional `workoutHref(occurrenceId: string): string` to `mountProgramView` options, supplied by `app.js` as the existing `#/programs/{programId}/workouts/{occurrenceId}` route. Preserve `onOpenWorkout` for guarded ordinary activation and standalone editor fallback.

- [x] Add coverage for Week, Sequence and Unscheduled title activation opening the intended occurrence, shared-template editing, breadcrumb context and return scroll/focus. Assert no Edit icon remains and Reorder/Duplicate/Remove remain usable. Cover long/empty titles, keyboard activation and native modified-click href behavior.
- [x] Run `npx playwright test e2e/programs.spec.js e2e/breadcrumbs.spec.js` and confirm title-link cases fail.
- [x] Put a native anchor inside the existing h3 when a route is available; intercept only unmodified primary activation through the existing guarded open path. Retain a native button fallback for standalone mounting without an href. Remove Edit from the action strip.
- [x] Replace all `data-edit`/Edit focus dependencies, including duplicate focus, return focus and validation/export navigation, with a stable occurrence-title target. Links must be excluded from drag initiation and keep the normal link cursor.
- [x] Add 150ms ease-out color/underline treatment with visible focus and reduced-motion override. Run targeted program, breadcrumb and shared-session suites; document and commit as `feat: open program sessions from their titles`.

### Task 4: Improve catalog name behavior

**Files:** Modify `src/catalog-form.js`, `src/catalog-view.js`, `style.css`, `docs/design-system/README.md`; extend `e2e/catalog.spec.js`, `e2e/catalog-metadata-forms.spec.js`, `e2e/breadcrumbs.spec.js`.

**Interfaces:** Preserve `openCatalogForm` options. For reference-scoped creation without a source entry or explicit initialName, initialize from the matching reference name once; source entry/explicit initialName behavior takes precedence. Catalog h3 names become text nodes.

- [x] Add coverage for Add variant prefilled from its reference, manual override surviving validation/save errors and catalog refresh, and source-variant cloning retaining its own name/mappings/description/tags.
- [x] Run targeted catalog form suites and observe the initial-name case fail; implement initialization without placing defaulting logic in refresh/change handlers that overwrite edits.
- [x] Replace variant-name anchors with plain h3 text and remove unused `.catalog-name-link` styling. Keep Edit actions and target/deep-link routing unchanged. Verify name clicks do not navigate, while workout View in catalog still reveals/focuses the right variant with breadcrumbs.
- [x] Run `npx playwright test e2e/catalog.spec.js e2e/catalog-metadata-forms.spec.js e2e/breadcrumbs.spec.js`; document and commit as `fix: simplify catalog names and prefill reference variants`.

### Task 5: Build a reusable branded confirmation modal

**Files:** Create `src/confirm-dialog.js`, `e2e/confirm-dialog.spec.js`; modify `style.css`, `docs/design-system/README.md`. Reuse `src/dialog-motion.js` without rewriting its unrelated callers.

**Interfaces:** Export `confirmAction({title, message, confirmLabel, destructive = false, signal, returnFocus}: {title:string, message:string, confirmLabel:string, destructive?:boolean, signal?:AbortSignal, returnFocus?:HTMLElement|(()=>HTMLElement|null)}): Promise<boolean>`. Return false on cancel/abort. Resolve once after close animation; abort tears down immediately. Permit at most one active confirmation: a second request returns false rather than stacking dialogs or queuing a stale action.

- [x] Add browser tests for Confirm/Cancel, Escape/backdrop, Tab containment, initial Cancel focus, invoker restoration, disconnected invoker fallback, multiline/long names rendered as text, double activation, simultaneous requests, abort and reduced motion. Exercise normal-motion entry/exit separately from Playwright's default reduced-motion setting.
- [x] Run `npx playwright test e2e/confirm-dialog.spec.js` and verify failure before the module exists.
- [x] Implement the helper with a native labeled/described dialog, form, safe text nodes and existing button classes. Use 150ms opacity/4px motion via `mountDialogMotion`, 16px viewport clearance, wrapping content and reachable actions. Destructive styling follows existing danger tokens; action labels describe the operation.
- [x] Guard repeated decisions and clean up listeners/active ownership on every exit. Restore focus before resolving the result so caller mutation/navigation can intentionally move it afterward. Do not restore focus to background content when another dialog remains open.
- [x] Run the helper browser suite; document and commit as `feat: add branded asynchronous confirmation dialog`.

### Task 6: Replace every in-app browser confirmation safely

**Files:** Modify `src/app.js`, `src/program-view.js`, `src/session-editor.js`, `src/exercise-picker.js`; extend `e2e/confirm-dialog.spec.js`, `e2e/recovery.spec.js`, `e2e/import-export.spec.js`, `e2e/exercise-actions.spec.js`, relevant library/program suites.

**Interfaces:** Use Task 5's `confirmAction`. Each mounted view/picker owns an AbortController and aborts pending confirmation on destroy. App-level requests capture record identity, route generation and relevant draft/revision state; proceed only while their original target remains current.

- [x] Inventory `confirm(` in `src` and replace all eight current call sites: failed-save navigation discard, Reload saved version, shared-template/program import replacement, library deletion, occurrence removal, standalone program import, standalone session import and exercise replacement. Use `Discard and leave`, `Reload saved version`, `Replace program`, `Replace shared template`, `Delete`, `Remove session`, `Replace template` and `Replace exercise` as appropriate. Preserve existing shared-impact wording and mapping differences/rest/prescription assurances.
- [x] First add workflow tests proving Cancel leaves data/drafts untouched and Confirm performs exactly one intended action. Install a page dialog listener that fails on an unexpected native confirm. Update existing tests that accept native confirms to interact with application dialogs.
- [x] Convert handlers to await the helper through existing async error wrappers. Capture the intended target before awaiting and recheck disposed/generation/record or exercise identity afterward. If relevant content/revision changes while asking, cancel the stale action rather than overwrite newer edits. Keep original server revision checks and error recovery.
- [x] Test navigation during confirmation, repeated activation, route changes during import, dirty save failure, revision conflict, replacement inside existing modal contexts and picker teardown. A canceled failed-save leave retains edits; confirmed replacement never modifies another instance accidentally.
- [x] Run the affected browser suites and `rg -n 'confirm\(' src`; expect no application `confirm()` calls. Preserve the `beforeunload` listener and test it separately without claiming it is brandable.
- [x] Commit as `refactor: replace browser confirms with branded dialogs`.

### Task 7: Verify the complete release and document evidence

**Files:** Update `docs/design-system/README.md`; create `docs/superpowers/verification/2026-10-30-disclosure-glutes-confirmations.md`.

**Interfaces:** No new product interfaces. This task produces the verification record and final reviewable diff.

- [x] Run `npm test`, `npm run test:e2e`, `npm run build`; require successful exit codes and investigate failures before claiming completion. Do not migrate or seed for this change.
- [x] Inspect populated template/program/catalog screens in a real browser at 1366×768, 1440×900 and 1920×1080, plus 390px mobile and 820px tablet widths. Check long names, 200% text, coarse/hybrid targets, overflow, header alignment and unchanged desktop figure prominence.
- [x] Inspect both motion preferences: hover/focus states, open/close, rapid disclosure reversals, keyboard navigation, touch click/hold/drag, title links, modal confirm/cancel/exit and focus after removal/navigation. Verify Glutes heat and highlights in session/weekly contexts.
- [x] Review the final diff against all six requests and shared-session/catalog constraints. Record commands/results, screenshots or inspection evidence, browser limitations and any verification gaps; reconcile design-system documentation with implemented values.
- [x] Commit verification/docs as `docs: record interaction and glutes release verification`. Report completion only after evidence supports it; deployment remains outside this plan.

## Plan Self-Review

All six requests map to Tasks 1–6; Task 7 supplies required release verification. No existing muscle assignments or seed mappings change. Async-confirmation races, old Edit focus targets and hard-coded muscle counts receive explicit checks. Scope is limited to current flows and one shared dialog helper. The native tab-close warning is an explicit browser constraint, not an unfinished in-app conversion.
