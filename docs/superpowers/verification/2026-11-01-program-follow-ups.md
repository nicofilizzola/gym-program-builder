# Program follow-ups verification

Implementation: branch `feat/program-follow-ups`. Design and plan: [spec](../specs/2026-11-01-program-follow-ups-design.md), [plan](../plans/2026-11-01-program-follow-ups.md); backlog: [follow-ups](../backlog/2026-11-01-follow-ups.md); rollout: [program background rollout](../../operations/program-background-rollout.md). This is local verification on Windows with headless Playwright Chromium. **No preview or production deployment or migration was performed or verified.**

## Migration 007 (local copy only)

`npm run db:migrate` was run from the worktree against `./local.db`, which is a **copy** of the user's local database placed there by the controller (the user's real `local.db` was never opened). Before running, `node --env-file-if-exists=.env.local -e` confirmed `TURSO_DATABASE_URL=file:local.db` (relative to the worktree, no auth token). Results:

- Before: `schema_migrations` held versions 1–6; no `program_context_background_backup` table; one program, two templates.
- Output: `Database migrations applied.` After: versions `[1,2,3,4,5,6,7]`.
- `SELECT count(*) FROM program_context_background_backup` returned **1** (program `30a7fc5e-…`, backed-up text 49 UTF-16 code units; text itself not printed). That program's revision went 169 to 170 and its document has no `context` key afterwards, as the spec requires when no field remains non-empty. The two templates were unchanged (revisions 83 and 16).
- `user_profile` (`id, revision, profile_json, updated_at`) exists and is empty, so the profile starts empty. A second `npm run db:migrate` was idempotent (versions unchanged, backup count still 1).
- Not verified: the user's real `local.db`, any preview database, any production database.

## Automated evidence

- `npm test`: **236 passed, 0 failed** (10.1s).
- `npm run build`: "Built public assets."
- Targeted e2e (`drag-reorder`, `program-sequence`, `program-sequence-persistence`, `program-review-dock`, `profile`, `program-analysis-panel`, `program-context`, `program-context-dialog`, `reorder-regressions`, `program-analysis`): **106 passed, 0 failed** (2.0 min). The full `npm run test:e2e` suite was not re-run for this record.

## Browser evidence

Real Chromium (Playwright 1.64, headless; the Chrome extension was unavailable) driven by throwaway scripts kept outside the repository, against `node scripts/dev-server.js --test` (port 3199, fresh migrated database) and, for the profile and review-request checks, a scratch server with the real API stack and a recording provider stub (port 3201). Populated fixtures built through the API client: three shared templates (6, 5 and 8 exercises, one with a very long name), a Week program with six occurrences (two on Monday, Tuesday, Thursday, Friday and Unscheduled; long program name; goals), and a Sequence program with three sessions and two rests. Both servers were stopped afterwards.

### Drag preview geometry (spec section 2)

For each case the source card's element rectangles (every non-empty descendant, relative to the card) were captured before the drag; then the pointer pressed on a non-control spot, moved 18px, and the floating copy's rectangles were captured and compared element by element. 68 cases in total: 67 measured by the main drag script, plus the session-template exercise card at 390px touch, for which the main script found no safe press point and which a dedicated script measured separately (geometry only).

- Result: **maximum deviation 0.0px (below 0.05px after rounding)** in every case; element counts matched. The copy host was `position: fixed`, the copy `inert`, `aria-hidden="true"` and `pointer-events: none` in all 67 main-script cases; the separate 390px exercise-card run did not inspect those properties. (Count reconciled against the saved drag results after the final review: 68 entries, 67 measured, 1 "no safe point".)
- Cards: Week workout cards (Monday, long-name, Unscheduled), Sequence workout cards, Sequence rest cards, and session-template exercise cards.
- Viewports and dock: 1440 closed, 1440 dock open, 1100 closed and open, 1024 closed and open, 1280 and 1920 dock open (mouse); 390 closed (touch, `isMobile`), 1440 closed and open (touch, `hasTouch`). Touch used CDP `Input.dispatchTouchEvent` with a 700ms hold. Day-row widths ranged 358px (390) and 416px (1280 dock open), the narrow cases, to 826px and 868px (1440 and 1920) for Week, and 358 to 976px for Sequence.
- Card heights measured: Week 44px (wide, 1440 closed) to 124px (390); Sequence workout 85 to 192px; rest cards 50 to 70px; template exercise card 94px (1440) and a 136-element expanded card at 390.
- Method notes: touch presses must land on a non-control area. A press near the card's top-left corner is retargeted by Chrome's touch adjustment to the title link in Week cards, and at 390px the sticky volume panel covers the bottom of the screen; neither is a product problem, so points were chosen by hit-testing.

### Header (spec section 3)

Measured at 1024×768, 1152×864 (1152×768 used), 1280×800, 1366×768, 1440×900 and 1920×1080, dock closed and open:

- Order is always `Program context | Import program | Export program | AI review`, never reordered by opening the dock; the four buttons share one row (`btnRows = 1`) at every size; Export to AI review gap is **16px** everywhere; the group's right edge sits 0px from the header's right edge; no horizontal overflow.
- Selector follows the name field with a 12px gap in all cases.
- Group on the same row as the identity group: closed at 1152 (barely), 1280, 1366, 1440, 1920; open only at 1920 (header 54px). On its own right-aligned row: 1024 closed and open (header 128px), 1152 open (100px), 1280, 1366 and 1440 open (100px).
- Rapid toggles (page `click()` x5 at 30ms, x6 at 30ms, x5 at 0ms, from closed): the final state was consistent at every width: `aria-expanded` matched the dock's `is-open` class, button order unchanged, no leftover classes on the dock or page. From closed the sequence ended open, open, closed, as parity predicts.
- Frame sampling during open and close at 1440 and 1280 (motion enabled): the dock column grows 0 to 340px monotonically and settles at about 175 to 186ms; with reduced motion there are 0 animations and the column is final at the first frame. Header height and the group's row change during the 180ms transition as ordinary reflow: at 1440 opening the group's y goes 106, 113, 162 (header 54, 67, 100px; the 67px frame is the selector wrap in Defect 1), at 1280 closing 162 to 106 in one step.

### Review dock from 1024px

- Open: focus lands on the review title (`H2.analysis-title`). Close button and Escape from inside the dock return focus to the AI review toggle (`aria-expanded` false). Escape from the Program name field leaves the dock open and focus in the field.
- Crossing while open with a 90-line report, scroll 250, focus on Analyze again: 1100 to 1023 (modal) to 1000 to 1024 (dock) to 1100 to 1023 to 1500 to 1023 to 1024. Every step kept the report text length (5775), `scrollTop` 250 and focus on "Analyze again"; the modal appears below 1024 and the dock from 1024.
- Stacked panel at 1024 to 1279 with the dock open: weekly panel above the sessions, body figures 180px (230px at 1024), no horizontal overflow.
- The known 1100 to 1279 close squeeze (frame sampled with motion on, the sessions column being the first child of the program grid): on closing, the two-column grid returns immediately while the dock column is still wide, so the sessions column narrows before it widens. Minimum sessions column width during the close: **272px at 1024, 236px at 1100, 336px at 1200, 415px at 1279** (idle closed widths 612, 576, 676, 755px). At 1280 the layout is two-column in both states and the column never goes below 416px. The column recovers to its idle width in about 190ms; during that time its content height spikes (for example 1851px at the first frame at 1024, 1827px at 1100) as session cards reflow, then settles to 861/770px. No document overflow in any frame. This is the spec-implied instant reflow; whether it looks acceptable on real hardware has not been judged by eye.

### Rest-card actions (spec section 1)

Rest cards show `Reorder rest day` then `Remove rest day` at the right on the title row. Action-group right edge versus the Sequence workout card's group right edge: 927 vs 927px at 1440 (aligned); **623 vs 619px at 1024 and 361 vs 357px at 390** (see Defect 2). Target sizes: 32px at 1440, 44px at 1024 and 390.

### Profile and program review (spec sections 5 and 6)

- Header Profile button sits before Log out, has `aria-current="page"` on `#/profile` and measured 32px (44px at 390 touch).
- Profile edit autosaves ("Saving…" then "Saved" within about 420ms), the server holds the text, and the text persists after reload. Typing is limited to 2,000 characters by `maxlength`. A remote change plus a local edit gives status **Conflict** with **Reload saved version** visible and Save as copy hidden; confirming Reload shows the remote text and "Saved".
- Program review request: with a saved profile text, the browser's `POST /api/analysis/program` body contained neither the text nor the words `athlete` or `trainingBackground`; the server added `athlete.trainingBackgroundAndApproach` (the saved text) and the recorded provider messages carried it. `promptVersion` was `program-hypertrophy-v13`. This used the real API route and prompt builder with a recording stub in place of the provider; no real provider was called.
- Program context dialog has exactly two fields (Goals and priorities, Constraints and preferences). A program export contained neither the profile text nor the key `trainingBackgroundAndApproach`.
- Session template editor: no Analyze or AI review control (0 buttons; no "Analyze" text). `test/fixtures/analysis-sessions.js` was intentionally kept: `analysis-input`, `analysis-controller` and `analysis-api` unit tests still use it for the shared review modules. `POST /api/analysis` returns **405** `Method not allowed.`; `GET /api/analysis` returns 200 `{"enabled":true}`.
- Method note: filling the profile field during the first roughly 100 to 250ms after route entry (while the shell is `inert` for the view transition) is discarded by a programmatic fill, and the field then shows the saved text. People cannot type into an inert region, so this is not a product defect; the checks wait for the shell to leave `inert`.

### 390×844 touch, 200% text, reduced motion

- 390×844 (touch, mobile): no horizontal overflow on Week, Sequence, review modal and Profile; the file-action group wraps to two rows (allowed at 760px and below); the review opens as the full-screen modal with focus on the title, Close is 44×44 and Escape returns focus to the toggle; Profile button 44×44.
- 390px controls under 44px (not compared with the previous branch, so possibly pre-existing): the template select (358×41) and the volume-panel muscle chips (36px high).
- 200% text (root font-size 200%) at 1024, 1366, 1440, 1920, closed and open: no horizontal overflow; file actions on one row from 1366 up and two rows at 1024; body figures 230px (1024), 180px (1366 and 1440), 200px (1920); dock opens at all four widths.
- Reduced motion: dock open and close are instant with no running animations (see header section).

## Defects found (not fixed)

Both were fixed after the final review; see [Final review fixes](#final-review-fixes-2026-11-01).

1. **Week/Sequence selector wraps into two lines in two width bands (minor, cosmetic).** Reproduce: Week program, viewport 1136 to 1159px with the dock closed, or 1472 to 1503px with the dock open (sampled every 8px; also 1152×768 closed). The identity group is squeezed, the selector's "Week" and "Sequence" labels stack (fieldset 135.7px wide, 70.4px high), the Program name field and selector lose vertical alignment, and the header grows from 54 to 67px. The bands are also passed through transiently while the dock opens at 1440 (group y 106, 113, 162). No overflow, order or grouping is violated; the spec only requires the selector to follow the name field.
2. **Rest-card action group is 4px right of workout cards' group at 44px target sizes (minor, cosmetic).** Reproduce: Sequence program with a rest between sessions, at 1024 (no touch) or 390 (touch): rest group right edge 623 vs 619px and 361 vs 357px for workout card `s0`; aligned (927 vs 927px) at 1440 with 32px targets. The spec says the group's right edge aligns with workout cards' group.

## Gaps and not verified

- **Preview and production**: migration 007, the rollout steps in the rollout document and the deployment itself are pending and unverified. Nothing was run against a remote database.
- The user's real local `local.db` is not migrated; only a controller-provided copy was.
- The Chrome extension was unavailable. All browser checks used headless Playwright Chromium on Windows only (no Firefox or WebKit, no real touch hardware; touch is CDP-synthesized). Hybrid mouse-plus-touch was exercised with `hasTouch` only.
- Motion was sampled (computed styles, rectangles and animation counts per frame), never judged by eye: the 180ms dock glide, the header's row changes during it, the stacked-to-two-column squeeze on closing at 1024 to 1279 and the drag preview's feel remain for a human check. Hover sweep and generating breath were not re-sampled in this pass (unchanged code).
- Not inspected: 1152×864 exactly (1152×768 used), 768-wide tablet, drag-preview checks under 200% text or reduced motion, and screenshot archives (none saved to the repository).
- The profile and review-request checks used a recording stub, not a real provider.
- The 4px alignment and wrapped-selector findings were measured, not compared against the previous branch; the 390px 41px select and 36px chips were not baselined.
- The full e2e suite was not re-run; only the targeted specs listed above.

## Final review fixes (2026-11-01)

Local verification only (Windows, headless Playwright Chromium, `node scripts/dev-server.js --test`). **No preview or production deployment or migration was performed or verified.**

Changes:

- **Selector wrap (Defect 1).** From 761px `.program-identity` is a grid (`minmax(12rem, 480px) max-content`); the name field spans the label and input rows as a subgrid and the Week/Sequence selector (`flex: none; flex-wrap: nowrap`) sits in the input row, centered with `align-items: center`. The −5px/−3px offset margins are gone at ≥761px (≤760px keeps its previous layout). The identity's minimum is now its content, so a narrow row moves the file-action group to its own row. The redundant ≤760px `flex-wrap: wrap` on the file actions was removed; header geometry at 390, 600 and 760px was measured identical before and after.
- **Rest-card actions (Defect 2).** Rest cards use `12px 16px` padding below 1100px, matching workout cards' 16px inline padding (≥1100px both stay 12px inline).
- **Close squeeze.** On close the dock keeps `.is-closing` until the route's `grid-template-columns` transition ends (260ms fallback), and the 1024–1279px stack selects `.is-open, .is-closing`. Reopening cancels the hold; destroy cleans it up; reduced motion switches immediately. Spec section 4, AGENTS.md and the design system now say the switch happens at the start of opening and the end of closing.
- `PUT /api/profile` without a profile object (missing, null, array or primitive) returns 400 INVALID instead of clearing the background.
- Spec section 3 now says the file-action group never wraps internally at default text size on desktop and may wrap only when a full row cannot hold it; the design system's Program context text says two textareas.

Measurements after the fixes:

- Selector: sampled every 4px from 1120 to 1176px (dock closed, 15 widths) and 1456 to 1520px (dock open, 17 widths): both labels on one line at every width, selector center offset from the name input center 0px, header 60px (file actions on the same row) or 106px (file actions on their own row), no horizontal overflow. The header e2e also asserts one-line labels and centering at 1024, 1136, 1152, 1159, 1280, 1440, 1472, 1488, 1503 and 1920, dock closed and open.
- Rest versus workout action-group right edge (Sequence): 927 vs 927px at 1440, 619 vs 619px at 1024, 357 vs 357px at 390 (delta 0).
- Minimum sessions column width during the close (motion on, every animation frame for 600ms): **612px at 1024, 576px at 1100, 676px at 1200, 755px at 1279**, equal to the idle closed widths (stacked open widths 636, 712, 812, 891px). The hold released on `transitionend` at about 184ms with the dock column at 0px.

Automated results on the final head:

- `npm test`: 236 passed, 0 failed.
- Full `npm run test:e2e`: **276 passed, 0 failed** (6.4 min), one run, no retries.
- `npm run build`: "Built public assets."

The earlier full-run failure (`exercise-actions.spec.js:59`, "program inline strip fits populated editor at 1920") timed out in `page.goto('/')` waiting for the `load` event, before the login form was used, so login and the `login_attempts` limiter were not involved (no e2e test submits a wrong password, and a successful login clears its bucket). `index.html` loads the Google Fonts stylesheet render-blocking from `fonts.googleapis.com`; a probe that left that request unanswered made `page.goto('/')` time out the same way. The most likely cause is a slow or stalled external font request; it did not recur. Fixing it would mean making e2e independent of the network (for example, serving cached font responses in tests or self-hosting the fonts), which was not done here.

Not verified: motion was sampled, not judged by eye; the 200% text checks are the existing e2e (800, 1024 and 1280px) plus the before/after header measurements; no real touch hardware.

