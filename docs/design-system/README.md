# Design system

The visual language of Gym Program Builder: a dark, athletic look with a single energetic orange accent. Everything here is implemented in plain CSS in `style.css` (tokens on `:root`) with no build step or UI library.

When you change a value, change it in `style.css` first and then update this file.

## Principles

- **One accent.** Orange (`--accent`) marks actions, selected state and training heat. Do not introduce a second accent colour. The only other colours are the four goal status colours (`--under`, `--met`, `--over`, `--no-goal`), reserved for the volume-list bars and status text.
- **Volume is the hero.** The body map and volume list must always be visible while editing (sticky sidebar on desktop, pinned bottom strip on mobile).
- **Colour never stands alone.** Every heat colour is paired with a number (volume list, readout), the direct/indirect bar segments with the split as text (readout, row accessible name), every status colour with its status text and `volume / goal` value, and every highlight with a text tag.
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
| `--on-accent` | `#0f172a` | Text on `--accent` |
| `--error` | `#fca5a5` | Validation messages |
| `--body` | `#252f3c` | Body-map silhouette (non-muscle areas) |
| `--under` / `--under-soft` | `#fbbf24` / `rgba(251,191,36,.14)` | Volume bar and status text, under the goal |
| `--met` / `--met-soft` | `#4ade80` / `rgba(74,222,128,.14)` | Volume bar and status text, goal met |
| `--over` / `--over-soft` | `#f87171` / `rgba(248,113,113,.14)` | Volume bar and status text, over the goal |
| `--no-goal` / `--no-goal-soft` | `#94a3b8` / `rgba(148,163,184,.14)` | Volume bar without a goal; split key swatches |

Placeholder and hint text use `#64748b`. Contrast on `--surface` is at least 4.5:1 for `--text`, `--muted` and `--error`.

### Heat scale (muscle volume)

Used by the body map only (the volume-list bars show direct/indirect instead). Fixed, absolute bands so a colour means the same thing in every session. The mapping lives in the pure function `volumeLevel(sets)` in `src/volume.js` (unit-tested); CSS only maps a `data-level` attribute to a colour.

| Level | Sets | Token | Value |
|---|---|---|---|
| 0 | 0 | `--lvl-0` | `#3a4656` |
| 1 | > 0 and < 4 | `--lvl-1` | `#7c2d12` |
| 2 | 4 – 6.5 | `--lvl-2` | `#c2410c` |
| 3 | 7 – 9.5 | `--lvl-3` | `#f97316` |
| 4 | 10+ | `--lvl-4` | `#fbbf24` |

If the bands change, update `LEVEL_LIMITS` in `src/volume.js`, its test, the legend in `index.html`, and this table together.

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
| Captions, legend, tags | 0.75rem |

Numbers in the volume list use `font-variant-numeric: tabular-nums` so columns line up. Volumes are shown as-is (e.g. `4.5`), never rounded.

## Spacing, shape and elevation

- **Spacing:** 4 / 6 / 8 / 12 / 16 / 20 / 24 / 32px. Cards stack with 16px gaps; fields inside a card are 12px apart.
- **Radius:** `--radius` 12px for cards and panel, 8px for inputs and buttons, 999px for chips, tags and bars.
- **Elevation:** flat by default. Shadows only for meaning: the primary-highlight glow on cards, and the upward shadow of the pinned mobile panel.

## Layout

- **Desktop (> 760px):** two-column grid, `minmax(0, 1fr) 340px`, max width 1120px, sticky panel at `top: 24px`.
- **Mobile (≤ 760px):** single column (`minmax(0, 1fr)`, which prevents the chip row from causing horizontal scroll); the panel is pinned to the bottom with 120px-tall figures, the legend hidden, and the muscle list turned into one horizontally scrolling row of chips.

## Components

### Inputs
44px minimum height, `--surface-2` background, `--border` border. Focus: `--accent` border plus a 3px `--accent-soft` halo. Labels always visible above the field (never placeholder-only). Errors sit directly under the field they belong to.

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
| `secondary` | Dashed border, `--lvl-2` left border | Outlined "Secondary · Muscle" |
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
4. **Legend** of the five heat levels (`aria-label="Body map colour scale"`). It describes the body map only.
5. **Split key**: "Direct" (`--no-goal` swatch) and "Indirect" (`--no-goal-soft` swatch with an inset `--no-goal` outline), left-aligned above the list, `aria-hidden` because each row carries the split as text. Hidden on mobile, with the bars.
6. **Volume list**: one `<button aria-pressed>` per muscle with name, bar and value. This is the keyboard and screen-reader equivalent of the body map, which is `aria-hidden`.
   - **Bar**: two stacked segments from `barSegments` in `src/volume.js`: direct (solid `--bar`) then indirect (`--bar-soft` fill with an inset 1px `--bar` outline). Each row's `data-status` sets `--bar` / `--bar-soft` to the under, met or over pair, or to the no-goal pair without a goal. All bars share one scale from `barScale`: the largest goal sits at 75% of the bar, and the scale grows so the largest volume always fits; with no goals the largest volume fills 75%. Nothing is cut off. The bar does not use heat colours.
   - **Goal marker**: a 2px × 14px `--text` tick (`.bar-goal`, `aria-hidden`) at `goal / scale`, drawn over the fill, so overshoot shows as fill past the marker. Hidden without a goal.
   - A visually hidden `(3 direct · 2 indirect)` inside each button puts the split in its accessible name. `.volume-row` is `position: relative` so that absolutely positioned text cannot widen the mobile chip scroller.
   - **With a goal** (from `goalStatus` in `src/volume.js`): the value reads `volume / goal` (e.g. `7 / 10`), the bar shows the goal marker, and a text status follows in the bar's colour: `under` in `--under`, `met` in `--met`, `over` in `--over` with an outline pill.
   - **Without a goal** the row keeps a plain value. Once any goal is set, the list gets `.has-goals` and every row uses fixed value and status columns (`76px 1fr 72px 44px`) so bars stay aligned and comparable.
   - The readout adds the goal and status for a muscle that has one (`Chest 7 / 10 sets (7 direct · 0 indirect) · under · 2 exercises`).
   - Goals never change the body map: it always shows absolute heat.

### Goals dialog
Native `<dialog>` opened with `showModal()` from "Set goals": `--surface`, `--radius`, `min(420px, 100vw − 32px)` wide, 60% black backdrop. One number field per muscle (`step 0.5`) in a two-column grid at every width, so "Done" stays on screen on a phone. Values apply to the session as they are typed; an invalid value shows its error under the field and leaves the previous goal in place; an empty field clears the goal. "Done" (primary button), Escape or a backdrop click close it, and focus returns to "Set goals". On open, the fields show the applied goals with no errors.

## Body map

`src/body.js` exports `bodySvg(view)` for `'front'` or `'back'`. Each figure is drawn in a `0 0 100 210` viewBox from **left-half** paths that are mirrored for the right side (`matrix(-1 0 0 1 100 0)`).

| View | Muscles |
|---|---|
| Front | Chest, Shoulders, Biceps, Abs, Quads |
| Back | Upper back, Lats, Shoulders, Triceps, Hamstrings, Calves |

Each muscle is a `<g class="region" data-muscle="…">`. The app sets `data-level` (heat) and the classes `is-selected` / `is-focus` on it. Muscle names must match `MUSCLE_GROUPS` exactly.

## Interaction

| Action | Result |
|---|---|
| Hover a muscle (mouse only) | White outline on the region, row highlighted, readout shows its sets |
| Click / tap a muscle (body or list) | Selects it: other regions dim to 40%, matching exercise cards highlight, row shows pressed state |
| Click the selected muscle again | Clears the selection |

Hover is a preview only; everything is also reachable by click/tap and keyboard (list buttons). Selection and hover are view state in `src/app.js`, kept apart from the session data.

## Motion

- 150ms for colour/border changes on controls, 200–250ms for heat fills, bars and card highlights, `ease` timing.
- Only colour, opacity, width of bars and a tiny press scale are animated.
- `prefers-reduced-motion: reduce` turns all transitions off.

## Accessibility checklist

- Text contrast at least 4.5:1 on its background.
- Visible focus ring (`2px --accent`, 2px offset) on every interactive element.
- Touch targets at least 44px (chips are 36px tall with 8px spacing).
- Icon-only buttons have `aria-label`; decorative SVGs are `aria-hidden`.
- Heat is always backed by a number; highlights are backed by a text tag.
