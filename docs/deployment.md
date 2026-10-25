# Deployment and recovery

## Architecture

Vercel serves `public/` and the Node.js 24 function at `api/index.js`. `vercel.json` rewrites API paths to the router. Durable data lives in Turso, not Vercel's ephemeral filesystem. Runtime dependency: `@libsql/client`. No frontend framework or ORM.

Only `index.html`, `style.css` and `src/*.js` are public. Do not deploy the project using a static server rooted at the repository; use the configured build/output directory. Local `npm start` also enforces a browser-asset allowlist. API responses are uncached.

## Environment setup

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

## Password rotation and session revocation

1. Generate a new salted password hash; update `APP_PASSWORD_HASH` in the intended environment.
2. Delete all rows from `auth_sessions` using the provider SQL shell: `DELETE FROM auth_sessions;`. This logs out every device. A password change alone does not revoke existing sessions.
3. If secrets were exposed, rotate `AUTH_SECRET` and the database token too. Redeploy/restart functions so environment changes apply. Reauthenticate on each device.
4. To remove lockout during an operational recovery, clear only the necessary `login_attempts` row or wait 15 minutes; do not weaken rate limiting in code.

## Production gate and rollback

Production deployment requires preview smoke evidence, a tested restore and the correct separate environment variables. Provisioning Turso credentials, remote preview routing, provider backup/restore and production deployment were not verified by the local automated suite and remain operator release steps.

Rollback to a prior compatible Vercel deployment without dropping tables or documents. Migration 1 is additive. Do not roll back to the original static/in-memory app and assume it can read the database. If a future migration is incompatible, restore the tested backup into a new database and point the compatible deployment at it; never blindly delete live tables. Retain the original database until recovery is verified.

## References

- [Vercel Node.js runtime](https://vercel.com/docs/functions/runtimes/node-js)
- [Vercel rewrites](https://vercel.com/docs/routing/rewrites)
- [Trusted Vercel request headers](https://vercel.com/docs/headers/request-headers)
- [Turso Vercel integration](https://vercel.com/marketplace/tursocloud)
- [Turso CLI documentation](https://docs.turso.tech/cli/introduction)
