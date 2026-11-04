# Vercel deployment verification (2026-11-04)

Plan: [2026-11-04-vercel-deployment](../plans/2026-11-04-vercel-deployment.md). This records only what actually ran.

## Release

- Vercel project `gym-program-builder` (team-6372, Hobby, Node 24.x, `iad1`). The unused `programs-persistence` project had no deployments and was deleted with the owner's approval.
- Production: `https://gym-hub-app.vercel.app` (deployment `gym-program-builder-qkdnxy6pv`, commit b5dd0c4 on `main`). `gym-program-builder.vercel.app` belongs to another account.
- Preview: `https://gym-program-builder-git-preview-team-6372.vercel.app` (deployment `gym-program-builder-qopdr5tsu`). Deployment Protection covers previews only.
- Databases: Turso `gym-preview` and `gym-production` via the Vercel Marketplace, each connected to one environment. Every variable exists once per environment and none for Development.
- Source data: a backup of `local.db` (SHA-256 `43928c5f…cefd`), stored outside the repository, which the owner confirmed. Preview was migrated, copied and seeded. Production was migrated and copied but not seeded, by the owner's choice.

## Automated checks

- `npm test` 311/311, `npm run test:e2e` 307 passed, `npm run build` and `git diff --check` clean.
- The copy script's 6 tests cover counts, excluded sessions/login attempts, preserved migrations and refusals for nonempty, mismatched or incomplete targets. A file-database rehearsal copied `local.db` and refused a second run.

## Defects found and fixed during the release

- Migration 006 failed on remote Turso (`SQL_PARSE_ERROR` near `HAVING`) because Turso's server rejects `HAVING` without `GROUP BY`; local SQLite accepts it. It was rewritten as `CASE WHEN count(DISTINCT …)=1 THEN min(…) END`. A regression test failed first, and the existing metadata migration test confirms the result is unchanged. The failed run was transactional and left nothing behind.
- The first Git deployment (a push to `preview`) was made Production by Vercel because the project had none. It briefly served production variables against the empty, unmigrated production database. No data was written: the later copy into the production database succeeded, and the copy only accepts an empty target. It was redeployed as Preview, and the release replaced it.

## Environment checks

| Check | Preview | Production |
|---|---|---|
| `/api/auth/session` returns 401 JSON, `Cache-Control: no-store` | yes | yes |
| `/server/auth.js`, `/.env.local`, `/local.db` return 404 | yes | yes |
| Migrations 1–8, a second run changes nothing | yes | yes |
| Copied counts equal the backup; 0 `auth_sessions` and `login_attempts` | yes | yes |
| Signed in: 1 program, 2 templates and the profile present | yes | yes |
| Save on the stable origin succeeds | yes (profile resaved unchanged) | yes (profile resaved unchanged) |
| Writes from another origin refused (403 FORBIDDEN) | per-commit URL | `-two` alias |
| Stale save with different content returns 409 CONFLICT, data unchanged | yes | not run |
| AI review streams text before completion | yes | yes, completed |
| Stop leaves a partial report marked incomplete | yes | not run |
| Blank workout: server active record and local mirror; active bar after reload; Discard clears both | yes | not run |
| Seeded catalog keeps the original 11 entries and 11 references identical | yes | not seeded |

Preview used 2 AI runs (one accidental, through Analyze again) and Production 1.

## Not verified

Second-device sync, offline Retry, import/export, 320px layout, expired login, finishing a workout with History/Last time on a hosted environment, physical touch devices, and the OpenRouter Activity dashboard (to be confirmed by the owner). The Turso CLI dump/restore was not exercised; the copy script was exercised as the restore path into Preview.
