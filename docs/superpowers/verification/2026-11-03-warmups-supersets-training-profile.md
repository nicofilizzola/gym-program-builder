# Warm-ups, supersets and training profile verification

Implementation: branch `feature/warmups-supersets-profile`. Design and plan: [spec](../specs/2026-11-03-warmups-supersets-training-profile-design.md), [plan](../plans/2026-11-03-warmups-supersets-training-profile.md). This is local verification on Windows with headless Playwright Chromium. **No preview or production deployment was performed or verified.** Part A needs no SQL migration.

## Part A: warm-up sets and supersets (2026-11-03)

Head verified: `3bac2f4` (Phase A commits `aad993a..3c163b3` plus the scroll fix below).

### Automated evidence

- `npm test`: **254 passed, 0 failed**.
- `npm run test:e2e` (full): **291 passed, 0 failed** (6.7 min) on `3c163b3`; **292 passed, 0 failed** (6.6 min) on `3bac2f4` after adding the scroll regression test. One run each, no retries.
- `npm run build`: "Built public assets."

### Browser evidence

Real Chromium (Playwright, headless) driven by a throwaway spec against `node scripts/dev-server.js --test` (fresh test database). Fixture created through the API client: one session template with 8 unlinked exercises (two pairs: Incline dumbbell press + Chest-supported T-bar row with rests 30 s / 2 min, Bayesian cable curl (4 sets) + Overhead cable triceps extension (3 sets, a leftover round) with 15 s / 1 min 30 s; warm-ups 2, 1, 0, 0, 0, 1, 2, 1), a Chest goal, and a Week program linking it on Monday. Each check measured element rectangles, computed styles and `getAnimations()` per animation frame; screenshots were kept outside the repository.

**Main-field row and density (carried item 1).**

- At ≥700px card width the row is name / Sets / Warm-up sets / Reps / Rest per set. Column widths: 1366×768 213 + 4×142px (card 842px); 1440×900 233 + 4×155px; 1920×1080 348 + 4×232px. Visible slider tracks are about 98px at 1366 (from the screenshot; the `.slider` box is 142px including thumb insets), about 111px at 1440 and 188px at 1920. Labels and values stay on one line at 100% text with no overflow.
- The 1366 row is 126px high (96px at 1440 and 1920) because the name column of an unlinked exercise stacks "Custom exercise", Link to catalog and the name field; the slider columns are the same height.
- Judgment: usable, but the 98px tracks at 1366 are tight. Sets (10 steps) and Warm-up (6) are fine; Rest (21 steps, about 5px each) and Reps (30 steps, two thumbs sharing about 98px; 8–12 thumbs nearly touch) need care with a mouse. Keyboard and the 44px hit box are unaffected. Values sit right-aligned in their column, so the gap between "4" and the next column's "Warm-up sets" label is only the 16px field gap. See Concerns.
- 390×844 touch (mobile, `isMobile`): the expanded card was scrolled to the top of the viewport (the sticky volume panel covers the bottom 324px, from y=520). Fields stack full width (321px; member 309px), each slider 44px high; every button and range input in the list is at least 44×44px; no horizontal overflow. The card (1092px tall) is fully reachable by scrolling; Rest per set sits under the sticky panel until scrolled further, as before this feature.

**Superset frame (carried item 2).**

- 1366, 1440, 1920 (fine pointer): frame header 32px high, four 32×32px actions right-aligned in the card action column; title on one line; members inset 12px with the 3px rail; members show only Remove (their Reorder is hidden) and "Rest set by superset" vertically centered in the rest column; no horizontal overflow. Settings body: two sliders side by side (393, 430, 640px).
- 200% text (root font size 200%) at 1366, 1440, 1920: no horizontal overflow; frame header 39px (title wraps inside it); actions stay 32px. At 1366 and 1440 the Warm-up sets head wraps to three lines ("Warm-up / sets / 1", 124px) while Sets, Reps and Rest wrap to two, so the Warm-up slider sits about 77px lower than its neighbours; the five-column row stays because the 700px container query is in px. At 1920 all heads are two lines. Allowed by the design system (content wraps and grows with enlarged text), recorded as a concern.
- Hybrid (1440, fine mouse plus `hasTouch`; `any-pointer: coarse` matched): frame actions, card actions and the pair action are 44×44px; frame header 44px; no overflow.
- 390×844 touch: frame header 69px (title on its own line, four 44×44px actions below), settings sliders stacked; all targets at least 44px.
- Program workout editor (`#/programs/:id/workouts/:occurrence`, 1440) renders the same two frames; duration details read Warm-up 7 min, Execution 27 min, Rest 50 min 45 sec, Extra time 5 min, Buffer 8 min 59 sec (total ~99 min, also shown on the Week card); the volume panel shows Chest 7 / 8, so warm-ups do not count as volume.

**Pair, unpair and settings motion (carried item 3)** at 1440, sampled every animation frame:

- Pair: the frame header grows 0 → 40px over about 200ms in smooth steps (0, 4.4, 8.9 … 39.4, 40), the cards below ease down with it and the rail and 12px inset end at full opacity and width (their intermediate frames were not recorded); focus moves to Unlink superset.
- Settings open/close: body 0 → 81.5px and back in 12 steps each, settled by about 250ms; focus stays on the toggle.
- Unlink: header 40 → 0px over about 200ms, the frame is removed after the close ends; focus moves to the first member's pair action.
- Rapid toggles: settings toggle clicked 5× and 6× at 30ms ended consistent (`aria-expanded`, `inert`, `is-closed` agree, no running animations). Unlink then pair after 0, 60 and 150ms (and after 300ms, once the close finished) always ended with one clean frame (no leftover `is-closed`), the original order, and focus on Unlink superset; the saved document had the expected `superset` objects and warm-ups.
- Reduced motion: every change reached its final height in the first sampled frame with 0 animations in the list.

**Block reordering (carried item 4).**

- Mouse drag of the first pair by its header at 1440 (motion on): the copy is `position: fixed`, `inert`, `aria-hidden="true"`; displaced neighbours glide with the 180ms FLIP animation (animations seen in 11 of 73 sampled frames, one card at a time); dropping below Cable lateral raise moved the pair as one block, focus on Reorder superset, saved order matches.
- Keyboard: ↑/↓ on Reorder superset moves one block each way, focus stays on the handle, and the live status reads "Moved superset Incline dumbbell press and Chest-supported T-bar row to positions 2–3 of 8."
- Touch hold at 390 (motion on, CDP touch): not armed at 150ms, armed after the hold; the drag copy showed; the pair moved below Cable lateral raise and saved.

### Defect found and fixed

**Rebuilding the exercise list reset the page scroll** (fixed in `3bac2f4`, `fix: keep the page scroll when the exercise list rebuilds`). Reproduce on `3c163b3`: long template, scroll to the bottom, Unlink superset or Swap exercises: `scrollY` 323 → 0 (top of the page); a single card's keyboard move went 363 → 257. Cause: `renderExercises()` re-inserts cards with `list.replaceChildren()`; removing the focused control during that call makes Chrome lay out the half-rebuilt list (with or without scroll anchoring, and with blur/focusout handlers suppressed), which clamps the scroll. Fix: blur the focused control before rebuilding; focus is restored afterwards as before. After the fix: swap 363 → 363, keyboard move 363 → 363, unlink 363 → 323 (the 40px header is gone, a legitimate clamp at the page end). Regression test: `e2e/supersets.spec.js`, "swap, unlink and keyboard moves keep the page scroll position", which fails without the fix (1375 → 1269).

### Concerns (judgment calls, not changed)

1. **1366 slider tracks are about 98px.** Reps (two thumbs, 30 steps) and Rest (21 steps) are fiddly with a mouse; values sit close to the next column's label. Options for a later decision: let the name column shrink further, or drop to the name-above layout below a larger container width.
2. **200% text keeps five columns** at 1366 and 1440, so headings wrap to two or three lines and the Warm-up slider is about 77px lower than its neighbours.

### Gaps and not verified

- Headless Chromium on Windows only (no Firefox or WebKit, no real touch hardware; touch is CDP-synthesized; hybrid is `hasTouch` on a desktop viewport).
- Motion was sampled (heights, styles, animation counts), not judged by eye. The pair header's opacity fade was not sampled separately (the inner wrapper stayed at opacity 1; height and rail were sampled).
- Ten animations were still running inside the exercise list about 430ms after Unlink with motion on (0 with reduced motion); their source was not identified (likely slider-fill or neighbour transitions). Nothing was visibly wrong in the sampled geometry.
- Swap was checked for order, focus and scroll, not frame-by-frame (it is specified as instant).
- 200% text used a root font size of 200%, not browser zoom; 768-wide tablet was not inspected.
- The duration rule and v4 export round trip rely on the unit and e2e suites; the browser check only read the displayed breakdown.
- No preview or production deployment was performed or verified.

## Part B: structured training profile (2026-11-04)

Head verified: `d14d16c` (Phase B commits `60ed633..d14d16c`). No SQL migration: the profile JSON gains fields through `normalizeProfile`. **Local databases whose programs still hold `constraintsAndPreferences` in their context drop it on the next load/save (no backup or migration, by decision);** move any text worth keeping into the profile's Constraints and preferences first.

### Automated evidence

- `npm test`: **266 passed, 0 failed**.
- `npm run test:e2e` (full): **306 passed, 0 failed** (7.2 min), one run, no retries, no flakes.
- `npm run build`: "Built public assets."

### Browser evidence

Real Chromium (Playwright, headless) driven by a throwaway spec against `node scripts/dev-server.js --test`. Profile fixture: max 4 training days, available Mon/Tue/Thu/Fri/Sat, 1 session per day, max 60 min, intermediate, RIR 2, Barbell/Dumbbell/Cable/Machine. Week program with 7 occurrences: Monday Upper (5 exercises, ~116 min, long name) + Lower (~31 min), Wednesday Push, Thursday Pull, Friday Legs (~116 min), Sunday Arms, Unscheduled Core.

**Profile page.**

- 1366×768, 1440×900, 1920×1080: sections Schedule, Session length, Experience, Equipment, Notes in a two-column grid (647/684/924px columns); no horizontal overflow; sliders 44px hit boxes; pills and segmented radios 32px (fine pointer); page about 857px tall at 1366 (the Notes textareas end at the fold).
- 200% text (root font size) at 1366 and 1440: two columns kept, no overflow, no clipped pill or radio label (pills 38px, radio labels 50px high).
- Keyboard: Tab visits max-days slider, Mon–Sun pills (one stop each), the sessions-per-day radio group (one stop), length slider, level radio group, RIR slider, eight equipment pills, both textareas. Pills and textareas show a 2px accent outline; sliders and radio labels use their existing thumb/label focus rings. Arrow keys on sliders and radio groups, Space/Enter on pills and typing all autosaved; the saved profile matched exactly (`maxTrainingDaysPerWeek 4, availableWeekdays [0,1], maxSessionsPerDay 1, maxSessionMinutes 60, intermediate, RIR 2, ['Barbell'], 'Bad left shoulder'`).
- Retry: with `PUT /api/profile` failing (503), a pill toggle showed "Couldn’t save" and Retry while the pill stayed pressed; further typing was kept; after the route recovered, Retry saved both edits (`['Barbell','Cable']`, appended text) and hid Retry.
- Conflict: a remote save (90 min, Wed/Fri) then a local RIR change showed Conflict with Reload saved version and no Save as copy; reloading restored every control (`90 min`, Wed pressed, Mon released, RIR 2) and status Saved.
- 390×844 touch (`isMobile`): one column (358px), every button, range, radio label and textarea at least 44×44px, no overflow; tapping Sunday and the `2` radio saved. Hybrid 1440 (`hasTouch`, `any-pointer: coarse`): every target at least 44px.

**Hints (Week and Sequence).**

- 1366, 1440, 1920: Monday `2 sessions · max 1`, Wednesday and Sunday `Not an available day`, Upper and Legs cards `over 60 min max`, weekly panel `5 training days · max 4`; Tuesday, Thursday, Saturday and Unscheduled Core show none (Unscheduled is excluded from day checks; Core is short). All hints are amber text with the warning icon, no overflow, no overlap between day hints and cards, 0 running animations.
- Sequence (1440): only the two `over 60 min max` card hints remain; switching back to Week restores the day and weekly hints.
- 200% text (1440): hints wrap with their rows (day hints move above the cards, weekly line 65px high); no overflow or overlap.
- 390×844 touch: day hints sit under each day heading, card hints wrap with the metadata, weekly line under the panel subtitle; no overflow.
- AI review dock (motion on) at 1100×800 and 1440×900: the 340px dock opened and completed a stubbed review; the same 6 hints stayed visible, none under the dock, no overflow, both body figures 180px; at 1100 the weekly panel stacked above the sessions with its hint line. The analysis request body carried no `athlete` (server-owned).
- Live editor: in the program workout editor, Upper started at `~116 min` + `over 60 min max`; lowering each Sets slider with Home updated the suffix live (103, 90, 76, 63 min with the suffix; 50 min without), with 0 animations; returning to the program showed `Estimated duration ~50 min` with no hint.
- Profile change and return: on the profile page, adding Wed and Sun, choosing 2 sessions, max length 180 and max days No limit, then returning to the program showed no hints; restoring the limits through the API and dispatching window focus brought back the remaining five hints (Legs, Monday, Wednesday, Sunday, weekly).

### Concerns (judgment calls, not changed)

1. **Narrow day-label column.** At 1366 and 1440 the 78px label column wraps `Not an available day` to three lines (49px) and `2 sessions · max 1` to two, so those day rows grow about 55px beyond their single card. At 1920 (96px column) they take two lines. Readable, but less dense; a shorter label or full-width placement would be a design decision.
2. **Card hint tooltip is hover-only.** The `over 60 min max` hint is a non-focusable span, so its tooltip ("Longer than your max session length (Profile)") did not appear on a touch tap and cannot be reached by keyboard. The visible text carries the essential information; the "(Profile)" pointer is lost on touch/keyboard.

### Gaps and not verified

- Headless Chromium on Windows only; touch is emulated (`hasTouch`/`isMobile`), 200% text is root font size, not browser zoom.
- No real model call: the review was stubbed, so the v15 prompt's handling of profile checks relies on the unit tests and fixtures; evaluation CLI runs were not performed.
- Hint motion was checked by `getAnimations()` counts and the computed `transition`, not by eye; the profile page at 768px tablet was not inspected.
- The local development database's legacy `constraintsAndPreferences` values were not inspected or cleaned.
- No preview or production deployment was performed or verified.


## Follow-up: exercise field layout

Fix for Phase A concerns 1 and 2. Visible slider track = slider width minus the 44px thumb. Container thresholds are in rem (>=48rem: one row; 36-48rem: name column + 2x2; below or enlarged text: name row + 2 columns) with subgrid rows for head/track alignment. Measured visible tracks (Sets, Warm-up, Reps, Rest; name input width), card height:
- 1366x768: 75, 75, 143, 143 (name 170); in a superset frame 73, 73, 140 (name 167); card 307px (unchanged).
- 1440x900: 86, 86, 160, 160 (name 186); frame 84, 84, 158; card 285px.
- 1920x1080: 150, 150, 261, 261 (name 277); frame 148, 148, 258; card 251px.
- 200% text (root font-size) 1366: 2 columns, tracks 359 each, heads/tracks aligned within 1px; 1440 frame 390.
Baseline Reps/Rest before warm-up sets was about 131/148/241px. Regression tests: compact-desktop.spec.js (exercise sliders...). Headless Chromium only; no deployment verified.
