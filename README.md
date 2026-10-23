# Gym Program Builder

A personal library of named session templates and weekly programs. Add independent template copies to a program, keep a simple workout order or assign Monday–Sunday days, and see live direct/indirect volume and optional workout/weekly goals.

Data autosaves through a password-protected API to SQLite. Use a local database for development and Turso with Vercel for cross-device access. Changes appear on another device when you reopen/reload a document; concurrent edits show a conflict instead of silently overwriting.

## Local setup

Requires **Node.js 24** and npm. On Windows PowerShell, use `npm.cmd`/`npx.cmd` if execution policy blocks npm.ps1.

1. Run `npm install`.
2. Copy `.env.example` to `.env.local`.
3. Generate `APP_PASSWORD_HASH` by passing your chosen password on stdin to `npm run --silent password:hash`. The script produces a salted scrypt hash. Do not put a password in command arguments, git or browser code.
4. Set a random `AUTH_SECRET`, `TURSO_DATABASE_URL=file:local.db` and `APP_ORIGIN=http://localhost:3000` in `.env.local`.
5. Run `npm run db:migrate`, then `npm start` and open the exact `APP_ORIGIN`.

PowerShell password input without recording the password in history:
```powershell
$gymPassword = Read-Host 'App password' -AsSecureString
[System.Net.NetworkCredential]::new('', $gymPassword).Password | npm.cmd run --silent password:hash
```

Use `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"` to generate `AUTH_SECRET`. Treat both the hash and secret as private. `.env.local` and local database files are ignored by git and excluded from the static output.

## Verification

```text
npm test
npx playwright install chromium
npm run test:e2e
npm run build
```

The browser suite starts its own local server and temporary SQLite database with a test-only password, `test-password`. Normal app startup never uses that password. Tests need no Turso or Vercel account. Build output is `public/`; only browser assets are copied there.

## Data and backups

Drafts, including empty names or unfinished muscle selections, are saved. Export requires a valid complete template/program. JSON import/export supports both kinds; legacy version-1 session files import as named session templates. Import at a library creates a new item. Import in an editor replaces its content after confirmation where appropriate.

Copies in a program are independent of the library and one another. Weekly goals use 0.5–30 sets; workout goals use 0.5–12. A workout counts once even when unscheduled. There is no calendar history, workout logging or offline editing.

Wait for **Saved** before closing. Failed saves retain edits in the open tab and offer Retry. Conflicts offer Reload saved version or Save as copy. A forced browser close before acknowledgement can lose unsaved edits.

For hosting, migrations, password rotation and backup/restore, see [the deployment runbook](docs/deployment.md).
