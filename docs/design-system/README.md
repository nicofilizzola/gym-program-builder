# Design system

The visual language of Gym Program Builder: a dark, athletic look with a single energetic orange accent. Everything here is implemented in plain CSS in `style.css` (tokens on `:root`) with no build step or UI library.

When you change a value, change it in `style.css` first and then update this file.

## Principles

- **One accent.** Orange (`--accent`) marks actions and selected state. Do not introduce a second accent colour. The only other colours are the four goal status colours (`--under`, `--met`, `--over`, `--no-goal`) plus `--untrained`, reserved for the volume-list bars, status text and body map.
- **Volume is the hero.** The body map and volume list must always be visible while editing (sticky sidebar on desktop, pinned bottom strip on mobile).
- **Colour never stands alone.** Every body map colour is paired with the volume list's number and status text (and the readout), the direct/indirect bar segments with the split as text (readout, row accessible name), every status colour with its status text and `volume / goal` value, and every highlight with a text tag.
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
| `--under` / `--under-soft` | `#fbbf24` / `rgba(251,191,36,.14)` | Volume bar and status text, under the goal |
| `--met` / `--met-soft` | `#4ade80` / `rgba(74,222,128,.14)` | Volume bar and status text, goal met |
| `--over` / `--over-soft` | `#f87171` / `rgba(248,113,113,.14)` | Volume bar and status text, over the goal |
| `--no-goal` / `--no-goal-soft` | `#94a3b8` / `rgba(148,163,184,.14)` | Volume bar and body map muscle without a goal; split key swatches |
| `--untrained` | `#3a4656` | Body map muscle with no goal and no volume |

Placeholder and hint text use `#64748b`. Contrast on `--surface` is at least 4.5:1 for `--text`, `--muted` and `--error`.

### Body map colours

The body map uses the volume bars' colours: one solid fill per muscle, with no direct/indirect split and no legend (the volume list and readout carry the numbers and status as text). The pure function `bodyMapTone(volume, goal)` in `src/volume.js` (unit-tested, built on `goalStatus`) picks the tone; CSS only maps a `data-tone` attribute to a colour.

| Tone | When | Token |
|---|---|---|
| `under` | goal set, volume below it (including 0 volume) | `--under` |
| `met` | goal set, volume equal to it | `--met` |
| `over` | goal set, volume above it | `--over` |
| `trained` | no goal, volume above 0 | `--no-goal` |
| `untrained` | no goal, 0 volume | `--untrained` |

## Typography

| Role | Font | Weight | Notes |
|---|---|---|---|
| Display (`--font-display`) | Barlow Condensed | 600 / 700 | Headings, card index, buttons, volume numbers. Uppercase with slight letter spacing. |
| Body (`--font-body`) | Barlow | 400 / 500 / 600 | Everything else |

Loaded from Google Fonts in `index.html`; falls back to `Arial Narrow` / `system-ui` offline.

| Element | Size |
|---|---|
| `h1` | 2.5rem (2rem on mobile) |
| Panel `h2` | 1.5rem (1.1rem on mobile) |
| Body / inputs | 16px, line-height 1.5 |
| Labels, chips, list rows | 0.875rem |
| Captions, tags | 0.75rem |

Numbers in the volume list use `font-variant-numeric: tabular-nums` so columns line up. Volumes are shown as-is (e.g. `4.5`), never rounded.

## Spacing, shape and elevation

- **Spacing:** 4 / 6 / 8 / 12 / 16 / 20 / 24 / 32px. Cards stack with 16px gaps; fields inside a card are 12px apart.
- **Radius:** `--radius` 12px for cards and panel, 8px for inputs and buttons, 999px for chips, tags and bars.
- **Elevation:** flat by default. Shadows only for meaning: the primary-highlight glow on cards, and the upward shadow of the pinned mobile panel.

## Layout

- **Desktop (> 760px):** two-column grid, `minmax(0, 1fr) 340px`, max width 1120px, sticky panel at `top: 24px`.
- **Mobile (≤ 760px):** single column (`minmax(0, 1fr)`, which prevents the chip row from causing horizontal scroll); the panel is pinned to the bottom with 120px-tall figures and the muscle list turned into one horizontally scrolling row of chips.

## Components

### Inputs
44px minimum height, `--surface-2` background, `--border` border. Focus: `--accent` border plus a 3px `--accent-soft` halo. Labels always visible above the field (never placeholder-only). Errors sit directly under the field they belong to.
Numbers (sets, rep range, goals) are never typed: they use sliders (below). Text fields remain only for names.

### Sliders
Native `<input type="range">` with no library, in a `.slider` wrapper (`src/app.js` builds them; limits come from `LIMITS` in `src/validate.js`).

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

A collapsed card hides its fields and shows a one-line summary below the header in `--muted` (for example `Bench press · 4 × 6–10 · Chest · secondary: Triceps, Shoulders`). It wraps; it is never truncated.

"Expand all" / "Collapse all" secondary buttons sit right-aligned above the exercise list, hidden when there are no exercises. When export is refused, the exercise it names expands and focus moves to its first invalid field.

Highlight states, set from the selected muscle via `data-hit`:

| `data-hit` | Look | Tag |
|---|---|---|
| `primary` | Solid `--accent` border + glow | Solid orange "Primary · Muscle" |
| `secondary` | Dashed border, `--accent-deep` left border | Outlined "Secondary · Muscle" |
| `none` | 45% opacity | none |
| empty | Default | none |

### Buttons
- **Primary ("Add exercise")**: full width, 52px tall, `--accent` fill, display font uppercase, plus icon.
- **Secondary ("Set goals")**: 44px tall, transparent, `--border` outline that turns `--accent` on hover, display font uppercase.
- **Icon buttons**: 44×44 transparent, always with an `aria-label`.
- Icons are inline SVG strokes (2px, round caps) using `currentColor`.

### Volume panel
1. Header: "Volume" + "sets per muscle" + the "Set goals" secondary button.
2. **Body map**: front and back figures side by side (`src/body.js`).
3. **Readout** (`aria-live="polite"`): hovered or selected muscle, its sets with the direct/indirect split, and exercise count (`Triceps 5 sets (3 direct · 2 indirect) · 2 exercises`); otherwise a hint.
4. **Split key**: "Direct" (`--no-goal` swatch) and "Indirect" (`--no-goal-soft` swatch with an inset `--no-goal` outline), left-aligned above the list, `aria-hidden` because each row carries the split as text. Hidden on mobile, with the bars.
5. **Volume list**: one `<button aria-pressed>` per muscle with name, bar and value. This is the keyboard and screen-reader equivalent of the body map, which is `aria-hidden`.
   - **Bar**: two stacked segments from `barSegments` in `src/volume.js`: direct (solid `--bar`) then indirect (`--bar-soft` fill with an inset 1px `--bar` outline). Each row's `data-status` sets `--bar` / `--bar-soft` to the under, met or over pair, or to the no-goal pair without a goal. All bars share one scale from `barScale`: the largest goal sits at 75% of the bar, and the scale grows so the largest volume always fits; with no goals the largest volume fills 75%. Nothing is cut off. The body map uses the same colours (see Body map colours).
   - **Goal marker**: a 2px × 14px `--text` tick (`.bar-goal`, `aria-hidden`) at `goal / scale`, drawn over the fill, so overshoot shows as fill past the marker. Hidden without a goal.
   - A visually hidden `(3 direct · 2 indirect)` inside each button puts the split in its accessible name. `.volume-row` is `position: relative` so that absolutely positioned text cannot widen the mobile chip scroller.
   - **With a goal** (from `goalStatus` in `src/volume.js`): the value reads `volume / goal` (e.g. `7 / 10`), the bar shows the goal marker, and a text status follows in the bar's colour: `under` in `--under`, `met` in `--met`, `over` in `--over` with an outline pill.
   - **Without a goal** the row keeps a plain value. Once any goal is set, the list gets `.has-goals` and every row uses fixed value and status columns (`76px 1fr 72px 44px`) so bars stay aligned and comparable.
   - The readout adds the goal and status for a muscle that has one (`Chest 7 / 10 sets (7 direct · 0 indirect) · under · 2 exercises`).
   - Goals colour the body map the same way as the bars (see Body map colours).

### Goals dialog
Native `<dialog>` opened with `showModal()` from "Set goals": `--surface`, `--radius`, `min(420px, 100vw − 32px)` wide, 60% black backdrop. One slider row per muscle in a single column, like the volume list (`.goal-row`: `88px` name, slider, `56px` value). On phones (≤ 760px) each row stacks, with name and value on one line and a full-width slider below. "Done" is `position: sticky` at the bottom, so it stays on screen while the list scrolls. Each slider runs from 0 to `LIMITS.goal.max` in `LIMITS.goal.step` steps. Its far-left 0 means no goal, and reads `No goal` (`.is-empty`, `--muted`, with `aria-valuetext="No goal"`). Values apply to the session while sliding; a slider at 0 deletes the goal. A slider cannot hold an invalid value, so the dialog has no goal errors. "Done" (primary button), Escape or a backdrop click close it, and focus returns to "Set goals". On open, the sliders show the applied goals (0 for a muscle without one).

## Body map

`src/body.js` exports `bodySvg(view)` for `'front'` or `'back'`. Each figure is drawn in a `0 0 100 210` viewBox from **left-half** paths that are mirrored for the right side (`matrix(-1 0 0 1 100 0)`).

| View | Muscles |
|---|---|
| Front | Chest, Shoulders, Biceps, Abs, Quads |
| Back | Upper back, Lats, Shoulders, Triceps, Hamstrings, Calves |

Each muscle is a `<g class="region" data-muscle="…">`. The app sets `data-tone` (from `bodyMapTone`) and the classes `is-selected` / `is-focus` on it. Muscle names must match `MUSCLE_GROUPS` exactly.

## Interaction

| Action | Result |
|---|---|
| Hover a muscle (mouse only) | White outline on the region, row highlighted, readout shows its sets |
| Click / tap a muscle (body or list) | Selects it: other regions dim to 40%, matching exercise cards highlight, row shows pressed state |
| Click the selected muscle again | Clears the selection |

Hover is a preview only; everything is also reachable by click/tap and keyboard (list buttons). Selection and hover are view state in `src/app.js`, kept apart from the session data.

## Motion

- 150ms for colour/border changes on controls, 200–250ms for body map fills, bars and card highlights, `ease` timing.
- Only colour, opacity, width of bars and a tiny press scale are animated.
- `prefers-reduced-motion: reduce` turns all transitions off.

## Accessibility checklist

- Text contrast at least 4.5:1 on its background.
- Visible focus ring (`2px --accent`, 2px offset) on every interactive element.
- Touch targets at least 44px (chips are 36px tall with 8px spacing).
- Icon-only buttons have `aria-label`; decorative SVGs are `aria-hidden`.
- Heat is always backed by a number; highlights are backed by a text tag.
