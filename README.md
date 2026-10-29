# Gym Program Builder

A personal library of named session templates and weekly programs. Link shared session templates into programs, keep a simple workout order or assign Monday–Sunday days, and see live direct/indirect volume and optional workout/weekly goals. Editing a shared session from any program updates its template and every occurrence; weekday and position remain program-specific.

Data autosaves through a password-protected API to SQLite. Use a local database for development and Turso with Vercel for cross-device access. Changes appear on another device when you reopen/reload a document; concurrent edits show a conflict instead of silently overwriting.

## Local setup

Requires **Node.js 24** and npm. On Windows PowerShell, use `npm.cmd`/`npx.cmd` if execution policy blocks npm.ps1.

1. Run `npm install`.
2. Copy `.env.example` to `.env.local`.
3. Generate `APP_PASSWORD_HASH` by passing your chosen password on stdin to `npm run --silent password:hash`. The script produces a salted scrypt hash. Do not put a password in command arguments, git or browser code.
4. Set a random `AUTH_SECRET`, `TURSO_DATABASE_URL=file:local.db` and `APP_ORIGIN=http://localhost:3000` in `.env.local`.
5. Run `npm run db:migrate`, then `npm run db:seed`, then `npm start` and open the exact `APP_ORIGIN`.

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

Programs link shared templates. Editing a session from a program changes that template everywhere; weekday and placement stay local to each occurrence. Duplicate session adds another linked occurrence; library template duplication creates an independent template. Templates in use cannot be deleted until removed from their programs. Weekly goals use 0.5–30 sets; workout goals use 0.5–12. Every occurrence counts, including repeats and Unscheduled. There is no calendar history, workout logging or offline editing.

Exports use self-contained version-3 files that preserve repeated template links and descriptive exercise metadata. Version-1/2 files still import. Library imports create new records; importing into a shared session editor replaces that same shared template after the existing nonempty-content confirmation. Save as copy creates an independent template without silently relinking any programs.

Wait for **Saved** before closing. Failed saves retain edits in the open tab and offer Retry. Conflicts offer Reload saved version or Save as copy. A forced browser close before acknowledgement can lose unsaved edits.

## Exercise catalog

The catalog starts with 64 common variants, grouped beneath named **reference exercises**. References own equipment, optional descriptions and default muscle selections; only variants can be selected for workouts. Variants inherit equipment and can override the starting muscles. Browse collapsed groups or search by names, equipment, Brand and Focus tags. Session autocomplete shows the same grouping and supports arrow-key navigation through variants.

Equipment uses single-select pills with icons and labels. Optional reference and variant descriptions appear together in the workout's info popover. Variants can have one optional Brand and multiple Focus tags; Focus labels do not change volume calculations. Use **Manage tags** in the catalog to create, rename, archive or restore either type. Archived labels remain visible on existing assignments, and tags stay visible on collapsed workout cards.

Use **New reference exercise** to create an empty group, **Add variant** on its header to define an exercise, and the header icon strip to edit or archive/restore the group. Variant actions support editing, copying, moving to another active reference and individual archive/restore. Moving preserves the variant ID, muscle mappings, workout sets/reps and links. A conflicting destination name is refused rather than merged.

Reference archiving hides its variants from new selections without breaking existing workouts. Restoring a reference brings back only variants that were not individually archived. Moving an effectively archived variant keeps it archived until explicitly restored.

Linked names and muscle mappings stay read-only in session cards. **Create variant** saves an alternative under the same active reference and selects it in that shared session, including every program occurrence of the template. Other templates do not switch variants. **Edit variant** in the catalog changes that exact entry everywhere it is used; the usage preview identifies affected workout instances. Other variants remain independent.

Existing/imported custom exercises stay unlinked until explicit confirmation. Exports contain complete definitions without catalog IDs; imports never modify the catalog. Focus refresh and Save as copy preserve the existing conflict/recovery behavior, and save acknowledgements preserve open variant drafts.

Run **npm run db:migrate** explicitly before starting this release against an existing database. Migration 005 converts embedded workouts to separate linked templates; migration 006 adds catalog metadata and preserves equipment conflicts for manual resolution. Use [the shared-session rollout guide](docs/operations/shared-sessions-rollout.md) and [catalog cleanup guide](docs/operations/catalog-metadata-rollout.md), including environment-specific backups and a maintenance window. Run **npm run db:seed** explicitly where desired; seed reruns preserve personal metadata. Preview and production databases remain separate, and builds/requests never migrate or seed.

For hosting, migrations, password rotation and backup/restore, see [the deployment runbook](docs/deployment.md).
