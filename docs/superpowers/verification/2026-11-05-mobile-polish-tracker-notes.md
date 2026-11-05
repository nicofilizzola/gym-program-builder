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
