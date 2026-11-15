# Tracker inputs and benchmarks verification

Spec: [approved design](../specs/2026-11-15-tracker-inputs-and-benchmarks-design.md).

Local implementation only; not deployed. Phone feedback, slow/fast/reversal fluidity, touch border and physical keyboard/viewport calibration: pending (user).

Environment: Windows, Node 24.22.1, Chromium via Playwright, isolated managed worktree. Existing 3199 server left alone; temporary port 3299 used for isolated local checks, restored before delivery. Baseline `npm test`: 516 passed.

Task 1 RED: above-max 15-rep singleton returned null; all four new/updated presenter cases rejected the old range label/winner. No server/API change.
`node --test test/workout-best.test.js test/workout-repository.test.js`: 19 passed. `npx playwright test e2e/workout-best.spec.js`: 20 passed; lower-bound parity covers active 390x844, active/finished 1366x768; repository filtering and reduction/ranking remain green.
`node --test test/workout-edit.test.js test/workout-sets.test.js`: 27 passed. RED: completion stored suggested 4 instead of null and historical options were highlighted. `npx playwright test e2e/workout-set-row.spec.js e2e/workout-focus-view.spec.js`: 47 passed. Additional finished-copy/history rerun: 1 passed. Includes persisted mobile/desktop null completion, zero select/clear, previous suggestions, explicit copies, old warm-up 3/new warm-up null; phone touch confirmation remains pending (user).

## Ruler work measurement

Real logger/port/Focus path, Chromium, 390x844, six exercises x four working sets; trace enabled, no reduced motion. Slow: 8 moves/one frame per move; fast: 120 moves in one dispatch burst; reversal: 40 moves in one burst with vertical drift. Durations sum synchronous pointermove dispatches, including canonical row, logger render and Focus update. No hardware budget assertion. JSON attached as `ruler-work` to the Playwright result; timings are noisy local samples.

Before optimization (`npx playwright test e2e/workout-focus-view.spec.js --grep "populated ruler path" --trace on`, 1 passed):

| Workload | Dispatch ms | Frames | Track style mutations | Tick rebuilds | Final input/port/saved kg |
| --- | ---: | ---: | ---: | ---: | ---: |
| Slow | 55.0 | 10 | 8 | 12 | 87.5 |
| Fast | 168.5 | 2 | 117 | 125 | 107.5 |
| Reversal | 154.2 | 2 | 37 | 49 | 107.5 |

Controlled-frame RED: old ruler made 5 track-style mutations before the queued frame and replaced a band for an equivalent range object. Two structural checks failed; lifecycle checks already passed.

After paint coalescing (same traced workload):

| Workload | Dispatch ms | Frames | Track style mutations | Tick rebuilds | Final input/port/saved kg |
| --- | ---: | ---: | ---: | ---: | ---: |
| Slow | 49.1 | 10 | 8 | 4 | 87.5 |
| Fast | 108.7 | 2 | 1 | 1 | 107.5 |
| Reversal | 119.3 | 2 | 0 | 0 | 107.5 |

`npx playwright test e2e/workout-ruler.spec.js e2e/workout-focus-view.spec.js --trace on`: 49 passed. Controlled frames prove immediate port/ARIA updates, zero track work before paint, one paint per frame, unchanged-node reuse, no redundant width reads, exact inclusive target bands, geometry invalidation and cancellation. Timing samples are descriptive, not a phone diagnosis.
