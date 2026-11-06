# Verification — mobile polish, active program, tracker set rows and notes (2026-11-05)

Spec: docs/superpowers/specs/2026-11-05-mobile-polish-tracker-notes-design.md. Local verification only; no preview or production deployment has been verified.

## Plan 1 — mobile navigation and start-sheet search

Plan: docs/superpowers/plans/2026-11-05-mobile-nav-search.md (branch `feature/mobile-polish`).

**Automated**
- `npm test`: 368/368 (adds `test/search-text.test.js`).
- `npm run test:e2e`: 370 passed and 5 failed in one slow 11.9-minute run: `program-review-dock` ×3 and `reference-exercises` ×2. Those specs are untouched by this plan, passed in the previous full run (371/371), and passed 36/36 when re-run on their own. Recorded as load flakes. New: `e2e/mobile-navigation.spec.js` (6 tests: tab names and sizes, resume bar stacking and padding, bars hide while typing, sliders keep the bar, pinned volume panel above the bar, a tap while typing activates its target) and 4 search tests in `e2e/workout-start-sheet.spec.js`.
- `npm run build`: passes.

**Browser review (Playwright Chromium, reduced motion unless noted)**
- 360, 390 and 430px touch: Programs, Templates, Catalog, the workout logger and the resume bar above the tab bar. The current tab shows accent and indicator, and touch no longer leaves the last tab highlighted.
- 200% text at 360 and 390: the bar grows with the label line and labels truncate with an ellipsis rather than overlapping.
- 1366×768: the header is unchanged (full labels, no icons).
- Start sheet at 390 touch (bottom sheet) and 1366 (dialog): the search field sits on its own row, filters instantly, and focus stays on the Up next card / selected tab on open.

**Found and fixed during review**
- The session editor's pinned mobile volume panel was covered by the tab bar. It now sticks above the bar.
- With the CSS-only typing state, a tap that blurred a field brought the bar back under the finger, so the bar took the click. `src/typing-state.js` now defers the return until after the tap.
- At 200% text the fixed 56px bar clipped and overlapped its labels.

**Gaps**
- No real iOS/Android device was used: safe-area insets and on-screen keyboard behaviour were not observed; the keyboard was simulated by text-field focus.
- Motion was checked only for presence of the 150ms transition rule, not watched frame by frame.

**Final review (Opus) and fix pass**
- Fixed: script focus no longer hides the bars; tap-out restores them only after the tap's click on real touch order and with reduced motion; search Retry keeps focus, shows its own status and never a false empty message; design-system tab bar height corrected.
- A full run after the fixes passed 378 of 380. The 2 program-review-dock failures were caused by `mobile-navigation.spec.js` leaving an active workout behind (its resume bar changed their layout); fixed by cleanup, pair re-run 29/29.
- Deferred minors: re-requests of a failed program on each keystroke; date/time inputs enter the typing state; search results drop the Unscheduled cue; navigation toast overlaps the tab bar; drag autoscroll zone under the bars; search e2e only at desktop size; result groups announce their name twice.

## Plan 2 — active program

Plan: docs/superpowers/plans/2026-11-05-active-program.md (branch `feature/mobile-polish`). Migration 009 applied to the local database only.

**Automated**
- `npm test`: settings repository and API (`test/settings.test.js`), `activeProgram`; migration-version expectations updated to 9.
- `e2e/active-program.spec.js`: star toggle, badge and sort, persistence, failed save reverts, rapid taps end on the last choice on the server, the sheet follows the active program, aborted settings load behaves as none.
- `e2e/workout-start-sheet.spec.js`: active program first, expanded and alone feeding Up next; one-tap Make active (focus to Up next); failed activation; deleted active program; Unscheduled-only active program; Make active disabled during a start. The real-app tests set an active program.

**Browser review**
- 390 touch: Programs list star and badge (wrapping name), tooltip; start sheet without an active program, after Make active, and searching (Active pill beside the program name).
- 1366: Programs list star (32px), tooltip.

- Full run: `npm test` 371/371; `npm run test:e2e` 386/387 (one `reference-exercises` flake, 14/14 on re-run); `npm run build` passes.

**Final review (Opus) and fix pass**
- Fixed: keyboard focus stays on the moved star; a fast second tap where the starred card used to be is ignored for 500ms after a re-sort; the `Active` badge is a separate word in accessible names; activating a program without an Up next focuses its disclosure.
- After fixes: `npm test` 371/371, `npm run test:e2e` 390/390, `npm run build` passes.
- Deferred minors: Make active re-enabled by a failed template load mid-activation; no sign-in prompt for a 401 from Make active; late star failures report on the next route; dead variable in library-view; some e2e gaps (empty-Sequence active program, real-server deleted program).

**Gaps**
- Migration 009 has not been run on preview or production.

## Plan 3 — tracker set rows, warm-ups, supersets and notes

Plan: `docs/superpowers/plans/2026-11-05-tracker-polish-supersets-notes.md`, absorbing Tasks 2–7 of `docs/superpowers/plans/2026-11-04-log-warmups-supersets.md`. Local verification on 2026-11-06 in the isolated `feature/log-warmups-supersets` worktree, beginning at `2a22cc8`. The [warm-up/superset verification record](2026-11-04-log-warmups-supersets.md) names the inherited model, repository and sync evidence.

### Scope and evidence boundaries

The logger keeps its existing compact cards, dark surfaces, orange accent, typography, steppers and collapse helpers. Notes use the existing exercise disclosure area and aligned set-note slot; Add warm-up shares the Add set strip. No new page, palette or layout direction was introduced. Set menus reuse the existing keyboard/Escape/focus-return menu. Empty notes consume no saved-note row; live input and save acknowledgements do not animate. Warm-ups keep full-contrast fields and muted W labels.

Full required commands, supplemental browser results and any targeted reruns are recorded separately below. A rerun does not turn a failed full suite into a clean full run. Tests use Chromium against the disposable `--test` server/database at `127.0.0.1:3199`; no personal/remote migration or paid AI request was run. No deployment was verified.

### Findings corrected during verification

- Wide fine-pointer rows had an unrecorded `padding-block:6px` override. The new permanent assertion failed at both 900px and 1366px (`8px` expected, `6px` observed). Removing the override restores the shared 8px padding. The complete set-row spec then passed 6/6, including added desktop separator and full-width done-tint checks. Commit `01c1433`.
- At 360px inside a pair, `102.5` kg had 30px of input space for 34px of content, and `100` reps had 20px for 23px. The existing unpaired test missed this. A permanent paired-row assertion reproduced it. Removing the paired grid's 2px gaps recovered six pixels but reps still clipped (22px/23px); reducing only the open frame inset from 10px to 9px recovered the last pixel. Final measurements are weight 34px/34px and reps 23px/23px, with 16px input text, 44px steppers, a 24px number column, 3px rail and no page overflow. Before/after screenshots were inspected. Commit `206bdd3`.

Both fixes changed CSS first, followed by the design-system documentation in the same commit. The narrower spacing is limited to paired cards below 390px; its cost is closer control edges. No timeouts were relaxed.

The first full suite after these corrections finished **435 passed, 1 failed** in 11.2 minutes (native exit 1). Its remaining failure was the old `workout-logger.spec.js` desktop assertion `row.height < 48`: the corrected 8px padding produces a 50px row (34px bordered stepper plus 16px padding). Focused reproduction failed with the same 50px result. The test now checks aligned control centers, 32px control sizes, 8px padding and the computed single-line box height, so it tests the approved behavior without an arbitrary old height cap. No product change was needed for this stale test expectation. The corrected logger/set-row/superset regression passed **35/35** (49.9 seconds, native exit 0); commit `59a680d`.

### Required commands and transient failures

- Baseline `npm.cmd test`: 395 passed, 0 failed, 0 skipped. Baseline build completed. Baseline full `npm.cmd run test:e2e`: Playwright reported 436 passed in 11.1 minutes; PowerShell's wrapper returned 1 and the native code was not captured (stderr contained the existing NO_COLOR/FORCE_COLOR advisory). Later commands explicitly capture the native exit code.
- A post-change `npm.cmd test` run finished 394 passed, 1 failed: the existing SQLite persistence test's temporary `test.db` deletion failed with Windows `EBUSY` in teardown after `db.close()`, rather than a repository assertion. Its baseline duration was 213ms, the failing run 67s. Two isolated runs passed (8.6s each); instrumentation reported all three native closes succeeded with `open:false`. The cause is unestablished; no production, dependency or teardown code was changed on speculation.
- With the full browser process finished, sequential `npm.cmd test` passed **395/395**, 0 failed, 0 skipped, in 10.7 seconds, native exit 0. This clean run does not erase the failed run above.
- Final `npm.cmd run build`: `Built public assets.`, native exit 0.
- After the stale test correction and removal of both temporary specs, final `npm.cmd run test:e2e` passed **436/436** in **11.8 minutes**, native exit 0. This is a fresh complete permanent-suite run; the earlier 435/436 full result and focused reruns remain separate above.
- The earlier Task 9 startup Saved/Saving and offline-reload status failures did not recur in the baseline 436/436, the subsequent 435/436 or the final 436/436 full run. Their cause was not established by this task; no timeout was changed and no load explanation is asserted.

### Supplemental browser review

The temporary `e2e/zz-verify-tracker-task10.spec.js` used real Chromium, catalog-linked templates with three exercises, a superset, warm-ups, prior finished sets and notes. It was removed before the final permanent full suite. Its ignored source, logs and representative screenshots remain in `.superpowers/sdd/2026-11-05-tracker-polish-supersets-notes/`.

| Viewport/input | Inspected result |
| --- | --- |
| 360×800 touch | Paired `102.5`/`100` visible after the scoped fix; W/working columns aligned; ≥44px targets; RIR spans number through reps without a visible caption; notes wrap; no page overflow |
| 390×844 touch | Paired `999.75`/`100` visible; aligned notes and full-width done tint; no visible RIR caption below 22rem; menu, remove and Add warm-up work |
| 430×900 touch | `999.75`/`100` visible; RIR caption returns and the control spans kg through reps; aligned rows and notes |
| 1366×768, 1440×900, 1920×1080 fine pointer | Existing header and compact card layout retained; standalone wide cards use one-line rows, 32px controls and an RIR heading; the paired cards' content is below 560px and correctly remains two-line; separators and full-width tint checked |
| 390×844, 200% root text, touch | Notes and long exercise names wrap; kg/reps stack with units, touch targets remain ≥44px, no horizontal page overflow; interactions remain usable. Existing bottom-tab labels ellipsize at this text size; navigation redesign is outside this task |
| 1366×900, 200% root text, touch-capable context | Two-line rows, wrapping notes and 44px targets; no horizontal page overflow. Chromium reports `any-pointer:coarse=true`, `pointer:fine=false`: this exercises the coarse-pointer CSS path, not physical simultaneous mouse/touch hardware |

Temporary first pass: 7 passed, 5 failed. One failure exposed the paired 360px clipping fixed above. Three were incorrect test assumptions that a paired desktop card exceeded the container threshold; one omitted the required confirmation when removing an exercise with logged sets. After correcting those harness assumptions and the product defect, the combined permanent set-row/superset plus temporary review run passed **33/33** (21 permanent, 12 temporary); an overview-screenshot refresh passed **8/8**. A second temporary footer review passed **2/2** at 200% text (390px touch and 1366px touch-capable desktop): Add exercise was reachable and activated, catalog selection appended a fourth exercise, Add warm-up worked there, and the page still had no horizontal overflow. On the phone, the footer button's bottom was above the fixed tab bar before activation. These are supplemental runs, not substitutes for the permanent full suite. Both temporary specs were removed before the final full permanent run.

| Interaction | Evidence actually exercised |
| --- | --- |
| Set layout and menu | Bounding-box column alignment within 1px across W/working rows; RIR spans; 1px separators; 8px vertical padding; edge-to-edge done tint; Add/Edit note and Remove set; Escape returns menu focus |
| Warm-up insert | W labels, ordering and Add warm-up beside Add set; normal-motion height samples increase from initial through 70ms to settled; reduced motion is immediate |
| Pair actions | Keyboard and menu move the pair as one block and retain handle focus; pointer drag never inserts between members; swap on A2 retains the pair; member removal and Unlink dissolve it; finished Reorder retained/Unlink hidden; read-only has no frame actions or drag |
| Guided focus | A1 working ✓ → A2 reps → A1 next working reps; exhausted fallback, uncheck, warm-up and unpaired exclusions; touch scrolling below the sticky header; ordinary typing retains focus |
| Finish | Warm-up-only refusal uses exact copy; warning counts only unchecked working sets; no warning with only warm-ups unchecked; unchecked rows and warm-up-only exercises are pruned, broken pairs dissolve; finished last-working-set removal confirmation completes |
| Notes | Exercise/set add, input save, blur trimming, Enter behavior, saved-text reopen, clearing, warm-up labels, removal focus, offline resume and finished autosave; Last time note/prefix/title shown without copying; read-only exercise/set notes are plain text with no menus |
| Motion/focus | Exercise and set note closing nodes remain connected, inert and `aria-hidden` while geometry shrinks; closing input cannot refocus; rapid set-note reopening survives stale close callbacks. The original set-note input node, focus and caret position 3 survive a save acknowledgement. Unlink head is retained while shrinking before frame removal; permanent tests cover focus/typing across the close. Reduced-motion note and unlink cases settle without waiting |
| Version 1 | Dirty local mirror resumes with working rows and saves canonical v2 with empty exercise/set notes and `target.warmupSets:0`; repository/model/sync units separately cover stored and queued legacy snapshots |

Screenshots were opened and visually inspected with `view_image`, including all three phone card widths, desktop overview/wide cards, phone 200% text and the touch-capable desktop context. The captures confirm layout only; the interaction assertions and intermediate geometry above supply the motion evidence. A full-card screenshot at 200% includes the fixed tab bar crossing the captured card because the card is taller than the viewport; it is not evidence that every part is simultaneously visible.

### Model and data boundaries

- `test/workout-log.test.js`: notes default and v1 upgrade, exact UTF-16 limits/errors, canonical fields and empty notes on creation.
- `test/workout-edit.test.js`: note transforms, swap retention and empty new set/warm-up notes; kind/pair transforms and Finish rules.
- `test/workout-repository.test.js`: Last time returns the exercise note (empty for v1), set kinds and stored-v1 upgrade.
- `test/workout-sync.test.js`: v1 mirror recovery and upgrade. Active notes use the same synchronous mirror/autosave path as other fields; finished notes use online autosave.
- `src/app.js` exports only template/program documents through `serializeDocumentBundle`; workout logging writes through the separate workout API. `src/analysis-input.js` and `src/program-analysis-input.js` project template prescriptions and omit note keys; `src/volume.js` and `src/program-volume.js` consume those prescriptions. Logs and their notes never enter exported bundles, reviews or program volume. Existing bundle, analysis projection and volume tests run in the complete unit suite; no paid provider call was made.

### Release gaps and retained costs

- Browser coverage is Chromium emulation, not physical iOS/Android or hybrid hardware. Real keyboard resizing, safe areas, iOS focus zoom, platform font rendering and screen-reader output remain unverified.
- At 200% phone text, the existing bottom-tab labels ellipsize. Logger fields/notes wrap and remain operable; this task does not redesign the navigation.
- At 360–389px, long weights may scroll inside the input; 44px touch targets and ≥16px input text take precedence. Touch/hybrid retains two lines. Below 22rem the visible per-row RIR caption is omitted, while the group retains its accessible name. At 200% text steppers can stack; this intentionally trades density for reachable controls.
- Editable finished pairs keep Reorder and hide Unlink; read-only history has neither frame actions nor drag. No pairing control is added while logging.
- Earlier tasks recorded initial Saved/Saving and offline-reload status timeouts, plus the now-fixed animated-add/menu race. This verification preserves full-run results and investigation evidence rather than labeling unexplained failures as load flakes.
- No preview/production environment or rollout was tested. Task 10 does not verify unrelated earlier deferred items or physical assistive technology.

### Final review fix wave (2026-11-06, base `63293ad`)

The whole-branch review identified three Important findings and one Minor alignment finding. The final wave preserves all 12 retained rulings below; it introduces no new layout exception.

- **I1: optional v2 notes:** `upgradeLog` now canonicalizes accepted version 2 as well as version 1. Repository reads, sync adoption and saved-conflict adoption therefore receive empty note defaults before editing. Invalid/unsupported input still returns unchanged for existing validation handling. Read normalization does not write the database, change revisions or loosen conflict checks; the next ordinary save persists the canonical record. Defensive empty DOM values supplement this boundary. Permanent units exercise raw stored-v2 reads/revision conflicts, mirror recovery/save and saved-version adoption; four browser cases open exercise/set notes independently as the first edit from a server record or an offline mirror and assert canonical empty notes on the next save.
- **I2: frame release blur:** moving cards out of an unlinking frame fires synchronous blur. A scope limited to that internal move and focus restoration prevents note blur from changing editor state. The same node, typed value, focus and selection survive; real blur still trims/closes and set-note Enter still completes. Six deterministic browser cases open a note after Unlink or either member removal and signal the actual transition completion in the same browser turn, then continue typing and finish normally. They assert the closing header remains inert. Existing normal-motion/reversal and instant reduced-motion coverage remains in the affected suites.
- **I3: mobile note font:** exercise-note textarea now computes to at least 16px on phone/touch/hybrid paths; the previous 15px compact size is confined to the existing fine-pointer desktop rule. A computed-font assertion runs at 390px touch. This is Chromium CSS evidence, not physical iOS zoom verification.
- **M1: header alignment:** removed the second horizontal padding inset from the header. Permanent 390px touch / 1366px fine-pointer checks compare the bounds and centers of all first three header tracks with their row counterparts within 1px. Existing full-width tint, separators, padding, numeric fit and touch-target assertions remain unchanged.
- **M2: bounded cleanup/debt:** removed the duplicate note-text width and updated the stale 1.15 grid comment to the retained 1.2 ratio. The unused pair-unaware `moveLogExercise` export, permissive `blankSet` optional-value helper and older loose history/swap assertions remain explicit nonblocking follow-ups; no broad helper/test refactor was included.

Actual preimplementation RED: focused units failed three new assertions (`undefined !== ''`); all 12 browser regressions failed on missing-note `"undefined"`, lost focus/inert note editor, computed 15px text or the 12px desktop header offset. First GREEN attempt: focused units 53/53; browser 5/12 passed, with six continuation assertions containing a test typo (`Typed` instead of the deliberately edited `Typ!ed`) and one 20-second startup timeout in `workout-helper.js:5` (`page.goto('/')`, waiting for load). The typo was corrected; the startup cause remains unestablished, and no timeout or production startup change was made. The mirror case was strengthened to reload while the active-workout request is unreachable, ensuring it really resumes locally. The corrected affected browser run passed **52/52**, native exit 0 (the new 12 plus existing notes, supersets and set-row suites). Refreshed `task-9-390-touch.png` and `task-9-1366.png` were opened with `view_image`; the implementer and controller confirmed aligned header labels and compact notes without visible overflow. This is layout-only evidence, not a new broad visual matrix.

Final required checks on the final production code, run sequentially:

| Command | Result | Full scratch log |
| --- | --- | --- |
| `npm.cmd test` | **398 passed**, 0 failed, 0 skipped; native exit 0 | `final-fix-full-unit.log` |
| `npm.cmd run test:e2e` | **448 passed (11.6m)**; native exit 0 | `final-fix-full-e2e.log` |
| `npm.cmd run build` | `Built public assets.`; native exit 0 | `final-fix-full-build.log` |

All 448 browser cases are permanent (prior 436 plus 12 new regressions); no temporary matrix is included in that count. Logs and the complete `final-fix-report.md` are in ignored `.superpowers/sdd/2026-11-05-tracker-polish-supersets-notes/`. These fresh full results do not erase the earlier failed runs. No further broad repeat was needed after green. Physical keyboard/zoom/safe-area/font behavior, physical hybrid hardware and assistive technology remain unverified; preview/production deployment remains unverified. No personal database, remote migration, paid AI or deployment was used. The historical unexplained startup/offline timeouts and EBUSY remain unattributed; this wave does not claim to resolve them.

### Decisions retained

These are the implementation ledger’s decisions, retained in their original order with their stated costs. They document prior rulings and do not introduce new requirements.

> Setup: Ruling: Task 1 Step 1 (rebase onto main) done by the controller during setup — rebase is workspace setup, clean, unit 380/380 — cost if wrong: none

> Task 1: Ruling: 44px touch targets (project-wide AGENTS rule) win over "999.75 fully visible at ≥375px" — 999.75 must be fully visible at ≥390px; at 360–389px values up to 5 characters (e.g. 102.5) fully visible, longer may scroll inside the input — cost if wrong: very heavy weights scroll on the narrowest phones

> Task 1: Ruling: one-line wide layout applies where it fits with full targets: container ≥35rem on fine-pointer-only devices, ≥44rem on touch — cost if wrong: touch tablets between 35 and 44rem keep two lines

> Task 1: Ruling: six 44px RIR segments (264px) cannot fit between kg and reps below ~22rem card width — below 22rem the RIR segmented control spans the number→reps columns and the per-row "RIR" caption is dropped (group keeps its accessible name); at ≥22rem the caption stays in the number column — cost if wrong: narrowest phones lose the visible per-row RIR caption

> Task 1: Ruling: numeric set inputs keep ≥16px font on phones (iOS zooms the page on focus below 16px) — fit via Barlow Condensed tabular digits rather than a smaller font — cost if wrong: condensed digits in steppers

> Task 4: Ruling: reviewer Minor 3 (typed warm-up values muted) enters the loop — design §3 says W rows use a muted LABEL style with fields identical to working rows, so muted field text is a spec deviation (and a contrast risk) — cost if wrong: one CSS rule

> Task 4: Ruling: the missing 200% text inspection (required by the brief's browser review) enters the loop — cost if wrong: one screenshot pass

> Task 5: Ruling: editable finished logs keep pair reordering (Reorder superset shown, pointer and keyboard agree, block moves) but hide Unlink; read-only logs have no drag and no frame actions — design §3 "without editing actions" read against tracker V1 allowing finished-log reorder of single cards — cost if wrong: one hidden/shown button

> Task 8: Ruling: merge main into the feature branch to adopt existing test fix 7ccd4cb, then reproduce and verify the failing interaction -- main already contains Tasks1-7; preserves history without rewriting -- cost if wrong: a feature-branch merge commit and rework of the test fix.

> Task 9: Ruling: saved-note button uses an explicit optional onNoteOpen callback, keeping onMenu dedicated to menu activation -- clearer ownership than an undocumented boolean protocol -- cost if wrong: one additional task-local callback to revise. Controller visually inspected 390px/1366px screenshots: aligned note, no visible overflow; interaction evidence pending.

> Task 10: Ruling: retain existing kg/reps ratios 1.2, and 1.1 below 390px, subject to measured alignment, targets and numeric visibility -- these implement retained Task 1 numeric-fit/touch-target decisions; enforcing 1.15 risks undoing reviewed phone fit -- cost if wrong: kg/reps relative widths differ slightly from original spec.

> Task 10: Ruling: paired cards below 390px may use 0px set-grid column gaps and a minimally reduced frame inset (9px after measurement) to show 102.5 kg and 100 reps fully while retaining the 24px number column, 16px input font, 44px targets and 3px rail -- cost if wrong: closest control edges on the narrowest paired cards.
