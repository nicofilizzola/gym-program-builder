# Workout notes and best performance

Date: 2026-11-06. Product scope approved in conversation. This records the agreed scope; implementation status and actual checks are recorded in the corresponding plan and verification document.

## Intent and boundaries

Give the athlete somewhere to record context for the whole workout and a useful historical benchmark for each exercise while logging. Extend existing tracker flows and controls. Logs remain snapshots, separate from templates/programs/catalog, exports, AI review and volume/analytics. No PR celebrations, record dashboard, copying notes forward or changes to Last time placeholders.

## Workout note

- Each log has one optional top-level `note`, default `""`, limited to 2,000 UTF-16 code units through `WORKOUT_LIMITS.workoutNoteMax`. Accept missing notes in version 1 and version 2 records and normalize to empty; retain log version 2. Non-string values fail with `Invalid workout note.`; over-limit values fail with `Workout note must be at most 2,000 characters.` No SQL migration.
- Put the note immediately below the header metadata, outside the sticky header so long notes do not consume the logging viewport. Reuse the exercise-note Add note / textarea / saved-text pattern, typography and spacing; no additional card or toolbar. Names: `Add workout note`, `Workout note`, and `Edit workout note`. Saved text is visible and wraps.
- Add opens a focused, auto-growing two-row textarea; reopening places the caret at the end. Commit on input; trim only on blur, turning whitespace-only text into empty. Enter inserts a newline. Clearing returns to Add. No separate delete confirmation or save button.
- Active notes use the existing synchronous local mirror, autosave, backoff and conflict resolution. Finished notes use existing online autosave; read-only notes are plain text and absent when empty. Start every new workout with an empty note.
- Keep the focused control, selection and composition through input and save acknowledgements. Reuse the 200ms ease-out grid-height/fade collapse pattern for editor/saved/add transitions, making exiting content inert immediately and removing it after closing. Rapid reversal is safe; reduced motion is instant. Initial render, typing and acknowledgements never animate. Restore logical focus if a transition would otherwise remove it, without stealing a blur destination's focus.

## Best performance

- Compare completed working sets from every other finished workout for the exact `variantId`, including every repeated occurrence in a workout. Exclude the log being viewed in both active and finished views. Version 1 sets normalize to working sets. Exclude warm-ups, unchecked/incomplete sets and other variants; do not filter by source template/program, age, RIR, or historical prescribed range.
- Use the viewed exercise's inclusive `target.repRange` when present. Without a target range, allow all rep counts (1–100). Pick greatest weight, then greatest reps, then newest finish instant. Compare dates as instants across UTC offsets. Break otherwise identical cross-log ties deterministically by descending log ID.
- Blank/null and zero weight both rank as 0 and display `BW`; among qualifying BW sets, more reps wins. Do not infer body mass or assisted load. Numeric weights rank above BW.
- Best stays a historical benchmark: current set edits/checks never enter it. Last time continues supplying working/warm-up placeholders and its previous exercise note. Best does not display or copy historical notes.
- Add one muted text line in the existing history area, after Last time and its note and before the current exercise note: `Best (8–12 reps) · 100 kg × 10 · 2 Nov 2026`; without range: `Best · BW × 12 · 2 Nov 2026`. Use local calendar formatting with year (English short month), and a semantic `time` with the original timestamp. No new card, disclosure or link. Long labels and dates wrap.
- Empty: `Best (8–12 reps) · No qualifying performance` (or `Best · No qualifying performance`). Unknown/offline without cache: `Best unavailable offline`. Initial request without cached data: `Loading best…`. Non-network request failure without cache: `Best unavailable`; use existing error reporting. A null variant has no eligible history and shows the empty state without a request.
- Cached Best remains visible offline. Fetch fresh data on each logger open/reopen online, and for added/swapped variants; use cache immediately while refreshing. Fetch failure preserves existing cached data. Successful empty results clear obsolete records. Reopening after editing/deleting history reflects the new records. No background subscriptions or refresh on each keystroke.

## Technical approach

Keep the current `/api/workouts/last` contract intact. Add authenticated `GET /api/workouts/best?variantIds=...&exclude=...`, returning `{bestPerformance: {[variantId]: BestCandidate[]}}`. Missing IDs return an empty map; use the existing 40-ID bound, string validation and query conventions. Every requested ID has an array, including `[]` when history is empty.

`BestCandidate` is `{weightKg: number, reps: number, logId: string, finishedAt: string}`; normalize BW to numeric 0. Return the winner for each exact rep count, ascending by reps, at most 100 candidates per variant. Keeping one winner per rep count preserves the winner for any inclusive rep range, supports repeated variants with different targets, and avoids sending full history or notes. Rank only in a shared pure module. Use the existing finished-variant index and bounded log batches in a consistent read transaction; no schema/index migration or persisted records. Server work grows with eligible history, but neither response size nor retained aggregation grows with log count.

Add a separate `bestPerformance` field to the active mirror; do not mix it into `lastTime`. `null` means unknown, a missing variant key means not fetched, and `[]` means fetched with no record. Old mirrors default to null without losing dirty logs, revisions or notes. Keep cache and view loading/failure status outside the log document. Explicitly refresh this cache on each attachment even when Last time is already cached. Bound and discard stale async responses by log ownership, route lifetime and per-variant request order; a removed/swapped card must not receive another variant's result. Failed Best must not hide Last time or block the logger.

## Validation and release

Unit tests cover note boundaries/defaults/preservation and selection rules, including rep boundaries, BW, ties, repeated variants and date offsets. Repository/API tests cover all-history selection beyond the first history page, exclusion, auth, validation, edit/delete recomputation and bounded candidate output. Controller/sync tests cover old mirrors, independent failures, cache replacement and stale responses. Browser tests cover actual note focus/caret/autogrow/IME-safe patching, offline recovery/conflicts, finished/read-only behavior, Best refresh and unchanged placeholders.

Review populated screens at 360/390px, tablet, 1366×768, 1440×900, 1920×1080, 200% text and touch/hybrid input. Preserve existing 32px fine-pointer-only / 44px touch targets. Play normal/reduced motion and rapid reversal; record screenshots and checks actually performed. Run the complete unit suite, targeted tracker browser regression suite and build before shipping. Deploy server and client together; verify the actual target environment separately. No database migration. A rollback to code that does not preserve top-level notes can discard them on subsequent saves, so preserve new note data before a rollback and prefer a forward fix. Never claim a pending deployment was verified.
