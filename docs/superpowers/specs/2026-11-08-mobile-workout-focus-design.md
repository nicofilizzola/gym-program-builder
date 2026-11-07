# Mobile workout Focus view

Date: 2026-11-08.

Status: Interaction direction and mobile/desktop scope approved in conversation. This written specification is ready for user review; implementation planning has not started. Detailed integration and edge-case rules below are proposals for that review, rather than claims that the prototype implemented them.

## Purpose and agreed direction

Make active workout logging on a phone spacious, athletic, and satisfying. Give each set its own vertically snapping card, keep a small preview of the next card, and provide immediate visual feedback after completion. The user can move back to edit previous sets or jump through a grouped workout overview.

The final interaction direction follows these decisions:

- Focus is the default for active workouts at widths up to and including 760px. Desktop retains the regular tracker. Finished workouts use the compact, editable record on every viewport.
- Weight and reps are the two large, matching swipe-ruler inputs, with exact numeric entry available. RIR is a dedicated, always-visible row of six one-tap buttons, with smaller visual weight and full touch targets.
- Exercise notes, set notes, and the workout note remain separate and available. Note actions use a small inline note icon; the set-note action has no border and occupies its own line.
- Completion animates the progress segment and the set-number-to-check transition before automatic advancement. Auto-next can be turned off.
- One grouped Workout overview replaces the redundant List view and All sets controls.
- Long exercise names loop left automatically and can be dragged in either direction. Tap the title to pause/resume; there is no separate play/pause button. Short names stay still.
- Finishing is explicit. The completion recap offers a workout note, Done to History, and View workout to the finished record. It does not use working-set count as a large hero metric.
- The established bottom navigation remains visible and reserved in the layout. Integrate with the separately designed mobile Library navigation rather than replacing its shell.

Success means a normal set can be logged with the existing one-tap repeat behavior; RIR can be chosen with one interaction; the next exercise or superset round is understandable before scrolling; previous sets and all existing editing actions remain reachable; and input, navigation, or animation never loses workout data.

## Existing requirements and boundaries

This extends the workout tracker, tracker notes, warm-up/superset logging, and Best performance designs:

- [Workout tracker](2026-11-03-workout-tracker-design.md).
- [Logging warm-ups and supersets](2026-11-04-log-warmups-supersets-design.md).
- [Tracker polish and notes](2026-11-05-mobile-polish-tracker-notes-design.md).
- [Workout notes and Best performance](2026-11-06-workout-notes-best-performance-design.md).
- [Mobile Library navigation](2026-11-07-mobile-library-navigation-design.md).

Where they conflict, this specification proposes replacing the active mobile logger layout and its paired-set focus guidance, and adding a recap after a successful explicit Finish. Existing desktop and finished-log layouts, domain validation, snapshots, API contracts, conflict handling, and offline ownership remain authoritative.

Use the existing vanilla JS/CSS stack and design-system palette and typography. Logs retain version 2. No SQL migration, API endpoint, export format, persistent reward model, new offline creation, or new offline editing of finished logs is introduced. No rest timer, sound, haptics, streaks, points, or verified-PR celebration is in scope. Rest durations remain useful context, with the existing elapsed workout time retained.

The approved navigation direction is Home / Library / History / User. Resolve its actual implementation at planning time because that work is in a separate thread. Do not overwrite its routing, shell ownership, or typing behavior. Workout-log routes remain within History; root-destination horizontal swipes remain disabled in loggers.

## 1. Layout and set feed

Keep one logger header with workout name, elapsed time, controller-owned save/sync feedback and recovery controls, Finish, and workout actions. Workout notes remain outside the sticky header so their text does not consume permanent header space.

Between the header and bottom navigation, reserve space for a compact workout toolbar containing Workout overview, a conditional Back to current action, and the Auto-next toggle. The set feed uses the remaining available height. Account for safe areas, the actual shell height, and the existing typing-driven navigation hiding; do not hard-code a phone screenshot's dimensions.

At normal text size, each card occupies the feed height minus approximately 60px, leaving the next card's real header visible. Vertical scrolling snaps to card starts. Use a deliberate gesture to settle on the adjacent card; avoid accidental traversal of several sets on an ordinary swipe. An overview jump goes directly to its target rather than animating through every intervening card.

A card contains, in order:

1. Upcoming/current context and the kind-specific set label, with its number/completed marker at the right.
2. Exercise title, including the long-title interaction below. Exercise-note access and target/rest or partner context remain immediately associated with the exercise identity.
3. Last time, its previous exercise note, and Best performance, including the existing loading/empty/offline states. Preserve their full meaning and qualifying date; the prototype's shortened benchmark labels are illustrative.
4. Large Weight and Reps controls, target-range guidance, and the weight increment choice.
5. An always-visible RIR row.
6. The separate set-note action or saved-note control.
7. Complete set / completed state and short completion/next-step feedback.

Do not truncate labels, benchmarks, errors, or notes to force the target card height. Long content, enlarged text, a reduced visual viewport, and the keyboard may make a card taller. Allow ordinary scrolling through an oversized card before moving to the next snap point. Prevent clipping and overlapping adjacent cards; keep completion and all controls reachable. The preview may be smaller or absent when content requires the space.

Never enable snapping inside an open note editor or force a snap in response to typing, acknowledgements, cached-history refreshes, or the keyboard opening. Resizing and switching between mobile and desktop preserve the current log, in-progress valid/invalid input drafts, note editors, and focused control. A focused control must not be destroyed to apply a breakpoint layout.

## 2. Execution order and orientation

Derive the feed from existing exercise/set IDs. Do not reorder the stored log into execution order.

- Straight exercise: its warm-ups in order, then its working sets in order.
- Superset: first member's warm-ups, second member's warm-ups, then working sets interleaved A1 round 1, A2 round 1, A1 round 2, A2 round 2, and so on.
- With unequal working counts, retain the remaining member's sets after the shared rounds. Label the other member as having no set in that round; do not imply it was completed if its earlier sets are unfinished.
- Repeated occurrences of the same variant remain different exercises, identified by their exercise IDs and position. Their notes, set IDs, targets, and pair membership remain independent.

Warm-ups use W1/W2 labels and do not increment the working-set progress bar. Every working set has one progress segment in execution order; the counter is completed working sets over total working sets. The right-hand marker is the current set's kind-specific number, not a global exercise number. Exercise position is separate header context.

The next-card preview distinguishes same-exercise sets, the first working set after warm-ups, a new exercise, a superset partner, and a new round. On a straight exercise's final working-set completion, show Exercise complete only when all its working sets are done. On A2 completion, show Round complete only when both working sets in that round are done. A skipped or absent set never earns a false completion message. Do not insert interstitial exercise/rest cards solely to announce transitions.

Exercises with zero sets remain visible in the overview with Add set / Add warm-up, without creating fictional set screens. A blank log offers Add exercise. If every set is complete, the feed ends in a review/Finish card; reaching it or scrolling past a set does not complete anything.

## 3. Numeric controls, RIR, and rep guidance

### Weight and reps

Use matching visual structure: label, large directly editable number, horizontal ruler, and a fixed center marker. Ruler motion is confined to its own horizontal interaction and must not initiate shell navigation. Vertical gestures outside it keep normal feed scrolling. Touch gesture arbitration must distinguish diagonal/vertical intent rather than consuming every gesture that begins on a control.

Preserve the current numeric rules and accessible labels, including exercise, set number, and warm-up kind. Weight is 0–999.75kg by 0.25, with blank/0 meaning bodyweight; reps are integers 1–100. Direct inputs remain at least 16px and support decimal/numeric keyboards. Invalid drafts remain editable with the existing validation behavior; do not silently coerce or save invalid values.

Weight ruler increments are 0.25, 1, 2.5, and 5kg, initially 2.5kg. The choice is session-local UI state, not part of the log. Changing an increment or mounting a ruler does not round an existing valid typed value. Only an actual ruler adjustment selects a new value, clamped to the domain limits. Reps step by 1. Provide keyboard adjustment and direct entry as alternatives to dragging.

Existing Last time/target placeholders and `toggleSetDone` materialization remain authoritative; a suggested value is visually distinct from an entered value. Do not seed real recorded values merely to make the ruler look populated. Completing a row without reps or a reps placeholder reports Enter reps and focuses that input.

### RIR

Put the RIR label and Optional caption beside six clearly actionable values 0–5, on a dedicated row. Each value has a touch target at least 44×44px. At widths that cannot hold the label and six targets, place the label above the buttons. Keep RIR smaller than the two primary inputs while making every value available without expanding a disclosure.

One tap selects; tapping the selected value clears it to null. Use visible selection plus `aria-pressed`, with a named group that includes the exercise and set. Do not place an independent Not set dropdown or a set-note button in this row. Preserve the current behavior of any Last time RIR placeholder on completion; distinguish a suggested RIR from a recorded selection before completion.

### Rep-range indicator

Read the current exercise snapshot's inclusive `target.repRange`. For working sets only, highlight the target band on the reps ruler and show text below/above it:

- Inside: Within target · 8–10 reps.
- Below: 2 below target · Aim for 8–10 reps.
- Above: 2 above target · Aim for 8–10 reps.

The out-of-range state uses a small warning icon, text, and a restrained accent treatment on the reps control. Color is supplementary. Update immediately from the current value while typing or swiping, without lag or celebratory animation. For an empty value, show the target without judging it. Invalid numeric input uses validation feedback, not a misleading range comparison.

Warm-ups and exercises with no target have no range warning or invented target. A valid out-of-range rep count remains loggable, is not automatically changed, and requires no confirmation. Associate guidance with the reps input/ruler; do not announce a warning on every intermediate swipe tick. Preserve existing Best selection by inclusive target range independently of this hint.

## 4. Exercise titles

Give the title the full identity width. A name that fits is stationary and has no motion interaction or extra control. A name that overflows remains one line and loops left at approximately 22px per second after a 1.4-second initial reading pause. Keep a gap between repeated visual copies so the loop is continuous without an abrupt reset. These are starting values for real-device tuning.

Tap the title itself to pause/resume. There is no separate play/pause button. The title's interactive surface is at least 44px high and supports Enter/Space. Expose a single full exercise name to assistive technology, preserve the heading, and hide decorative copies. Provide an accessible action/state for pause/resume and a discoverable interaction description without adding a permanent visual badge.

Horizontal dragging/swiping moves the text in either direction. Pause while dragging, then wait approximately 2.2 seconds before resuming if the user has not explicitly paused. A drag, vertical scroll, or pointer cancellation must not also toggle pause on release. Vertical intent and pinch zoom remain native; do not capture every pointer-down. Keyboard arrows and Home/End allow manual reading. Exact-entry keyboard activity and open note/dialog surfaces pause automatic title motion.

Only the current visible card animates; offscreen cards, hidden tabs, and detached views do not. Preserve pause/offset through ordinary save acknowledgements. Resume and reorder do not replay a title entrance animation. Under reduced motion, disable autoplay and keep manual horizontal reading available. The overview and finished record show wrapping static titles rather than tickers.

Exercise-note access stays beside the title's associated metadata below the ticker, with a clear exercise scope. A long saved note never takes width away from the scrolling title.

## 5. Notes

Retain all three existing scopes, limits, plain-text handling, and persistence:

| Scope | Limit in UTF-16 code units | Access |
| --- | --- | --- |
| Workout | 2,000 | Below the sticky header; also from the completion recap when editable. |
| Exercise | 1,000 | Exercise identity; the same note on every set card of that exact exercise occurrence. |
| Set | 280 | A small borderless note-icon action on its own line, below RIR. |

Use Add exercise note / Edit exercise note and Add set note / Edit set note labels with scope-specific accessible names. Saved text remains recognizable as an editable note, wraps, and can reopen at the end of its text. Avoid replacing a long saved note with only an icon. Preserve Last time's read-only exercise note and its distinction from the current exercise note.

Reuse input commits, trim only on blur, whitespace normalization, auto-growing multiline workout/exercise editors, single-line set notes with Enter to finish, IME handling, and focus/caret preservation. Notes do not inherit from Last time or copy to a new workout. Swapping keeps the existing exercise note; removing a set/exercise discards its affected notes through the existing edit transforms.

Opening a note suspends advancement and title motion and keeps the note's context fixed. Reuse the 200ms collapse pattern, immediate inert closing content, safe reversal, and instant reduced-motion behavior. Ordinary input and save acknowledgements never animate. Finished notes use the existing online editing path; read-only and pending-unsynced finished notes remain plain text.

## 6. Completion, feedback, and advancement

Completing a set uses the same validation and placeholder rules as the regular logger and writes through the existing local mirror before relying on network activity. Never delay the actual state update for an animation.

For an explicit not-done → done transition:

- Animate its existing progress segment filling left to right over approximately 480ms. Update stable segment nodes; do not rebuild the progress bar on every render.
- Crossfade/move the set number out and draw the check over approximately 300ms, with one restrained scale response over approximately 480ms.
- Resolve the primary action into a completed state and show accurate set, exercise, or round feedback. Keep values editable and provide an explicit undo activation.

These timings are proposed tuning values. Reserve stronger feedback for exercise/round milestones and the final recap. Do not add constant idle effects, celebrate ordinary edits, or show unverified personal-record claims. Rechecking a previously rewarded set in the same attachment does not replay its milestone flourish. Reload/resume, server acknowledgement, initial render, and responsive layout changes show final completion states instantly.

Auto-next is on by default and can be toggled in the workout toolbar; remember it in memory for the signed-in app session. No exported/server preference is needed.

The current training destination is the first unfinished set in execution order, separate from the viewed set. An explicit completion of that destination schedules advancement after approximately 650ms of feedback to the next unfinished set, or to the review card when none remain. This includes warm-ups. In Focus, this navigation replaces the old paired-working-set input-focus jump; do not run both. Desktop keeps the old guidance.

Manually visiting a different card is browsing. Completing or editing an earlier/other set while browsing keeps the user there; Back to current returns directly to the first unfinished set. Users can log exercises out of order by jumping and manually scrolling; no out-of-order edit is blocked or marked done by navigation.

Cancel a pending advance when the user starts scrolling/dragging, enters a field, opens a note/menu/overview, unchecks the set, changes Auto-next, changes route/auth/viewport, or changes the target through an edit. Resolve destinations by stable IDs against the latest log, not by a stale array index. Never advance because of a save callback or network response. With Auto-next off, retain feedback and preview, and let the user scroll.

After explicit automatic navigation, move accessible focus to the destination's context heading without opening a numeric keyboard. Manual scrolls do not move DOM focus. Reduced motion applies final progress/check states and any explicit advancement instantly; no smooth scroll, scale, or check-drawing animation.

## 7. Workout overview and editing

One Workout overview control opens one grouped surface. Use a mobile sheet and a centered dialog if its contents need to survive a viewport change. Keep titles static and wrapping, restore focus to the opener on dismissal, and preserve the viewed set when closing without selecting a destination.

Straight exercises have their own heading and warm-up/working rows. Supersets have one accent frame, named members A1/A2, rest context, and explicit Round 1 / Round 2 groups. Rows show set identity, values, and completion. The currently viewed set is distinct from the current training destination and completed status. Selecting a row jumps immediately to that set and closes the surface.

Keep all regular active-workout editing available here:

- Add exercise, catalog swap, remove exercise, and exercise-block reorder.
- Add set / Add warm-up, remove set, and set-note access.
- Pair block reorder and Unlink, with member Reorder hidden and the existing confirmations and pair dissolving rules retained.
- Workout name, workout note, Discard, and Finish through the established workout actions/header.

Use existing accessible menus, catalog picker, reorder controls, and pure edit transforms. Pair formation during logging remains outside scope. New exercises still come from catalog variants; preserve archived/unknown snapshot behavior and existing 20-set/40-exercise bounds.

Reordering rebuilds the derived feed without changing set identity. Preserve the viewed set, focus, and drafts when it still exists. Removing the viewed set selects the next surviving execution-order set, else the previous, else the appropriate empty/Add state. Removing a member dissolves the pair, swapping retains it, and unlinking reveals the two straight exercises. Finish closing pair/remove animations before discarding nodes, with the current inert/reversal rules. No routine update may silently scroll back to the start.

This overview is the quick-access alternative to the feed. Do not introduce a second, duplicate All sets/List view switch on active mobile logging.

## 8. Finish and after-workout flow

The final set can advance to a review/Finish card; finishing remains a separate explicit action. The existing header Finish is available throughout. Preserve `confirmFinish` semantics: count unchecked working sets in the existing warning; remove every unchecked set on acceptance; remove exercises without a completed working set and dissolve broken pairs; refuse a finish with no completed working set. Only unchecked warm-ups do not trigger the working-set warning.

After the accepted finished snapshot is handed to the existing controller/mirror, show a full-page mobile recap within the logger route, keeping the bottom navigation. Do not wait indefinitely for connectivity or bypass conflict/auth handling to show it. The recap distinguishes local completion from server acknowledgement with the controller's accurate sync/recovery state. It summarizes the actual post-pruning record, using static exercise names and honest partial-work context rather than claiming every planned exercise was completed.

Show a brief restrained completion flourish and a headline, then the exercise recap. Do not use a large working-set count, invented score, calories, or unsupported improvement statistic as the hero. Preserve the workout note and offer editing only through the supported finished-log path.

Actions:

- Done navigates to `#/workouts` through the existing guarded route flow. The completed local pending finish appears once in History under the existing deduplication behavior.
- View workout opens the same log ID's existing compact finished record, editable once its normal online/sync rules allow it.
- The workout-note control is available when the finished record can be edited. A pending offline finish stays read-only and explains that syncing is required before editing; do not create a new offline finished-log writer or a second controller owner to match the prototype's in-memory note behavior.

The recap is transient view state after a user-initiated finish, not a new persisted report or route required for every history visit. Opening/reloading a finished log shows the regular finished record and does not replay the celebration. Finish/Discard prompts invoked elsewhere, including the existing start-another-workout flow, retain their normal destination and do not unexpectedly divert to a recap.

Keep revision conflicts, sign-in-required states, retries, pending-finish restrictions on starting another workout, and read-only recovery visible and functional. Never describe a locally queued finish as saved on the server. A failed validation, canceled confirmation, or obsolete response cannot open a success recap.

## 9. Integration and lifecycle

Keep `workout-controller` as the single active/pending-finish sync owner. A logger view attaches to that owner; it never creates a competing mirror or sync. Use the same validated edit commands for the Focus renderer, overview actions, regular logger, and finished edits. Logs remain independent snapshots outside templates, exports, AI review, and program analytics.

Split the implementation into focused responsibilities during planning: pure execution-order/current-destination selection; a Focus presentation layer; numeric and RIR controls; title motion/gesture behavior; completion/advance coordination; and overview/recap presentation. Integrate at the existing logger/controller attachment boundary rather than duplicating its autosave, validation, history loading, or conflict logic. No unrelated refactor is required.

UI state is keyed by log ID and stable exercise/set IDs: viewed set, Auto-next, input drafts, title pause/offset, and celebration-once bookkeeping. It stays outside the persisted log. Reopening within the signed-in session may restore a still-existing viewed ID; a reload or absent ID falls back to the first unfinished set, else review. Clear transient state across auth changes and dispose it when its owner is no longer valid.

Preserve stale-response guards for Last time and Best, per-variant request order, and controller attachment lifetime. A late result may update a valid benchmark but cannot replace an input node, alter a draft, steal focus, advance the feed, or replay feedback. The mobile/desktop switch changes presentation, not log ownership.

Dispose all view subscriptions, Resize/Intersection observers, animation frames, request listeners, pointer capture, timers, and any bar-suppression reservation on detach. Maintain existing logger suppression of the floating workout bar and the navigation's own reservations/typing rules. The title/rulers never initiate root-destination swipes. Keep dialogs above navigation and preserve focus/route guards during navigation to Home, Library, History, or User.

## 10. Verification and review evidence

The browser companion explored seven iterations with sample data, under the ignored `.superpowers/brainstorm/` directory. The final tap-title direction is represented by `focus-flow-v7.html` in session `2411-1794092968`; earlier generated examples and probes are in sessions `2121-1794064654` and `2398-1794092132`. These local artifacts are design references, not production implementation or release evidence.

Checks performed on prototype iterations include mobile layouts at 360×740 and 390×844; overview jumps and grouping; numeric entry and ruler adjustment; inclusive rep-range boundaries and allowed out-of-range completion; one-tap RIR including 0, clearing, and at least 44px touch targets; exercise/set/workout note retention in sample state; recap/History/finished-record transitions; title overflow, loop wrap, dragging, pause/resume, keyboard interaction, reduced motion, and drag-versus-tap separation. Tests ran in Chromium with mobile-sized viewports; they do not establish real-device touch/keyboard behavior or production sync correctness.

Implementation verification must cover:

- Pure execution ordering for straight sets, warm-ups, pairs, unequal counts, repeated variants, and zero-set exercises; stable cursor fallback after every edit.
- Completion validation/placeholders, one-owner mirror writes, cancellations of pending advances, Auto-next off, browsing/undo, and no duplicate milestone feedback.
- Exact weight entry through increment changes, valid boundaries, invalid drafts, bodyweight, ruler keyboard and real touch/diagonal behavior, and clear distinction of placeholders from recorded values.
- Rep guidance at both inclusive bounds, absent targets, warm-ups, invalid/empty values, swap-cleared targets, and immediate typed/swiped updates without blocking valid out-of-range logs.
- All note scopes and limits, multiline versus single-line Enter, IME/caret/focus preservation, ordinary input without rerender animation, read-only recovery, and no note-copy regression.
- Overview management actions and pair invariants, rapid remove/unlink/reorder, menus and note access, long names/history text, and full action availability.
- Loop and manual title motion, visible-card-only autoplay, tap/drag/cancellation discrimination, native vertical scrolling and zoom, pause while typing/dialogs, keyboard semantics, and reduced motion without duplicated accessible titles.
- Explicit Finish and every pruning/confirmation case, recap and actual sync statuses, offline queued finish and reconnection, conflicts/auth changes, History deduplication, read-only pending records, finished note edits, and existing finish-from-another-start behavior.
- Current navigation implementation, reserved bars/safe areas, typing hide/show, real mobile keyboard, focus-safe responsive switching, route departure and cleanup, plus regression checks for Home, desktop, and the compact finished logger.
- 360px, 390px, 760px, 761px, and the project's desktop sizes; 200% text; long notes/names; touch/hybrid targets; reduced motion and assistive-technology navigation. Inspect screenshots and play gestures/animations on a real mobile browser before calling the interaction verified.

Run meaningful focused unit/controller/browser tests, the required repository suite, and build. Record actual evidence in a dedicated verification document during implementation. Production/preview verification is separate and must name the deployed environment; never claim a pending deployment was verified.

Self-review: scope is active mobile presentation plus its recap; desktop/finished-record editing and server/domain formats remain compatible. The proposed pending-finish note rule intentionally preserves existing offline limits rather than treating the prototype's sample memory as persistence. Remaining stage is the user's review of this written specification, followed by an implementation plan and execution-method choice.
