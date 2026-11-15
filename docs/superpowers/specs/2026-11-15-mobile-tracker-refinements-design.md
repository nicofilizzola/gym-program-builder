# Mobile tracker and navigation refinements

Date: 2026-11-15.

Status: Directions agreed in conversation; written specifications awaiting user review. No app implementation or deployment is included in this documentation change. Implementation plans follow approval of these written specs.

## Intent

Make workout logging feel fluid, make exercise and superset context easier to recognize, and reclaim space from secondary navigation. Preserve the familiar logger, its data, and its accessible alternatives. The user explicitly wants exploratory design and implementation plans before later integration and shipping.

The user approved a paired superset selector and then refined its behavior: one vertical page per round, either partner may be logged first, and automatic vertical movement happens only after every existing partner set in that round is complete. Selection and completion have separate visual signals. Auto-next controls both partner switching and vertical advancement.

The conversation occasionally used “drop set” to mean superset. The user explicitly corrected that terminology. Actual drop sets remain unsupported and out of scope.

## Specifications and request coverage

| Original request | Owning specification |
|---|---|
| 1. Soften large ruler-controlled weight/reps changes; investigate perceived lag | [Tracker inputs and benchmarks](2026-11-15-tracker-inputs-and-benchmarks-design.md) |
| 2. Best qualifies by the rep-range minimum, without an upper cap | [Tracker inputs and benchmarks](2026-11-15-tracker-inputs-and-benchmarks-design.md) |
| 3. Complete never chooses an unanswered RIR | [Tracker inputs and benchmarks](2026-11-15-tracker-inputs-and-benchmarks-design.md) |
| 4. Remove the next-set/next-exercise peek | [Focus rounds and presentation](2026-11-15-focus-rounds-and-presentation-design.md) |
| 5. Stronger exercise boundaries and quieter warm-ups | [Focus rounds and presentation](2026-11-15-focus-rounds-and-presentation-design.md) |
| Added during brainstorming: superset round pages, partner selection, completion and motion | [Focus rounds and presentation](2026-11-15-focus-rounds-and-presentation-design.md) |
| 6. Visible drag preview, compact overview controls, reorder actions in “…” | [Workout overview interactions](2026-11-15-workout-overview-interactions-design.md) |
| 7. Hide bottom tabs on nested mobile screens; compact parent back links | [Nested mobile navigation](2026-11-15-nested-mobile-navigation-design.md) |
| 8. Auto-next in Workout actions; a clearer direct Workout overview button | [Focus rounds and presentation](2026-11-15-focus-rounds-and-presentation-design.md) |

The shared Best and optional-RIR corrections apply on mobile and desktop. The remaining tracker presentation changes apply to editable active Focus at ≤760px. The navigation spec also applies to other nested mobile screens. The shared drag-preview correction must preserve all existing sortable consumers.

## Boundaries and integration

- Reuse plain JavaScript, CSS, native controls, the existing action icons, popovers/dialogs and motion patterns. Add no dependency.
- Keep one logger, controller and workout sync owner. Focus borrows canonical controls; it never clones live rows or mounts another logger.
- Preserve workout-log versions, validation, mirror/queue formats, autosave, history storage, exports/imports, AI review and analytics. No migration, data backfill, new persistence or deployment is required.
- Keep exact exercise/set IDs as navigation addresses. Round pages are a derived presentation, never a replacement storage model.
- Preserve pointer and keyboard access, readable labels, 44px touch targets, focus, caret, composition, invalid drafts and reduced motion.
- Retain the existing single orange accent and established status-color meanings. Add no exercise-specific color palette.

The inputs/benchmarks, overview and navigation specs are independently implementable. Focus rounds consume the unchanged logger port, the overview's set-reference jumps and the navigation's actual available height. Final Focus verification must include those integrations. The implementation plans should preserve these boundaries rather than turn all four into one large rewrite.

When each implementation lands, update the relevant rules in `AGENTS.md` and `docs/design-system/README.md`, and add implementation verification evidence. The older implemented rules remain current until that code lands; these specs do not mark their replacements implemented.

## Visual references and evidence limits

These are concept images with synthetic data, not shipped screens:

- [Selected and completed are separate signals](assets/2026-11-15-tracker/superset-selected-complete.png).
- [A completed partner remains marked when another is selected](assets/2026-11-15-tracker/superset-other-complete.png).
- [Compact back link and direct overview action](assets/2026-11-15-tracker/workout-frame.png).
- [Auto-next in Workout actions](assets/2026-11-15-tracker/workout-settings.png).

The local companion sources and exploratory checks are in `.superpowers/brainstorm/1308-1794758915/` (ignored, not a runtime dependency). V3 establishes the approved selector and partner motion. V4 establishes the approved frame, footer and Auto-next-off behavior. V4's short overview round list is only a demonstration of opening/jumping/focus; it does not replace the app's exercise rows and set chips.

Prototype browser checks covered both partner orders, partial/completed rounds, separate field values, unanswered RIR, undo/cancellation, rapid switching, selector identity, reduced motion, menu focus and responsive mock layouts. Browser inspection reproduced the actual overview drag-layering defect. These checks do not establish implementation correctness in the app, the real 660px fit, physical-phone performance, momentum behavior or production behavior.

Real-phone feel, keyboard/viewport behavior, safe-area use and deployed verification remain pending until implementation and the relevant user checks.
