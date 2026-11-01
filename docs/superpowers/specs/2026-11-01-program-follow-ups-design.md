# Program follow-ups bundle — design (2026-11-01)

Approved answers from the 2026-11-01 review of `docs/superpowers/backlog/2026-11-01-follow-ups.md`, plus one cosmetic change. These requirements supersede conflicting rules in AGENTS.md sections "Program review dock and Week agenda", "Program hypertrophy analysis" and the design system's "Session analysis overlay".

## 1. Rest-day actions on the right

Sequence rest cards place Reorder and Remove at the right end of the card, in one action group, in that order (Reorder, Remove), after the "Rest day" title, on every viewport. The group's right edge aligns with workout cards' action group. Dragging, touch hold, Reorder menu and focus behavior are unchanged.

## 2. Drag preview keeps the card's layout

Cause: `mountSortable` appends the floating copy to `<body>` with a fixed width/height. Outside the Week agenda and its `day` size container, the copy loses `.week-agenda …` and `@container day` rules, so its title drops toward the bottom, the actions straddle the border and the metadata overflows.

Requirement: during a drag the copy renders exactly like its source card (same size; title, metadata and action positions within 1px) for program workout cards in Week and Sequence, rest cards, and session-template exercise cards, with the review dock open or closed. The copy is still fixed-positioned, inert, `aria-hidden` and noninteractive; drop logic, placeholder, motion and reduced motion are unchanged.

Approach: the copy is placed inside a body-level, fixed-position host that recreates the source's ancestor chain from the sortable root down to the item's parent as bare elements (same tag and class list only, no ids/data attributes/children), each sized to its original's border-box width with zero margin/padding/border. Descendant selectors and container queries therefore match as they do in the page. The host, not the copy, is translated.

## 3. Program header

- Row content: `PROGRAM` title, Program name field, then the Week/Sequence selector immediately after the name field. The selector belongs to the identity group, not the file actions.
- File actions (Program context, Import program, Export program, AI review, with AI review 16px from Export) form one group that never wraps internally at default text size on desktop (≥761px). It sits right-aligned on the same row when there is room; otherwise the whole group moves to its own row, still right-aligned. It may wrap internally only when even a full row cannot hold it (enlarged text, for example 200%).
- At ≥761px the Week/Sequence selector never wraps its two options and is vertically centered on the Program name input (layout alignment, not offset margins). The Program name field keeps at least 12rem, so a narrow row moves the file-action group to its own row instead of squeezing the identity group. (Amended 2026-11-01 after the final review.) Opening or closing the review dock never reorders the buttons or splits the group.
- ≤760px: the group may wrap internally (existing mobile behavior).
- No new motion: the group's row change happens during the existing 180ms dock column animation as normal reflow.

## 4. Review dock from 1024px

- The docked review applies at viewport widths ≥1024px (was 1280px). Below 1024px it stays the full-screen native modal. Dock widths unchanged: 340px, 360px at ≥1600px.
- 1024–1279.98px with the dock open: the program grid becomes a single column with the weekly volume panel above the sessions (same order as ≤800px). Body figures keep ≥180px height; no horizontal overflow. Closing the dock restores the two-column grid. The column switch is an instant reflow at the start of the 180ms dock transition (a two-column to stacked reflow cannot be interpolated); the dock's own motion and reduced-motion rules are unchanged.
- Breakpoint crossings while open keep report, scroll and focus, now at 1024px.

## 5. Training background in a user profile

- Program context keeps two fields: Goals and priorities; Constraints and preferences. The dialog, button, limits and save behavior are otherwise unchanged. Context-only replacement confirmation uses the two fields.
- A single-user profile holds `trainingBackgroundAndApproach` (plain text, ≤2,000 UTF-16 code units, CRLF normalized, whitespace-only = empty), stored server-side in SQLite with a revision, never in the browser.
- UI: a labeled person icon button (`Profile`, shared tooltip, `aria-current="page"` on the route) in the app header before Log out opens `#/profile`: a compact page titled Profile with one visibly labeled textarea "Training background and approach", the existing example guidance, and the note "Used by AI program reviews. Not included in program exports." It autosaves through the existing header save status; Retry on failure; a 409 conflict offers Reload saved version only (no Save as copy).
- Program AI review: the server adds the saved profile background to the program analysis input as `athlete.trainingBackgroundAndApproach`; the client never sends it. Program prompt version becomes `program-hypertrophy-v13`. Everything else about analysis (route, limits, generation settings, lifecycle) is unchanged.
- Migration 007 (explicit, per environment): creates the profile table, backs up every non-empty program `context.trainingBackgroundAndApproach` into `program_context_background_backup`, removes the field from program documents (removing `context` entirely when no field remains non-empty) and increments those programs' revisions. The profile starts empty.
- Exports no longer contain training background. Imports of v1–v3 files containing it succeed and drop that field. The profile is not exported.

## 6. Remove session-template AI analysis

- Remove the Analyze action, the session report popup/≤760px modal wiring, `POST /api/analysis` session analysis, the session prompt (`server/analysis-prompt.js`), its evaluation script/fixtures and session-only tests/styles.
- Keep everything the program review uses: `GET /api/analysis` capability, `POST /api/analysis/program`, `analysis-input.js` (shared exercise cleaning), controller, report rendering, SSE, client streaming, panel/dock, provider settings and program evaluation.
- `POST /api/analysis` returns 405 Method not allowed.

## Verification

`npm test`, `npm run test:e2e`, `npm run build`; real-browser checks per AGENTS.md "Review behavior as well as screenshots" at 1024×768, 1152×864, 1280×800, 1366×768, 1440×900, 1920×1080, 390×844 touch, 200% text and reduced motion. Record results in `docs/superpowers/verification/2026-11-01-program-follow-ups.md`. Never claim a pending deployment or migration was verified.
