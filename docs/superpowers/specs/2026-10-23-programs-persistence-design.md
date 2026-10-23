# Programs and persistent storage

## Intent and agreed scope

Evolve the current single-session, in-memory builder into a personal library of named session templates and named weekly programs. Data must be available across browsers/devices, automatically saved to hosted SQLite through a small Vercel backend. Access uses one password. This document records the clarification answers and the implementation defaults below; implementation is not part of the planning request.

Confirmed decisions:
- Standalone session templates live in a library. Adding one to a program creates a deep, independent copy, including its goals. Subsequent changes never propagate in either direction.
- Programs default to a simple sequential workout list. A toggle enables a Monday–Sunday schedule. Both sequence and weekday assignments survive switching modes.
- New program workouts are unscheduled. Multiple workouts may occupy one day. Repeating a workout creates another independent copy.
- Weekly volume includes each program workout exactly once, even if unscheduled or the schedule is hidden. Weekly goals are optional, separate from workout goals, from 0.5–30 in increments of 0.5; slider 0 clears a goal.
- Names, exercises, goals, ordering and scheduling autosave, including unfinished drafts, with visible save feedback.
- Import/export supports individual session templates and entire programs. Existing version-1 session files remain importable.

## Approach and alternatives

Recommended: retain vanilla JavaScript and CSS, add Vercel Node.js functions, and use Turso/libSQL through `@libsql/client`. Store each template/program as one versioned JSON document in SQLite. Each save is an atomic record update; this fits a small personal app and preserves ordered nested data without an ORM.

Alternative: normalized exercise/workout/goal tables. These support finer-grained queries but add joins, migrations and transactional ordering logic without a current product need. Alternative: a framework rewrite with a full-stack framework. It could simplify later large features but adds migration work unrelated to this release. A local writable SQLite file inside a Vercel function cannot provide durable shared storage.

## Data model and invariants

Use JSDoc types in `src/program.js`:
```
Workout = { name: string, exercises: Exercise[], goals: Goals }
SessionTemplate = Workout
ProgramWorkout = Workout & { id: string, day: null | 0|1|2|3|4|5|6 }
Program = { name: string, mode: 'simple'|'schedule', workouts: ProgramWorkout[], goals: Goals }
Record = { id: string, kind: 'template'|'program', revision: number,
           createdAt: string, updatedAt: string, document: SessionTemplate|Program }
```
Monday is 0. `workouts` array order is the canonical simple sequence; a scheduled day filters this array, preserving relative order. Moving within a day changes canonical order; changing a day changes only `day`. Simple mode always reveals the resulting canonical order. An occurrence has exactly one day or null. IDs use UUIDs and are stable through reorder; duplication/import remaps occurrence IDs.

Names are required for export/import but may temporarily be empty in a saved draft. UI fallbacks: `Untitled template`, `Untitled program`, `Untitled workout`. Nonempty duplicate names are allowed; IDs identify records. Existing numeric limits, muscle list and primary-muscle validation remain. Saving drafts relaxes only empty names and missing primary-muscle selections, not structural shape, numeric bounds, unknown/duplicate muscles or overlapping primary/secondary selections. New names default to the corresponding fallback and are editable.

Weekly split sums `computeVolumeSplit` for every workout; total derives from that split. Do not store computed volume, status, scale, validation errors, hover, collapse or selection state. Standalone templates are excluded from program totals. Schedule does not filter totals. Weekly goals accept 0.5–30; template/workout goals remain 0.5–12. No new recommendation ranges.

## Product flows and UI defaults

Top-level navigation has `Programs` and `Session templates`, plus logout. Each library lists saved items and supports create, rename through the editor, duplicate, delete with confirmation, import and export. Open an item to edit; return to its list without losing changes. Use hash routes (`#/programs`, `#/templates`, `#/programs/<id>`, `#/templates/<id>`) to retain static hosting and browser history. Unknown IDs show an error and a route back.

A program editor has its name, mode toggle, workout list/schedule, `Add from template`, and `Add empty workout`. Its overview displays weekly direct/indirect bars, totals and weekly goals. Selecting a workout opens the existing exercise editor within the program context, with a clear way back. Call the copied item a `Session template` in contextual labels and `workout` when describing its place in the program; never imply it remains linked to the library. Program copies may be renamed, duplicated and removed independently. No reverse publication of copies to the template library in this release.

Scheduled mode uses seven labelled day sections and an `Unscheduled` section, stacking vertically on narrow screens. A labelled day selector assigns a workout, and explicit move-up/down controls reorder it; all actions work with keyboard and touch without drag. Simple mode uses the same move controls. Preserve the existing mouse/touch/keyboard exercise drag handles. Keep focus on moved controls and restore focus after dialogs/deletion. Reuse the visual system; no redesign.

Existing template volume panel, body-map heatmap, collapse, readout, sliders, tooltips and accessibility remain. The program overview uses weekly volume bars and status, but no body map: the existing heat levels describe per-session volume. Weekly goals reuse goal sliders with a 30 maximum, with no per-session productive-set tooltips in the weekly dialog. Weekly readout reports total/split/status and contributing workout count; session-template readout retains contributing exercise count. Empty-week message: `No weekly volume yet. Add a workout or set a weekly goal.`

## Storage and API

SQLite schema:
- `schema_migrations(version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL)`.
- `documents(id TEXT PRIMARY KEY, kind TEXT NOT NULL CHECK(kind IN ('template','program')), revision INTEGER NOT NULL, document_json TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`.
- `auth_sessions(token_hash TEXT PRIMARY KEY, expires_at INTEGER NOT NULL)`.
- `login_attempts(bucket TEXT PRIMARY KEY, failures INTEGER NOT NULL, window_start INTEGER NOT NULL)`.

Use a local file database for development/tests, Turso remotely in production; never rely on Vercel ephemeral files. Explicit versioned migration command, not schema writes on each API request. Secrets and database files stay outside published static assets.

One API router at `api/index.js`, with internal modules under `server/`. Rewrite `/api/:path*` to the router, preserving the requested path; verify routing under `vercel dev` before deployment. Use parameterized SQL. Domain errors return 400, missing records 404, revision conflicts 409, unavailable storage 503; never expose SQL/secrets. JSON error envelope: `{ error: { code, message } }`.

Endpoints:
- `POST /api/auth/login {password}`; `GET /api/auth/session`; `POST /api/auth/logout`.
- `GET /api/documents?kind=template|program` → `{records: [{id,kind,name,revision,createdAt,updatedAt}]}`.
- `GET /api/documents/:id` → `{record}`.
- `POST /api/documents {id,kind,document}` → `{record}`, revision 1. Client-generated ID makes retries detectable; identical existing content returns the existing record, different content at that ID returns 409.
- `PUT /api/documents/:id {revision,document}` → `{record}` using `UPDATE ... WHERE id=? AND revision=?`, incrementing revision atomically. A retry whose revision is one behind and whose content exactly matches stored canonical content returns the current record; otherwise stale edits return 409.
- `DELETE /api/documents/:id {revision}` → 204, conditional on revision; deleting an already missing record is idempotent.

Mutation validation is server-side as well as client-side. Canonicalize known fields; reject malformed input before writes. Request size maximum 1 MiB with a clear error, matching import checks. A whole program save/import is one document update and cannot partially apply. Runtime state uses per-record queues, not a whole-library overwrite.

## Authentication and deployment boundaries

One password, no users/accounts/registration/recovery UI. Configure `APP_PASSWORD_HASH` as a salted Node scrypt hash (generated by a local script) and `AUTH_SECRET` for session-token hashing. Verify with timing-safe comparison; never send secrets to the frontend. Login issues a cryptographically random opaque token in a host-only `HttpOnly; Secure; SameSite=Strict; Path=/` cookie (Secure disabled only for local HTTP), expires after 30 days. Store only token HMAC/hash in SQLite, delete on logout, enforce expiry on every request. Changing the password requires documented session revocation.

Require authentication on every data endpoint, return `Cache-Control: no-store` on all API responses and reject cross-origin mutations using exact Origin checks. Login accepts JSON only and is rate limited in SQLite by platform-provided client IP: five failed attempts per 15 minutes, then 429; no in-memory limiter. Clear successful bucket and prune expired rows. Logout clears cookie even when session has expired. A 401 pauses autosave and asks for login while retaining in-memory unsaved edits.

Publish only `index.html`, `style.css` and browser `src/` assets as static output using a small Node build script; never serve `server/`, migration scripts, `.env`, tests or local databases. API bundles may import server/shared source separately. Production and preview use different databases and secrets. No cross-device live subscription: reload/reopen fetches current server content; revision conflicts prevent silent overwrites.

## Autosave and recovery

Debounce input saves by 400 ms; update UI/volume immediately. One in-flight save per record, coalesce later changes, keep pending changes on failures, and only show `Saved` once the newest local generation is acknowledged. Show `Saving…`, `Saved`, or `Couldn’t save` plus Retry. Flush pending saves on in-app navigation/logout, block discard unless explicitly confirmed, and warn on browser unload while dirty. Keep application queues alive during record switching. Autosave is not an offline guarantee; a browser forcibly closed before acknowledgement may lose pending edits. Do not introduce localStorage/IndexedDB as another application data store.

On 409 stop that record's queue, keep local edits visible, offer `Reload saved version` (confirm discard) or `Save as copy` with a fresh record ID. Never retry stale data over a newer revision automatically. Avoid stale list/detail responses overwriting dirty state. Re-login resumes by checking the server revision before retrying. Delete waits for/cancels that record's queue before the conditional delete; no late write resurrects it.

## Portable JSON

New format version 2:
```
{ "version": 2, "kind": "template", "template": { "name": "Upper A", "exercises": [], "goals": {} } }
{ "version": 2, "kind": "program", "program": { "name": "Week A", "mode": "simple", "goals": {},
  "workouts": [{ "name": "Upper A", "day": null, "exercises": [], "goals": {} }] } }
```
Array order preserves sequence/day order; mode and assignments round-trip even in simple mode. Do not export record IDs, revisions, timestamps or occurrence IDs. Import assigns fresh IDs. Compare round trips by portable domain content, excluding generated identities.

Legacy version 1 session imports become `Imported session template` in the library. Keep the existing parser and legacy validation unchanged; unsupported legacy versions/muscles still reject. New exports are always version 2, indented with two spaces. Filenames use local date: `gym-session-template-YYYY-MM-DD.json` and `gym-program-YYYY-MM-DD.json`.

Library import creates a new record; it never overwrites the library. Import inside a template/workout editor replaces that document's content after confirmation if it has content; it accepts only template files, preserves a program occurrence's ID/day, and uses the imported name. Import inside a program editor replaces the program after confirmation. Wrong file kinds explain where to import them. Validate the whole file before prompting or mutating; no partial writes. Imported exercises start collapsed. Empty exercise lists/programs export if names/goals are valid. Invalid export navigates to and expands/focuses the first invalid workout/field, naming both workout and exercise where relevant. Blank top-level names focus the name first.

## Verification and release

Keep `node --test` and existing tests. Add pure model/weekly/format tests, local-SQLite repository and authenticated HTTP integration tests, deterministic fake-time autosave tests, and a focused Playwright smoke suite for cross-device contexts and retained exercise interactions. Browser tooling is development-only. No ORM, frontend framework or generic state library.

Deploy only after migrations, preview smoke tests, authentication checks and cross-browser persistence checks pass. Keep production/preview storage isolated and document backup/restore before migration; rollback code must not remove saved documents. No automatic production deployment is authorized by the planning request.

## Sources checked

- Vercel SQLite limitations: https://vercel.com/kb/guide/is-sqlite-supported-in-vercel
- Turso integration and server-side environment variables: https://vercel.com/marketplace/tursocloud
- Plain Node.js functions: https://vercel.com/docs/functions/runtimes/node-js
- libSQL client local/remote databases and transactions: https://tursodatabase.github.io/libsql-client-ts/interfaces/Client.html

## Scope exclusions

Multiple users, collaborative/live sync, recurring calendar dates, workout logging, exercise presets, offline editing, template-copy synchronization, weekly heatmap recommendations and whole-library backup UI. Built-in database backup/restore instructions remain an operational release requirement.
