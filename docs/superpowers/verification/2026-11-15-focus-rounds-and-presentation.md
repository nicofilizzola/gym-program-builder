# Focus rounds and presentation verification

Design: [2026-11-15-focus-rounds-and-presentation-design.md](../specs/2026-11-15-focus-rounds-and-presentation-design.md); plan: [2026-11-15-focus-rounds-and-presentation.md](../plans/2026-11-15-focus-rounds-and-presentation.md).

Status: Implemented, not deployed. Tasks 1-7 pass locally on branch `feat/focus-rounds-presentation` (from `main` 6680213): full unit and browser suites, static build and diff check. Physical-phone checks, preview/production and deployment remain pending (user).

## Final interfaces

- `src/workout-focus-model.js`: `focusPages(log,items,previousPages)` → `{pages,pageByKey}`, page `{key,kind,keys,pairId,round,members}` (ordinary pages `members:[]`; pair warm-ups keep `pairId`, `round:null`). Two-pass key allocation inherits a surviving set key and never reuses one for a split. `roundComplete(page,doneKeys)`; `completionMilestone` counts real working sets (a missing partner earns round feedback, never a fictional check).
- `src/workout-focus-pair.js`: `mountWorkoutFocusPair(host,{onSelect,onInteraction,reduced,relocate})` → `{update({page,members,selected,total,animate,completedKey}),cancelMotion,destroy,context}`.
- `src/workout-focus-view.js`: rounds as `li.focus-round` beside straight `li.focus-group`s; exact-ref `jump(ref,{animate,focus})`, `visibleRef()`, per-page attachment-local selection; `cancelMovement()` (pending advance, travel, partner motion; no suspension lifecycle) and `setAutoNext(value)` (emits the existing preference only on change, never schedules).
- `src/workout-focus-advance.js`: still the only timer owner. Rounds accept either member, switch the first partner in place at once, wait 650ms after the incomplete→complete change and travel forward only; firing revalidates owner, status, suspension (typing or an open `dialog`), preference, viewed ref, membership and target.
- `src/workout-focus-fit.js`: peeks removed; `fitGroup({feedHeight,nameHeight,detailsHeight,contentHeights,editing})` → `{nameOnly,pinned,rows:[{offset,minHeight}]}`; `fitPair` with optional `compactHeaderHeight`.
- `src/reorder-menu.js` checkbox choices; `src/workout-logger-view.js` Workout actions `Auto-next` row; `src/workout-title.js` `hidden` state for compact titles.

Superseded: the 2026-11-12 alternating group-per-round-set presentation, every Focus peek rule (`.is-peekless`, next-set header, next-group name row), the footer Auto-next checkbox and the set-only Auto-next gate for superset rounds. Controller rulings: R1 (each task keeps every Focus suite green), R2 (interim round sizing until Task 5), R3 (missing-partner round feedback), R4 (docs deferred to Task 7), R5 (660px compact relocation of the exercise-note and set-note buttons into the round context, no context/selector gap, trimmed selector padding; strict whole-round assertion kept).

## Tasks 1-6 (summary of their reports)

| Task | Commit(s) | Evidence |
|---|---|---|
| 1 Pages | f6fbdc5, 735222f | RED missing `focusPages` export; GREEN model 14/14; `npm test` 523 |
| 2 Rounds and exact refs | 7920ec0 | RED 14 failed/107 passed; GREEN 121 passed; R1 Focus suites green; `npm test` 524 |
| 3 Either-partner completion | aed1fd7 | RED unit 7 failed, browser 19 failed/61 passed; GREEN 80 passed; R1 suites 228 passed; `npm test` 532 |
| 4 Partner motion | 45e31ef | RED 10 failed/101 passed; GREEN 111; R1 225 passed; fixed a real focus-to-body bug (show destination, focus, then inert) |
| 5 No peeks, fit | 7eb1797, 577f8bf | RED 27 failed/129 passed, strict paired matrix 8 failed before R5; GREEN fit 57/57, R1 248 passed; compact hidden title made unfocusable (RED `Expected 0, Received 1`) |
| 6 Menu and footer | b5eeb3f, 7988bc9 | RED 12 failed/86 passed; GREEN Focus suites 262 passed; travel-interruption RED `Received 1202` without `cancelTravel()` |

## Task 7 — saved partial rounds and lifecycle integration

New tests (pair-specific inputs only; storage/recap semantics stay covered by existing tests):

- `e2e/workout-focus-integration.spec.js` › `saved partial rounds` (reduced motion off):
  - `A2 logged first stays one real saved completion through acknowledgement, Back, Resume and reload`: a real API log plus a finished log of the same variants. Both partner panes read `Best (8+ reps) · 50 kg × 9 · …`. A2 gets 42.5 kg × 10, a set note and blank RIR; `Log A2 & switch to A1` switches in place with no scroll. The server's exercises equal the original record with only B1 changed (`done`, values, `rir:null`, note); the log gains no keys; no RIR option is pressed after acknowledgement. With A2 reselected, ordinary `Back to Home` (Main hidden while nested) and `Resume workout` restore A2 exactly; nothing animates, viewed and scroll stay put for 900ms. After reload the stored completion (`A2, …, complete`) is unchanged and nothing moves.
  - `a conflict accepted while a round advance is queued never applies a stale switch or travel` (fake clock): A1 then B1 by synthetic clicks queue the 650ms advance; another device first saves a copy that keeps A1 open and removes the target A2. The app's save meets the real 409, the `Workout changed elsewhere` dialog opens, and at 800ms viewed and scroll are unchanged. `Use saved version` adopts the server copy (A2 card gone, nothing done) with no later movement. Discrimination check: with the `dialog[open]` suspension temporarily removed from the view's advance `read()`, this test failed (`viewedId` changed); restored with `git checkout`.
- `e2e/workout-offline.spec.js` › `an offline first-partner completion mirrors, survives an offline reload and syncs once with no round fields`: `gpb.activeWorkout` holds exactly `baseRevision,bestPerformance,dirty,lastTime,log`, `dirty:true` and a log equal to the original with only B1 done; an offline reload keeps exactly one done card and the server copy unchanged; reconnecting saves the same log once and the mirror turns clean.
- `e2e/workout-recap.spec.js` › `finishing a partial superset round prunes, dissolves the broken pair and keeps one truthful writer`: only A1 logged; with the finished PUT held, the recap reads `Finished on this device…`, offers no note editing, lists one exercise `1 of 3 working sets logged` and `1 planned exercise was not logged.`; after release `Saved to your history.`, mirror cleared, the server log holds only A1's done set without `superset`, one finished write, no active log. (The recap `start` helper gained an optional `mutate`.)

RED/GREEN: the new tests exercised existing correct integration; no product change was made to force RED (Step 2). The only failures while writing them were test-harness issues: a strict-mode match across three hidden-round Log buttons, and a Playwright click that first scrolled an oversized round (a saved set note makes the 390×844 round 9px taller than the feed) across the next snap point, briefly making round 2 viewed so the first-partner gate correctly declined. That step now uses a synthetic click; a real tap does not scroll before dispatch, but this remains a phone check below.

`npx playwright test e2e/workout-focus-integration.spec.js e2e/workout-offline.spec.js e2e/workout-recap.spec.js`: 53 passed (1.5m). No Step 3 fix was needed.

Sibling integration evidence: lower-bound Best in both panes and blank RIR after acknowledgement (above); readout cancellation while switching (Task 4 motion spec); overview reorder/unlink and same-round chips/scrub (Tasks 2/6, overview and progress specs); hidden nested tabs, compact Home link and Resume after ordinary Back (above plus `nested-mobile-navigation.spec.js`); 660px fit with simulated inset and keyboard (fit and nested-navigation specs); desktop/finished/read-only controls (integration spec, regular logger suites).

## Final checks (sequential)

| Command | Result |
|---|---|
| `npm test` | First run 532 passed, 1 failed: `test/repository.test.js` "SQLite records persist…" (67s, `EBUSY … unlink …test.db`), the known timing flake unrelated to this plan. One rerun: 533 passed, 0 failed. |
| `npm run test:e2e` | 904 passed, 7 skipped (existing phone-viewport skips in `workout-logger`/`workout-notes`), 0 failed (17.5m), exit 0. |
| `npm run build` | `Built public assets.`, exit 0. |
| `git diff --check` | clean. |

The full browser run rewrote committed screenshots under `docs/superpowers/verification/assets/mobile-library-navigation/` and `…/nested-mobile-navigation/`; they were restored with `git checkout` and are not part of this change. No migration, seed or deploy command ran.

## Browser inspection (Playwright Chromium, local test server; temporary script, not committed)

Populated pair (wrapped names, Brand + two focus tags, Last time and Best):

| Viewport | Feed | Round before | Compact | Selectors | After first completion |
|---|---|---|---|---|---|
| 360×844 | 614 | 614 | yes | 44/44 | 614, selectors 57/57 |
| 390×844 | 614 | 614 | yes | 44/44 | 614, selectors 57/57 |
| 412×915 | 685 | 685 | no | 48/48 | 685, selectors 65/65 |
| 360×660 | 430 | 430 | yes | 44/44 | 441 (oversized by 11px) |
| 390×660 | 430 | 430 | yes | 44/44 | 441 |
| 412×660 | 430 | 430 | yes | 44/44 | 441 |

- `Log A1 & switch to A2 →` fits on one line at 360px (button 336×44 at 660, 336×50 at 844, no text overflow); `← Log A2 & switch to A1` reads the reverse direction. Inputs, RIR and Complete are inside the feed before and after the first completion at every size; no horizontal page overflow.
- Finding: once a member is done its 20px check takes name width, so a long selector name wraps one more line (44→57px) and the 660px compact round exceeds the feed by 11px; the sticky Complete keeps RIR and Complete visible (the bottom gap scrolls). Recorded as an open design question rather than changed here.
- 200% text (390×844): oversized round (893px in a 545px feed), native scrolling, sticky Complete visible, `Superset A`/`Round 1 of 3` wrap; no horizontal overflow. Fine-pointer (non-touch) 390×844 matches touch geometry (selectors keep 44px).
- Interactions (390×844, motion on): rapid A2/A1/A2 taps end on A2 with a mid-frame showing the fading pane and moving underline; a ruler press mid-switch drops running pair animations from 4 to 0, the drag writes only A1 (62.5 → 67.5) and A1 stays selected; B-first logging switches to A1 (`Complete round`), completing travels to Round 2 of 3; returning to round 1 shows `Undo A1 completion`, undo reopens only that member; Tab from the A1 selector reaches `A2, …, complete` and Enter selects it; Workout actions shows Add workout note, Weight steps, `Auto-next  On`, Discard; the overview opens with set chips. Reduced motion: a selector tap starts no animation.
- Desktop 1366×768, 1440×900, 1920×1080: the regular tracker with its superset frame; no Focus.

Screenshots and frames are local scratchpad artifacts; they support but do not prove motion.

## Not verified

- Physical phones: partner-transition feel, ruler interaction while transitioning, scrolling through rounds and momentum, real safe areas and on-screen keyboard behavior, and tap behavior on oversized rounds — pending (user).
- Preview/production behavior and deployment — pending (user); nothing was deployed.
- Open design questions (user): the two identical note icons in the compact round context, the Auto-next row's plain menu text, the `template` footer icon, and the selector growth after completion at 660px.
