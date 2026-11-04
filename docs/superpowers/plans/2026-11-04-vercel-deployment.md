# Vercel Deployment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deploy Gym Program Builder to Vercel with separate Preview and Production environments, each backed by its own Turso database, with production starting from a copy of the personal `local.db`.

**Architecture:** One new Vercel project, `gym-program-builder`, on the Hobby plan, connected to the GitHub repo. A dedicated `preview` branch gives Preview a stable URL, and `main` deploys Production to `gym-program-builder.vercel.app`. Two Turso databases are provisioned through the Vercel Marketplace, one per environment. A new script, `scripts/copy-database.js`, copies data rows from `local.db` into an empty, migrated remote database. It runs first on Preview as a rehearsal and tested restore, then on Production. Migrations and seeds run explicitly from this machine before any code reaches an environment.

**Tech Stack:** Node.js 24, `@libsql/client`, Vercel CLI, Vercel Git integration, the Turso Vercel Marketplace integration and OpenRouter.

**Spec:** `docs/deployment.md` (architecture, environment variables, preview release steps, backup/restore, production gate) and `docs/operations/workout-tracker-rollout.md` (migration 008 checks and smoke tests). Decisions made on 2026-11-04 are listed under Global Constraints below.

## Global Constraints

- Environments: **Preview and Production**, fully separate. No database, token, `AUTH_SECRET` or OpenRouter key is shared between them, and every variable is scoped to exactly one environment.
- Production data: a **copy of `local.db`**, excluding `auth_sessions` and `login_attempts`. Preview gets the same copy as a rehearsal.
- Turso is provisioned through the **Vercel Marketplace**. The app reads exactly `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN`, with no prefix.
- AI review is **enabled**: `OPENROUTER_API_KEY` uses a separate key per environment with nonresetting caps of **$1 Preview** and **$5 Production**, and `OPENROUTER_MODEL=anthropic/claude-sonnet-4.6`.
- Deploys come from **Git integration**: pushing to `main` deploys Production, and the `preview` branch is the stable Preview.
- Production origin: `APP_ORIGIN=https://gym-program-builder.vercel.app`, unless that name is taken, in which case use the domain Vercel assigns. Preview origin is the exact `preview` branch alias. HTTPS, no trailing slash.
- Project: create a new `gym-program-builder` project. Delete the unused `programs-persistence` project only after confirming it has no deployments, and only with the user's explicit confirmation.
- Plan: Vercel **Hobby**. `vercel.json` already sets `npm run build`, `public` and `maxDuration: 75`, and the runtime is Node `24.x` from `engines`.
- Migrations and seeds are never run from builds or requests. Run them per environment with `node --env-file=<that environment's file> scripts/<script>.js`, never with `npm run db:*`, because those scripts also load `.env.local`.
- Secrets never appear in chat, command arguments, commits or logs. Pulled env files are `.env.preview.local` and `.env.production.local` (already ignored by `.env*`) and are deleted at the end.
- Never claim an environment is verified unless its checks actually ran. Record real results only.

## Review Focus

1. **`APP_ORIGIN` doesn't match the URL being used.** Writes (POST/PUT) fail with "Cross-origin requests are not allowed." The user expects saving to work on the stable Preview alias and the production domain. Task 6 Step 6 and Task 7 Step 6 check a real save on each.
2. **Marketplace variables are prefixed, missing or sensitive.** The function fails to connect, or `vercel env pull` writes empty values. The user expects the app to reach its own database. Task 3 Step 4 checks exact names and scopes, and Tasks 5 and 7 check that pulled values are nonempty before running scripts.
3. **The copy runs against a nonempty or differently migrated database.** It must refuse and change nothing rather than duplicate or half-copy data. This is pinned in Task 1's tests.
4. **Copied login sessions would grant access.** Production must never contain `local.db`'s `auth_sessions`. This is pinned in Task 1's tests and checked in Task 7 Step 3.
5. **A push to `main` lands before the production database is migrated and filled.** Production would serve against an empty database. The task order blocks it: Git is connected in Task 6, and nothing is pushed to `main` until Task 7 Step 5. Task 7 Step 6 checks `/api/auth/session` and the copied data.

---

### Task 1: Database copy script

**Files:**
- Create: `server/copy-database.js`
- Create: `scripts/copy-database.js`
- Test: `test/copy-database.test.js`
- Modify: `docs/deployment.md` (new section "Copying a local database into a new environment", after "Backup and restore before production migration")

**Interfaces:**
- Consumes: `createDb(options)` and `migrate(db)` from `server/db.js`.
- Produces: `copyDatabase(source, target) → Promise<Record<string, number>>`, a map of table name to copied row count in source creation order. Also `EXCLUDED_TABLES = ['schema_migrations','auth_sessions','login_attempts']`. CLI: `node --env-file=<file> scripts/copy-database.js --from <path to .db file>`. The target comes from `TURSO_DATABASE_URL`/`TURSO_AUTH_TOKEN` and the script prints one `table: count` line per table.

- [ ] **Step 1: Write the failing tests** in `test/copy-database.test.js`. Use temp file databases created with `mkdtemp` and cleanup like `test/repository.test.js:31-32`, each migrated with `migrate`.
  - `copies every data table and returns counts`: the source has 1 `documents` row (template), 1 `user_profile` row, 1 `auth_sessions` row and 1 `login_attempts` row. After the copy, the target's `documents` and `user_profile` rows equal the source rows column for column. The result includes `documents: 1` and has no key from `EXCLUDED_TABLES`.
  - `never copies sessions or login attempts`: the target's `auth_sessions` and `login_attempts` counts are both 0.
  - `keeps the target's own schema_migrations`: the target's versions are `1..8` and its `applied_at` values are unchanged.
  - `refuses a target that already has data`: the target has one `documents` row. The copy rejects with `/Target database is not empty: documents/` and the target's row counts are unchanged.
  - `refuses mismatched migration versions`: delete version 8 from the source's `schema_migrations`. The copy rejects with `/Migration versions differ/` and the target is unchanged.
  - `refuses a source table missing from the target`: drop `workout_log_variants` in the target. The copy rejects with `/Target is missing table workout_log_variants/` before writing anything.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test test/copy-database.test.js`
Expected: FAIL because `server/copy-database.js` can't be found.

- [ ] **Step 3: Implement `copyDatabase(source, target)` in `server/copy-database.js`**

Read the source's tables from `sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'`, ordered by `rowid` (creation order, so referenced tables come first), minus `EXCLUDED_TABLES`. Run every check before writing: versions match, every table exists in the target, and every copied table in the target is empty. Then, in a single `target.transaction('write')`, run `PRAGMA defer_foreign_keys=ON` and insert each row with `INSERT INTO "<table>" (<source columns>) VALUES (?, …)`. Before committing, compare each target count to the source count and throw `Row count mismatch in <table>` on any difference.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test test/copy-database.test.js`
Expected: all 6 tests pass.

- [ ] **Step 5: Implement the CLI `scripts/copy-database.js`**

Require `--from <path>`. Exit with a usage message if it's missing, if `TURSO_DATABASE_URL` is unset, or if the target URL equals `file:<from>`. Open the source as `file:<path>`, call `copyDatabase`, print the counts and close both clients in `finally`. Never print URLs or tokens.

- [ ] **Step 6: Rehearse locally with file databases**

Run: create an empty database with `TURSO_DATABASE_URL=file:<scratch>/target.db node scripts/migrate.js`, then `TURSO_DATABASE_URL=file:<scratch>/target.db node scripts/copy-database.js --from local.db`.
Expected: the counts match `local.db` (as of 2026-11-04: `documents: 3`, `catalog_entries: 11`, `catalog_families: 11`, `user_profile: 1`, …) and there are no `auth_sessions` or `login_attempts` lines. Running the copy a second time exits nonzero with "Target database is not empty".

- [ ] **Step 7: Document the procedure** in `docs/deployment.md`. Cover what is copied and excluded, the refusal rules, the per-environment `node --env-file=...` invocation, and that the copy is also how a backup is restored into a new isolated database.

- [ ] **Step 8: Run the full gate and commit**

Run: `npm test`, `npm run test:e2e`, `npm run build`, `git diff --check`
Expected: all pass, with no whitespace errors.

```bash
git add server/copy-database.js scripts/copy-database.js test/copy-database.test.js docs/deployment.md
git commit -m "feat: copy a local database into an empty migrated environment"
```

### Task 2: Back up local.db and prepare the Vercel account

Operational. There are no code changes.

- [ ] **Step 1: Back up `local.db`** with the dev server stopped. Copy it to a private folder outside the repo (for example `%USERPROFILE%\gym-backups\2026-11-04-local.db`) and record its SHA-256 with `certutil -hashfile <file> SHA256`.
  Expected: the backup hash equals the hash of `local.db`. The rest of the plan uses this backup as the copy source, so later local edits don't drift between Preview and Production.
- [ ] **Step 2: Confirm the source.** Show the user the table counts from Task 1 Step 6 and have them confirm this is the data they want in production. In particular, `catalog_seed_versions` is 0, so the starter catalog was never seeded locally.
- [ ] **Step 3: Install and log in to the Vercel CLI.** Run `npm i -g vercel`. The user then runs `! vercel login`.
  Expected: `vercel whoami` prints the user's account.
- [ ] **Step 4: Check the old project.** Run `vercel project ls` and `vercel ls programs-persistence`.
  Expected: `programs-persistence` exists and shows no deployments. If it has deployments, stop and report to the user instead of deleting it.
- [ ] **Step 5: Delete the old project.** After the user explicitly confirms, run `vercel project rm programs-persistence`.
  Expected: `vercel project ls` no longer lists it.

### Task 3: Create the project and provision Turso

- [ ] **Step 1: Create and link the project** without deploying: `vercel project add gym-program-builder`, then `vercel link --yes --project gym-program-builder`.
  Expected: `.vercel/project.json` exists (it's git-ignored). If the name is taken under the account, use the name the CLI offers and update `APP_ORIGIN` in Task 4 to match.
- [ ] **Step 2: Check project settings** (Dashboard → Settings → Build and Deployment): Framework Preset **Other**, Node.js **24.x**, Root Directory empty. Build and output come from `vercel.json`. Under Deployment Protection, leave **Standard Protection** on, which covers previews and leaves the production domain public.
- [ ] **Step 3: Provision two Turso databases** in Dashboard → Storage → Create → Turso (Marketplace), in the region nearest the function region (default `iad1`, Washington D.C.):
  - `gym-preview`, connected to the **Preview** environment only.
  - `gym-production`, connected to the **Production** environment only.
  Turn off Development for both, because local development keeps `file:local.db`. If the connect dialog offers a variable prefix, leave it empty.
- [ ] **Step 4: Check the variables.** Run `vercel env ls`.
  Expected: exactly one `TURSO_DATABASE_URL` and one `TURSO_AUTH_TOKEN` per environment, Preview and Production, each scoped to a single environment and unprefixed. If the integration injected other names (for example `TURSO_URL`), add the two expected names with the same values per environment rather than changing code.

### Task 4: Secrets, origins and AI keys per environment

All values are entered by the user (`! vercel env add …`) or piped directly from a generator. Nothing is printed.

- [ ] **Step 1: Create the `preview` branch** from `main` and push it: `git push -u origin main:preview`. Its stable alias will be `gym-program-builder-git-preview-<scope>.vercel.app`. Take `<scope>` from `vercel whoami` or the team slug.
- [ ] **Step 2: Set `AUTH_SECRET`** with a fresh value for each environment:
  `node -e "process.stdout.write(require('node:crypto').randomBytes(32).toString('hex'))" | vercel env add AUTH_SECRET production`, then the same command with `preview preview` (the second `preview` scopes it to the branch).
- [ ] **Step 3: Set `APP_PASSWORD_HASH`.** The user runs the README's PowerShell `Read-Host` snippet piped into `npm.cmd run --silent password:hash`, then pipes the hash into `vercel env add APP_PASSWORD_HASH production` and again for `preview preview`. The same password is fine, but each hash is generated separately.
- [ ] **Step 4: Set `APP_ORIGIN`** to `https://gym-program-builder.vercel.app` for production, and to `https://gym-program-builder-git-preview-<scope>.vercel.app` for `preview preview`.
- [ ] **Step 5: Set up OpenRouter.** The user creates two keys at openrouter.ai/settings/keys: `gym-preview`, with a $1 nonresetting cap, and `gym-production`, with a $5 nonresetting cap. Automatic top-up stays off. The user adds each key with `! vercel env add OPENROUTER_API_KEY production` and `! vercel env add OPENROUTER_API_KEY preview preview`. Then set `OPENROUTER_MODEL` to `anthropic/claude-sonnet-4.6` for both.
- [ ] **Step 6: Check scopes.** Run `vercel env ls`.
  Expected: `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`, `AUTH_SECRET`, `APP_PASSWORD_HASH`, `APP_ORIGIN`, `OPENROUTER_API_KEY` and `OPENROUTER_MODEL` each appear once for Production and once for Preview (the Preview ones scoped to the `preview` branch or to all of Preview). None are set for Development.

### Task 5: Prepare the Preview database (rehearsal and restore test)

- [ ] **Step 1: Pull the variables:** `vercel env pull .env.preview.local --environment=preview --git-branch=preview`.
  Expected: `TURSO_DATABASE_URL` starts with `libsql://` and `TURSO_AUTH_TOKEN` is nonempty. Check this with a script that prints only `set`/`empty`. If the values are empty because they're marked sensitive, the user copies the URL and creates a database token from the integration's "Open in Turso" page into that file privately.
- [ ] **Step 2: Migrate:** `node --env-file=.env.preview.local scripts/migrate.js`.
  Expected: prints `Database migrations applied.` A second run changes nothing.
- [ ] **Step 3: Copy the data:** `node --env-file=.env.preview.local scripts/copy-database.js --from <backup path>`.
  Expected: the same counts as Task 1 Step 6.
- [ ] **Step 4: Seed:** `node --env-file=.env.preview.local scripts/seed-catalog.js`.
  Expected: it completes, and custom catalog entries, tags and archives are unchanged. The seed adds the 64 starter variants. Show the user the result so they can decide in Task 7 Step 4 whether Production gets the seed too.
- [ ] **Step 5: Run read-only checks** with a short `node --env-file=.env.preview.local -e` query: `schema_migrations` versions are 1–8, `documents`/`user_profile` counts match the backup, and `auth_sessions` and `login_attempts` are both 0.

### Task 6: Connect Git and verify Preview

- [ ] **Step 1: Connect the repository:** `vercel git connect` (the repo is `github.com/nicofilizzola/gym-program-builder`).
  Expected: the dashboard shows the repo, with Production Branch set to `main`.
- [ ] **Step 2: Deploy Preview** by pushing the plan commits to `preview` (`git push origin main:preview`).
  Expected: the build log shows npm (from `package-lock.json`), `npm run build` and Node 24, and the deployment is Ready.
- [ ] **Step 3: Check routing and private files** on the stable alias, using `vercel curl` or the `vercel:access-protected-vercel-deployment` skill because of Standard Protection:
  - `/api/auth/session` returns 401 JSON with `Cache-Control: no-store`.
  - `/server/auth.js`, `/.env.local` and `/local.db` are not served.
- [ ] **Step 4: Run app smoke tests in two browsers** on the stable alias (`docs/deployment.md` steps 6–7). Sign in, check that the copied programs/templates/profile are present, edit a shared template and see it on the second device, check that a stale save conflicts and Save as copy works, check Retry when offline, and run import/export and the 320px layout.
- [ ] **Step 5: Run the workout tracker smoke test** (`workout-tracker-rollout.md` step 5): start from a program, a template and blank, finish one, check that it appears in History and as Last time, reload mid-workout, and discard a second workout. Delete the test logs afterwards.
- [ ] **Step 6: Run the origin and AI checks.** A save succeeds on the stable alias. On the per-commit `…-<hash>-….vercel.app` URL, a save is refused with "Cross-origin requests are not allowed." Run one AI program review: text streams before completion, Stop works, and OpenRouter Activity shows `gym-preview` with the expected model.
  Expected: all pass. Any failure stops the plan before Production.

### Task 7: Production database, release and record

- [ ] **Step 1: Pull the variables:** `vercel env pull .env.production.local --environment=production`, with the same `set`/`empty` check as Task 5 Step 1, plus a check that `TURSO_DATABASE_URL` differs from Preview's.
- [ ] **Step 2: Migrate:** `node --env-file=.env.production.local scripts/migrate.js`.
  Expected: `Database migrations applied.`
- [ ] **Step 3: Copy the data:** `node --env-file=.env.production.local scripts/copy-database.js --from <backup path>`, then the Task 5 Step 5 read-only checks against production.
  Expected: the same counts as the backup, and 0 `auth_sessions`.
- [ ] **Step 4: Seed, if the user wants it.** Ask the user whether Production gets the starter catalog (decided after seeing Preview). If yes, run `node --env-file=.env.production.local scripts/seed-catalog.js`.
- [ ] **Step 5: Release:** push `main` to origin.
  Expected: a Production deployment is Ready on `gym-program-builder.vercel.app`.
- [ ] **Step 6: Run the production smoke test.** `/api/auth/session` returns 401 JSON with no-store, and private files aren't served. Sign in, see the copied data, make one save, then reverse it. Run one AI review and check OpenRouter Activity for `gym-production`. Sign in from a second device.
- [ ] **Step 7: Record the release** in `docs/superpowers/verification/2026-11-04-vercel-deployment.md`: what actually ran in each environment, the counts, the deployment URLs (no secrets) and any checks not performed. Update the "Production gate and rollback" section of `docs/deployment.md` with how to roll back: re-promote a previous deployment, or restore the backup into a new database with `copy-database.js`.
- [ ] **Step 8: Clean up and commit.** Delete `.env.preview.local` and `.env.production.local`, and keep the `local.db` backup.

```bash
git add docs/superpowers/verification/2026-11-04-vercel-deployment.md docs/deployment.md
git commit -m "docs: record the Vercel preview and production release"
git push origin main
```
