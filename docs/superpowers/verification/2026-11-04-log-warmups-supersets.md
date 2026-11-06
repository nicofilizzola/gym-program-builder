# Verification — logging warm-ups and supersets (2026-11-04)

Design: `docs/superpowers/specs/2026-11-04-log-warmups-supersets-design.md`. Original plan: `docs/superpowers/plans/2026-11-04-log-warmups-supersets.md`; Task 7 was absorbed by Task 10 of `docs/superpowers/plans/2026-11-05-tracker-polish-supersets-notes.md`.

Local verification on 2026-11-06, isolated branch `feature/log-warmups-supersets`, starting at `2a22cc8`. No preview or production deployment was verified. Browser API writes and automatic test migrations used the disposable test database at `127.0.0.1:3199`; personal and remote databases were untouched. This feature needs no SQL migration.

## Automated evidence

- `npm.cmd test`: 395 tests passed, 0 failed, 0 skipped; fresh complete run.
- `npm.cmd run build`: exit 0, `Built public assets.`
- Final `npm.cmd run test:e2e`: **436/436 passed** in **11.8 minutes**, native exit 0, with temporary browser-review specs removed before launch.
- Earlier runs remain separate: baseline Chromium 436 passed; first post-fix Chromium 435 passed / 1 failed on a stale desktop height assertion, corrected with focused 35/35 and the final full run above. One intermediate full unit run was 394/395 because temporary SQLite database deletion hit Windows `EBUSY`; two isolated checks passed, then sequential full units passed 395/395. No speculative dependency/cleanup change was made. Detailed commands and failures are retained in the shared Plan 3 record.
- Supplemental browser checks: 33/33 (21 permanent + 12 temporary), screenshot refresh 8/8 and 200% footer interaction 2/2. These do not replace the full permanent run.

The passing unit suite includes these named boundaries:

| Requirement | Evidence |
| --- | --- |
| Template start copies warm-ups, working rows, targets and pair rests | `test/workout-log.test.js`: `template start builds warm-up rows, working rows and pairs` |
| v1 stored/mirrored/queued snapshots normalize to v2 | `test/workout-log.test.js`: `version 1 logs upgrade to version 2`; `test/workout-repository.test.js`: `stored version 1 logs are summarized and read back as version 2`; `test/workout-sync.test.js`: dirty v1 recovery, upgrade on adopt and empty-note recovery |
| Kind ordering, finished rules and pair invariant | `test/workout-log.test.js`: `kind order, superset invariant and finished rules`; both kinds count toward the cap |
| Warm-up insert, working append, swap/remove/unlink and block movement | `test/workout-edit.test.js`: warm-up/pair transform cases |
| Last time and placeholders stay kind-specific | `test/workout-sets.test.js`; `test/workout-repository.test.js`: `lastTime returns kind per set, working for version 1 logs` |
| Finish warning and summary count working sets only | `test/workout-edit.test.js`: `finish ignores warm-ups in the warning and refuses without working sets`, `finish drops warm-up-only exercises and dissolves broken pairs`; `test/workout-log.test.js`: `history counts done working sets only` |
| Guided focus alternates and falls back | `test/workout-edit.test.js`: `guided focus alternates partners and falls back` |

Workout logs remain separate from template/program documents: the logger commits through the workout controller/repository and never writes a source template. `src/app.js` exports template/program bundles via `serializeDocumentBundle`, and builds reviews from resolved program/template snapshots; the log is neither input. `src/volume.js` and `src/program-volume.js` consume template prescriptions, not logged sets. The complete unit suite includes document bundle, volume and program analysis projection tests. No paid AI call was made.

## Browser review

Task 10 used real Playwright Chromium and populated catalog-linked templates with one pair, a warm-up, working sets, prior finished data and notes. Both temporary browser-review specs were removed before the final full suite and documentation commit. Representative screenshots and the temporary source are retained in ignored task scratch space; committed verification records the conclusions rather than requiring those local artifacts.

Detailed matrix, interaction results, narrow-layout decisions and remaining release gaps are recorded in [Plan 3 of the shared verification record](2026-11-05-mobile-polish-tracker-notes.md#plan-3--tracker-set-rows-warm-ups-supersets-and-notes).

Editable finished logs deliberately retain pair Reorder and hide Unlink; read-only logs have no frame actions or drag. This follows the retained Task 5 ruling. No new pairing control or rest timer is introduced while logging.

## Gaps and release boundary

- Chromium emulation cannot verify real iOS/Android keyboards, safe areas, iOS input zoom, platform font rendering, VoiceOver/TalkBack or physical hybrid hardware.
- The full-run result and any targeted reruns must be read independently; a targeted pass does not replace a failed full suite.
- No deployed environment, migration rollout or paid-provider response was tested.

## Final review follow-up (2026-11-06, base `63293ad`)

The single final fix wave corrected supported-v2 missing-note normalization, note editing state/focus lost during frame release, 15px phone exercise-note text and the extra header inset. Shared strict canonicalization now handles accepted v1/v2 without write-on-read or revision changes. Frame release distinguishes its synchronous internal blur from genuine user completion, preserving the same exercise/set note node, value and selection across Unlink and either member removal. Initial/resume/reduced-motion behavior and all 12 retained rulings remain unchanged.

Fresh sequential required checks on final production code: `npm.cmd test` **398/398** (0 fail/skip), `npm.cmd run test:e2e` **448/448 (11.6m)**, `npm.cmd run build` **Built public assets.**; all native exits0. The count is the prior 436 permanent browser cases plus 12 permanent regressions, without a temporary matrix. Affected browser checks passed 52/52. Actual RED evidence and the first GREEN attempt's one unexplained startup timeout plus six corrected test-assertion typos remain recorded in [the shared final fix record](2026-11-05-mobile-polish-tracker-notes.md#final-review-fix-wave-2026-11-06-base-63293ad); targeted passes were not substituted for the full run.

The controller and implementer inspected refreshed 390/1366 screenshots as layout-only evidence. Physical hardware, assistive technology and deployment remain unverified. No personal/remote database or paid AI was used. Nonblocking follow-ups remain the unused pair-unaware move helper, permissive blank-set helper API and older loose history/swap assertions; duplicate CSS width and stale ratio comment were cleaned only where already touched. Historical startup/offline/EBUSY failures retain their original evidence without an asserted cause or unrelated fix.
