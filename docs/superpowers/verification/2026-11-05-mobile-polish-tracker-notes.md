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
