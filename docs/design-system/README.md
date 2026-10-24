# Design system

The visual language of Gym Program Builder: a dark, athletic look with a single energetic orange accent. Everything here is implemented in plain CSS in `style.css` (tokens on `:root`) with no build step or UI library.

When you change a value, change it in `style.css` first and then update this file.

## Principles

- **One accent.** Orange (`--accent`) marks actions and selected state. Do not introduce a second accent colour. The only other colours are the four goal status colours (`--under`, `--met`, `--over`, `--no-goal`), reserved for the volume-list bars and the met checkmark, and the body map heat ramp (`--untrained`, `--heat-1` to `--heat-4`), reserved for the body map and its legend.
- **Volume is the hero.** Keep the body map and volume list prominent while editing: a sticky desktop rail when it fits, normal document flow when it exceeds the viewport, and the existing mobile panel placement.
- **Colour never stands alone.** Every body map colour is paired with the heat legend and the volume list's numbers (and the readout), the direct/indirect bar segments with the split as text (readout, row accessible name), every status colour with the `volume / goal` value, the met checkmark and the hidden status word, and every highlight with a text tag.
- **Simple over clever.** Hand-written CSS, inline SVG, no icon fonts, no emoji as icons.

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
| Display (`--font-display`) | Barlow Condensed | 600 / 700 | Headings, card index, buttons, volume numbers. Uppercase with slight letter spacing. |
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

Session cards expose Edit, Duplicate and Remove as visible icon buttons with accessible names and the shared hover/focus tooltips. Edit uses a pencil. Icon targets are 32px only on compact fine-pointer desktop without a coarse pointer, otherwise 44px. Rest cards have only a handle and remove icon. No session-card move buttons or day select are shown. Week helper text explains dragging and handle shortcuts: Up/Down reorder within a day; Alt+Up/Down move through Monday–Sunday and Unscheduled, restoring handle focus and announcing the destination.

Week/Sequence switches fade only the session area: 75ms out, then 100ms in, ease-out, using the existing view-transition helper. The selector and weekly panel stay usable and steady; a newer selection cancels the old fade. Initial rendering and regular edits do not trigger this transition. Reduced motion switches instantly. Pending fades are canceled on list edits, editor navigation, server-driven updates and teardown.

## Components

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
`--surface` with a 4px left border. Header: drag handle (⋮⋮ grip, 44×44, `cursor: grab`, `aria-label="Reorder exercise"`; drag it, or focus it and press ↑ / ↓, to move the card), "Exercise N" index, optional hit tag, `Needs fixing` marker (outlined `--error` pill, only on a collapsed invalid card), chevron toggle (44×44, `aria-expanded`, `aria-label` "Collapse exercise" / "Expand exercise", points up when expanded, hover `--text` on `--surface-2`), trash icon button (44×44, turns `--error` on hover, `aria-label="Remove exercise"`). The header wraps on narrow screens. Moves are announced in a visually hidden live region.

A collapsed card hides its fields and shows a one-line summary below the header in `--muted` (for example `Bench press · 4 × 6–10 · Chest · secondary: Triceps, Front delts`). It wraps; it is never truncated.

Collapsing and expanding slide: the summary and the fields each sit in a `.collapsible` wrapper whose single grid row animates between `1fr` and `0fr`, with opacity and the 12px gap below the header (`padding-top`) shrinking alongside, all 200ms `ease-out`. A closed part has `.is-closed` and `inert` (unfocusable, hidden from screen readers). The inner element has 4px of inline room (`margin: 0 -4px; padding-inline: 4px`) so input focus halos are not clipped by its `overflow: hidden`, and the fields get 4px of bottom room (`padding-bottom: 4px; margin-bottom: -4px`) for the last chip row's focus ring. A refused export focuses its field with `preventScroll` and scrolls it to the centre only after the body's `grid-template-rows` transition ends (at once when nothing animates), so the field is never measured at 0 height. Cards built fresh (load, add, import, reorder, remove) get their state before the first style pass, so they never animate; reduced motion makes it instant.

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
- Only colour, opacity, width of bars, card collapse (grid row and padding) and a tiny press scale are animated.
- `prefers-reduced-motion: reduce` turns all transitions off.

## Accessibility checklist

- Text contrast at least 4.5:1 on its background.
- Visible focus ring (`2px --accent`, 2px offset) on every interactive element.
- Coarse-pointer targets, including chips, are at least 44?44px. Fine-pointer desktop controls may be 32px; compact chips are 28px. Native slider hit boxes remain 44px on every device.
- Icon-only buttons have `aria-label`; decorative SVGs are `aria-hidden`.
- Heat is always backed by a number; highlights are backed by a text tag.
