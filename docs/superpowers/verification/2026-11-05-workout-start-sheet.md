# Workout start sheet verification (2026-11-05)

Spec: docs/superpowers/specs/2026-11-05-workout-start-sheet-design.md; plan: docs/superpowers/plans/2026-11-05-workout-start-sheet.md. Branch `feature/workout-start-sheet`.

## Automated

- `npm test`: 366 passed, 0 failed (includes 19 `test/workout-up-next.test.js` cases: every worked example, week boundary, Monday 00:00, offset in `startedAt`, removed occurrences, program choice).
- `npm run test:e2e`: 361 passed, 0 failed (includes 21 `e2e/workout-start-sheet.spec.js` cases: 16 fixture tests of the view and 5 app-level tests; updated `workouts`, `workout-start` and `workout-offline` specs).
- `npm run build`: `Built public assets.`

## Browser review (Playwright Chromium, local test server, populated data)

Data: a Week program with Monday/Tuesday/Thursday/Saturday sessions, an Unscheduled session with a long name, and a Sequence program with a rest day; six templates; two finished program logs.

- Viewports: 390×844 and 320×640 (touch, mobile), 768×1024 (touch), 1366×768, 1440×900, 1920×1080 (fine pointer); 390×844 with the root font size at 200%. No horizontal overflow at any size; long names wrap inside rows.
- Bottom sheet at ≤760px anchored to the bottom edge; a frame captured 90ms into opening shows it mid-slide. The dialog at ≥761px is centred and ≤480px wide.
- Found and fixed during review: the tab row wrapped `Blank workout` onto its own line at 390px (needed 329px of 324px). Tab and Blank padding/size were tightened; the row now fits from 375px and wraps cleanly at 360px and below.
- Found and fixed during implementation: a quick second swipe started a native text drag and cancelled the pointer; the grab area now suppresses selection.
- Interactions exercised by the e2e suite: open/close via Close, Escape, backdrop and swipe (and spring-back), rapid reopen, tab arrow/Home keys, program expand/collapse during loading, double tap, template-load failure, list and program Retry, reduced motion, focus return.

## Gaps

- Not tested on a physical touch device; touch was emulated (`hasTouch`), and swipe was driven with mouse pointer events.
- 200% text was approximated by the root font size, not the browser's text-size setting.
- Motion was checked by sampled frames and tests, not watched frame by frame.
- Not deployed: Preview and Production are unverified.
