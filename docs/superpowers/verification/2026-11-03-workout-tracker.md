# Workout tracker verification

Implementation: branch `feature/workout-tracker`. Design: [spec](../specs/2026-11-03-workout-tracker-design.md); rollout: [workout tracker rollout](../../operations/workout-tracker-rollout.md); design system: [Workout history and logger](../../design-system/README.md). This is local verification on Windows with headless Playwright Chromium. **No preview or production deployment or migration was performed or verified; both are PENDING.**

## Migration 008

Applied only to the disposable per-run test databases created by `node scripts/dev-server.js --test` and Playwright's web server (`migrate` runs on a fresh temp database). It was not run against `./local.db`, any preview database or any production database. Not verified: re-running `npm run db:migrate` on an existing populated environment, and `GET /api/workouts/active` returning `{record:null}` on a deployed environment (the e2e suite asserts this behaviour only on the test database).

## Automated evidence

- `npm test`: **291 passed, 0 failed** (about 10s).
- `npm run build`: "Built public assets."; `public/src` contains `workout-bar.js`, `workout-controller.js`, `workout-edit.js`, `workout-history-view.js`, `workout-log.js`, `workout-logger-view.js`, `workout-set-row.js`, `workout-sets.js` and `workout-sync.js`.
- Full `npm run test:e2e`: first run **303 passed, 0 failed** (9.2 min); after the one CSS fix below and its new test, a second full run **304 passed, 0 failed** (8.3 min). No retries.

## Browser evidence

Real Chromium (Playwright, headless; throwaway scripts and screenshots kept under `.superpowers/sdd/2026-11-03-workout-tracker/manual/`, not committed) against `node scripts/dev-server.js --test` on a fresh migrated and seeded database. Fixture: a template with five linked catalog exercises (long name), one finished workout from it (every exercise's first set done at 60 kg x 8 @ RIR 2, so Last time and placeholders are populated), and an active workout with the same exercises.

### Layout, overflow and targets

- Viewports: phones 360x740, 390x844, 430x932; tablet 768x1024; desktop 1366x768, 1440x900, 1920x1080. Each logger and History at 100% text and the logger also at 200% (`document.documentElement.style.fontSize='200%'`). Touch (`hasTouch`) at phone and tablet sizes, fine pointer at all sizes, plus a hybrid case (1440x900 with `hasTouch`).
- **No horizontal overflow** and no element past the viewport edge in any combination (scrollWidth equals clientWidth, including 200% text at 360px).
- Touch and hybrid: steppers, RIR options, done and remove buttons, action icons, Finish and the name field are all at least 44x44 (the stepper inputs are 44px tall). Hybrid 1440 measured 44px steppers and RIR options (`any-pointer: coarse` matched). Fine pointer 1366 to 1920 at 100% text: 32px steppers, RIR options, done and action buttons; the set row is one line (number, kg, reps, RIR, done, remove) with a column header.
- **RIR control:** 274px wide at every phone and tablet width (6 x 44 + 5 x 2, `flex: none`), 202px on fine-pointer desktop (6 x 32 + 5 x 2). The `RIR` caption (re-measured at 100% text) is hidden at 360px (card 328px) and shown at 390, 430 and 768px (card 358, 398, 592px); on fine-pointer desktop it is hidden because the grid column header carries `RIR`. At 200% text on phones the group stays 274px, wraps to its own line below the stacked kg and reps steppers, and nothing overflows. On fine-pointer desktop at 200% text the set row stays inside the card with 32px targets and no overflow.
- Enlarged text (200%) at 360px: kg and reps stack with their units inside the steppers and the column header row is hidden; the workout name field truncates with an ellipsis (`Upper...`) next to Finish and the overflow menu, which is a cosmetic limit rather than a defect (the field is editable and its full value is exposed).
- History: rows are at least 44px tall, one link per row stretched over the card, no overflow at any size.

### Motion (video and sampling)

Short videos with normal and reduced motion are in `manual/video-no-preference/` and `manual/video-reduce/` (390x844, touch). Sampled values:

- **Add set:** card height grows 754, 785, 820, 835px over about 100ms of 30ms samples (animated) and is 1309px at every sample with reduced motion (instant).
- **Done toggle:** the row background passes through five distinct intermediate values from transparent to `rgba(249, 115, 22, 0.14)` over 150ms; with reduced motion it is the final value at the first sample.
- **Active workout bar:** top edge 844, 825, 809, 796, 785, 780, 779px with opacity 0 to 1 over about 180ms; with reduced motion it is at its final position at the first sample.
- **Rapid add/remove:** four quick Add set clicks and three quick remove clicks ended in a consistent count (set count matched the sequence applied) in both modes.
- Initial render shows no animations (asserted by the e2e suite).

### Keyboard, focus and offline

- Tab order from a set's weight field: increase weight, decrease reps, reps field, increase reps, then the RIR options, each with a visible 2px outline (inputs show the accent border on their stepper group instead).
- Offline: with the network off, an edit shows `Offline · saved on this device`; after going back online the status settles to `Saved` within the backoff window and the server holds the edited value. An offline reload and Log out behaviour are covered by `workout-offline.spec.js` only.

## Defect found and fixed

- **Clipped inputs at 360px.** At 360px the kg and reps inputs were 41px wide (steppers share the width evenly, minus two 44px buttons each), so `999.75` clipped (scrollWidth 51px). Fix in `style.css`: inside `@container (max-width:19.5rem)` the set grid is `1.25rem minmax(0,1.15fr) minmax(0,1fr)`, which gives kg about 50px and reps about 31px; `999.75` and `100` now fit. Regression test: `e2e/workout-logger.spec.js` "weight and reps inputs show their longest values unclipped at 360px". The design system README describes the new column ratio. The test was written with the fix and not separately shown failing against the old CSS; the pre-fix measurement above is the evidence.

## Gaps

- No real touch hardware, real mobile keyboard or iOS/Android browser was used; touch is Chromium touch emulation. The numeric `inputmode` keyboards were not observed.
- Motion was sampled and recorded, not judged by eye on real hardware.
- Offline was exercised with Playwright's network toggle, not a real connectivity loss or a service-worker-less cold start on a phone.
- Cross-device resume (a log started on another device) is covered by e2e only, not by manual inspection.
- A very long single exercise name or 20-set card at 200% text was not inspected beyond the populated fixture.
- Preview and production deployments and migration 008 are PENDING and not verified.
