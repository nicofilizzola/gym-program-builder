# Workout flow: grouped feed, compact overview and moving around

Date: 2026-11-12.

Status: Design approved in conversation on 2026-11-12; written specification awaiting user review. This is spec 2 of four from the 2026-11-11 backlog (items 9, 10). It builds on [spec 1, Focus set page](2026-11-12-focus-set-page-design.md); its plan runs after spec 1's plan.

## Purpose and agreed direction

On a phone the tracker shows one set per page. The user reported:

- The exercise name is rendered again on every set of the same exercise. Sets should read as belonging to one exercise, without changing what a set page contains, the snap scrolling or the one-page fit. "Don't think of it as a layout change, but as an interaction change."
- The workout overview is too spaced out to work as an overview or as a navigation tool. It shows little without scrolling, and a jump lands without any sense of movement. They suggested an animated jump and navigation from the progress bar as directions.

Decisions:

- Keep the single vertical snap feed. The exercise block stays pinned while its sets snap underneath it; the next exercise slides in whole. No nested scrollers and no sideways paging.
- The set label row sits under the exercise block and travels with its set.
- Supersets get no pair header. The block stays only while the next set belongs to the same exercise, so alternating superset sets each bring their own block, as today.
- The overview shows one row per exercise with a chip per set. Editing moves behind one menu per exercise.
- Explicit jumps scroll from the current set to the target.
- The progress row opens the overview on a tap and scrubs on a horizontal drag.

Success means the user sees the exercise name once per exercise while logging, reads a six-exercise workout in the overview without scrolling, and sees the feed travel whenever they jump.

## Existing requirements and boundaries

This extends [Mobile workout Focus](2026-11-08-mobile-workout-focus-design.md), the card fit and rhythm plans (2026-11-10, 2026-11-11), [Logging warm-ups and supersets](2026-11-04-log-warmups-supersets-design.md) and [Focus set page](2026-11-12-focus-set-page-design.md). It assumes spec 1 has shipped: the set-note button is on the set's header row, tags sit under the title, the help row is gone, warm-ups have no RIR and a stored RIR of 5 reads `5+`.

It replaces these rules, and `AGENTS.md` and `docs/design-system/README.md` are updated in the same change as each part ships:

| Existing rule | Replaced by |
|---|---|
| Focus: "one snapping set-by-set feed"; Focus spec §1: every card carries the exercise title, note and history | One snapping feed of sets grouped by exercise; the exercise block renders once per group and pins (§1). |
| Card fit: "otherwise, and always for the last set, there is no peek and never any title pixels" | At an exercise boundary the next exercise's name row peeks, whole or not at all. Still no peek before the review card (§1). |
| Card fit: "only the viewed card's Complete is sticky" | The exercise block is also sticky, with a name-only fallback (§1). |
| Focus spec §5: the exercise note shows "on every set card of that exact exercise occurrence" | Once per group, in the pinned block (§1). |
| Focus spec §1 and §7: "An overview jump goes directly to its target rather than animating through every intervening card"; "Selecting a row jumps immediately" | Explicit jumps animate (§3). |
| Focus spec §7: one row per set with its own note and remove actions; visible exercise action buttons | Set chips; one actions menu per exercise; `Remove last set`; set notes leave the overview (§2). |
| Design system: the progress strip is a decorative strip between header and feed | The progress row is a button that opens the overview and scrubs (§3). |
| Spec 1 §3: "Tags do not appear in the workout overview" | Tags show as muted text after the exercise name (§2). |

Unchanged: Focus stays a presentation over `mountWorkoutLogger`'s port and borrows the canonical row nodes, never clones them and never mounts a second logger. Execution order, the set page's sections and components, `--focus-gap`, the `@container focus-feed` density tiers, the sticky Complete on the viewed set, completion timings, Auto-next (650ms), the title ticker timings, session memory, the recap, the review card and the regular tracker on desktop. Logger horizontal gestures never navigate root destinations. No change to logs, `workout-sync`, mirrors, endpoints, exports, AI review or analytics. No migration.

## 1. Grouped feed

A **group** is a maximal run of consecutive sets in execution order that belong to the same exercise occurrence. The pure model computes it.

- A straight exercise is one group: its warm-ups and working sets.
- In a superset, A's warm-ups are one group and B's warm-ups another. Each alternating round set is a group of one. Leftover sets of the longer member form one group.
- Exercises without sets have no group, as today.

```
 Incline dumbbell press              [note]   pinned
 (Hammer) (Upper chest)
 Last time 80×9 @2 · Best 82.5×8
 ─────────────────────────────────────────
 Next set · Rest 120s            [note] (2)   set page, snaps
 Working set 2 of 4
  Weight · kg            Reps · 8–12
     82.5                   8
 ‹ ╷ ╷ ╷ ▼ ╷ ╷ ╷ ›     ‹ ╷▓▓▓▼▓▓▓╷ ›
 RIR   [0] [1] [2] [3] [4] [5+]
 [          Complete set           ]
 ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄
 Next set · Rest 120s                   (3)   peek
```

- **Exercise block.** Name row (title with its ticker, exercise-note button), tags, the saved exercise note or its editor, Last time and Best. One per group. It has an opaque `--bg` background and a 1px `--border` bottom edge, and sets slide under it. It sticks to the top of the feed while any set of its group is in view and leaves with the group's last set, pushed by the next group.
- **Set page.** Header row (context text, set-note button, number marker), weight and reps, RIR on working sets, note area, Complete. Same nodes, sizes and order as after spec 1. Each set page is one snap stop (`scroll-snap-stop: always`), positioned so its header row rests directly under the block.
- **At rest** a page shows the same sections as today. The only visible difference is that the set label row sits below the exercise block instead of above the title.
- **Peek.** The space for a set page is the feed height minus the pinned height. Inside a group the next set's header row peeks when it fits whole, as today. At a group boundary the next group's name row peeks when it fits whole; tags and history never peek. Before the review card there is no peek. A row that does not fit whole shows no pixels.
- **Fit rule kept.** At default text, with one line of tags, the viewed set shows through Complete from a 660px visible viewport. The pure `workout-focus-fit.js` rule is unchanged; it receives the space under the block as its feed height.
- **Name-only fallback.** When the block plus the viewed set page (through Complete, without a peek) cannot fit the feed, only the name row stays pinned for that group. Tags, note and history scroll with the group's first set and are reached by scrolling back to it. This covers 200% text, long saved notes and the short density tiers. The fallback is evaluated per group from measured heights and re-evaluated with the existing fit pass, anchored to the set in view.
- **Editing the exercise note.** While its editor is open the whole block stays pinned regardless of fit, so the field never scrolls away from the set the user came from. In Focus the editor grows to at most 40% of the feed height and then scrolls inside the field. Closing it returns the group to its measured state.
- **Title ticker.** One per group. It runs only for the group that holds the viewed set, under the existing overflow, timing, tap and reduced-motion rules.
- **Completion and Auto-next.** Unchanged. The check, fill and milestone play on the set page; Auto-next scrolls to the next set in execution order and focuses its context text, whether it is in the same group or the next.
- **Accessibility.** Each group exposes the exercise name as one heading. Each set page keeps its accessible name `{set label}, {exercise}`, so a set is identifiable without the pinned block. A pinned block never traps focus and never covers a focused field: focused controls keep a scroll margin that clears the block and the sticky Complete.
- **Motion.** Pinning is scroll-driven and adds no animation. Set add and remove keep the 200ms collapse; a group appears and disappears with its sets. Switching between the whole block and the name-only fallback is instant, because it follows a measurement, not a user action.
- **Preserved.** Node identity, focus, caret, composition and invalid drafts through breakpoint changes, saves, refits and regrouping (a set changing group after add, remove, reorder, unlink or swap keeps its row node).

## 2. Compact overview

The overview stays one `.catalog-dialog` bottom sheet opened from Focus, with its header, Close, Add exercise and the in-sheet exercise picker. Its body becomes a dense list.

```
 Workout overview                          [×]
 ───────────────────────────────────────────
 ⠿ Bench press  Hammer · Upper chest      [⋯]
   [W 40×10 ✓] [80×8 ✓] [80×8 ✓] [(80×7)]
 ⠿ Incline press                          [⋯]
   [• 60×10] [60×10] [—]
 ┃ ⠿ Superset · 30s between · 90s after   [unlink]
 ┃   A1 Row                               [⋯]
 ┃   [70×10] [—]
 ┃   A2 Lateral raise                     [⋯]
 ┃   [12×15] [—]
 ⠿ Leg curl                               [⋯]
   No sets
 ───────────────────────────────────────────
 [+ Add exercise]
```

- **Exercise row.** The existing Reorder control as an icon handle (drag, ↑/↓ keys, click for Move up / Move down), the exercise name, the tags, and one `more` icon button named `Actions, {exercise}`. Names wrap; they are never truncated.
- **Tags.** Brand first, then focus tags, joined with ` · ` as muted text after the name, with a visually hidden `Tags:` prefix. One line, ellipsis when too long. Nothing renders without tags.
- **Chips.** One button per set, in stored order, wrapping onto further lines.
  - Text: `80×8`; `BW×8` for a blank or zero weight; `—` when reps are empty. Warm-ups are prefixed `W`. Digits are tabular.
  - Done: tinted fill and a check icon.
  - Viewed set: a 2px accent ring and `aria-current="step"`.
  - Next set to do (the current training destination): a leading accent dot and hidden text `up next`.
  - Accessible name: `Working set 2, Bench press, 80 kg × 8, 2 RIR, complete` (parts omitted when empty; `Warm-up 1, …` for warm-ups; RIR through spec 1's shared formatter).
  - Size: at least 44px tall and 56px wide on touch, 32px tall on a fine pointer; 6px gaps.
  - Tapping a chip closes the sheet and jumps to that set (§3). Tapping the viewed set's chip only closes the sheet.
- **Supersets.** One accent rail around the pair. A header line holds the pair's Reorder handle, `Superset`, the rest summary and an `Unlink superset` icon button. Each member shows `A1`/`A2`, its name, tags and its own actions menu, with its chips on the next line in stored order (warm-ups, then working sets), so the nth working-set chip of each member is round n. Chips are not padded into columns when the members' warm-up counts differ. A set without a partner in its round carries hidden text `no partner set this round`. Members have no Reorder handle.
- **Actions menu** (the existing `mountReorderMenu` popup): `Add set`, `Add warm-up`, `Exercise note`, `Swap exercise`, `Remove last set`, `Remove last warm-up`, `Remove exercise`. Add items are disabled at 20 sets. Each Remove-last item appears only when such a set exists. Every item sends the same port command as today, with the same confirmations. The exercise-note editor and the swap picker still open inside the sheet, under that exercise's row.
- **Removed from the overview.** Per-set remove and per-set note buttons. A specific middle set is dropped by unchecking it, since Finish removes unchecked sets. A set note is written on the set page, reached by its chip.
- **Exercise without sets.** Muted `No sets` in place of chips; its menu offers Add set and Add warm-up.
- **Opening.** The sheet scrolls so the viewed set's chip is visible and focuses that chip; with no sets it focuses Close. Close, Escape and the backdrop return focus to the control that opened it.
- **Density.** 12px body padding; exercises separated by a 1px `--border` line with 8px above and below; no per-group headings (`Warm-ups`, `Working sets`, `Round N`). Target: a workout of six exercises with up to four sets each and one-line names shows without scrolling in the sheet at 390×844 and default text.
- **Motion.** The sheet keeps its 200ms open and close. A removed exercise keeps its 200ms fade before removal. An added chip fades in over 200ms; a removed chip fades out over 200ms, inert, before it is removed. Rapid reversal is safe. Typing and save acknowledgements never animate. Reduced motion is instant.

## 3. Moving around

### Animated jumps

- A chip tap, a scrub release and Back to current scroll the feed from the current position to the target, through the sets in between, using the same smooth scroll as Auto-next. Focus moves to the target's context text.
- From the overview the travel starts when the sheet has finished closing.
- During the travel viewed-set tracking is suspended, nothing celebrates and no ticker starts. The viewed set and the progress text update on arrival.
- A touch, wheel, key press, dialog or resize ends the travel at the nearest set, which becomes the viewed set.
- Reduced motion jumps instantly. Initial render, hydration, resize, breakpoint changes and refits stay instant.
- The browser sets the duration. If a phone makes long jumps crawl or stall against snapping, the plan replaces the native scroll with a tween of at most 700ms. This has not been tried on a device.

### Progress row

- The row (position text, working-set count and the 4px strip) becomes one button named `Workout overview, exercise 2 of 6, 5 of 14 working sets`, with `aria-haspopup="dialog"`. Its visible size and the feed height do not change. Its touch target extends to at least 44px tall; where the extension would overlap another control, that control keeps its own area.
- **Segments.** Still one per working set in execution order, filled when done. Segments form one cluster per exercise, or per superset. Segments within a cluster sit 3px apart; clusters sit 8px apart. (A cluster is not a feed group from §1: a superset is one cluster.)
- **Tap, Enter or Space** opens the overview. The toolbar's Workout overview button stays.
- **Scrub.** The row captures the pointer on press and uses `touch-action: none`. Once the pointer has moved 8px sideways it is a scrub, and its release never opens the overview.
  - A bubble appears above the strip, over the page header, centred on the pointer and kept 8px inside the viewport. It reads `{exercise} · {set label}` using the feed's set labels (`Working set 2 of 4`, `A1 · Round 2`); a long exercise name truncates with an ellipsis.
  - The pointer's position along the strip selects the nearest working-set segment, clamped at both ends. The feed does not move during the scrub.
  - Releasing within 48px above or below the strip jumps to that set with the animated travel. Releasing farther away, or a `pointercancel`, cancels with no change. Releasing on the viewed set does nothing.
  - The bubble fades in over 150ms with a 4px slide and fades out the same way, like the existing tooltips. It follows the pointer without a transition. Reduced motion is instant.
  - A scrub cancels a pending Auto-next, like any other interaction.
- **Limits.** Scrubbing reaches working sets only; warm-ups are reached by their chip or by scrolling. Scrubbing is pointer-only and the bubble is `aria-hidden`; keyboard and screen-reader users reach every set through the overview chips.

## 4. Delivery order

One plan, three independently shippable parts:

1. **Grouped feed:** groups in the model, the pinned exercise block, peek and fallback, tests moved to the grouped structure.
2. **Compact overview:** exercise rows, chips, the actions menu, tags.
3. **Moving around:** animated jumps, grouped segments, the progress row as a button, scrubbing.

## 5. Verification

- **Unit:** grouping of straight exercises, pairs with warm-ups, uneven pairs, repeated variants and zero-set exercises; the fit rule with a pinned height and both kinds of peek; the name-only fallback decision; chip text and accessible names (bodyweight, empty reps, warm-up, `5+`); the pointer-to-segment mapping, including both ends and a single working set.
- **Browser (`npm run test:e2e`), at real browser heights:** the block stays in place while the next set of the same exercise snaps in, and leaves with the last set; a superset shows a new block on every round set; one title and one history per group; the 660px fit; a boundary peek shows the next name row whole or not at all; the fallback at 200% text and with a long note; the open note editor stays pinned; node identity, focus and caret through a breakpoint change. In the overview: the six-exercise target at 390×844; chip states; a chip jump ends on the target with focus on its context; every menu command; reorder by keys and menu; the 20-set and 40-exercise caps; focus on open and on close. For moving around: a travel ends with the target at its snap position; an interaction cancels it; reduced motion is instant; a tap opens the overview; a drag shows the bubble and jumps on release; a far release cancels; the row's target is at least 44px tall and the feed height is unchanged.
- **Review:** populated workouts with straight exercises, a superset and a long name at 360, 390 and 412px widths, the short density tiers, 200% text, reduced motion and touch input.
- **Physical phone:** pinning under momentum scrolling, long animated jumps with snapping, and the scrub's comfort can only be confirmed on the user's phone. Each of those plan tasks ends with the user trying it. Evidence goes in `docs/superpowers/verification/2026-11-12-workout-flow.md`. Never claim physical-device or deployment verification from localhost or emulation.
- `npm test`, `npm run test:e2e` and `npm run build` pass.

## Out of scope

Nested scrollers or sideways paging between exercises; a pinned pair header; collapsing exercises in the feed; a persistent "you are here" marker on the progress strip; scrubbing to warm-ups, a feed that follows the finger during a scrub, and keyboard scrubbing; removing a specific middle set or writing set notes from the overview; hints that teach the scrub gesture; any change to the regular tracker, finished logs or desktop; and backlog items 3 and 4.
