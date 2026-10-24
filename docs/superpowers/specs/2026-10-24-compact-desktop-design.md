# Compact desktop design

## Intent and agreed direction

Make the existing application show substantially more useful information and actions before scrolling, from laptop to monitor. The user approved a structural redesign: compact expanded exercise editing, a numbers-first volume panel, responsive weekly grids, visible secondary icon actions, and the existing dark/orange/Barlow identity. Mobile behavior stays intact. The bodies must remain a friendly, prominent visual element: density must not turn this into a purely utilitarian table.

This document and its implementation plan complete the requested planning work. Product implementation is a subsequent task.

## Scope and constraints

- Plain HTML, CSS and JavaScript; no new dependencies or frontend framework.
- Preserve domain calculations, validation, import/export, autosave, conflicts, authentication and storage formats.
- Preserve exercise collapse defaults: loaded/imported exercises start collapsed; new exercises start expanded. Compact expanded editing means the expanded layout is efficient, not that loading behavior changes.
- Preserve hover/focus previews, selection, highlighting, drag and keyboard reorder, goal dialogs, tooltip behavior and reduced-motion handling.
- Preserve all 12 muscles, both body figures, heat legends, direct/indirect bars, goal markers and accessible status/readout text.
- Preserve current mobile panel placement separately for the session editor and program overview; do not unify their different behavior in this work.
- No density toggle, new navigation destinations, overflow menus, new persistence, database changes or unrelated refactors.

## Desktop layout

Desktop density begins at 1100 CSS px and only uses smaller targets for fine pointers. Existing layouts below 1100 px remain the fallback, with narrowly scoped fixes for shared markup. Do not compress tablet or coarse-pointer controls accidentally.

At desktop widths, use a fluid canvas with 24 px side gutters, a 16 px main-column gap and no 1120 px cap. Keep header, editor and program edges aligned. At 1366 px the arithmetic is 24 + 842 + 16 + 460 + 24 = 1366. At 1920 px it is 24 + 1336 + 16 + 520 + 24 = 1920.

- 1100–1599 px: 460 px volume rail, remaining width for the editor/program list.
- 1600 px and above: 520 px volume rail, remaining width for the editor/program list.
- Compact application header, normally 56 px tall, with product name, labeled library navigation, save status and logout. Allow wrapping for recovery controls and enlarged text; never clip them to maintain a fixed height.
- Retain one h1 per screen, normally 24 px. Remove repeated product eyebrows from authenticated page content; the shell carries product identity once. Keep login identity.
- Place the page type, visible name label/name input and file/bulk actions in a compact wrapping header. Retain separate semantic labels and a logical DOM/tab order. Empty error/status containers consume no spacing.
- Document scrolling remains the primary scroll model. Do not add independently scrolling exercise lists or fixed-height day cards.

## Density tokens and component rules

Introduce semantic CSS tokens for canvas gutter (24 px), layout gap (16 px), compact gap (8 px), card padding (12 px), field gap (8 px), compact control height (32 px), touch control height (44 px), panel width (460/520 px), and body figure height (180/200 px). Use existing color/font tokens. Keep 12 px card radius and 8 px control radius.

Desktop body/input text is 14 px with 1.4 line height; labels and metadata are 13 px; captions never below 12 px. Desktop library row titles are 18 px and exercise/workout titles 16 px. Use tabular numbers for counts and volume. Avoid uppercase for new helper copy; retain the established heading face.

Fine-pointer desktop buttons and name/select fields have a 32 px minimum height. Slider wrappers/thumb hit boxes remain 44 px. Coarse-pointer controls remain at least 44 × 44 px, including chips and icon controls. Visible keyboard focus and contrast remain mandatory. At enlarged text, allow wrapping and vertical growth instead of truncating controls or enforcing density targets.

## Exercise editor

Keep one ordered column, so drag and keyboard ordering remain easy to understand. Each card has its existing compact control header and an expanded body with two groups:

1. A field row with name, sets and reps in three columns: `minmax(0, 2fr) minmax(140px, 1fr) minmax(180px, 1fr)`. Each field owns its label, control and error. If the card is narrower than 700 px, put name on its own row and sets/reps side by side.
2. Primary and secondary muscle fieldsets side by side when the card is at least 700 px wide, stacked below that. Keep all choices visible with wrapping chips, canonical order, disabled-state semantics and the secondary half-set hint.

Use a container query on the builder/card region rather than assuming viewport width guarantees enough field space. The existing collapsible wrappers and inert behavior remain intact. Keep error selectors, input data attributes and delegated handlers stable when grouping fields. Do not rebuild controls on input.

Retain the prescribed Import/Export left and Expand all/Collapse all right toolbar grouping, with text and icons. Add exercise remains visible in document flow directly after the list. Secondary per-record/card actions use compact icons with accessible names and tooltips; primary Edit/Open remains discoverable.

## Volume panels: visual and numeric balance

Use the same CSS composition for the session and weekly panels, without combining their separate JavaScript controllers. Each desktop panel has:

- A full-width heading with units and goal action.
- Two adjacent content columns: body figures and heat legend on the left, direct/indirect key and muscle rows on the right.
- A full-width readout below, reserving its existing two lines and growing when necessary.

At laptop widths, allocate 180 px to the body/legend column and remaining space to the numbers. At monitor widths, allocate 200 px to the body column. Render BOTH front and back at 180 px tall on laptops and 200 px on monitors, preserving SVG aspect ratios. Captions and legend may wrap naturally inside their column. Never crop, remove, hide behind a disclosure, or shrink the figures below 180 px at the desktop checkpoints.

Muscle rows normally have 32 px pitch, contiguous hover areas, and aligned name/bar/value/status columns. Use `minmax(0,1fr)` for the bar; do not sacrifice readable names or values for bar length. Goal values and markers, including weekly goals up to 30, must remain legible. Set numbers-first hierarchy through alignment and weight, not by hiding the bodies.

The panel is sticky with a 16 px offset. If its natural height exceeds the available viewport (short window, zoom, wrapped readout), release sticky positioning using a small layout observer shared by both mounts; the whole panel must remain reachable through normal document scrolling. Disconnect observers on destroy. This is geometry-only view state and must never enter saved documents. Do not shrink bodies to force a fit.

## Libraries and program overview

Libraries use compact bordered rows, normally 56–64 px tall for short names, with title/link left and existing Duplicate/Export/Delete icon actions right. Long names wrap; actions remain visible. Keep simple lists rather than adding columns of unnecessary metadata.

Program headers consolidate name, file actions and the layout switch into fewer wrapping rows. The template picker and add alternatives remain in one compact wrapping group with their existing labels and behavior.

In sequence mode, keep one canonical ordered list. In schedule mode, apply a two-column day grid from 1100–1599 px and a three-column grid from 1600 px. Days remain in Monday–Sunday DOM and visual row-major order. Unscheduled spans the entire workout area below the seven days. Empty days show a compact Rest day line; all day drop targets remain usable. Multiple workouts stack in their day; no fixed-height clipping.

Workout rows show drag handle, name, exercise count, stable highlight badge slot and visible actions. Use icons for Move up, Move down, Duplicate and Remove; keep Edit text. Keep the day-assignment control available in schedule mode. Preserve accessible action names, disabled boundary moves, confirmations, focus restoration and cross-day drag behavior. Compact badges must not move controls on selection.

## Acceptance and verification

Create deterministic populated fixtures and capture BEFORE and AFTER at 1366×768, 1440×900 and 1920×1080 after fonts load. Fixtures: six valid exercises with mixed primary/secondary muscles (expanded deliberately for comparison); 12 visible muscles with goals; 12 library records; a scheduled program with all seven days, two workouts on one day and an unscheduled workout. Also exercise long names, empty states and error/recovery states.

Acceptance at normal text and the desktop checkpoints:

- No page-level horizontal overflow, clipped fields, overlapping actions or hidden values.
- First exercise begins within the top 200 px, including the application header.
- At least two complete expanded fixture exercises fit at 1366×768 and 1440×900, and three at 1920×1080. Use consistent short exercise names and complete muscle-choice sets; do not collapse cards to pass.
- Both body figures meet the 180/200 px height targets; the panel with all 12 visible rows and standard readout fits vertically at the three checkpoints. Measure the real SVG and panel bounds.
- Library short-name rows are at most 64 px tall and schedule columns are 2/2/3 respectively.
- Normal desktop actions remain one click away. Error/recovery states may grow the header and scroll.
- 200% text and short viewports remain usable through reflow/document scrolling, without the normal-density height guarantees.
- 320, 375, 768 and 1024 px regressions preserve mobile/tablet behavior, targets and panel placement. Check mouse, keyboard and coarse-pointer desktop interaction.

Run `npm test`, `npm run test:e2e`, and `npm run build` before declaring completion. No migration is required because no schema changes are in scope. Inspect screenshots manually; passing geometry checks alone does not establish a friendly visual balance.

## Design sources

The app-screen guidance from design-taste-frontend informs quiet surfaces, real content, aligned grids and purposeful density. Existing palette and type override alternative style sheets. UI/UX Pro Max's initial product-wide search returned marketing-oriented advice and was rejected; use its targeted interaction guidance only after checking fit. The bodies, heatmap and training volume are this product's visual signature.
