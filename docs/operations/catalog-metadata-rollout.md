# Catalog metadata rollout (migration 006 / seed version 3)

Prerequisite: shared session migration 005 and compatible application, as described in [the shared-session runbook](shared-sessions-rollout.md). Tests and screenshots use disposable databases, not personal/production data.

1. Verify the release's unit, browser and build checks and back up the intended environment consistently. Keep preview/production credentials separate and do not print them. Rehearse restoring the backup and the matching previous application before the maintenance window.
2. Stop old application writers and deploy the compatible server/browser code together. Run `npm run db:migrate` explicitly for the intended environment; never migrate or seed from builds or requests. Windows PowerShell can use `npm.cmd`.
3. Migration 006 adds reference-owned equipment, descriptions, default muscle arrays and tag tables. Unanimous variant equipment initializes the reference. Mixed-equipment and empty references remain unconfigured. Old equipment values are preserved in `catalog_equipment_backup`; no reference or variant is renamed, regrouped or split by migration. Existing workout snapshots/rest and actual variant muscles remain intact.
4. Run the read-only report: `node --env-file-if-exists=.env.local scripts/catalog-equipment-report.js`. It lists unconfigured reference IDs/names and their previous equipment values. It does not migrate, seed or edit data.
5. In Exercise catalog, find each Needs equipment reference and use Edit reference exercise to choose its equipment pill. Review affected variants/templates/programs before saving. Choose Compound/Isolation too if an older reference is unclassified. The change updates inherited metadata everywhere without resetting rest, sets/reps or variant muscle mappings. Until configured, existing linked workouts remain readable; new selection, new variants and move destinations are blocked.
6. Run `npm run db:seed` explicitly only when desired. Seed version 3 keeps existing entries, chosen equipment/types, renamed references, archives, descriptions, defaults and tags. Fresh environments get starter references grouped by equipment; existing seeded environments are never split or moved. No brands or focus labels are invented for personal data.
7. Smoke-check reference defaults versus source-variant cloning, inherited equipment on moves, tag create/rename/archive/restore, archived assignments, search by combined name/Brand/Focus and both descriptions in the workout info surface. Verify v3 exports retain plain metadata while imports stay unlinked and never modify the catalog.
8. Re-run the report after manual cleanup; expect zero unconfigured references. Re-running migration/seed must not change chosen metadata. Re-enable writes and require old tabs to reload.

Do not reverse the schema ad hoc or copy equipment back into variants as an override. If rollback is required, stop writes and restore the matching backed-up database/application pair. Keep the equipment backup table until the release and manual cleanup are accepted.

No live migration, seed, cleanup, deployment or secret change is implied by committing this guide.
