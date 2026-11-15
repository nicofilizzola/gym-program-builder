# Focus rounds and presentation

Date: 2026-11-15.

Status: Written specification approved by the user in conversation after commit `f8f452b`. Not implemented or deployed. Covers requests 4, 5 and 8, plus the superset experience developed during brainstorming. See the [design map](2026-11-15-mobile-tracker-refinements-design.md).

## Purpose and scope

Keep one familiar vertical workout feed, make paired exercises feel like one superset, and reduce incidental clutter. A working superset round is one vertical page containing two selectable partner sets. Either partner can be logged first. Completing one guides the user within that round; completing every existing partner set allows automatic movement to the next page.

This presentation applies to editable active mobile Focus at ≤760px. Desktop and finished records retain their regular tracker. This spec consumes the shared [optional-RIR/Best corrections](2026-11-15-tracker-inputs-and-benchmarks-design.md), and integrates with [overview interactions](2026-11-15-workout-overview-interactions-design.md) and [nested navigation](2026-11-15-nested-mobile-navigation-design.md). Read it alongside the existing [workout flow](2026-11-12-workout-flow-design.md); rules below supersede that presentation where stated.

## 1. Feed units and stored identity

Retain `projectWorkout`'s flat, ID-addressed execution projection for set counts, progress segments, historical lookup and ordinary consumers. Derive the page membership in the pure Focus model, with a map from each set key to its containing page:

| Work | Vertical page |
|---|---|
| Straight-exercise warm-up | One warm-up set |
| Straight-exercise working set | One working set |
| Superset A1 warm-ups | Individual pages, in their stored order |
| Superset A2 warm-ups | Individual pages after A1's warm-ups |
| Superset working round n | A1's nth working set and A2's nth working set, when present |

Use the existing two-member superset definition and member letters. Rounds run from 1 to the larger working-set count. Zero-set exercises have no artificial set page and remain manageable in the overview. A pair with no working sets has no working-round pages. Warm-ups never become paired working rounds.

Every address remains `{exerciseId,setId}`. A page is derived UI state, not a log object. Keep each canonical row/input/note/RIR/done node mounted exactly once, including a partner currently hidden from view. Do not clone controls, mount another logger or create another sync owner.

Page identity survives an add, removal, reorder, unlink or regroup when it can inherit a shared surviving set key; never identify a set by its display round number. Remove stale membership and choose the existing next/previous surviving-ref fallback when a viewed set disappears. A split must not reuse one page element twice. Breakpoint changes restore the exact rows to the regular logger, preserving values, invalid drafts and focused/composing controls.

## 2. Superset page layout

The page carries, in order:

1. `Superset A` with the existing link icon and `Round 2 of 3`.
2. Two equal partner selectors, naming `A1`/`A2` and each exercise.
3. The selected exercise's title, exercise-note action, tags, note and Last time/Best, using the existing presenters.
4. The selected set's context, canonical kg/reps controls and rulers, optional RIR, set note and completion action.

Use the existing orange accent rail around the superset context, without a second accent color. Keep the current controls, typography, snapshot metadata and note scopes. Only the selected partner's details and set controls are visible and operable; the other canonical row is hidden and inert, not deleted. Each selected context exposes the exercise and set through its accessible name.

The superset round is one full-height snap page. Only its outer round page is a snap target; its member rows must not create competing snap points. Its header belongs to that round and travels with it; do not add a separate pair header pinned across all rounds. Existing straight-exercise group pinning remains. In an oversized round the context can scroll away so all content remains reachable; the viewed set's Complete uses the existing sticky-bottom fallback. Focused pair controls must not reserve an obsolete straight-exercise pin height; retain their bottom clearance for Complete.

The selected pane is reserved against the larger member's measured content where needed so switching does not change the snap position or make nearby controls jump. Long names wrap in the selectors and retain their full accessible names. Do not shrink the touch target to fit a name.

### Selected and completed are independent

| State | Surface/name | Selection mark | Completion mark |
|---|---|---|---|
| Unselected, unfinished | Quiet `--bg` surface, `--muted` name, `--border` outline | None | None |
| Selected, unfinished | `--surface-2`, `--text` name | 3px orange underline | None |
| Unselected, complete | Quiet surface/name | None | Filled orange circle with a dark check |
| Selected, complete | Selected surface/name | Same moving underline | Same persistent check |

Use a 20px check circle; it does not replace the A1/A2 identity. A completed unselected member never receives an underline. The active selector is the only one with `aria-current="step"`; completion is also present in the button's accessible name. Use a named group of native buttons, not an incomplete ARIA tab implementation. Manual selection does not mark a set done or undo it.

### Unequal counts and absent members

Keep the paired layout, as requested. When A1 has four working sets and A2 has three, round 4 retains both member identities. A2 reads `No set this round`, has no set target and cannot be selected. It does not receive a completion check. Completing the existing A1 set completes that round. Apply the same rule when A2 is longer, or one member has no working sets.

Do not label a missing set complete, add a stored placeholder set or force equal counts. The round-completion condition is that every **existing** working set in the round is done, with at least one existing set.

## 3. Explicit completion, either partner first

Log one actual set through the canonical port on each deliberate completion. The first partner's completion is real immediately and survives save, offline mirroring, leaving the page and reload; it is not deferred until the pair finishes. The second completion does not batch-rewrite the first.

| Selected set | Other existing partner | Auto-next | Action and effect |
|---|---|---|---|
| Unfinished | Unfinished | On | `Log A1 & switch to A2` (or reverse): log only the selected member; switch to the unfinished partner in place |
| Unfinished | Unfinished | Off | `Log A1` / `Log A2`: log only that member and stay on it |
| Unfinished | Already complete or absent | Either | `Complete round`: log the selected set; the round becomes complete |
| Complete | Any | Either | `Undo A1 completion` / `Undo A2 completion`: reopen only this member and retain its values |

The first-partner action uses a neutral filled surface with an accent outline and a directional arrow. `Complete round` uses the existing filled orange primary treatment. A completed member uses the existing completed tint/undo treatment. No second round-confirmation button is added.

For example, A2→A1 is equally valid: logging A2 first checks A2 and, with Auto-next on, selects A1 without vertical motion. Logging A1 then completes the round and permits vertical advancement. Never use “A2 is done” or a fixed last-member index as the completion predicate.

Validate the selected set before any completion or navigation. Invalid or missing required reps leave the set incomplete and focus the existing error field. Completing never fills RIR. Changes to stored completion from hydration, saves, history loads or network acknowledgement cannot initiate movement or a celebration.

### Auto-next

Keep the auth-scoped preference in `src/workout-focus-session.js`, defaulting to true, shared across active Focus attachments as it is today. It is not a per-log field or a new persisted setting.

- On: after the first accepted completion, switch immediately within the round using the 200ms partner transition. After an explicit change takes the visible round from incomplete to complete, retain the existing 650ms completion-feedback window, then scroll vertically using the existing smooth travel.
- Off: both kinds of automatic movement stop. Users may still select either partner, scroll, scrub, use overview chips and use Back to current.
- Changing the preference only changes future behavior and cancels pending movement. Enabling it on an already-complete round never triggers travel.
- An explicit visible-round completion may be performed after navigating ahead. Advance forward to the next page with unfinished work after that round, or the review card if none follows. Leave earlier unfinished work intact and reachable through Back to current and the overview; never jump backwards automatically or force an earlier partner/round to be filled first. Ordinary straight-set guidance retains its existing rules.
- Three rounds completed in order produce three vertical advances: round 1→2, round 2→3, round 3→the next exercise or review.

Any existing interaction that cancels Auto-next still cancels it: pointer/key/wheel input, direct input, note interaction, dialog/menu, undo, resize, view/auth teardown or an invalidated target. Recheck the accepted log/page membership at firing time. A conflict that changes completion or removes a target cancels stale movement. Reduced motion removes the artificial delay and uses an instant final position.

Completion feedback remains truthful and scoped: a first member gets set feedback, both existing members earn round feedback, and all real working sets in the pair earn superset feedback. A missing partner does not earn a fictional set check. Retain the existing prevention of repeated flourish on the same rewarded set.

## 4. Partner transitions and focus

Use the approved coordinated transition for manual selection, a same-page jump and completion-driven switching:

- Details and active set controls enter together from +12px for A1→A2, or −12px for A2→A1, with opacity 0→1.
- Duration 200ms; easing `cubic-bezier(.22,1,.36,1)`.
- The selector and round context remain anchored. One 3px selection underline moves between partners over the same 200ms/easing; selected surface/text colors transition over 180ms ease-out.
- A newly logged member's check fades in and scales .65→1 over 160ms, without a bounce. Undo reverses those signals. Initial stored completion appears in its final state.
- Latest selection wins. Cancel/retarget earlier animations, do not queue panes, and leave only the latest selected controls operable. Canonical values and accessible selection change immediately.
- Direct typing, composition, initial rendering, acknowledgement patches, resizing and restoration do not animate. Cancel content motion when interacting with an input. Reduced motion applies final states instantly, including if enabled mid-transition.

Manual selector focus stays on that selector. Completion-driven switching and set jumps move focus to the new set's context text, not a numeric input. Move focus to its visible destination before making the old pane inert/hidden. Keep set-specific notes/drafts in their own canonical nodes. Do not replace or forcibly blur a composing field; finish composition before applying the latest requested partner change. Switching commits ordinary blur trimming through the existing note/input path, without silently normalizing an invalid numeric draft. The existing overflow ticker runs only for the selected visible exercise, after the switch settles; it remains suspended for hidden/compact titles and vertical travel.

## 5. Jumps, progress, scrolling and recovery

Keep the logger port, `jump(ref,{animate,focus})`, `visibleRef()`, overview chip targets and cursor memory addressed by exact exercise/set IDs. A pair page is an implementation detail of resolving those addresses.

- A target in the currently viewed round selects its partner in place; it does not manufacture a vertical scroll.
- A target on another page uses the existing smooth travel, then exposes the requested member. Focus moves to target context at travel start without opening a keyboard. Keep viewed-set/progress/ticker publication suspended until arrival, as today.
- `scrollend` or 150ms without scroll events settles travel. Existing interruption rules choose the nearest actual page and an existing member; no stale target or hidden input keeps focus.
- Manual scrolling restores a page's last selected existing member during the attachment; if none is remembered, prefer its first unfinished member, else the first existing member. The stored viewed-set ref restores the exact partner on reattachment. Do not persist every page's UI selection.
- Progress counts and segments still represent real individual working sets, in execution order, grouped by exercise/superset as today. A first partner completion increments the working count by one. The visible exercise position follows the selected partner.
- Scrubbing still reaches individual working sets only. Two segments can resolve to the same round page with different selected partners. Overview chips retain their exercise grouping, stored order and set-level labels; do not replace them with round-only buttons.
- Back to current targets the first unfinished exact set in execution order, including an unfinished partner in the currently viewed round. Show it whenever that ref differs from the viewed ref. It may select in place or travel vertically.

Reordering a pair moves it as one block; unlinking restores individual pages around surviving exact refs. Adding/removing sets recomputes round membership without duplicating rows or completion. A first/second member removal dissolves the pair using the existing rules. Finishing still prunes unchecked sets, dissolves invalid pairs and preserves controller/recap ownership exactly as before.

## 6. Less clutter, clearer boundaries and warm-ups

Remove the next-set header and next-exercise name-row peek everywhere in Focus. Every resting page uses the available space under its applicable header. Do not insert a replacement “what's next” snippet. The overview/progress navigation supplies that information.

Remove the peek calculations and height reservation from the fit model and renderer rather than keeping a dead zero-height peek branch. Keep regular group pinning, `--focus-gap`, density tiers and reachable sticky completion. Add no transition to measurement-driven fitting.

For straight exercises, mark the start of a new exercise block with a 2px full-width `--accent` rule on its name-row boundary. It moves with the incoming block; do not repeat it on every set. Superset context uses its agreed accent rail; in-place partner transitions and the moving selector communicate A1↔A2 changes. Do not introduce color cycling, interstitial screens or flashes.

Warm-ups are deliberately quieter: use a neutral `--surface` header band with the existing border and a prominent `Warm-up · W1` label (`W2`, etc.). Keep fields, numeric sizes, contrast, note access, Complete target and required validation equivalent to working sets. RIR remains absent. A paired exercise's warm-up may show its superset/member context, but has no partner round selector and completes/advances as an individual warm-up. The existing A1-warm-ups→A2-warm-ups→working-rounds order is unchanged.

### Short screens and enlarged text

Use the measured feed height, existing container-based tiers and real available space after the navigation change. At default text, the selected page must show inputs/RIR through Complete from a 660px visible viewport with representative names, one tag row and ordinary history. Do not claim that the fixed-height concept mock proves this.

Before a paired header crowds out controls, use the selected selector as its visible exercise name and visually hide the duplicate large title; retain a semantic exercise heading and relocate its existing exercise-note action into the round context. This compact fit is instant and reverses when room returns. Names in the selectors remain readable and wrap. Keep the same elements and note scopes.

Long notes, 200% text and very short viewports may make a page taller than the snapport. Allow native scrolling within that oversized page, retaining the sticky Complete fallback and keeping focused controls above it. Do not trap scrolling, shrink targets, discard details or pin a header that prevents access to inputs. Details and partner selectors remain reachable by scrolling back up. Preserve the established top-edge precedence when the keyboard shrinks the viewport.

## 7. Workout actions and footer

Remove the footer Auto-next checkbox. In editable active Focus, add a native checkbox row labelled `Auto-next` in the existing Workout actions popover, after Weight steps, with visible `On`/`Off` state. Use a 44px label target, native keyboard behavior and an accessible checked state. A change closes the popover and restores focus to Workout actions. Opening the menu cancels pending Auto-next. Preserve the existing note, weight-step and destructive actions and all other menu callers.

Make Workout overview a 44px neutral filled button (`--surface-2`, 1px `--border`, `--text`, existing overview icon and visible label) in the existing footer row. It fills the available row space; show Back to current alongside only when needed. Use an 8px gap and a 50px base row (3px block padding around the 44px control), excluding safe-area clearance. Allow the row to grow for wrapped enlarged text rather than squeezing targets. Orange primary emphasis remains with Finish/completion. The progress-row button remains another way to open the same overview.

Opening/closing the actual overview retains its 200ms sheet/dialog motion, focus restoration, inert closing content and reduced-motion behavior. The compact root back link and hidden nested tabs are owned by the navigation spec. Measure the feed against their actual geometry, including safe areas and keyboard changes.

## Architecture and acceptance

- `src/workout-focus-model.js`: derive page membership from existing execution items, preserve exact set identity, round completion and fallback. Keep log mutation in existing pure edits/port commands.
- `src/workout-focus-view.js`: own the one feed, canonical row placement, selected refs, jumps and measured fitting. A small `src/workout-focus-pair.js` owns pair selectors/state presentation and coordinated motion, rather than further mixing those concerns into the feed controller.
- `src/workout-focus-fit.js`: remove peek allocation and fit regular/pair pages with the defined compact/oversized behavior.
- `src/workout-focus-advance.js`: extend the existing explicit-completion coordinator for paired pages and order-independent completion; do not introduce a second competing advance controller.
- `src/workout-logger-view.js`, `src/reorder-menu.js`, `src/workout-focus-session.js`, `style.css`: expose the checkable Auto-next action, retain preference ownership and apply the final frame/footer style.

Keep ruler geometry enabled only for the selected/nearby presentation as needed; unselected hidden inputs must not trigger zero-width redraw loops or new state writes. This is not a new logger virtualization system.

Tests must cover derived pages with warm-ups, repeated variants, zero/unequal counts, both logging orders, missing/removed partners, unlinking, skipped earlier rounds, partial saves/offline resume and exact-ref jumps. Browser checks must cover all four selector states, missing partners, notes, input/DOM identity through resize and acknowledgements, invalid/composing drafts, rapid reversal, all Auto-next cancellation paths, overview/scrub same-page targets, focus, real-height fitting, 200% text, reduced motion and teardown.

Reuse the existing Focus model/advance/session/fit unit tests and Focus view/integration/fit/motion/progress/overview browser suites. Update old set-per-superset-page and peek assertions to the new requirements; retain the independent data/sync assertions. Add physical-phone checks for partner-transition feel, ruler interaction while transitioning, scrolling through rounds, keyboard/safe areas and momentum behavior. Those checks and deployment remain pending.

This supersedes the 2026-11-12 alternating-superset group-per-set presentation, all Focus peek rules, footer Auto-next placement and its set-only advancement gate for superset rounds. It leaves regular desktop/finished logging, warm-up order, storage/sync, exports, Last time/Best identity, AI review and analytics intact. No migration or new dependency.
