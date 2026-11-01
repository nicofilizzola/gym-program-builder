# Program background rollout (migration 007)

Prerequisite: catalog metadata migration 006 and its compatible application, as described in [the catalog metadata runbook](catalog-metadata-rollout.md). Tests and screenshots use disposable databases, not personal/production data.

1. Verify the release's unit, browser and build checks and back up the intended environment consistently. Keep preview/production credentials separate and do not print them. Rehearse restoring the backup and the matching previous application before the maintenance window.
2. Stop old application writers and deploy the compatible server/browser code together. Old tabs would otherwise keep sending program context with the removed field. Run `npm run db:migrate` explicitly for the intended environment; never migrate from builds or requests. Windows PowerShell can use `npm.cmd`.
3. Migration 007 creates `user_profile` (one row at most, `id=1`, with a revision) and `program_context_background_backup`. For every program whose saved `context.trainingBackgroundAndApproach` is non-empty, it copies the exact text into the backup table, removes the field, removes `context` entirely when no remaining field is non-empty, and increments that program's revision. Programs without a background are unchanged. Templates are never touched. The profile starts empty; nothing is copied into it automatically.
4. Verify with read-only queries, for example `SELECT count(*) FROM program_context_background_backup` (expect the number of programs that had a background) and `SELECT id,revision FROM documents WHERE kind='program'` (expect +1 only for those programs). Spot-check one backed-up program's remaining goals/constraints context in the app.
5. Open Profile and, if desired, paste the appropriate background from the backup table into Training background and approach. Choose one text when several programs had different backgrounds; the profile is single-user and applies to every program review.
6. Smoke-check program context (two fields), program export (no background), import of an older file containing a background (succeeds, field dropped) and an AI program review using the saved profile background. Re-running `npm run db:migrate` must not change revisions again.
7. Re-enable writes and require old tabs to reload.

Do not reverse the schema ad hoc or write background text back into program documents. If rollback is required, stop writes and restore the matching backed-up database/application pair. Keep the backup table until the release and any manual profile entry are accepted.

No live migration, deployment or secret change is implied by committing this guide.
