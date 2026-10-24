# Program overview design

## Agreed intent

Improve the existing weekly microcycle page so its controls match the rest of the app and weekly volume is explorable through the same front/back body figures as the session editor. Keep the existing vanilla JavaScript, CSS and persistence architecture. This document records the decisions agreed in conversation; the requested deliverable is an implementation plan, not implementation in this session.

## Toolbar and layout

- Replace the schedule checkbox with a two-option segmented control: **Sequence** and **Monday–Sunday**. Use native radios in a fieldset named **Program layout**, styled with existing surface, border, accent and focus tokens. Sequence maps to `simple`; Monday–Sunday maps to `schedule`.
- Put the layout control at the left and a grouped **Import program / Export program** pair at the right. Reuse the session toolbar's import/export SVG paths, `currentColor` strokes and visible labels. Decorative SVGs are `aria-hidden` and not focusable.
- Use 8px within action groups, 16px between groups, and 24px below the toolbar before the main program grid. Error messages sit between the toolbar and grid with their own spacing; empty errors must not supply the required spacing.
- Controls have at least 44px touch targets. At narrow widths, groups wrap in reading order; within the file group allow wrapping only if needed to prevent overflow. Use existing responsive breakpoints, typography and colours. Preserve the existing weekly-panel-first mobile layout.
- Leave workout editing, template copying and day assignment flows intact. Preserve canonical order and day assignments when switching modes.

## Weekly body map

- Place the existing front/back figures and a weekly heat legend inside the Weekly volume panel, above its readout and bars, on desktop and mobile. Reuse `bodySvg` and existing body styles, including all twelve muscles and side delts on both figures.
- Colour by total weekly counted volume, independently of goals. Count all program workouts once, including Unscheduled, with secondary muscles contributing half sets.

| Total sets per week | Heat level | Existing colour token |
| --- | --- | --- |
| 0 | 0 | `--untrained` |
| 0.5–6 | 1 | `--heat-1` |
| 6.5–12 | 2 | `--heat-2` |
| 12.5–18 | 3 | `--heat-3` |
| 18.5+ | 4 | `--heat-4` |

- Legend labels are exactly `0`, `0.5–6`, `6.5–12`, `12.5–18`, `18.5+`; the panel's unit identifies these as weekly sets. Session thresholds and its legend remain unchanged.
- Body regions and volume rows share mouse hover and click/tap selection. Clicking the selected muscle clears selection. Hover never changes selection; after leaving a muscle, retain hover for 150ms, then fall back to selection or the hint. Moving into another muscle cancels that timeout, including movement between body and list. Moving onto non-muscle space inside the panel also starts the timeout.
- The effective muscle is hovered muscle, otherwise selected muscle. Apply matching focus/selection styles to every representation of that muscle. Retain the readout's reserved two-line space, approximately 150ms subject crossfade and instant same-subject data updates. Reduced motion makes the crossfade instant. Pending callbacks always use current data and must be cancelled on destroy.
- Keep SVGs and the visual legend hidden from assistive technology, consistent with the existing session map. The native volume row buttons provide keyboard and screen reader access, `aria-pressed` selection, total/direct/indirect values and goal status. Keyboard focus previews a visible row; leaving focus restores the selected muscle or hint. Muscles with zero volume and no goal still have hidden rows; they remain selectable on the visual map.

## Contributing workout highlights

- Hovering, keyboard-previewing or selecting a muscle highlights every workout that includes that muscle as primary or secondary in any exercise. Keep every workout visible and in order.
- Use an accent border/background and visible text `Trains {muscle}` on each matching workout card. Do not dim or disable other cards. One workout gets one highlight even if multiple exercises match; primary and secondary membership both count.
- Keep membership semantics consistent with the existing `contributingWorkouts` count, including incomplete drafts. The weekly totals continue using existing volume calculations.
- Reapply the effective highlight after adding, removing, duplicating, moving or assigning workouts and changing layout. Returning from a workout editor starts a fresh overview interaction state. Successful program import/replacement clears interaction state. Hover, focus and selection never trigger autosave and are never exported or persisted.
- Readout hint: `Tap a muscle to highlight its workouts.` Muscle details retain the current weekly format: total/goal, direct and indirect, status when applicable, and contributing workout count.

## Scope and acceptance

This explicitly supersedes the older requirement excluding a weekly heatmap. It does not add weekly productive-set recommendations or muscle-info tooltips. Weekly goals remain 0.5–30 by 0.5, with zero clearing a goal. Bars retain goal-status colours and the shared scale; the heatmap retains its independent volume colours.

No schema changes, migrations, browser persistence, dependencies, framework, authentication changes or import/export format changes are needed. Update AGENTS.md's weekly-panel rule to reflect this approved exception during implementation. Preserve unrelated working-tree changes in package.json and package-lock.json.

Acceptance includes threshold boundary unit tests, interaction and responsive browser checks, existing session regression coverage, `npm test`, `npm run test:e2e` and `npm run build`. Do not run a production migration or publish as part of this change.
