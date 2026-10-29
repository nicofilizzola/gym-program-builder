# Design system

The visual language of Gym Program Builder: a dark, athletic look with a single energetic orange accent. Everything here is implemented in plain CSS in `style.css` (tokens on `:root`) with no build step or UI library.

When you change a value, change it in `style.css` first and then update this file.

## Principles

### Session analysis overlay

The labeled Analyze toolbar action uses the existing orange tint/border and a restrained waveform SVG. Its report is a top-layer desktop region (at most 480px wide, 16px viewport clearance) or a full-screen mobile dialog at <=760px. Existing Barlow/dark/orange tokens remain authoritative; a raised surface, orange edge and editorial text sections distinguish the AI component. No chat bubbles, scores or new palette. Fine-pointer desktop targets remain 32px, otherwise 44px.

Open/close animate opacity and a 4px translation for 180ms ease-out; nodes survive exit and rapid reversal cancels old callbacks. Closing content becomes inert/aria-hidden immediately after focus restoration. Mobile closing transfers the same content into a nonmodal exit surface so native focus containment ends immediately. Reduced motion settles instantly. The streaming indicator changes opacity only; no artificial typing or per-token entrance effects. Jump to latest fades for 150ms without shifting controls. Opening focuses the heading, Escape/Close restores the trigger, desktop editing stays available, and mobile uses native modal focus containment. Streaming only follows while within 48px of the report bottom; status announcements are separate from report text. Initial editor rendering never animates the overlay.

- **One accent.** Orange (`--accent`) marks actions and selected state. Do not introduce a second accent colour. The only other colours are the four goal status colours (`--under`, `--met`, `--over`, `--no-goal`), reserved for the volume-list bars and the met checkmark, and the body map heat ramp (`--untrained`, `--heat-1` to `--heat-4`), reserved for the body map and its legend.
- **Volume is the hero.** Keep the body map and volume list prominent while editing: a sticky desktop rail when it fits, normal document flow when it exceeds the viewport, and the existing mobile panel placement.
- **Colour never stands alone.** Every body map colour is paired with the heat legend and the volume list's numbers (and the readout), the direct/indirect bar segments with the split as text (readout, row accessible name), every status colour with the `volume / goal` value, the met checkmark and the hidden status word, and every highlight with a text tag.
- **Simple over clever.** Hand-written CSS, inline SVG, no icon fonts, no emoji as icons.

## Feature design and review checklist

Use this checklist while designing, implementing and reviewing every UI change. Record decisions in the feature's existing spec/plan or short design note; a separate document is unnecessary. This is guidance for future changes, not a claim that every existing component already meets it.

- **Fit the existing screen.** Identify the nearest existing component and reuse its layout, spacing, typography and controls. Put related fields on aligned rows when space allows. Use disclosures for secondary settings. Avoid introducing a new card, heading or vertical section when an existing row or toolbar can hold the control. Let content wrap at narrow widths and enlarged text.
- **Choose icons with purpose.** Familiar repeated actions such as rename, archive, replace and remove should use the existing inline action-button pattern: currentColor SVG, accessible action-and-target name, shared hover/focus tooltip, and a direct action strip. Keep text on primary or unclear actions and preserve specifically required text buttons (including Import, Export and Reorder). Tooltips supplement an accessible name; they never replace it. Preserve the established 32px fine-pointer desktop / 44px touch and hybrid targets, and 44px slider hit boxes.
- **Describe both states and the transition.** For every changed interaction, note the trigger, open/closed states, animated properties, duration/easing, reduced-motion fallback and focus destination. Choose the nearest existing motion pattern below. Explain any intentionally immediate reveal or dismissal. Live values, typing and save acknowledgements must remain immediate; decorative delays are inappropriate.
- **Inspect populated layouts.** Use the project's required desktop sizes (1366×768, 1440×900, 1920×1080), relevant mobile/tablet widths, 200% text and touch/hybrid input. Check long names, errors, wrapped action strips, visible focus rings, body figures and reachable content. Review useful density alongside readability and target sizes.
- **Play the interaction.** In a real browser, verify opening and closing, rapid toggles/reversal, Escape/outside dismissal where supported, keyboard focus and reduced motion. Check that neighbors move smoothly during disclosures and closing content cannot receive focus. Capture screenshots for layout evidence; verify motion through interaction. Report checks actually performed and any gaps in the completion note.

## Colour tokens

| Token | Value | Use |
|---|---|---|
| `--bg` | `#0e131a` | Page background |
| `--surface` | `#171e28` | Cards, panel |
| `--surface-2` | `#1f2834` | Inputs, chips, hover rows, empty bar track |
| `--border` | `#2c3746` | Borders and dividers |
| `--text` | `#f1f5f9` | Primary text |
| `--muted` | `#94a3b8` | Labels, captions, secondary text |
| `--accent` | `#f97316` | Primary action, selected chip, focus ring, primary highlight |
| `--accent-soft` | `rgba(249,115,22,.14)` | Tinted backgrounds (secondary chip, pressed row, focus halo) |
| `--accent-deep` | `#c2410c` | Secondary highlight: card left edge and tag outline |
| `--on-accent` | `#0f172a` | Text on `--accent` |
| `--error` | `#fca5a5` | Validation messages |
| `--body` | `#252f3c` | Body-map silhouette (non-muscle areas) |
| `--under` / `--under-soft` | `#fbbf24` / `rgba(251,191,36,.14)` | Volume bar, under the goal |
| `--met` / `--met-soft` | `#4ade80` / `rgba(74,222,128,.14)` | Volume bar and checkmark, goal met |
| `--over` / `--over-soft` | `#f87171` / `rgba(248,113,113,.14)` | Volume bar, over the goal |
| `--no-goal` / `--no-goal-soft` | `#94a3b8` / `rgba(148,163,184,.14)` | Volume bar without a goal; split key swatches |
| `--untrained` | `#3a4656` | Body map muscle with 0 volume; heat legend `0` |
| `--heat-1` | `#9a4a1f` | Body map heat level 1 (0.5–3 sets) |
| `--heat-2` | `var(--accent)` (`#f97316`) | Body map heat level 2 (3.5–6 sets, the ideal range) |
| `--heat-3` | `#f0522d` | Body map heat level 3 (6.5–9 sets) |
| `--heat-4` | `#dc2626` | Body map heat level 4 (9.5 sets and above) |

Placeholder and hint text use `#64748b`. Contrast on `--surface` is at least 4.5:1 for `--text`, `--muted` and `--error`.

### Body map heatmap

The body map shows each muscle's absolute volume (direct + indirect), not its goal status, so its colours do not match the bars. One solid fill per muscle, with no direct/indirect split. The ramp builds to the accent orange at the ideal 4–6 sets and leans toward red above it. The pure function `heatLevel(volume)` in `src/volume.js` (unit-tested, limits in `HEAT_BANDS`) picks the level; CSS only maps a `data-heat` attribute to a token. Goals are ignored.

| Level | Volume | Token | Legend |
|---|---|---|---|
| 0 | 0 | `--untrained` | `0` |
| 1 | 0.5–3 | `--heat-1` | `1–3` |
| 2 | 3.5–6 | `--heat-2` | `4–6` |
| 3 | 6.5–9 | `--heat-3` | `7–9` |
| 4 | 9.5 and above | `--heat-4` | `10+` |

The legend (`#heat-key`, `aria-hidden`) sits centred under the two figures on every screen size: 0.75rem `--muted` labels, each after a 10px rounded swatch, like the Direct / Indirect key.

## Typography

| Role | Font | Weight | Notes |
|---|---|---|---|
| Display (`--font-display`) | Barlow Condensed | 600 / 700 | Page/panel headings, card index, buttons, volume numbers. Headings/buttons use uppercase with slight letter spacing; exercise names use normal-case Barlow. |
| Body (`--font-body`) | Barlow | 400 / 500 / 600 | Everything else |

Loaded from Google Fonts in `index.html`; falls back to `Arial Narrow` / `system-ui` offline.

| Element | Size |
|---|---|
| `h1` | 1.5rem on compact desktop; 2.5rem tablet / 2rem mobile |
| Panel `h2` | 1.25rem compact desktop; 1.5rem tablet / 1.1rem mobile |
| Body / inputs | Compact fine-pointer desktop: 0.875rem, line-height 1.4; otherwise 16px / 1.5 |
| Labels, chips, list rows | Compact desktop: 0.8125rem; otherwise 0.875rem |
| Captions, tags | 0.75rem |

Numbers in the volume list use `font-variant-numeric: tabular-nums` so columns line up. Volumes are shown as-is (e.g. `4.5`), never rounded.

## Spacing, shape and elevation

- **Spacing:** 4 / 6 / 8 / 12 / 16 / 20 / 24 / 32px. Cards stack with 16px gaps; fields inside a card are 12px apart.
- **Radius:** `--radius` 12px for cards and panel, 8px for inputs and buttons, 999px for chips, tags and bars.
- **Elevation:** flat by default. Shadows only for meaning: the primary-highlight glow on cards, and the upward shadow of the pinned mobile panel.

## Layout

- **Desktop (?1100px):** fluid canvas, 24px side gutters, 16px main gap, `minmax(0, 1fr) 460px`; the panel becomes 520px at ?1600px. Header, editor and program edges align. One compact application header carries product identity, labeled navigation and save/recovery controls. Page headings are 24px and names/actions use wrapping rows.
- **Tablet (761?1099px):** retain the previous 1120px cap and 340px session rail; program overview stacks at ?800px. Desktop density does not apply.
- **Mobile (≤ 760px):** single column (`minmax(0, 1fr)`, which prevents the chip row from causing horizontal scroll); the panel is pinned to the bottom with 120px-tall figures and the muscle list turned into one horizontally scrolling row of chips.

## Desktop density tokens

| Token | Value |
|---|---|
| `--canvas-gutter` | 24px |
| `--layout-gap` | 16px |
| `--compact-gap` / `--field-gap` | 8px |
| `--card-padding` | 12px |
| `--control-compact` / `--control-touch` | 32px / 44px |
| `--panel-width` | 460px; 520px at ?1600px |
| `--figure-height` | 180px; 200px at ?1600px |

Compact-target rules require a fine primary pointer and no available coarse pointer. Hybrid mouse/touchscreen laptops retain touch sizes using `any-pointer: coarse`. The desktop readout reserves `calc(2lh + 9px)`, including two line boxes plus its padding/border, so a two-line update never grows the panel.

Compact library rows are normally 54px tall, with 8px between rows; long names and enlarged text grow naturally. Desktop exercise cards use 12px padding and 12px list gaps. Their main field row is name/sets/reps, and primary/secondary muscle fieldsets sit side by side when card content is at least 700px wide. Narrower cards put name above sets/reps and stack the fieldsets. All 12 muscle choices remain visible in both groups.

Programs retain one ordered list in sequence mode. Schedule mode uses two day columns at 1100?1599px and three at ?1600px, in Monday?Sunday row-major order. Unscheduled spans the workout area below the week. Empty days retain 44px drop targets; workout cards grow naturally without internal scrollbars.

The program layout selector reads **Week / Sequence**, in that order. New programs open in Week; saved programs keep their applied layout. Sequence is headed **Sessions**, with an **Add rest day** action that appends a draggable, removable neutral rest card. Rests use the existing surface/border/radius, 12px padding and gaps (8px padding/gaps on compact fine-pointer desktop); they wrap and grow. Rests remain saved while hidden in Week and never affect weekday assignments or weekly volume.

Session cards expose Edit, Duplicate and Remove as visible icon buttons with accessible names and the shared hover/focus tooltips. Edit uses a pencil. Icon targets are 32px only on compact fine-pointer desktop without a coarse pointer, otherwise 44px. Workout and rest cards retain whole-card dragging and a visible Reorder action with movement options; rest cards also have a remove icon. No separate session-card Move up/Move down buttons or day select are shown. Helper text explains touch holds and Reorder shortcuts: Up/Down reorder within the mixed Sequence or current day; Alt+Up/Down in Week move through the weekdays and Unscheduled, restoring Reorder focus and announcing the destination. Reorder menus include all weekday destinations, including empty days. Rest cards use the same grab/hold feedback and pointer-aware control targets as workout cards.

Week/Sequence switches fade only the session area: 75ms out, then 100ms in, ease-out, using the existing view-transition helper. The selector and weekly panel stay usable and steady; a newer selection cancels the old fade. Initial rendering and regular edits do not trigger this transition. Reduced motion switches instantly. Pending fades are canceled on list edits, editor navigation, server-driven updates and teardown.

## Components

### Shared session context

Program sessions resolve shared template data; session editing saves the template rather than the program arrangement. The compact program context row contains the return control and a muted Shared template link, wrapping naturally without an extra card. The link uses 32px minimum height only at the established fine-pointer desktop breakpoint without any coarse pointer, otherwise 44px. Use the existing view fade for route entry/exit; do not add an entrance animation to the context row. Template and program names remain ordinary editable fields, and errors/recovery retain their existing surfaces. Acknowledgements update linked definitions without replacing focused controls or open variant drafts. Week/Sequence, body figures and volume layout stay unchanged.

### Inputs
32px minimum height on fine-pointer desktop (?1100px), 44px elsewhere, `--surface-2` background, `--border` border. Focus: `--accent` border plus a 3px `--accent-soft` halo. Labels always visible above the field (never placeholder-only). Errors sit directly under the field they belong to.
Numbers (sets, rep range, goals) are never typed: they use sliders (below). Text fields remain only for names.

### Sliders
Native `<input type="range">` with no library, in a `.slider` wrapper (`src/session-editor.js` builds them; limits come from `LIMITS` in `src/validate.js`).

- **Shape:** a 6px `--surface-2` track with a radius of 999px, like the volume bars, and an `--accent` fill from the start (or the min thumb) to the thumb. The visible knob is a 22px `--accent` circle with a 3px `--surface` ring, drawn as a radial gradient (`--knob`) inside a 44px-square thumb hit box. The wrapper is 44px tall, so a press anywhere within 22px of a knob's centre grabs it, two-thumb sliders included.
- **Alignment:** the track and fill are inset by half a thumb, and `--from` / `--to` (0–1, set by `setFill`) place the fill. Its ends always sit under the thumb's centre.
- **States:** hover adds a 6px `--accent-soft` halo around the knob (`--knob-hover`). Focus-visible draws the design system ring around the knob (2px `--surface` gap, then 2px `--accent`; `--knob-focus`) instead of a box around the input. The states swap backgrounds without transitions. The cursor shows `grab` / `grabbing`.
- **Value text:** in `.slider-head`, the label sits on the left and `.slider-value` on the right (display font, 700, `tabular-nums`, `--text`). `.is-empty` (e.g. `No goal`) turns the text `--muted`. The value text is `aria-hidden`, because the input announces its own value.
- **Two thumbs** (`.slider.is-range`, the rep range): two inputs overlap on one track. Only their thumbs take pointer input, and the last-touched one gets `.is-top`. Moving one thumb past the other pushes it (`setRepBound`), so min ≤ max always holds. The wrapper uses `isolation: isolate`, so `.is-top` never paints over the pinned mobile panel.

### Muscle chips
Real checkboxes, visually hidden but focusable, styled through the sibling `<span>`.

| State | Primary group | Secondary group |
|---|---|---|
| Off | `--surface-2` fill, `--border` outline | same |
| On | Solid `--accent`, `--on-accent` text | `--accent-soft` fill, `--accent` outline, `#fdba74` text |
| Disabled (picked in the other role) | 35% opacity, struck through | same |

Secondary legend carries the hint "count as ½ set".

### Exercise card
`--surface` with a 4px left border. The header starts with a compact identity group: a native expand/collapse chevron button immediately before a semantic h2: a small muted position (`01`, Barlow Condensed, 0.875rem, tabular figures) and the complete exercise name (Barlow, 1rem, weight 600, original case). Blank names read `Untitled exercise`. The padded number is decorative; visually hidden `Exercise N:` context distinguishes duplicate names for screen readers. Each card is associated with its heading. Names wrap without truncation. Optional muscle-match and `Needs fixing` tags follow the identity, then an intact right-side control strip: Reorder and remove. The identity group requests 240px before wrapping, so narrow tablet cards place tags/actions below rather than squeezing the name. Summaries align beneath the name with 68px compact / 80px touch indentation. Neutral collapsed-card hover feedback does not override muscle highlights. The chevron stays beside the identity in both states, including when the identity group takes the full mobile row. It has the existing 32px fine-pointer desktop / 44px touch target and shared hover/focus action tooltip, updated for its current state. Controls keep the existing 32px fine-pointer desktop / 44px touch sizing; names, tags and the strip wrap as necessary. The card background and heading remain drag surfaces; Reorder offers keyboard and movement-button alternatives. Moves are announced in a visually hidden live region.

A collapsed card hides its fields and shows only its prescription below the header in `--muted` (for example `4 × 6–10 · Rest 3 min`), separated by 4px with no trailing paragraph gap. It wraps; it is never truncated. The name and muscle mappings are not repeated. Saved/imported workouts start collapsed; newly added exercises start expanded. Disclosure state stays transient and follows the exercise when reordered. This pattern is shared by template and program workout editors. A primary click or short tap on any noninteractive content of a collapsed exercise opens it and focuses its disclosure button without scrolling or opening the keyboard. Expanded backgrounds never collapse: use the nearby chevron. Controls, secondary clicks, swipes, armed touch holds and completed or canceled drags never trigger background expansion. Disclosure state is never saved, and multiple cards can stay open independently.

Expanded cards keep the same name-led heading. Linked names are not repeated in the body; the existing direct catalog action strip, equipment/archive metadata and read-only muscle mappings remain available there. Custom exercises retain their labeled editable name field; unselected exercises retain the labeled autocomplete. Replacement search text never becomes the heading before explicit selection.

Collapsing and expanding slide: the summary and the fields each sit in a `.collapsible` wrapper whose single grid row animates between `1fr` and `0fr`, with opacity and the gap below the header (`padding-top`: 4px summary, 12px fields) shrinking alongside, all 200ms `ease-out`. A closed part has `.is-closed` and `inert` (unfocusable, hidden from screen readers). The inner element has 4px of inline room (`margin: 0 -4px; padding-inline: 4px`) so input focus halos are not clipped by its `overflow: hidden`, and the fields get 4px of bottom room (`padding-bottom: 4px; margin-bottom: -4px`) for the last chip row's focus ring. A refused export focuses its field with `preventScroll` and scrolls it to the centre only after the body's `grid-template-rows` transition ends (at once when nothing animates), so the field is never measured at 0 height. Cards built fresh (load, add, import, reorder, remove) get their state before the first style pass, so they never animate; reduced motion makes it instant.

"Expand all" / "Collapse all" secondary buttons sit right-aligned above the exercise list, hidden when there are no exercises. When export is refused, the exercise it names expands and focus moves to its first invalid field.

Highlight states, set from the selected muscle via `data-hit`:

| `data-hit` | Look | Tag |
|---|---|---|
| `primary` | Solid `--accent` border + glow | Solid orange "Primary · Muscle" |
| `secondary` | Dashed border, `--accent-deep` left border | Outlined "Secondary · Muscle" |
| `none` | 45% opacity | none |
| empty | Default | none |

### Buttons
- **Primary ("Add exercise")**: full width, 32px minimum on fine-pointer desktop / 52px elsewhere, `--accent` fill, display font uppercase, plus icon.
- **Secondary ("Set goals")**: 32px minimum on fine-pointer desktop / 44px elsewhere, transparent, `--border` outline that turns `--accent` on hover, display font uppercase.
- **Icon buttons**: 44×44 transparent, always with an `aria-label`.
- **Session toolbar** (`.toolbar`): one wrapping flex row above the exercise list. Import and Export (`.file-actions`) sit at the left, Expand all and Collapse all (`#list-actions`, hidden with no exercises) at the right (`margin-left: auto`). Each is a secondary button with an 18px inline SVG icon before its text (tray arrow in/out, chevron down/up). The file message sits below the row.
- Icons are inline SVG strokes (2px, round caps) using `currentColor`.

### Volume panel
1. Header: "Volume" + "sets per muscle" + the "Set goals" secondary button.
2. **Body map**: front and back figures side by side (`src/body.js`).
3. **Readout** (`aria-live="polite"`): hovered or selected muscle, its sets with the direct/indirect split, and exercise count (`Triceps 5 sets (3 direct · 2 indirect) · 2 exercises`); otherwise a hint. Always reserves two lines (`min-height: 3em`), with the text centred, so the panel never shifts on hover or selection. When its subject changes (hint ↔ muscle, or another muscle), the text crossfades: 75 ms out, 75 ms in, `ease-out`, with the text swapped while hidden, so the live region hears only the final text. Same-subject updates (live numbers) are instant, and so is every change under reduced motion.
4. **Split key**: "Direct" (`--no-goal` swatch) and "Indirect" (`--no-goal-soft` swatch with an inset `--no-goal` outline), left-aligned above the list, `aria-hidden` because each row carries the split as text. Hidden on mobile, with the bars.
5. **Volume list**: one `<button aria-pressed>` per muscle with name, bar and value. This is the keyboard and screen-reader equivalent of the body map, which is `aria-hidden`.
   - **Bar**: two stacked segments from `barSegments` in `src/volume.js`: direct (solid `--bar`) then indirect (`--bar-soft` fill with an inset 1px `--bar` outline). Each row's `data-status` sets `--bar` / `--bar-soft` to the under, met or over pair, or to the no-goal pair without a goal. All bars share one scale from `barScale`: the largest goal sits at 75% of the bar, and the scale grows so the largest volume always fits; with no goals the largest volume fills 75%. Nothing is cut off. The body map does not use these colours (see Body map heatmap).
   - **Goal marker**: a 2px × 14px `--text` tick (`.bar-goal`, `aria-hidden`) at `goal / scale`, drawn over the fill, so overshoot shows as fill past the marker. Hidden without a goal.
   - A visually hidden `(3 direct · 2 indirect)` inside each button puts the split in its accessible name. `.volume-row` is `position: relative` so that absolutely positioned text cannot widen the mobile chip scroller.
   - **With a goal** (from `goalStatus` in `src/volume.js`): the value reads `volume / goal` (e.g. `7 / 10`), the bar shows the goal marker, and a met goal adds a 16px `--met` checkmark (`.status`, inline SVG, `aria-hidden`). Under and over show no mark: the bar colour and the value carry them. The status word (`under`, `met`, `over`) sits in a visually hidden `.status-text` inside the button, so it stays in the accessible name.
   - **Without a goal** the row keeps a plain value. Once any goal is set, the list gets `.has-goals` and every row uses fixed value and status columns (`76px 1fr 72px 20px`) so bars stay aligned and comparable.
   - The readout adds the goal and status for a muscle that has one (`Chest 7 / 10 sets (7 direct · 0 indirect) · under · 2 exercises`).
   - The body map shows volume heat, not goal status (see Body map heatmap).

### Goals dialog
Native `<dialog>` opened with `showModal()` from "Set goals": `--surface`, `--radius`, `min(420px, 100vw − 32px)` wide, 60% black backdrop. One slider row per muscle in a single column, like the volume list (`.goal-row`: `120px` name, slider, `56px` value, `28px` info button, so the info buttons line up). On phones (≤ 760px) each row stacks, with name, value and info button on one line and a full-width slider below. "Done" is `position: sticky` at the bottom, so it stays on screen while the list scrolls. Each slider runs from 0 to `LIMITS.goal.max` in `LIMITS.goal.step` steps. Its far-left 0 means no goal, and reads `No goal` (`.is-empty`, `--muted`, with `aria-valuetext="No goal"`). Values apply to the session while sliding; a slider at 0 deletes the goal. A slider cannot hold an invalid value, so the dialog has no goal errors. "Done" (primary button), Escape or a backdrop click close it, and focus returns to "Set goals". On open, the sliders show the applied goals (0 for a muscle without one).

- **Info button** (`.info-btn`): a 28×28 "i" icon button in the row's last column, `aria-label="About <muscle>"`, with `aria-expanded` (true while its tooltip shows), `aria-controls` and `aria-describedby` pointing to its tooltip; `--muted`, `--accent` on hover or while shown.
- **Info tooltip** (`.info-tip`, `popover="manual"`): a top-layer overlay, so it never moves the rows and the dialog's scroll never clips it. `--surface-2`, 1px `--border`, 8px radius, soft shadow, `min(280px, 100vw − 16px)` wide, 0.75rem, with bold "Productive sets" and "Programming" lines. A mouse hover or keyboard focus peeks at it, and it stays while the pointer moves onto the tooltip (150 ms grace). A click or tap pins it until the button is clicked again, a press outside, or Escape (which then keeps the dialog open). One tooltip shows at a time, and scrolling the dialog, resizing the window or closing the dialog hides it. `tooltipPosition` (`src/tooltip.js`) places it 6px below the button with right edges aligned, flips it above when only that side fits, and keeps it 8px inside the window. It fades and slides 4px toward its spot over 150 ms `ease-out`, in and out, and appears at once under reduced motion.

## Body map

`src/body.js` exports `bodySvg(view)` for `'front'` or `'back'`. Each figure is drawn in a `0 0 100 210` viewBox from **left-half** paths that are mirrored for the right side (`matrix(-1 0 0 1 100 0)`).

| View | Muscles |
|---|---|
| Front | Chest, Front delts, Side delts (outer cap), Biceps, Abs, Quads |
| Back | Upper back, Lats, Rear delts, Side delts (outer cap), Triceps, Hamstrings, Calves |

Each muscle is a `<g class="region" data-muscle="…">`. The app sets `data-heat` (from `heatLevel`) and the classes `is-selected` / `is-focus` on it. Muscle names must match `MUSCLE_GROUPS` exactly.

## Interaction

| Action | Result |
|---|---|
| Hover a muscle (mouse only) | White outline on the region, row highlighted, readout shows its sets. Volume rows (and mobile chips) have touching hit areas, their visible box drawn by an inset `::before`; leaving a muscle keeps it hovered for 150 ms, so crossing a gap never flashes the hint |
| Click / tap a muscle (body or list) | Selects it: other regions dim to 40%, matching exercise cards highlight, row shows pressed state |
| Click the selected muscle again | Clears the selection |

Hover is a preview only; everything is also reachable by click/tap and keyboard (list buttons). Selection and hover are view state in `src/app.js`, kept apart from the session data.

## Motion

- 150ms for colour/border changes on controls, 200–250ms for body map fills, bars and card highlights, `ease` timing; 200ms `ease-out` for card collapse/expand.
- New user-triggered disclosures reuse the existing 200ms `ease-out` grid-row/opacity pattern, with a matching chevron rotation. Animate both expansion and collapse so neighboring content moves smoothly. New overlays reuse the nearest existing tooltip/popover/dialog pattern; where none fits, default to a restrained 150ms `ease-out` opacity transition, with at most the existing 4px slide. Preserve feature-specific behavior and document intentional instant changes.
- Animate only the properties the interaction needs: colour/border, opacity, bar width, disclosure grid row/padding, or a restrained transform. Never use `transition: all`. Do not introduce decorative entrance sequences or animation libraries.
- Keep the same nodes alive through exit transitions and rapid reversals where practical; apply final hidden/removal state only after closing finishes. Closing/closed content must be noninteractive and hidden from assistive technology immediately, with focus moved to a logical visible control first. Cancel obsolete completion handlers so repeated toggles cannot hide reopened content. Reduced motion must reach the same final state without waiting for a transition event.
- Initial rendering, imports and routine refreshes show their final state without entrance motion unless a feature explicitly requires otherwise. Typing, slider readouts and same-subject data updates remain immediate. Preserve focus indicators without a delayed reveal.
- `prefers-reduced-motion: reduce` turns all transitions off.

## Accessibility checklist

- Text contrast at least 4.5:1 on its background.
- Visible focus ring (`2px --accent`, 2px offset) on every interactive element.
- Coarse-pointer targets, including chips, are at least 44 by 44px. Fine-pointer desktop controls may be 32px; compact chips are 28px. Native slider hit boxes remain 44px on every device.
- Icon-only buttons have `aria-label`; decorative SVGs are `aria-hidden`.
- Heat is always backed by a number; highlights are backed by a text tag.

### Workout duration

A compact clock + live estimate + chevron disclosure shares the editor heading with the template name in session templates and program workout editors. The 18px outline clock stays still; only the chevron rotates. Accessible Show/Hide duration details names and shared hover/focus tooltips explain the action. Its inline details show execution/rest/extra/buffer and two native allowance sliders; no additional volume-panel space is used. Totals read ~N min, rounded upward only after calculation. Empty workouts show ~0 min. Details wrap and remain in normal document flow; open state is transient.

Duration details expand and collapse with grid rows (0fr to 1fr) and opacity over 200ms ease-out; the chevron rotates over the same duration. Persistent clipped wrappers preserve nodes through closing and rapid reversal, with no residual panel spacing when closed. Closing moves focus from inside to the toggle before immediately making the region inert and aria-hidden. Initial construction has no entrance motion; live values update immediately without resetting focus or open state. Reduced motion makes both transitions instant. The variable-width button retains 32px fine-pointer desktop / 44px touch and hybrid minimum targets.

Rest per set uses the existing native slider appearance and 44px hit area: 0 to 300 seconds, step 15, with readable minutes/seconds. It appears alongside sets/reps on wide desktop cards and in the existing stacked flow on mobile. Desktop main fields use name/sets/reps/rest at card widths of at least 700px; narrower desktop cards put the name above three slider columns. Collapsed summaries append configured rest and wrap naturally.

Extra time is 0 to 60 minutes by 1 (default 5); Buffer is 0 to 50% by 5 (default 10). Their controls use two columns with 16px gap, stacking on mobile. Breakdown values use tabular figures, muted labels, existing surface/border tokens, 12px padding and an 8px radius. Both figures retain their existing heights and all touch/hybrid controls retain their existing target sizes.

Exercise slider headings wrap label/value onto separate lines when text is enlarged; value readouts stay on one line. Program workout metadata includes a noninteractive Estimated duration ~N min label in sequence, scheduled days and Unscheduled. It can shrink and wrap with the exercise count and muscle-match badge without adding a second panel or a weekly total.

### Exercise catalog

Exercise catalog uses the existing dark surfaces, Barlow type, orange focus/action accent and compact controls. Reference disclosures contain indented variant rows with equipment and primary/secondary mappings; complete icon action strips wrap below on narrower screens. Search and equipment filters have visible labels. Archived entries can be shown and restored.

In-card autocomplete keeps the Exercise field and equipment filter in normal keyboard order. Suggestions use viewport-constrained top-layer popovers, independent of collapsing-card clipping and the mobile volume panel. Reference headings group variant names, equipment and both muscle roles in the suggestions. Arrow keys choose the active suggestion, Enter selects it, Escape dismisses it and Tab retains ordinary document navigation. Result announcements settle for 150ms while typing.

Catalog forms use native modal dialogs, at most 680px wide, with 16px viewport clearance and reachable sticky actions. Primary and secondary muscle chips are side by side when room permits and stack on mobile. Linked session definitions are read-only; Create variant and catalog edits explicitly explain their scope. All touch/hybrid actions remain at least 44px; fine-pointer desktop may use existing 32px controls and 28px muscle chips.

Catalog page titles use the compact 24px heading scale. Search inputs share text-input surfaces, focus rings and the same 32px fine-pointer desktop / 44px touch sizing. Suggestion popovers reserve visible application and program navigation space and anchor outside the complete picker controls, so they do not cover the equipment filter or navigation actions.

### Reference exercise groups

The catalog groups selectable variants beneath named reference exercises. Group headers use body typography, a native disclosure button with an 18px chevron, active/archive counts and a direct inline icon strip: Add variant, Rename, Archive/Restore. Variant rows expose Edit, Create variant, Move and Archive/Restore in that order. Icons are 20px currentColor strokes in existing action-button controls, with 8px gaps, accessible action-and-target names and shared hover/focus tooltips. There are no catalog row action menus. Headers begin collapsed; search temporarily expands matching groups. Child rows use a 26px desktop indent, 12px inner padding and a subtle left rule; mobile uses 8px and 10px. Reference-name case is preserved. All stateful disclosure controls expose aria-expanded/aria-controls.

Reference create/edit forms contain a name and a required Exercise type selector: Compound (3 min rest) or Isolation (1 min 30 sec rest). Existing form control styling and target sizes apply. New-reference creation inside the variant form requires the same deliberate choice; reference headings display classification in the existing muted count text. Variant forms identify their fixed reference when scoped. Move dialogs show source, destination and affected-workout counts. Action tooltips use the shared top-layer popover; unavailable actions remain focusable with aria-disabled and guarded activation, explaining the parent archive restriction. Keep row action strips horizontal and allow them to wrap as a whole below long content on narrow screens. Do not stretch individual icon buttons to full width. Use 32px square targets only at desktop >=1100px with a fine primary pointer and no coarse pointer, otherwise 44px square targets. Focus returns to logical controls after rerendering; archive origin is described as text, and touch/hybrid controls remain 44px.
Grouped autocomplete uses labeled reference groups with nonselectable headings and indented option rows. Its eight-result cap counts variants only; keyboard order follows the rendered groups, and active selection is retained by stable variant ID during refresh. Equipment, New variant and Cancel selection remain outside the listbox in document focus order.

Reference disclosure motion uses a catalog-specific grid wrapper (0fr to 1fr) and opacity over 200ms ease-out, with the chevron rotating over the same duration. Manual toggles update nodes in place, so rapid reversals preserve focus and animate from the current position. Closed/closing children are inert and aria-hidden immediately. Initial construction, filtering and reloads display their final state without entry motion. Reduced motion disables these transitions. The inner wrapper retains the 26px desktop / 8px mobile indent, 12px desktop / 10px mobile left padding, and 4px right focus-ring clearance.

At widths <=620px reference names use the complete header width, with counts and the intact action strip following on the next line. This avoids narrow columns of wrapped names at enlarged text sizes. Icon controls never grow to fill spare row width. A focused action's pending tooltip survives automatic scrolling into view; already shown tooltips still dismiss on scroll.

Unavailable icon actions show their restriction tooltip on activation as well as hover/focus, including a touch tap while the reference is collapsed; they never submit a mutation. Catalog focus restoration keeps the viewport position for already visible controls and scrolls offscreen results or fallbacks into view after moves, rename/reordering and filtering.

### Inline workout exercise actions

Expanded linked exercise cards in both session templates and program workouts show Replace exercise (swap arrows), Create variant (overlapping sheets) and View in catalog (book) as a direct inline icon strip in the expanded body above equipment/archive metadata. The name appears once in the card heading. There is no Actions menu. The strip stays horizontal with 8px gaps; names remain complete and use the full heading row on phones (<=760px). Reuse action-button controls: 32px square only at desktop >=1100px with a fine primary pointer and no coarse pointer, otherwise 44px square. Icons are 20px currentColor strokes with accessible button names and shared top-layer hover/focus tooltips.

An archived reference leaves Create variant focusable with aria-disabled and guarded activation; hover, focus or touch activation explains: Restore the reference exercise before creating a variant. Replacement cancellation returns focus to Replace exercise; variant form cancellation returns focus to Create variant. Tooltips dismiss on collapse and teardown. Custom exercise linking and autocomplete retain their existing controls.


### Card reordering

Exercise cards (expanded or collapsed) and program workout cards support dragging from backgrounds, headings, summaries and metadata. Buttons, inputs, sliders, selects, links, labels, editable content and custom interactive widgets retain their ordinary behavior. Eligible desktop content uses a grab cursor; interactive controls keep their normal cursors. There is no dotted drag handle or reserved drag gutter.

A visible Reorder text action uses the existing secondary-button appearance and sizes: 32px minimum height only at the established desktop fine-pointer breakpoint with no coarse pointer; otherwise at least 44 by 44px. Up/Down while focused moves within the current list/group. Activating it opens a viewport-constrained top-layer group of native movement buttons. Program Week options include every weekday and Unscheduled, including empty groups. Escape closes options and restores focus. Movement through Reorder options restores focus to Reorder and announces the position or destination. Existing Move up/Move down actions retain focus on the invoking action when still enabled. Options close on outside interaction, view rebuild, scrolling that moves their anchor, resize and teardown. Queued scroll notifications from opening the action do not dismiss newly positioned options.

Mouse/pen drags begin after 5px movement. Touch swipes scroll normally; holding eligible content for 350ms arms dragging with an accent border. Movement over 8px before the hold cancels the candidate. A hold released without dragging does not reorder. Keep native page panning enabled; suppress it only after the hold arms. Drag ghosts, placeholder motion, edge scrolling, Escape/cancellation and reduced-motion behavior retain the established sorter behavior. Gesture/menu state is transient. Collapsed exercise cards additionally open on a normal click/tap release; native post-drag and cancellation clicks are suppressed until consumed or a new press starts. Keyboard button activation stays available. Program overview workout/rest cards retain their existing activation behavior.

The visible helper reads: "Drag a card to reorder. On touch, press and hold. Use Reorder for movement options." Native buttons preserve Tab, Enter and Space; dragging always has a non-drag alternative.
