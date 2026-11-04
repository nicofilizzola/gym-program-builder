# Workout tracker rollout (migration 008)

Prerequisite: program background migration 007 and its compatible application, as described in [the program background runbook](program-background-rollout.md). Tests and screenshots use disposable databases, not personal/production data.

1. Verify the release's unit, browser and build checks (`npm test`, `npm run test:e2e`, `npm run build`) and back up the intended environment consistently. Keep preview/production credentials separate and do not print them. Rehearse restoring the backup and the matching previous application before the maintenance window.
2. Deploy the compatible server/browser code to the environment. Migration 008 only adds tables, so the previous application keeps working against the migrated database, but the new `/api/workouts` routes need the tables: run the migration immediately after the deploy. Run `npm run db:migrate` explicitly for the intended environment (preview first, then production); never migrate from builds or requests. Windows PowerShell can use `npm.cmd`. No seed is needed.
3. Migration 008 creates `workout_logs` (revisioned log documents with status `active` or `finished`, and a unique partial index that allows at most one active log) and `workout_log_variants` (finished-log variant index used for Last time), plus their indexes. It does not read, change or delete templates, programs, the catalog or the profile.
4. Verify with read-only checks: `SELECT version FROM schema_migrations` includes 8, and both tables exist and are empty. Signed in, `GET /api/workouts/active` returns `{"record":null}` and `GET /api/workouts` returns an empty list. Re-running `npm run db:migrate` must change nothing.
5. Smoke-check on a disposable or acceptable record: start a workout from a program card, a template card and blank; confirm the active workout bar appears on other routes; log a set, finish, find it in History and as Last time on the next start; reload mid-workout and confirm recovery; discard a second active workout. Delete any test logs afterwards from History.
6. Require old tabs to reload so they pick up the new routes and the active workout bar.

Workout logs are snapshots: they are never written back to templates, programs or the catalog, never exported, and not part of program volume or AI review. The active workout is mirrored in the browser's `localStorage` (`gpb.activeWorkout`) and is not part of any server backup until it syncs.

Do not drop the tables ad hoc. If rollback is required, stop writes and restore the matching backed-up database/application pair; logs created since the backup are lost. Keep the backup until the release is accepted.

No live migration, deployment or secret change is implied by committing this guide.
