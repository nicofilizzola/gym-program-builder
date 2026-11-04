# Deployment and recovery

## Architecture

Vercel serves `public/` and the Node.js 24 function at `api/index.js`. `vercel.json` rewrites API paths to the router. Durable data lives in Turso, not Vercel's ephemeral filesystem. Runtime dependency: `@libsql/client`. No frontend framework or ORM.

Only `index.html`, `style.css` and `src/*.js` are public. Do not deploy the project using a static server rooted at the repository; use the configured build/output directory. Local `npm start` also enforces a browser-asset allowlist. API responses are uncached.

## Environment setup

### OpenRouter session analysis

The AI feature is optional. Without `OPENROUTER_API_KEY`, normal editing/storage works and Analyze explains that analysis is not configured. No LiteLLM service, new database migration, catalog seed or browser API key is needed.

Before the first live test:

1. Create an [OpenRouter account](https://openrouter.ai/) and add a small prepaid balance. Leave automatic credit top-up disabled initially.
2. In [API keys](https://openrouter.ai/settings/keys), create separate development, preview and production keys. Suggested initial **nonresetting** caps: **$2 development, $1 preview, $5 production**. These are spending limits, not subscriptions; confirm each environment has the intended key/cap. Do not use a management key in the app.
3. In this feature worktree's ignored `.env.local`, keep your existing database/auth settings and add:

   ```dotenv
   OPENROUTER_API_KEY=<development key>
   OPENROUTER_MODEL=anthropic/claude-sonnet-4.6
   ```

   Copy existing local configuration privately if using a separate worktree. Never paste keys into chat or commit env files. Restart `npm start` after changing local env. On Windows use `npm.cmd` if PowerShell blocks the npm script wrapper.
4. Add the matching variables in Vercel Project Settings → Environment Variables separately for Preview and Production, then redeploy that environment. Never let Preview inherit the Production key. Keep `APP_ORIGIN` matched to the actual preview URL. The configured function duration is 75 seconds; confirm the hosting plan supports it. The service itself aborts at 60 seconds.
5. Confirm access to the model and the `anthropic` provider, review the account/provider data policies, and verify model pricing before spending. Requests allow only that provider with no fallback, disable extended reasoning and cap output at 1500 tokens. The server never automatically retries paid requests. Provider cancellation billing varies; Stop aborts the connection but does not promise zero further charges.

Run one explicit, paid fixture evaluation at a time from the feature worktree:

```powershell
node --env-file-if-exists=.env.local scripts/evaluate-analysis.js --live --fixture focused-push
```

Without `--live` or with an unknown fixture this command prints usage and exits before requesting anything. It outputs only nonprivate fixture results, prompt/model version and usage when reported; redirect into a local ignored `.superpowers/` artifact if desired. Review every fixture listed by the usage command against the spec's rubric before prompt acceptance: actual exercise evidence, correct numbers, useful prioritized adjustments, no fabricated context/weekly verdicts, and resistance to instructions in exercise names. Budget limits are enforced by OpenRouter keys across instances; there is no pretend global in-memory quota.

Then smoke-test locally and on Preview: first text arrives before completion; Stop/navigation disconnect aborts upstream; provider/credit errors are readable; OpenRouter Activity shows the intended model/provider and charge. Only enable Production after preview review. Automated tests use fake streams and never spend credits.

At published $3/M input and $15/M output, an example 4000 input + 1500 output tokens costs ~$0.0345. This is an estimate, not a hard request cap; recheck [model pricing](https://openrouter.ai/anthropic/claude-sonnet-4.6/pricing). Input is bounded at 40 exercises/64 KiB and output at 1500 tokens/64 KiB. Key caps are the overall spending control. References: [provider routing](https://openrouter.ai/docs/guides/routing/provider-selection), [streaming/cancellation](https://github.com/OpenRouterTeam/docs/blob/main/api_reference/streaming.mdx), [key limits](https://github.com/OpenRouterTeam/docs/blob/main/api_reference/limits.mdx).

To disable AI, remove its key and restart/redeploy; normal template editing remains available. If a key is exposed, revoke it in OpenRouter, create a replacement with the intended cap, update the affected server environment and redeploy.

Create separate Turso databases for preview and production, near the Vercel function region. Configure these variables separately in each Vercel environment:

| Variable | Value |
|---|---|
| `TURSO_DATABASE_URL` | The environment's remote libSQL database URL |
| `TURSO_AUTH_TOKEN` | Database-scoped access token |
| `APP_PASSWORD_HASH` | Salted scrypt hash generated with `npm run --silent password:hash` |
| `AUTH_SECRET` | At least 32 cryptographically random bytes, encoded as hex |
| `APP_ORIGIN` | Exact HTTPS origin, including host and optional port, no trailing slash |

Never expose variables as client/public variables or commit env files. `APP_ORIGIN` must match the URL you actually open. Use a stable preview alias (or configure the exact preview URL for that environment); arbitrary preview URLs are rejected for writes. Local HTTP is supported only by local configuration.

This release has one personal password, no account registration or password-reset endpoint. Session cookies expire after 30 days, are HttpOnly/SameSite=Strict and Secure in HTTPS environments. Five failed login attempts per platform client IP lock further attempts for 15 minutes; rate limits live in SQLite. Vercel overwrites `x-vercel-forwarded-for`; the local server ignores forwarded-IP headers and uses a local bucket. Do not place an untrusted reverse proxy in front of the app without reviewing client-IP semantics.

## Migration and preview release

1. Install dependencies using Node 24: `npm ci`.
2. Export the target environment's database variables into the process or a private `.env.local` and run `npm run db:migrate`. Migrations are explicit, transactional and safe to rerun. They are never run on user requests or automatically against production during builds.
3. Run `npm run db:seed` explicitly against the same target database, then `npm test`, `npm run test:e2e`, `npm run build` and `git diff --check`. Seeding is idempotent and never overwrites catalog edits or restores archived entries. Preview and production must be migrated and seeded separately; no production database was changed by local verification.
4. In Vercel, choose framework **Other**, Node **24.x**, build command `npm run build`, output directory `public`. Connect the intended Git repository and branch. Do not reuse a production DB token for preview.
5. Deploy a preview only when authorized. Verify the API rewrite by opening `/api/auth/session`: unauthenticated response must be 401 JSON with `Cache-Control: no-store`, not HTML or a 404. `/server/auth.js`, `/.env.local` and `/local.db` must be unavailable. Do not use SPA catch-all rewrites that expose private files or swallow API errors.
6. Sign in in two browsers. Create a template, add two copies to a program and edit one. Verify the source and other copy stay unchanged. Reopen on the second device and verify persisted names/goals/order/day assignments.
7. Edit the same record on both devices; verify the second stale save offers a conflict and Save as copy preserves the unsaved work. Test offline failure/Retry, expired login, import/export and 320px layout.

`npm run dev` uses the local HTTP server. Optional `npm run vercel:dev` invokes Vercel CLI on demand and may prompt to link or create a remote project; it is not required for tests. Do not accept project creation/link prompts during routine local verification. The implementation session inadvertently created a project named `programs-persistence`; it was not deployed. Confirm the intended project before any future release.

## Backup and restore before production migration

Take a provider-supported database export/snapshot before modifying a database that contains data. Keep the backup outside the repository and public output, with access restricted like the live database: it contains programs, password-session token hashes and rate-limit data.

Using the authenticated Turso CLI, export the target database with `turso db shell <database-name> .dump` into a private SQL file. On PowerShell, preserve UTF-8 explicitly rather than using the older PowerShell UTF-16 redirection default. Restore into a **new isolated database**, using Turso's documented SQL-dump import flow; never test restore over the production database. Check `schema_migrations`, document count, a representative program's exercises/goals/order/days and application login behavior. Delete restored `auth_sessions` so backup sessions cannot grant access. Validate the restore with the app pointed at that separate database and fresh secrets.

For local SQLite, close the app and database connections before copying the file, or use SQLite's consistent backup command; do not copy a live file without accounting for journals. Keep production backup retention/restore procedures in your Turso account's operational policy. JSON exports preserve individual portable documents but are not a full operational database backup.

## Copying a local database into a new environment

`scripts/copy-database.js` copies every data row from a SQLite file (for example a backup of `local.db`) into an environment's database. It copies everything except `schema_migrations`, `auth_sessions` and `login_attempts`, so copied data never carries login sessions or lockouts. The same command restores a backup into a new isolated database.

1. Close the app, then copy the source file to a private backup outside the repository. Copy from that backup, so a later local edit cannot make environments differ.
2. Pull the target environment's variables into a private, ignored file, for example `vercel env pull .env.preview.local --environment=preview`. Check that `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` are not empty without printing them.
3. Migrate the target and copy, naming the environment file explicitly (not `npm run db:*`, which also loads `.env.local`):

   ```text
   node --env-file=.env.preview.local scripts/migrate.js
   node --env-file=.env.preview.local scripts/copy-database.js --from <backup.db>
   ```

The copy refuses, and writes nothing, when the source and target migration versions differ, the target lacks a source table, or any copied table in the target already has rows. Otherwise it copies in one transaction, checks each table's row count before committing and prints the counts. Run `scripts/seed-catalog.js` the same way afterwards if the environment should get the starter catalog. Delete the pulled environment file when finished.

## Password rotation and session revocation

1. Generate a new salted password hash; update `APP_PASSWORD_HASH` in the intended environment.
2. Delete all rows from `auth_sessions` using the provider SQL shell: `DELETE FROM auth_sessions;`. This logs out every device. A password change alone does not revoke existing sessions.
3. If secrets were exposed, rotate `AUTH_SECRET` and the database token too. Redeploy/restart functions so environment changes apply. Reauthenticate on each device.
4. To remove lockout during an operational recovery, clear only the necessary `login_attempts` row or wait 15 minutes; do not weaken rate limiting in code.

## Production gate and rollback

Production deployment requires preview smoke evidence, a tested restore and the correct separate environment variables. Provisioning Turso credentials, remote preview routing, provider backup/restore and production deployment were not verified by the local automated suite and remain operator release steps.

Rollback to a prior compatible Vercel deployment without dropping tables or documents. Migration 1 is additive. Do not roll back to the original static/in-memory app and assume it can read the database. If a future migration is incompatible, restore the tested backup into a new database and point the compatible deployment at it; never blindly delete live tables. Retain the original database until recovery is verified.

### Hosted environments (2026-11-04)

Vercel project `gym-program-builder` (Hobby, Node 24.x, `iad1`), connected to GitHub: `main` deploys Production at `https://gym-hub-app.vercel.app`, and the `preview` branch is the stable Preview at `https://gym-program-builder-git-preview-team-6372.vercel.app`. `APP_ORIGIN` holds exactly those origins. Other aliases (`gym-program-builder-two.vercel.app`, per-commit URLs) serve the app but writes from them are refused. Deployment Protection covers previews only; Production is guarded by the app password.

Turso databases `gym-preview` and `gym-production` come from the Vercel Marketplace integration, each connected to one environment. Secrets are stored as sensitive variables, so `vercel env pull` writes `[SENSITIVE]` for them; the Turso URL and token are pullable for explicit migrations. A project's first Git deployment becomes Production whatever its branch, so migrate both databases before connecting Git to a new project.

To roll back the application, promote a previous Production deployment (`vercel promote <deployment-url>` or the dashboard's Instant Rollback). To recover data, restore a backup into a new database with `scripts/copy-database.js` (see "Copying a local database into a new environment"), verify it, then point the environment's `TURSO_DATABASE_URL`/`TURSO_AUTH_TOKEN` at it and redeploy.

## References

- [Vercel Node.js runtime](https://vercel.com/docs/functions/runtimes/node-js)
- [Vercel rewrites](https://vercel.com/docs/routing/rewrites)
- [Trusted Vercel request headers](https://vercel.com/docs/headers/request-headers)
- [Turso Vercel integration](https://vercel.com/marketplace/tursocloud)
- [Turso CLI documentation](https://docs.turso.tech/cli/introduction)

## Reference exercise update

Apply migration 003 explicitly with `npm run db:migrate` before starting this version against an existing database. It adds the reference-level archive flag and preserves existing grouping/variant IDs, individual archives and saved document JSON. No seed version changes are required; `npm run db:seed` remains safe to rerun and never restores archived references or variants.

Verify reference creation without a variant, nested catalog/picker search, parent archive/restore with a separately archived child, and a variant move used by multiple program workouts. A stale move/archive preview must conflict, and a lost-response retry must not duplicate entries or revision writes. Move failures must leave all linked workouts and volume intact. Version-1/version-2 portable files keep the same format and import without trusted catalog identity. The internal familyId field remains for compatibility; the UI calls its grouping a reference exercise.


## Workout duration update

Run `npm run db:migrate` explicitly before starting this version against an existing environment. Migration 004 adds a nullable exercise_type column to reference groups; legacy custom references remain unclassified with a two-minute fallback until edited. Then run `npm run db:seed` explicitly: seed version 2 classifies known unchanged active starter references once. It preserves chosen types, renamed references, archived references/variants and saved workout rest. Never run either command during builds or requests; repeat separately for preview and production with their own database credentials.

New reference creation requires Compound or Isolation. Type edits affect future initial selections only. Verify a compound selection starts at 3 minutes, an isolation selection at 1 minute 30 seconds, and existing rest overrides survive classification edits, moves and reloads. Duration inputs use document JSON; version-2 exports add rest/extra/buffer fields while old files import with defaults. Older app builds can discard timing on re-export; retain current-format exports and a tested database backup before rollback.

## Program hypertrophy analysis update

This release uses the existing server-side OpenRouter configuration and capability endpoint. Program analysis posts a self-contained snapshot to `/api/analysis/program`; standalone session analysis retains `/api/analysis`. No new database migration, seed, table or environment variable is required. The Vercel rewrite already forwards the nested route and the existing 75-second function limit covers the 60-second generation timeout. Keep development, preview and production keys/databases separate.

Program generation reserves 1,024 reasoning tokens inside a 2,500-token total cap, with reasoning excluded from the response. It omits temperature for this reasoning-enabled request. Session generation retains its existing 1,500-token/no-reasoning/0.2-temperature settings. Live comparison selected the program budget after arithmetic/cadence errors persisted without reasoning; expect some additional latency and spend. The existing generation timeout, output-byte limit, provider routing and spending caps still apply.

Program context is optional JSON metadata under the existing program revision. v3 program exports include these notes, while reports remain temporary and disappear on navigation. Existing v1/v2/v3 files without context still import. An older app version may discard this new metadata on save/re-export, so preserve current v3 exports and a tested database backup before rolling back to one.

Explicit synthetic evaluation command (one fixture and one provider request):

```powershell
node --env-file-if-exists=.env.local scripts/evaluate-program-analysis.js --live --fixture sound-program
```

Omitting `--live`, using an unknown fixture or supplying multiple fixtures exits before provider access. Automated tests/builds never run paid evaluations. Use the configured development key with its spending cap and inspect the recorded provider usage; Stop cannot guarantee that no additional provider charge occurs.

Before enabling a preview/production deployment, verify the nested endpoint on that actual environment: sign in, add context, analyze a populated program, observe text before completion, Stop a generation, reopen without an automatic new request, retry explicitly, and confirm context survives reload and v3 export/import. Exercise an empty session, an unavailable provider and a shared-template refresh while context has focus. Confirm usage/cancellation behavior in the provider dashboard. Local smoke evidence does not verify remote routing, proxy buffering or accounting.

Actual local results and pending operator release checks are recorded in [the verification record](superpowers/verification/2026-10-31-program-analysis.md). No preview or production deployment is implied by local verification.
