# Interaction polish design

Approved direction in conversation on 2026-10-24; this document records that agreement for implementation.

## Intent and scope

Make building templates and programs feel responsive, continuous, and moderately more compact on desktop. Preserve the existing dark/orange visual style and all domain, persistence, validation, volume, and accessibility behavior. Improve exercise-card dragging inside a template, not template ordering in the library. Add workout dragging inside programs, including moves between weekdays and Unscheduled. The requested deliverable at this stage is an implementation plan, not application changes.

## Constraints

- Native JavaScript and CSS; no new dependencies or frontend framework.
- Preserve save revisions, failed-save recovery, conflict handling, independent workout copies, and strict import/export validation.
- Persist only committed data changes; never persist drag previews, animation, hover, or collapse state.
- Respect prefers-reduced-motion: reduce throughout.
- Preserve readable text, visible focus, keyboard controls, and minimum 44 × 44 px interaction targets.
- Preserve existing edits to package.json and package-lock.json.
- Run npm test, npm run test:e2e, and npm run build before shipping. No database schema changes or migration are needed for this work.

## Dragging

Use a shared pointer-driven sortable controller. A handle starts a drag after 5 px of movement. Show an inert, aria-hidden visual copy following the pointer, preserving the initial pointer offset, and leave a same-size placeholder at the prospective insertion point. Move neighbouring cards smoothly using transform animation over 180 ms ease-out. The visual copy must not contain duplicate DOM IDs. Pointer tracking remains immediate with reduced motion; decorative animations become instant.

Exercise drops commit once using existing exercise/collapse reorder behavior. Keep focus on the moved handle and announce its new position. Provide Move up/Move down through a compact handle-activated menu as a single-pointer alternative; retain ArrowUp/ArrowDown on the handle.

Program workouts support sequence reorder and schedule reorder, including empty days and Unscheduled. Keep existing Move up/Move down buttons and day selectors. In schedule mode, dropping before a workout inserts immediately before that workout in the canonical array. Dropping after a nonempty day's last workout inserts immediately after that workout. Dropping into an empty day appends to the canonical array. A drop also sets the destination day; sequence mode preserves day assignments. Switching modes alone never changes canonical order or assignments. Use stable workout IDs, never display indices, to identify records.

Escape, pointercancel, lost capture, or destruction cancels without changing data. A release outside a valid drop area cancels. A click without crossing the movement threshold does not reorder. Scroll the document near the viewport's top/bottom edges during dragging; recompute geometry after scrolling. Release all animation frames, listeners, copies, and placeholders on completion or destruction. Dragging must work with expanded and collapsed exercise cards of different heights.

## Navigation

Keep the mounted source page visible and inert while preparing the destination. Do not clear it to show Loading…. Fetch all required data before replacing the view; keep the normal authenticated shell visible. Mark the destination region busy and show a discreet text progress indicator only after 250 ms. Initial loading, which has no source page, uses the same delayed indicator.

Once ready, fade the source out over 75 ms, swap once, and fade the destination in over 100 ms, ease-out. Animate opacity only. No artificial wait for loading feedback. Reduced motion swaps immediately. Move focus to the new page heading (temporarily focusable) after navigation, except where an explicit error-field or restored workout-button focus takes priority. Reset scroll for a new route; restore overview scroll and workout Edit focus on return from an embedded workout editor. Preserve native modified link clicks and browser Back/Forward.

Preserve leave()/flush() and revision protection before departure. Do not dispose an active autosave queue until a destination has been prepared and accepted for mounting. Guard fetches, timers, animation completion, busy state, and mounts with a navigation generation so stale destinations cannot win. On destination failure, retain the source and report an error; restore its route if the URL already changed. Authentication failure follows existing login/recovery behavior. No browser persistence or speculative record cache is introduced.

The same fade primitive handles program overview ↔ embedded workout editor, without fetching or calling the top-level leave guard. Internal transitions finish synchronously under reduced motion; update focus/error call sites to await animated mounts where needed.

## Highlighting

Workout background and border transition over 150 ms ease-out. Reserve an inline metadata slot for Trains <muscle> beside the exercise count. Its visibility uses opacity, not hidden/display toggling that changes card height. Long names wrap identically whether highlighted or not; reserve one consistent metadata row or use an ellipsis with the complete accessible text. Hover, focus, selected-muscle fallback, grace timing, and weekly calculations stay unchanged. Reduced motion changes immediately.

## Icons and density

Use a clearly separated upward arrow and tray for Export. The current shared export path has connected diagonals that can read ambiguously; separate the shaft and arrowhead into distinct path commands. Keep Import pointing down into its tray. Reuse the shared export icon in program and session editor toolbars and both libraries.

Use one compact add-workout row: [template selector] [Add template] · or · [+ Empty workout]. Both actions remain visible and wrap naturally on mobile. Keep the selector label Session template to copy, disable Add template until a selection exists, and show a useful empty-library option when no templates exist. Empty workout remains enabled. Template copies retain independent data.

Apply moderate spacing reductions to libraries, program overview, and session editor: desktop outer vertical padding 24 px, primary column gap 24 px, card padding 16 px, list/card vertical separation 12 px, and related control gaps 8–12 px. Do not shrink text, sliders, body maps, focus rings, or 44 px targets. Keep mobile outer padding 16 px and stack content at existing breakpoints. Preserve a full-width desktop overview metadata line without hover-driven growth. Long titles, validation errors, 320 px screens, and 200% text must not overlap or create horizontal page scrolling.

## Validation

Use existing Node unit tests for canonical reorder logic and Playwright for pointer behavior, cancellation, persistence, navigation races, stable geometry, compact layouts, and keyboard interaction. Explicitly enable reducedMotion: no-preference in animation tests because the repository default is reduce. Verify reduced-motion behavior separately. Capture desktop and mobile screenshots for review; no snapshot baselines are required for the icon-only adjustment.
