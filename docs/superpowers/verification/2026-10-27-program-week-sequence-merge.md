# Program Week and Sequence integration

Integrates `feat/program-week-sequence` (`07ffd5d`) into `main` after `c8fc7a7`. The original [implementation plan](../plans/2026-10-24-program-week-sequence-updates.md) and [branch verification](2026-10-25-program-week-sequence.md) remain historical records.

## Integration decisions

- Retain main's whole-card mouse dragging, touch holds and visible Reorder action/menu instead of restoring the feature branch's dotted handles. Apply the same interaction to rest cards. Up/Down moves through the mixed sequence; Week also supports Alt+Up/Down and menu destinations for all days and Unscheduled.
- Keep the feature's Week default, persistent mixed sequences, Edit pencil, removed separate move buttons/day selects, and cancellable session-area layout fades.
- Preserve catalog-aware template copy metadata, editor API/export hooks, timing normalization, duration metadata and self-contained exports that strip internal catalog links. New sequence serialization composes with those existing export rules.
- Update older test expectations for timing defaults and adapt drag/day-movement checks to the current controls. Add a rest-card Reorder-menu regression with desktop/mobile/tablet and enlarged-text layout checks.
- Replace the untracked original plan with the completed version already committed on the feature branch. Preserve the original draft in a temporary backup outside the repository.

## Review

A separate read-only reviewer inspected the merge resolutions, sequence operations, menu/drag/keyboard movement, layout cancellation, save synchronization, catalog copy metadata, duration preservation and JSON round trips. No concrete merge regressions were found. Browser verification is recorded separately below.

## Verification

- `npm.cmd run db:migrate` with `TURSO_DATABASE_URL=file::memory:`: passed explicitly against isolated SQLite; no production migration.
- `npm.cmd test`: all 148 unit tests passed.
- `npm.cmd run build`: passed.
- `npm.cmd run test:e2e -- --reporter=line`: 170 passed; one older regression still targeted the deliberately removed standalone Move down button. Updated that test to verify repeated keyboard activation through the Reorder menu and return focus.
- `npm.cmd run test:e2e -- e2e/reorder-regressions.spec.js --reporter=line`: all four tests passed, including the corrected test. All 171 distinct browser checks are covered by the full run and this rerun; the entire suite was not repeated after this test-only correction. No product code changed after the full run.
- `git diff --cached --check`: passed before committing.

Inspected populated Week and mixed Sequence screenshots at 1366x768, 1440x900 and 1920x1080, plus mixed Sequence at 390x844 and 820x1180. Compact controls, duration metadata, prominent body figures and reachable content are preserved. The new mixed-sequence test checks overflow and Reorder menu bounds at each size with normal and 200% text. Existing browser checks cover long names, coarse/hybrid targets, touch holds, focus, motion in both layout directions, rapid reversal and reduced motion. Screenshots are in ignored `.superpowers/compact-desktop/after` and `.superpowers/sdd/2026-10-27-program-merge`.

The feature branch and its host-managed worktree are retained. Integration is local; no push or deployment is part of this merge.
