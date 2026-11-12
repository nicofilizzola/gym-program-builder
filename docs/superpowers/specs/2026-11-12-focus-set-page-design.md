# Focus set page: comfortable input, visible tags, RIR and note fixes

Date: 2026-11-12.

Status: Design approved in conversation on 2026-11-12; written specification awaiting user review. This is spec 1 of four from the 2026-11-11 backlog (items 5, 7, 1, 2, 6, 8). Workout flow (items 9, 10), Home and history (item 4) and same-name variants (item 3) have their own specs.

## Purpose and agreed direction

Logging a set on a phone must be comfortable with one thumb, and the card must say which variant is being trained. The user reported:

- The weight and reps rulers are hard to grab and seem to let go mid-swipe; they ended up typing numbers instead. **Very high priority.**
- The variant's tags are missing from the tracker, although they matter as much as the name. **Very high priority.**
- RIR cannot express "five or more"; warm-up sets ask for an RIR that means nothing; the note button beside RIR reads as part of RIR; RIR buttons do not always show the same border after a tap.

Decisions:

- Keep the two side-by-side number tiles. Make each ruler taller, let it own every touch that starts on it, and let a tap on either side nudge one step. Typing stays available.
- Show tags as compact pills under the exercise title. Copy them into the log when the exercise enters the workout.
- The sixth RIR button reads `5+`. Warm-up sets have no RIR.
- The set-note button moves to the set's header row. One new pencil-on-paper icon marks every note action.
- The row holding the rep-target sentence and the `kg steps` selector is removed to pay for the added height. Rep guidance moves into the Reps caption; weight steps move into Workout actions.

Success means the user logs a whole workout on their phone using only the rulers and taps, recognises each variant from the card, and never sees an RIR button look selected when it is not.

## Existing requirements and boundaries

This extends [Mobile workout Focus](2026-11-08-mobile-workout-focus-design.md) and the card fit and rhythm plans (2026-11-10, 2026-11-11), [Logging warm-ups and supersets](2026-11-04-log-warmups-supersets-design.md), [Tracker polish and notes](2026-11-05-mobile-polish-tracker-notes-design.md) and [Reference metadata and tags](2026-10-29-linked-sessions-catalog-design.md).

It replaces these rules, and `AGENTS.md` is updated in the same change as each part ships:

| Existing rule | Replaced by |
|---|---|
| Focus: "set note is an icon in the RIR row" | Set note is an icon on the set's header row (§5). |
| Focus spec §3: visible rep-range sentence and weight-increment selector on the card | Reps caption and Workout actions (§1). |
| Tracker V1: "optional RIR (0–5)" | The stored range is unchanged; 5 means five or more and reads `5+` (§4). |
| Warm-ups: "fields and actions match working rows" | Warm-up rows have no RIR control (§4). |
| Tracker notes: saved set notes and Add note buttons use the `✎` character | They use the new note icon (§5). |
| Tracker V1: log exercises snapshot name, equipment and muscles | They also snapshot brand and focus tags (§3). |

Unchanged: Focus stays a presentation over `mountWorkoutLogger`'s port and borrows the canonical row nodes; `workout-sync`, conflicts, offline ownership, Auto-next timing, the title ticker, execution order, the recap and desktop layout rules. Rulers still never round a typed value; steps stay 0.25/1/2.5/5 kg with 2.5 the default. Logs stay version 2. No SQL migration, endpoint, export, AI-review or analytics change.

## 1. Set card layout

Top to bottom on an editable Focus card:

```
 Set 2 of 4 · Next set · Rest 120s       [note] (2)
 Incline dumbbell press                      [note]
 (Hammer) (Upper chest) (Stretch)
 Last time 80×9 @2 · Best 82.5×8

  Weight · kg            Reps · 8–12
     82.5                   8
 ‹ ╷ ╷ ╷ ▼ ╷ ╷ ╷ ›     ‹ ╷▓▓▓▼▓▓▓╷ ›

 RIR   [0] [1] [2] [3] [4] [5+]

 [          Complete set           ]
```

- **Removed:** the `.focus-input-help` row (44px).
- **Reps caption.** A working set with a target reads `Reps · 8–12`. Outside the target the caption changes its words and takes the `--under` colour: `Reps · 2 below 8–12` or `Reps · 1 above 8–12`. Warm-ups, exercises without a target and invalid drafts read `Reps`. Guidance stays advisory and inclusive; the existing `repRangeHint` sentences remain the accessible description. The ruler's target band is unchanged. The caption may wrap at enlarged text and never truncates the numbers.
- **Weight steps.** In Focus, on an editable active workout, Workout actions gains `Weight steps · 2.5 kg` after the workout-note action. It replaces the menu's items with `0.25 kg`, `1 kg`, `2.5 kg` and `5 kg`; the current choice is marked in text and to assistive technology. Choosing one applies to every ruler at once, closes the menu and returns focus to Workout actions. The second step replaces the items instantly inside the same popup, so it needs no new motion. Storage stays in `workout-focus-session.js`.
- **Header row.** Its minimum height becomes 44px to hold the set-note target (§5).
- **Height budget** at default text against today: −44px (help row), +24px (one line of tags), +8px to +12px (ruler), +4px (header). The card ends about 4–8px shorter. A second line of tags adds 24px. Exercises without tags and warm-up cards (no RIR row) are shorter still.
- **Fit rule kept:** at default text the viewed card shows through Complete from a 660px visible viewport, with one line of tags. When tags wrap, the next-set peek gives way first, then the existing sticky Complete applies. `workout-focus-fit.js` loses the help section; tags sit inside the identity section, which is already measured.

## 2. Weight and reps rulers

Problem today: the strip is 32–48px tall, the −/+ buttons are hidden in Focus, a drag whose first 8px lean vertical is abandoned, and `touch-action: pan-y` lets the browser take the gesture for the feed scroll and cancel the pointer. The last point is a hypothesis; it has not been reproduced on a device.

- **Size.** 56px when the feed is at least 560px tall, 48px below 560px, 44px below 460px. The fallback without container queries is 48px. Tick spacing (32px per step) is unchanged.
- **Ownership.** A pointer that goes down on the strip is captured at once and belongs to the ruler until it lifts. The strip uses `touch-action: none`. Vertical movement is ignored and never abandons the drag. A vertical swipe that starts on a ruler therefore does not scroll the feed; the rest of the card scrolls as before. A `pointercancel` still settles on the nearest step.
- **Drag.** Horizontal movement beyond a small slop drags the value as today, settling on a step on release.
- **Tap to nudge.** A pointer released within the slop is a tap: left of the centre marker steps down, right steps up, by the current weight step or 1 rep. A nudge behaves exactly like the ruler's existing Left/Right arrow keys, including from an empty field with a placeholder, from an off-grid typed value and at the limits.
- **Hints.** Muted `‹` and `›` chevrons sit at the strip's ends, `aria-hidden`, dimmed at the limit in that direction.
- **Motion.** Nudges apply immediately, like keyboard steps. No new animation.
- **Unchanged.** `role="slider"`, keyboard keys, value text, tapping the number to type, numeric inputs at least 16px, and every ruler interaction cancelling Auto-next. Only the viewed card and its neighbours stay enabled.

## 3. Variant tags

### Data

Log exercises gain two optional fields, normalized like `note`:

- `brand`: trimmed string, 0–80 UTF-16 units, default `""`.
- `focusTags`: array of at most 20 trimmed strings of 1–80 units, unique case-insensitively, default `[]`.

Limits live in `WORKOUT_LIMITS`. Shared validation rejects a present invalid value with `Exercise N: Invalid tags.` Missing fields in stored, mirrored and queued logs normalize to the defaults.

- Template and program starts copy the template exercise's `brand` and `focusTags` (the first 20).
- Add and swap copy the catalog variant's brand and focus tag names, in catalog order (the first 20), including retained archived assignments. Swap replaces the previous exercise's tags.
- Unlinked exercises have none. Workouts in progress when this ships show none; there is no backfill.
- Tags are a snapshot: renaming or archiving a tag later never changes a log. Last time and Best stay keyed by variant ID.

### Display

- **Focus card.** One list under the title, inside the identity section, labelled `Tags, {exercise}`. Brand comes first as a filled pill in `--text`; focus tags follow as outlined pills in `--muted`. No visible `Brand:` or `Focus:` prefix; each pill carries it as visually hidden text. Pills are not interactive. A long name truncates with an ellipsis inside the row. The list wraps to a second line when needed and is clipped at two lines (`shortcut:` a brand plus a handful of focus tags fits; revisit with a `+N` pill if real data overflows). No list renders when there are no tags.
- **Regular tracker and finished logs.** The exercise card's metadata line uses the existing `renderVariantMetadata` (equipment, then labelled `Brand:` and `Focus:` pills), on every viewport, including read-only logs.
- Tags do not appear in the workout overview (spec 2), history lists or Home.

## 4. RIR

- **5+.** The sixth button reads `5+` with the accessible name `5 or more`. The stored value stays 5 and validation is unchanged. Every rendering of a stored 5 reads `5+` through one shared formatter: set summaries (`@5+`), Last time, the overview (`5+ RIR`) and history. A last-time 5 shows as the dashed suggestion on `5+`.
- **Warm-ups.** Warm-up rows have no RIR control in Focus, the regular tracker or finished logs, and the Focus card has no RIR row. Completing or repeating a warm-up never fills RIR from Last time or the previous set. RIR already stored on old warm-up sets stays in the data, stays valid and is never displayed.
- **Consistent border (bug).** Required behaviour:
  - Accent border and fill appear only on the selected button.
  - An unselected button always has the `--border` colour, whatever was tapped before, including the button just deselected.
  - The last-time suggestion keeps its dashed border in a non-accent colour.
  - Hover styling applies only under `(hover: hover) and (pointer: fine)`.
  - Keyboard focus keeps a visible ring that cannot be mistaken for selection.

  Suspected causes are the ungated `:hover` rule sticking after a touch and the accent-coloured `:focus-visible` outline appearing after a text field was used. The plan reproduces the bug on a phone before choosing the fix. If the focus ring's colour changes for this group, the design system is updated in the same change.

## 5. Notes

- **Icon.** `action-controls.js` gains a `note` icon: a sheet of paper with a pencil, drawn like the other action icons. It replaces the pencil on the Focus workout-note indicator, the Focus exercise-note and set-note buttons and the overview's note action. In the regular tracker it replaces the `✎` character on Add note buttons and before saved exercise, workout and set notes. `edit` stays for rename and edit actions elsewhere.
- **Set-note placement.** In Focus the set-note button sits on the header row between the context text and the set-number marker, on working and warm-up cards. It keeps its 44px target, borderless style, accessible name and hide-while-a-note-exists rule. The editor and saved note still appear in the note area above Complete, with the existing 200ms collapse and focus behaviour.
- **RIR row.** It now holds only the caption and the six buttons, which share the freed 44px.
- The exercise note stays beside the title; the workout note stays in the page header and Workout actions.

## 6. Delivery order

One plan, three independently shippable parts:

1. **Small fixes:** `5+`, no warm-up RIR, note icon and set-note placement, RIR border.
2. **Input:** rulers, Reps caption, weight steps in Workout actions, help row removed.
3. **Tags:** log fields, start/add/swap copying, Focus pills, regular tracker pills.

## 7. Verification

- **Unit:** tag copying on start, add and swap; normalization of logs and mirrors without tags; rejection of invalid tags; the RIR formatter; warm-up completion and repeat leaving RIR empty; the fit model without the help section.
- **Browser (`npm run test:e2e`), at real browser heights:** a ruler drag that drifts vertically keeps tracking and does not scroll the feed; taps left and right of centre step once; limits; keyboard steps; the 660px fit with one line of tags; two lines of tags drop the peek; warm-up cards have no RIR row; `5+` selection and suggestion; the set-note button opens the editor from the header row; weight steps change from Workout actions.
- **Review:** populated workouts at 360, 390 and 412px widths, the short density tiers, 200% text, reduced motion and touch input; the regular tracker and a finished log at 1366×768, 1440×900 and 1920×1080 for tags, `5+` and the note icon.
- **Physical phone:** ruler comfort, the mid-swipe release and the RIR border can only be confirmed on the user's phone. Each of those plan tasks ends with the user trying it. Evidence goes in `docs/superpowers/verification/2026-11-12-focus-set-page.md`. Never claim physical-device or deployment verification from localhost or emulation.
- `npm test`, `npm run test:e2e` and `npm run build` pass.

## Out of scope

Hold-to-repeat nudging; haptics or sound; a different ruler scale or per-exercise weight steps; editing tags from the tracker; backfilling tags into existing logs; tags in the overview, history or Home; converting sets between warm-up and working; and backlog items 3, 4, 9 and 10.
