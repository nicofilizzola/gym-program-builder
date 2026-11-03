# Workout tracker V1 — design (2026-11-03)

Approved in the 2026-11-03 brainstorming session. These requirements supersede, for workout logging only, the following AGENTS.md rules: "workout logging" and "calendar dates/history" in the programs-and-persistence out-of-scope list; "no browser persistence mirror" (the active workout only, see §5); "offline editing" out of scope (the active workout only); and requirement 14 "sliders for numbers" (logging inputs only, see §4). Planning UI rules are unchanged.

## 1. Purpose and success

A mobile-first tracker for logging performed workouts. Primary goals, in order:

1. **Progressive overload at the gym:** while logging, every catalog exercise shows what was done last time, so the user knows what to beat.
2. **Reliable training record:** finished workouts form an accurate, editable history.

Planned-versus-actual adherence and analytics are not V1 goals, but the stored log must keep enough data (stable IDs, catalog links, muscle snapshot, timestamps, schema version) to support per-exercise history, charts and volume analytics later without data loss.

Success: the user can start a workout from a program occurrence, a session template or blank; log weight, reps and optional RIR per set with one tap per set when repeating last time; swap, add, remove and reorder exercises; keep logging through a dead connection or a reload without losing a set; finish; and later review, correct or delete the workout.

## 2. Principles

- Single user, behind the existing password, on the existing vanilla JS, SQLite/Turso and Vercel Node API stack. No new dependencies.
- A log is a **snapshot**. Starting from a template or program only seeds it. Logging never writes back to templates, programs or the catalog. Later template, program or catalog edits never rewrite logs.
- Logs are never exported, never imported, and are not included in program volume or the AI review.
- Units are kilograms only.

## 3. Data model

### WorkoutLog (`log_json`)

```
id            client-generated UUID
logVersion    1
status        'active' | 'finished'
name          string, 1–120 characters; template name or "Workout" for blank; editable
startedAt     ISO 8601 with UTC offset; set on Start; editable once finished
finishedAt    ISO 8601 with UTC offset; null while active; set on Finish; editable once finished
source        { kind:'program', programId, occurrenceId, templateId, programName, templateName }
            | { kind:'template', templateId, templateName }
            | { kind:'blank' }
exercises[]   ordered, at most 40
  id                         stable within the log
  variantId, referenceId     catalog links; both null for unlinked legacy exercises
  name, equipment            snapshot (equipment null when unknown)
  primaryMuscles, secondaryMuscles   snapshot, MuscleGroup values
  target                     { sets, repRange:{min,max}, restSeconds } from the template, or null
  sets[]                     ordered, at most 20 (an active log's exercise may have 0 sets)
    id, weightKg, reps, rir, done
```

### Rules

- `weightKg`: null or a multiple of 0.25 from 0 to 999.75. Null or 0 means bodyweight; a positive value on a bodyweight exercise is added load.
- `reps`: null or a whole number from 1 to 100. `rir`: null or a whole number from 0 to 5.
- A set with `done: true` must have `reps`. Its weight and RIR may be null.
- A finished log has `finishedAt > startedAt`, at least one exercise, every exercise has at least one set, and every set is done.
- An active log has `finishedAt: null`. At most one active log exists (database-enforced).
- Name snapshots in `source` are display fallbacks when the program or template no longer exists. The IDs are kept as plain values, never foreign keys.
- Validation lives in one pure module shared by client and server. The server validates strictly on every write and rejects the whole request on any violation.
- Request body limit: 256 KiB.

### Storage (migration 008)

- `workout_logs(id TEXT PRIMARY KEY, revision INTEGER NOT NULL, status TEXT NOT NULL CHECK(status IN ('active','finished')), started_at TEXT NOT NULL, finished_at TEXT, log_json TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`.
- A unique partial index on `status` where `status='active'` enforces a single active log.
- `workout_log_variants(log_id TEXT NOT NULL REFERENCES workout_logs(id) ON DELETE CASCADE, variant_id TEXT NOT NULL, finished_at TEXT NOT NULL, PRIMARY KEY(log_id, variant_id))` with an index on `(variant_id, finished_at DESC)`. It holds rows only for finished logs and is rebuilt for the log in the same transaction as every save or delete.
- Run migration 008 explicitly per environment, never during builds or requests (docs/operations/workout-tracker-rollout.md).

### Last time

For a variant, "last time" is the done sets of that variant's **first** occurrence in the most recent finished log (by `finishedAt`) that contains it, excluding the log being edited. It is shown as `80×8 @2 · 80×7 · 77.5×8`: a positive weight is shown as its number, a null or 0 weight as `BW` (for example `BW×10`), and `@n` appears only when RIR is set. Exercises with no match show `No history`; unlinked exercises show `No history` and offer Swap.

## 4. Screens and flows

### Routes and navigation

- `#/workouts`: **History**. A "Workouts" link is added to the main navigation after Exercise catalog.
- `#/workouts/:id`: **Logger** for both the active log and finished logs. An unknown ID shows the existing not-found view.
- **Active workout bar:** while a log is active (on the server, or in the local mirror), every route except its own logger shows a slim bar fixed to the bottom of the viewport with `Workout in progress · {name} · {elapsed}` and a labeled **Resume** link. Page content reserves its height so nothing is covered.

### Start points

- **Program:** every program workout card gets a **Start workout** icon action (accessible name `Start workout {session name}`, shared tooltip), in the card's existing action group. The program-workout page (`#/programs/:id/workouts/:occurrenceId`) gets a labeled **Start workout** button in its toolbar. Source: `program`.
- **Template:** library template cards get a Start workout icon action; the template editor toolbar gets a labeled **Start workout** button. Source: `template`.
- **Blank:** a labeled **Start blank workout** button at the top of History. Source: `blank`, with no exercises.
- Starting uses the template's current in-memory state, including unsaved edits. Each template exercise becomes a log exercise with its catalog links, name, equipment and muscles snapshot, `target` from its sets, rep range and rest, and `target.sets` empty set rows.
- Starting while a log is active opens a confirm dialog: **Resume current** (navigates to it), **Finish current** (runs Finish, then starts the new log once it succeeds) or **Discard current** (confirms, deletes it, then starts the new log). Cancel changes nothing.
- After starting, the app navigates to the new log's logger.

### Logger (active)

- **Sticky header:** editable name, live elapsed time computed from `startedAt` (never stored, updates each minute and on resume), the sync status (§5), and a labeled **Finish** button. An overflow menu holds **Discard workout**, which asks for confirmation, deletes the log, clears the mirror and returns to History.
- **Exercise card:** name, equipment, then a **Last time** line (§3). Set rows in a compact grid: set number, kg, reps, RIR, a done toggle (✓), and a remove-set icon button. Below the rows, a labeled **Add set** button.
- **Placeholders:** each empty kg/reps field shows a greyed placeholder from the same-numbered set of last time, else from the last set of last time, else (reps only) from `target.repRange.min`. RIR placeholders come from last time only. Tapping ✓ on a row fills empty fields from their placeholders, then marks the row done; the row needs reps (typed or placeholder) to become done, otherwise focus moves to its reps field and an inline message reads `Enter reps`. Tapping ✓ on a done row marks it not done and keeps its values. Editing a done row's values keeps it done.
- **Inputs:** weight is a text input with `inputmode="decimal"`, reps with `inputmode="numeric"`, each with compact −/+ steppers (2.5 kg, 1 rep) clamped to the limits. Values that do not fit the rules (for example 82.3 kg) show an inline error and are not stored until fixed. RIR is a compact segmented control 0–5 that can be cleared. Every value change applies immediately.
- **Add set:** appends a row whose placeholders copy the previous row's values (or its placeholders when empty).
- **Exercise actions:** an icon action group per card with **Swap exercise**, **Reorder** (the existing Reorder menu pattern plus pointer dragging via the existing sortable) and **Remove exercise**. Removing an exercise that has done sets asks for confirmation.
- **Swap** opens the existing catalog autocomplete inline in the card (active, configured variants only; Create variant available). Choosing a variant replaces `variantId`, `referenceId`, name, equipment and muscles, sets `target` to null, keeps the set rows and their values, and refreshes Last time.
- **Add exercise:** a labeled button below the last card opens the same autocomplete; the new exercise has one empty set and no target.
- **Finish:** if any set is not done, a confirm dialog reads `{n} sets not completed — finish anyway? Uncompleted sets will be removed.` On confirm (or when every set is done), not-done sets are removed, then exercises without sets, `finishedAt` is set to now and status to `finished`. If no done set remains, Finish is refused with the message `Log at least one set, or discard the workout.` After finishing, the app navigates to History.

### Logger (finished)

- Same layout without the live timer, Finish, done toggles or Discard. The header shows editable **Date**, **Start time** and **End time** (native date/time inputs; end must be after start) and the computed duration. The overflow menu holds **Delete workout** (confirmation; returns to History).
- Editing, swapping, adding, removing and reordering work as on an active log. Every set must remain complete: a new or edited row with no reps shows `Enter reps` and the log is not saved until it is fixed or removed. Removing the last set removes the exercise after confirmation; removing the last exercise is refused (Delete the workout instead).
- Edits autosave online through the existing autosave behavior: header save status, Retry on failure, Reload saved version on conflict.

### History

- Newest first by `startedAt`, grouped under local-date headings. Each row is a link to the logger showing the name, source (program and template names, template name, or `Blank`), start time, duration and number of done sets.
- A local, not-yet-synced log (§5) appears at the top with a `Not synced yet` label.
- Loads 30 summaries at a time with a **Load more** button. The empty state reads `No workouts yet. Start one from a program, a session template or here.`

### Layout, motion and accessibility

- Mobile first: one column at every width; above 761px the logger and History are capped at 40rem and centered. Touch targets follow the design system's pointer-aware 32px/44px rule; set-row inputs and toggles are 44px on touch.
- Adding/removing an exercise or set uses the existing 200ms ease-out height-and-fade collapse pattern, completing before node removal and reversible mid-transition. Toggling a set done transitions the row's background and text color over 150ms. Dialogs reuse `dialog-motion`. The active workout bar slides in/out over 180ms. Typing, steppers and data refreshes are immediate. Nothing animates on initial render. With `prefers-reduced-motion: reduce` everything is instant.
- Every input has a visible or accessible label including the set number and exercise (for example `Set 2 weight, Bench press`). The done toggle is a button with `aria-pressed`. Status changes are announced through the existing polite live region.
- Follow docs/design-system/README.md and its Feature design and review checklist; update it in the same change for any new tokens or components.

## 5. Sync and offline

### Active log: local first

- A `workout-sync` module wraps the existing `createAutosave` for the active log only.
- **Mirror:** every change is written synchronously to `localStorage` key `gpb.activeWorkout` as `{ log, baseRevision, dirty, lastTime }` before autosave is scheduled. It is cleared when the server acknowledges a snapshot matching the latest local change and the log is finished, or when the log is discarded. Every storage access is wrapped in try/catch; if storage is unavailable, logging continues online and the status reads `Not saved on this device`.
- **Start offline:** the log is created locally with `revision: 0`; the first PUT creates it on the server. Replaying the same envelope is idempotent: a PUT at revision 0 for an existing log whose stored document equals the request returns the stored record instead of a conflict.
- **Network failures** (no response or 5xx) retry automatically with backoff 2s, 4s, 8s, 16s, then every 30s, and immediately on the browser `online` event; the status reads `Offline · saved on this device`. **401** reads `Sign in to sync` and keeps the mirror; syncing resumes after login. **409** opens the conflict dialog.
- **Last time** is fetched once at start for every linked variant (`GET /api/workouts/last`) and after each swap/add, and stored in the mirror. When unavailable offline, the line reads `Last time unavailable offline` and placeholders fall back to targets.
- **Finish offline** is a queued snapshot like any other edit. History shows the local log as `Not synced yet` until it syncs.
- **Boot:** if a dirty mirror exists, the app loads the server's copy of that log (when reachable). If the server has no copy and `baseRevision` is 0, or its revision equals `baseRevision`, the mirror wins and sync resumes automatically. If the server's revision is newer, it is a conflict. If the server is unreachable, the mirror is used and sync retries.
- **Conflict dialog:** **Keep this device's version** (saves the local log over the server's current revision) or **Use saved version** (confirms, then replaces the local log with the server's). Local data is never discarded without one of these explicit choices.
- **Another device:** `GET /api/workouts/active` drives the active workout bar, so a log started on one device can be resumed online on another. Starting a second log is rejected by the server with a distinct `active_exists` 409, which the client turns into the Resume/Finish/Discard dialog.

### Finished logs

Edited online through plain `createAutosave` with the existing Retry and Reload saved version behavior. No local mirror.

### API (Node, behind existing auth)

- `GET /api/workouts?before={startedAt}&limit=30`: history summaries (`id, name, source, startedAt, finishedAt, doneSets`), finished logs only.
- `GET /api/workouts/active`: the active log record or `null`.
- `GET /api/workouts/:id`: `{ id, revision, log }`.
- `PUT /api/workouts/:id` with `{ revision, log }`: creates (revision 0) or updates with a revision check; validates strictly; rewrites `workout_log_variants` in the same transaction; returns the new record. 409 on a stale revision (`revision_conflict`) or a second active log (`active_exists`).
- `DELETE /api/workouts/:id?revision=n`: deletes with a revision check (cascades to the variant index).
- `GET /api/workouts/last?variantIds=a,b,…&exclude={logId}`: at most 40 IDs; returns `{ [variantId]: { logId, finishedAt, sets:[{weightKg,reps,rir}] } }`.

## 6. Edge cases

- Deleted program or template: history and the logger show the snapshot names as plain text without links.
- Archived variant: stays in logs and keeps feeding Last time; excluded from Swap/Add like other new selections.
- Variant moved to another reference: Last time still matches by variant ID; logs keep their `referenceId` snapshot.
- Same variant twice in one log: Last time uses that log's first occurrence of it.
- Times are stored with their UTC offset and displayed in local time; History groups by the local date of `startedAt`.
- Logging out mid-workout keeps the mirror; syncing resumes after login.

## 7. Testing

- **Unit (`node:test`):** log validation (bounds, done-set rules, finished-log rules, limits); building a log from a program occurrence, a template and blank; swap/add/remove/reorder/add-set transforms; placeholder selection; done-toggle filling; Finish pruning and refusal; Last time formatting including bodyweight; boot recovery decisions (resume, conflict, server unreachable); backoff schedule; history grouping.
- **Server (temporary SQLite):** create and idempotent replay; revision conflicts; single active log and `active_exists`; variant index rebuild on save, finish and delete; Last time query (latest finished only, excludes the current log, first occurrence, done sets only); history pagination; auth; size limits; strict validation rejections; migration 008.
- **E2E (Playwright, phone viewport and 1366×768):** start from a program, a template and blank; log with placeholders and ✓; swap, add, remove and reorder exercises; offline logging with `context.setOffline`, reload and recovery, then sync on reconnect; Finish with the unchecked-sets warning; edit and delete a finished log; the active-exists dialog; a forced conflict; the active workout bar; reduced motion.
- **Manual review** per AGENTS.md: populated screens at phone widths (360–430px), tablet, 1366×768, 1440×900, 1920×1080, 200% text, touch and hybrid input, open/close and rapid toggles, keyboard and focus. Record results and gaps in docs/superpowers/verification/2026-11-03-workout-tracker.md. Never claim a pending deployment was verified.

## 8. Out of scope for V1 (flagged for later)

- Rest timer (auto-start from `restSeconds`, sticky countdown).
- Logged volume per muscle in a log's detail; per-exercise history.
- Charts, PRs, analytics, planned-versus-actual comparison.
- "Next workout" suggestion in Sequence programs.
- Backdating a new workout; writing log changes back to templates.
- Free-text exercises, lb units, warm-up flags, supersets, timed or unilateral sets, notes.
- Exporting logs; including logs in the AI review.
- A full offline app (service worker) and starting from data that is not loaded.
