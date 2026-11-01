# Follow-ups needing design, plan and verification (2026-11-01)

**Status (2026-11-01): items 1 to 5 shipped on branch `feat/program-follow-ups`.** Design: [spec](../specs/2026-11-01-program-follow-ups-design.md); plan: [plan](../plans/2026-11-01-program-follow-ups.md); verification: [verification](../verification/2026-11-01-program-follow-ups.md). Local verification only: migration 007 and deployment to preview/production are pending and unverified. The two cosmetic defects found during verification were fixed in the final review fixes (see the verification record).

Raised alongside the 2026-11-01 cosmetic bundle (bordered card icon actions, program Reorder icon, centered rest-day delete icon, Program context icon). Each item below changes approved requirements, data or interaction behavior, so it goes through the usual spec → plan → verification flow before implementation.

## 1. Review dock breakpoint on laptops (shipped)

**Shipped:** the review docks from 1024px and an open dock stacks the weekly panel above the sessions at 1024 to 1279px.

The AI review fills the whole screen on laptop-sized desktops (1366/1440 widths) instead of docking. Today the spec docks at ≥1280px (340px dock) and uses a full-screen modal below. Decide the laptop behavior (e.g. a lower dock breakpoint, a narrower dock, or an overlay drawer) without shrinking the body figures below 180px or the volume panel's required sizes.

- Touches: AGENTS.md "Program review dock and Week agenda", docs/superpowers/specs/2026-10-31-program-review-dock-design.md, `--review-width` and breakpoint CSS, analysis-panel dock/modal transfer.
- Verify at 1280, 1366, 1440, 1920, plus mobile/tablet, 200% text and touch/hybrid input; open/close, breakpoint crossing while open, focus restore, reduced motion.

## 2. Program toolbar layout when the review dock opens (shipped)

**Shipped:** the layout selector joins the name field, and the file actions form one non-wrapping group (the selector wrap found in verification was fixed in the final review fixes).

On monitor widths, opening the dock narrows the main column and the file actions (Program context, Import, Export, AI review) wrap and rearrange awkwardly. The Week/Sequence selector also sits in the same row as the file actions, although it belongs to the sessions column; it should align with the program name input instead.

- Decide the toolbar structure: layout selector with the name/sessions column, file actions in a stable row that does not reflow when the dock column animates.
- Touches: program heading markup in src/program-view.js, `.program-toolbar` / `.program-file-actions` CSS, design system "Program context editor" and dock sections.
- Same verification as item 1; best designed together with it.

## 3. Drag-and-drop preview looks wrong while dragging (shipped)

**Shipped:** the drag copy now keeps the source card layout (0.0px measured deviation in 68 cases). Also moved rest-card actions to the right (the 4px offset found in verification was fixed in the final review fixes).

The dragged session card renders oddly during a drag. Investigate first (drag copy sizing in the single-column agenda, placeholder, card styles at the dock width). If the cause is only styling, it can return to the cosmetic track.

- Touches: src/sortable.js drag copy/placeholder, Week agenda and Sequence card CSS.
- Verify mouse and touch drag in Week and Sequence, across days and Unscheduled, rest days, reduced motion, with the dock open and closed; keep the drag-reorder and program-sequence e2e suites passing.

## 4. Training background at user level (shipped)

**Shipped:** single-user server-side profile at `#/profile`, migration 007 (explicit per environment, pending outside the local copy), injected server-side into program reviews, never exported.

Move "Training background and approach" out of per-program context into a single-user profile (new profile menu/screen). It must still feed the program AI analysis the same way. The app stays single-user.

- Decide: storage (new profile record + migration), what happens to background text already saved on programs (migrate one, choose, or discard), whether v3 bundles keep carrying it, and replacement confirmation rules (context alone currently counts as content).
- Touches: AGENTS.md "Program hypertrophy analysis", program context model/validation/dialog, analysis input projection and prompt, document bundles, revisions/autosave, navigation.

## 5. Remove AI analysis from session templates (shipped)

**Shipped:** Analyze, the session popup/modal, `POST /api/analysis` (now 405), the session prompt and its evaluation script are removed; the program review modules and `GET /api/analysis` remain.

Remove the Analyze action and standalone session analysis (anchored popup, ≤760px modal, session route) for now; it will come back later by reusing the program review modules.

- Decide whether the server route `POST` session analysis and its tests are removed or only unreachable from the UI, and keep shared modules (streaming, cancellation, safe rendering, dock) intact for the program review.
- Touches: AGENTS.md (currently requires standalone session analysis), src/session-markup.js, session-editor wiring, analysis-panel session scope, server route and tests, design system "Session analysis overlay".
