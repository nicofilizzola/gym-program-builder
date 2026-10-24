# Compact Desktop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Use subagent-driven-development only if the user chooses that execution method.

**Goal:** Show more editable training information on laptops and monitors while retaining prominent, friendly body visualizations and existing mobile behavior.

**Architecture:** Reshape existing markup and CSS around responsive density tokens, a fluid canvas and compact field groups. Keep current domain/controllers intact; add one small shared geometry helper for volume-panel sticky fallback. Use existing SVG/action-tooltip infrastructure and Playwright fixtures for layout and interaction verification.

**Tech Stack:** Plain HTML/CSS/JavaScript modules, Node.js 24, Node test runner, Playwright; existing SQLite/libSQL persistence unchanged.

**Spec:** `docs/superpowers/specs/2026-10-24-compact-desktop-design.md`

## Global Constraints

- Plain HTML, CSS and JavaScript; no new dependencies or frontend framework.
- Preserve domain calculations, validation, import/export, autosave, conflicts, authentication and storage formats.
- Preserve exercise collapse defaults: loaded/imported exercises start collapsed; new exercises start expanded.
- Desktop density begins at 1100 CSS px and only uses smaller targets for fine pointers.
- Fine-pointer desktop buttons and name/select fields have a 32 px minimum height. Slider wrappers/thumb hit boxes remain 44 px.
- Coarse-pointer controls remain at least 44 × 44 px, including chips and icon controls.
- Never crop, remove, hide behind a disclosure, or shrink the figures below 180 px at the desktop checkpoints.
- No density toggle, new navigation destinations, overflow menus, new persistence, database changes or unrelated refactors.
- Run `npm test`, `npm run test:e2e`, and `npm run build` before declaring completion.

## Review Focus

1. Recovery controls and long document names can enlarge consolidated headers; all actions must remain reachable (Task 2).
2. Fine-pointer density must not shrink controls on touch-capable desktop devices or at enlarged text (Tasks 2 and 3).
3. All 12 rows, weekly goals of 30, long readouts and short viewports must not clip the bodies or panel (Task 4).
4. Grid ordering and day drop targets must preserve canonical workout ordering, including empty days and Unscheduled (Task 5).
5. Markup changes must preserve field-error focus, collapse inertness, slider behavior, tooltip lifecycle and highlight geometry (Tasks 3–5).

## File responsibilities

- `style.css`: authoritative density/layout tokens and responsive component styles. Update relevant existing rules; avoid another layer of contradictory overrides at the bottom.
- `index.html`: shell identity and navigation/save-control markup; retain IDs used by `src/app.js`.
- `src/session-markup.js`: editor header and panel composition.
- `src/session-editor.js`: compact field grouping, action tooltip lifecycle, panel geometry-helper mount/cleanup; retain domain and input handlers.
- `src/volume-panel.js`: weekly/shared panel composition and geometry-helper lifecycle; retain public interface and calculations.
- Create `src/panel-layout.js`: geometry-only sticky fallback, independently mounted and disposed.
- `src/library-view.js`: compact library header/rows, existing links/actions.
- `src/program-view.js`: schedule hooks, compact workout markup/actions, tooltip lifecycle.
- `src/action-controls.js`: additional action SVG paths only; reuse tooltip controller.
- Create `e2e/compact-desktop.spec.js`: deterministic density fixtures and geometric/interaction acceptance.
- `e2e/layout-polish.spec.js`, `e2e/program-overview.spec.js`, `e2e/drag-reorder.spec.js`: adapt changed layout expectations while preserving behavioral assertions.
- `docs/design-system/README.md`: final responsive values and rules matching shipped CSS.
- Create `docs/superpowers/reports/2026-10-24-compact-desktop.md`: measured results and screenshot paths.

## Task 1: Capture baseline and establish acceptance fixtures

**Files:** Create `e2e/compact-desktop.spec.js`; create the report above.

**Interfaces:** Consume `mountSessionEditor(root, options)` and `mountProgramView(root, options)` through browser module imports, following `e2e/layout-polish.spec.js`. Fixtures must use the existing document shapes and deterministic IDs. Produce reusable fixture helpers local to the new spec; do not export product APIs for tests.

- [ ] Create session, library and schedule fixtures from the spec. Mount only one panel at a time to avoid duplicate IDs. For shell screenshots, use the real authenticated app and import documents through existing UI helpers, as in `e2e/program-overview.spec.js`.
- [ ] Wait for `document.fonts.ready`, expand all six exercises explicitly, and capture baseline screenshots and geometry at the three desktop checkpoints. Record first-card top, complete expanded cards visible, panel bottom, figure heights and library row heights. Store artifacts under `.superpowers/compact-desktop/before/`; link paths in the report.
- [ ] Add targeted acceptance cases named `desktop editor exposes compact expanded fields`, `desktop volume keeps both bodies prominent`, `desktop library rows are compact`, and `schedule uses responsive day columns`. Assert the spec's exact bounds: first card top ≤200; complete cards ≥2/2/3; both figure heights ≥180/180/200; 12-row panel bottom ≤viewport height; row height ≤64; grid columns 2/2/3; document scrollWidth ≤viewport width.
- [ ] Run `npx playwright test e2e/compact-desktop.spec.js`. Confirm failures arise from the old geometry, not fixture setup. Record baseline evidence before changing CSS.
- [ ] Commit fixtures, expectations and baseline report: `test: define compact desktop acceptance`.

## Task 2: Ship density tokens, fluid shell and compact library/header layout

**Files:** Modify `style.css`, `index.html`, `src/session-markup.js`, `src/library-view.js`, `src/program-view.js`, `e2e/compact-desktop.spec.js`.

**Interfaces:** Preserve shell IDs, `[data-nav]`, name-input data attributes, file/bulk-action IDs and all mount function signatures. New classes are styling hooks only. Product name moves into the authenticated shell; each screen still owns one h1.

- [ ] Add regression cases for a long program/template name, Conflict with both recovery buttons, save Retry, and import error. Assert controls are enabled/reachable where appropriate, tab focus is visible, and the page does not overflow at 1366 px or at 200% root font size. Add coarse-pointer context coverage asserting icon buttons and chips remain ≥44×44.
- [ ] Add density tokens and desktop media/container rules from the spec. Scope 14 px text and 32 px controls to desktop fine pointers; keep sliders at 44 px. Set aligned fluid shell/editor/program canvases and 460/520 px rail widths. Use the exact 1366 and 1920 grid arithmetic in a CSS comment.
- [ ] Consolidate authenticated branding, title/name/file groups, library creation/import header and program header. Preserve Import/Export and bulk text labels/grouping. Remove empty container margins without hiding active errors. Keep recovery controls text-labeled and wrapping.
- [ ] Use compact library rows with existing title anchors and visible icon actions. Do not truncate full accessible names or disable modified-click navigation.
- [ ] Run `npx playwright test e2e/compact-desktop.spec.js e2e/library-navigation.spec.js e2e/libraries.spec.js e2e/recovery.spec.js`. At this stage, only acceptance cases owned by later tasks may remain failing; run the library/header cases separately to establish this task passes.
- [ ] Commit: `feat: compact desktop shell and library layout`.

## Task 3: Compact expanded exercise editing

**Files:** Modify `src/session-editor.js`, `style.css`, `e2e/compact-desktop.spec.js`; inspect existing `e2e/session-editor.spec.js`, `e2e/import-export.spec.js` and `e2e/drag-reorder.spec.js` for selector compatibility.

**Interfaces:** Keep `CARD_HTML` control data attributes, `.collapsible`, `[data-collapse]`, `.card-body`, error hooks and input event delegation stable. Introduce `.exercise-fields`, `.exercise-main-fields`, `.exercise-muscle-fields` grouping classes; keep each error with its field. Reuse `mountActionTooltips(root)` with cleanup on destroy if tooltip hooks are added.

- [ ] Add assertions for name/sets/reps on one row at card width ≥700 px and name above sets/reps below 700 px. Assert both complete muscle sets are present in canonical order and adjacent fieldsets at ≥700 px.
- [ ] Add compact-layout interaction coverage: edit a name without losing focus, move both rep thumbs with keyboard, select primary/secondary muscles, collapse then tab past hidden fields, refuse invalid export and focus its invalid field, reorder while preserving collapse state. Use existing behavioral tests where they already cover the exact condition.
- [ ] Group the expanded body into the spec's field rows and side-by-side fieldsets. Add container queries with a 700 px card-content threshold. Remove old sibling margins that would conflict with the new grids. Keep the card control header and summaries readable; do not change collapse defaults to satisfy density tests.
- [ ] Check the six-exercise fixture reaches ≥2 complete expanded cards at 1366×768 and 1440×900 and ≥3 at 1920×1080. Tighten redundant spacing first if it misses; keep font and target floors.
- [ ] Run `npx playwright test e2e/session-editor.spec.js e2e/import-export.spec.js e2e/drag-reorder.spec.js` and the editor cases in the new compact spec. Confirm legacy 320 px/200% text coverage still passes.
- [ ] Commit: `feat: arrange exercise fields for compact desktop editing`.

## Task 4: Balance prominent bodies with dense volume rows

**Files:** Modify `src/session-markup.js`, `src/session-editor.js`, `src/volume-panel.js`, `style.css`, `e2e/compact-desktop.spec.js`; create `src/panel-layout.js`.

**Interfaces:** Produce `mountPanelLayout(panel: HTMLElement): { destroy(): void }`. It observes panel size/viewport changes, toggles `.panel--flow` when natural height exceeds available viewport space, and removes listeners/observers on destroy. The desktop CSS uses `.panel--flow { position: static; }`; fallback does not affect mobile placement. Consume it once per panel from both controllers. Preserve volume-panel public signatures, row attributes, SVG region hooks, legends and readout IDs.

- [ ] Add cases for both session and weekly panels with 12 visible rows, weekly goals of 30, zero rows, selected/hovered muscles and long readout text. Assert figure heights, no content overlap, all values readable, stable hover areas and readout space. At normal size, assert panel bounds fit the three checkpoints.
- [ ] Add a 1366×500 case and a 200% text case where content cannot fit: assert `.panel--flow` applies and the final row/readout is reachable by document scrolling. Resize back and assert sticky returns. Navigate away and verify no stale observer updates or page errors.
- [ ] Add structural wrappers for `.panel-visual` and `.panel-data`, with a full-width header and readout, to both panel markup sources. Keep mobile logical order/appearance and existing session/program placement through scoped CSS. Do not extract the duplicated panel controllers as part of this task.
- [ ] Apply the 180/200 px body-column and figure-height values, 32 px numeric-row pitch, wrapping heat legend and aligned value/status columns. Inspect narrow Side delts regions at real scale; enlarge layout allocation if necessary rather than hiding body content.
- [ ] Implement `mountPanelLayout` with `ResizeObserver` and viewport resize handling; derive available height from viewport height and sticky top offset, not current scroll position. Avoid observer feedback loops by measuring intrinsic panel height. Disconnect on view teardown.
- [ ] Run `npx playwright test e2e/program-overview.spec.js e2e/session-editor.spec.js e2e/layout-polish.spec.js` plus compact panel cases. Verify goal updates, bars, tooltips, hover grace and selected highlighting without geometry shifts.
- [ ] Commit: `feat: balance desktop body maps and volume data`.

## Task 5: Responsive weekly grid and compact workout actions

**Files:** Modify `src/program-view.js`, `src/action-controls.js`, `style.css`, `e2e/compact-desktop.spec.js`, `e2e/program-overview.spec.js`, `e2e/drag-reorder.spec.js`.

**Interfaces:** Keep `mountProgramView` and `mountSortable` interfaces unchanged; preserve `[data-workouts]`, `[data-sort-group]`, `[data-workout]`, `[data-action]` values and current ARIA names. Add a schedule class to `[data-workouts]` and an Unscheduled class to its section. Extend `actionIcon(name)` with `move-up`, `move-down`, and `edit` SVG paths if needed. Consume `mountActionTooltips(root)` and destroy it with the view; hide pending tooltips before replacing rows.

- [ ] Add cases asserting 2/2/3 day columns, Monday–Sunday row-major order, full-width Unscheduled, visible compact Rest day drop targets, two workouts in the same day, and long workout names without overflow. Sequence mode must remain one ordered list.
- [ ] Verify drag from one grid column to another and into an empty day/Unscheduled. Assert saved day assignment and canonical order, then toggle sequence/schedule and assert no data changes beyond intended movement. Verify keyboard Move up/down, disabled boundaries and restored focus after duplicate/reorder.
- [ ] Apply mode/grid hooks without changing grouping logic. Render compact workout rows with Edit text, visible secondary SVG buttons, existing confirmation prompts and labeled day assignment. Keep the stable highlight badge slot, allowing wrap without shifting controls when selection changes.
- [ ] Preserve `data-action` values and accessible names while switching visible labels to icons. Reuse existing tooltip lifecycle and keep controls visible without hover. Preserve exercise/workout surface and selection consistency tests.
- [ ] Update only superseded geometric expectations in existing tests (for example old toolbar gaps); retain checks against overlap, overflow and inaccessible actions. Record why each expectation changed.
- [ ] Run `npx playwright test e2e/programs.spec.js e2e/program-overview.spec.js e2e/drag-reorder.spec.js e2e/layout-polish.spec.js` plus compact schedule cases.
- [ ] Commit: `feat: compact program workouts and responsive weekly grid`.

## Task 6: Visual review, documentation and release verification

**Files:** Modify `docs/design-system/README.md`, the compact-desktop report and any CSS/markup requiring review corrections.

**Interfaces:** No new product APIs. Documentation must describe actual shipped values, the observer fallback and the exceptions to desktop density.

- [ ] Capture AFTER screenshots using exactly the baseline fixtures at 1366×768, 1440×900 and 1920×1080. Put artifacts under `.superpowers/compact-desktop/after/`. Compare visible-card counts, first-content position, panel height and body heights; record actual measurements alongside baseline values.
- [ ] Review full screens and panel crops visually. Confirm bodies remain a prominent friendly element, both figures are legible, action icons are understandable, and the page feels cleaner rather than crowded. Fix the three largest visual problems, recapture, and stop after acceptance is met.
- [ ] Inspect 320/375/768/1024 px, desktop coarse-pointer input, 200% text, short viewports, reduced motion, empty libraries, errors/conflicts, long names and full goal sets. Verify mobile session pinned panel and program overview placement against baseline.
- [ ] Update the existing design-system document in place: desktop breakpoints, tokens, fluid width, compact fields, touch exceptions, visible actions, schedule grid, body dimensions and sticky fallback. Retain mobile rules and separate session/weekly heat scales.
- [ ] Run `npm test`, then `npm run test:e2e`, then `npm run build`. Require zero failures; inspect build output via existing build verification. No migration is needed for this CSS/markup change.
- [ ] Review `git diff --check` and final diff for accidental storage/API changes, stale layout rules, duplicate IDs and undeleted tooltip/observer listeners. Finish the report with commands/results, screenshot links and any remaining limits.
- [ ] Commit: `docs: document compact desktop design and verification`.

## Shipping handoff

Deliver the verified branch and report for review. Do not publish or deploy as part of this plan without a subsequent deployment instruction. The release changes only browser assets and documentation; existing database and secret separation remains intact.
