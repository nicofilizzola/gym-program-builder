# Workout overview interactions

Date: 2026-11-15.

Status: Written specification approved by the user in conversation after commit `f8f452b`. Not implemented or deployed. Covers request 6 in the [design map](2026-11-15-mobile-tracker-refinements-design.md).

## Purpose

Make reordering visibly complete and reduce button chrome without losing set-chip clarity or accessible movement controls. Keep the existing dense exercise overview, its editing commands and its exact-set navigation. The user chose to place Move up/down inside each exercise's existing “…” menu.

## 1. The missing drag preview

The defect was reproduced using the real overview and logger/Focus test fixture at a 390×844 browser viewport:

- `mountSortable.begin()` creates a copy and appends its fixed `.sort-drag-host` to `body`, with z-index 1000.
- The overview uses a native modal dialog in the browser's top layer. The source is hidden during dragging, and the body-level copy paints underneath that modal.
- The copy exists and has the intended coordinates. Promoting the same host to a manual popover made it visible without changing its coordinates or exercise order. This was a browser-runtime probe, not a source fix.

Evidence: [before promotion](assets/2026-11-15-tracker/overview-drag-before.png), [after promotion](assets/2026-11-15-tracker/overview-drag-promoted.png). The exploratory script and measurements are in `.superpowers/brainstorm/1308-1794758915/`.

Fix top-layer ownership in the shared sortable preview path rather than raising an arbitrary z-index or replacing the reorder engine. A manual top-layer popover for the existing preview host is the validated direction. Reset popover user-agent margins/insets/padding/borders/background so promotion preserves the same viewport coordinates and dimensions. Keep the cloned ancestor classes and widths that maintain the source's descendant/container styles.

The preview must be an opaque, legible representation of the exercise or whole superset, including names, metadata, chips and actions at the same positions as the source. It follows the pointer directly without smoothing lag. Keep it noninteractive, inert and `aria-hidden`, remove duplicate IDs and reference attributes, and never create a second live logger or active form. The real source remains the capture owner until drop/cancel.

Preserve the existing mouse/pen threshold (5px), touch hold (350ms), pre-hold movement cancellation (over 8px), placeholder movement, 180ms sibling repositioning and reduced-motion behavior. Data changes only once on a valid drop. Escape, cancellation, lost capture, outside drop, blur, closing the sheet, resize invalidation and teardown must remove the preview/top-layer entry/placeholder, restore the source and release capture without committing.

Check destination reachability in a long scrolling overview. The modal's visible bounds and scrolling container must govern reachable drop targets; do not commit a drop into clipped/off-screen content because the full list rectangle extends outside the sheet. Preserve access to all items when dragging near scroll edges. Scope any related scrolling correction to demonstrated reachability problems in this same interaction.

`src/sortable.js` is also used by programs, session editing and the regular logger. Their existing drag appearance, layout fidelity, activation, focus, cancellation and touch ownership must remain correct after the shared fix. Do not redesign their action menus.

## 2. Reorder actions belong in the existing exercise menu

Keep one `Exercise actions` popup per overview interaction. The ordinary member menu order is:

1. Add set.
2. Add warm-up.
3. Exercise note.
4. Swap exercise.
5. Move up.
6. Move down.
7. Remove last set, when present.
8. Remove last warm-up, when present.
9. Remove exercise.

In either superset member's menu, use `Move superset up` and `Move superset down`. Both move the containing pair as a single block; neither swaps/unlinks members. Disable movement at the first/last **block**, including a list containing only one block. Resolve the current block position at action time, rather than relying on a stale captured exercise index.

Remove the overview's separate two-item reorder popup. Keep its current movement icon as a movement/keyboard affordance: activating it opens the same exercise actions menu with focus on the first enabled movement action. For a pair header, use the same actions surface for its first member and label movement explicitly as a superset operation. This preserves the existing accessible handle name and ArrowUp/ArrowDown behavior without maintaining two different popup contents. The ordinary “…” remains the primary access to all exercise actions.

Use native buttons in the named group. Retain Tab/Enter/Space, visible disabled boundary states, Escape/outside dismissal, anchor-aware positioning and focus restoration. After a menu move, focus returns to its invoking control, which moves with the exercise. Announce the resulting position without duplicating a drag announcement. If an operation removes the invoker, retain the existing next-actions/previous-actions/Add exercise fallback. A stale action targeting a removed exercise must safely do nothing.

The non-drag path is intentional: some users can tap but cannot reliably hold and move a pointer. It also satisfies the pointer alternative described by [W3C's explanation of WCAG 2.2 SC 2.5.7](https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html); keyboard support remains separately necessary.

## 3. Compact controls

- Replace the text `Close` control with an inline cross in the shared action-icon map (add a `close` path there), in a borderless icon button, accessible name `Close overview`, at least 44×44px on touch. Keep the existing dialog-close behavior and opener focus restoration. No new icon renderer or package.
- Reorder, “…” and unlink controls in overview rows/header use a borderless transparent treatment. Keep their existing accessible names and tooltips; remove the persistent button frame, not the target area or visible focus.
- Use `--muted` icons at rest, `--text` on fine-pointer hover and an immediate visible focus ring. Do not depend on hover to identify or operate the controls. Focus/pressed feedback and minimum targets remain on touch/hybrid devices.
- Keep borders and surfaces on the set chips. Their done tint/check, viewed ring, next dot, warm-up label, exact values and accessible names retain their current meaning.
- Preserve the 12px body padding, row separators, superset rail, wrapping names, one-line tag text, existing six-exercise/four-set density target and all current action limits/confirmations. Do not add permanent Move buttons or a destination-picker screen.

The overview retains the existing 200ms sheet/dialog opening and closing, with immediate inertness during closing and instant reduced motion. Apply a 150ms opacity fade in both directions to its exercise-actions popup, reusing the established native-popover discrete display/overlay pattern. Closing controls become inert immediately and focus returns before dismissal; rapid reopening must cancel an obsolete exit. Other shared menu consumers retain their established presentation. Row/drag transitions do not animate hydration or routine data refresh.

## 4. Set targets and the new Focus round pages

The actual overview remains one exercise row with a chip per stored set, including warm-ups. It does not become the prototype's abbreviated round list. Tapping a chip closes the sheet, then calls the existing `onJump` with that chip's exact `{exerciseId,setId}`.

The [Focus spec](2026-11-15-focus-rounds-and-presentation-design.md) resolves that ref to a page and selected partner. Two chips can target the same round with different partners. Do not merge chip completion states, rename them into round-only actions or lose repeated-variant occurrence identity.

## Implementation ownership and verification

| Responsibility | Owner |
|---|---|
| Top-layer preview placement and cleanup | `src/sortable.js`, narrowly scoped `style.css` rules |
| Overview actions, shared movement invocation, compact close and row controls | `src/workout-overview.js` |
| Shared cross icon | `src/action-controls.js` |
| Existing canonical movement and confirmations | `src/workout-logger-view.js` presentation port and pure log edits |
| Popup focus/inert handling where required | `src/reorder-menu.js`, preserving other callers |
| Density, scoped icon/popup styles and implementation docs | `style.css`, `AGENTS.md`, `docs/design-system/README.md` |

During implementation, add a failing modal-drag regression that tests actual painted visibility, not only the copy's existence or bounding box. Verify that the promoted copy follows movement and matches source geometry, makes no pre-drop writes, commits once, and disappears cleanly on every cancellation path. Exercise both a single exercise and an entire superset, a scrolling sheet, touch hold, reduced motion and close-while-dragging.

Test both “…” and movement-icon entry to the same menu, disabled endpoints, live position after reorder, superset movement from either member, keyboard movement, focus and position announcements. Verify names/tags/chips remain intact and repeated variants keep exact targets.

Reuse `e2e/workout-overview.spec.js`, `e2e/drag-reorder.spec.js`, `e2e/reorder-regressions.spec.js` and the relevant program/session/logger drag suites. Retain all existing non-modal copy-fidelity checks. Update only overview-specific old-popup/Close assertions. Check populated mobile layouts at 360/390/412, desktop fine pointer, touch/hybrid, long names and 200% text.

No endpoint, schema, migration, export, stored execution order or new dependency. Browser reproduction establishes the layering defect; physical-device and deployment verification remain pending until the implementation is tested.
