# Tracker inputs and benchmarks verification

Spec: [approved design](../specs/2026-11-15-tracker-inputs-and-benchmarks-design.md).

Local implementation only; not deployed. Phone feedback, slow/fast/reversal fluidity, touch border and physical keyboard/viewport calibration: pending (user).

Environment: Windows, Node 24.22.1, Chromium via Playwright, isolated managed worktree. Existing 3199 server left alone; temporary port 3299 used for isolated local checks, restored before delivery. Baseline `npm test`: 516 passed.

Task 1 RED: above-max 15-rep singleton returned null; all four new/updated presenter cases rejected the old range label/winner. No server/API change.
`node --test test/workout-best.test.js test/workout-repository.test.js`: 19 passed. `npx playwright test e2e/workout-best.spec.js`: 20 passed; lower-bound parity covers active 390x844, active/finished 1366x768; repository filtering and reduction/ranking remain green.
`node --test test/workout-edit.test.js test/workout-sets.test.js`: 27 passed. RED: completion stored suggested 4 instead of null and historical options were highlighted. `npx playwright test e2e/workout-set-row.spec.js e2e/workout-focus-view.spec.js`: 47 passed. Additional finished-copy/history rerun: 1 passed. Includes persisted mobile/desktop null completion, zero select/clear, previous suggestions, explicit copies, old warm-up 3/new warm-up null; phone touch confirmation remains pending (user).
