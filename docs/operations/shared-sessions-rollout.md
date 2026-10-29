# Shared session rollout (migration 005)

This is an operator runbook, not an automatic deploy hook. Implementation tests use disposable databases; do not substitute production credentials into test commands.

## Before rollout

1. Run the unit/browser/build checks from the Stage A plan on the release commit.
2. Identify the target environment using its existing `TURSO_DATABASE_URL`, optional `TURSO_AUTH_TOKEN` and application deployment. Keep preview and production separate; never print secrets into reports.
3. Put the target app into a maintenance window so old clients cannot submit embedded program content during conversion. Deploy the compatible server/browser assets together and require old tabs to reload before writing again.
4. Make a consistent backup: use SQLite's backup mechanism for a local database (stop writers before a filesystem copy), or a provider-supported snapshot/export for remote libSQL. Record how to restore the data and matching prior app together. Test restoring a copy before proceeding.
5. Rehearse against a disposable copy. Record program/template counts, revision values, per-occurrence content, weekdays and sequence including rest IDs.

## Explicit conversion

Run `npm run db:migrate` with environment variables pointing to the intended database. On Windows use `npm.cmd run db:migrate` if PowerShell blocks npm.ps1. Builds and API requests must never invoke this command.

Migration 005 creates a new template for each legacy embedded workout, preserving independent drafts even when their content is identical. It retains occurrence IDs, day assignments and sequence IDs; changed program revisions advance. Conversion and its identity mapping/index are committed together. A failure rolls back the conversion; restore or correct the diagnosed input before retrying rather than editing around a partial migration.

On the rehearsed copy, compare resolved session content before/after, check every program link resolves to a template, and verify timing/catalog links/archive states survived. Run the migration a second time and confirm template counts and document revisions are unchanged. Existing migration integration tests exercise exact preservation, repeat execution, FK protection and rollback on the second insertion.

## Application smoke checks

- Edit a template through a program; verify the library and another occurrence show the same name/prescriptions.
- Duplicate an occurrence: its placement is independent and its session remains shared; weekly volume counts both.
- Create an empty workout: one new library template and its occurrence are created atomically. Replaying a lost response must not add another template.
- Remove an occurrence/program: templates remain. Delete a template in use: deletion is blocked with links to the affected programs.
- Try concurrent template edits: the stale editor retains its draft and offers Reload saved version or Save as copy. A copy opens independently without relinking programs.
- Import v1/v2 legacy files and a v3 repeated-template bundle. Export v3 and reimport: repeated occurrences remain linked, and file identities cannot overwrite existing templates. Importing into a shared session editor explicitly replaces that shared template after the existing nonempty-content confirmation.
- Verify normal and reduced motion, keyboard focus, touch/drag and populated desktop/mobile layouts as specified in the plan.

## Recovery

Stop writes before restoring. Restore the backed-up database and matching old application together; the old application cannot write the new linked program shape safely. Do not attempt an improvised reverse migration that guesses which templates to remove. Keep backups and the conversion mapping until the release is accepted.

No production migration, seed, deployment or backup has been executed merely by committing this runbook.
