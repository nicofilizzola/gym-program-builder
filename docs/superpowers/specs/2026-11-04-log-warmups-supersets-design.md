# Logging warm-ups and supersets — design (2026-11-04)

Approved in the 2026-11-04 brainstorming session. Extends the workout tracker (docs/superpowers/specs/2026-11-03-workout-tracker-design.md) so logs started from templates keep the template's warm-up sets and superset pairs (docs/superpowers/specs/2026-11-03-warmups-supersets-training-profile-design.md). These requirements supersede the tracker design's "warm-up flags, supersets" out-of-scope line and its §3 data model and Finish rules where they conflict.

## Intent

- Starting a workout from a template with warm-ups or supersets produces a log that mirrors how the session is actually performed: warm-up rows before working rows, paired exercises together with their rests.
- Warm-ups are recorded (weight, reps, RIR) but never pollute progress comparisons: Last time, working placeholders and history set counts use working sets only, matching the volume rule that warm-ups never count.
- Supersets get a guided flow: checking off a set moves focus to the partner's next set.

Out of scope: rest timer; switching a row between warm-up and working; pairing exercises while logging (including blank workouts); warm-ups in volume, analytics or the AI review; new SQL migrations.

## 1. Data model (log version 2)

Changes to `WorkoutLog` (`src/workout-log.js`, `log_json`):

| Field | Rule |
|---|---|
| `logVersion` | `2` for every new or saved log. |
| `exercises[].sets[].kind` | `'warmup'` or `'working'`. Within an exercise all warm-up sets precede all working sets. |
| `exercises[].superset` | Optional `{restBetweenSeconds, restAfterRoundSeconds}` (0–120 by 15; 0–300 by 15) on the first of exactly two consecutive exercises; same invariant and messages as templates (`Exercise N: Invalid superset.`), reusing the shared limits/helpers. |
| `exercises[].target.warmupSets` | Integer 0–5 when `target` is not null (template's `warmupSets`). |

- The 20-set cap per exercise counts both kinds.
- **Version 1 compatibility:** `validateWorkoutLog` accepts `logVersion: 1` (sets without `kind`, targets without `warmupSets`, no `superset`) and returns a canonical version 2 log (every set `kind:'working'`, `target.warmupSets: 0`). Stored version 1 logs, an active log in the device mirror (`gpb.activeWorkout`) and queued sync snapshots therefore keep working and are upgraded on their next save. No migration.
- Finished-log rules: every remaining set is done (both kinds) and every exercise has at least one working set.

## 2. Starting a workout

`createWorkoutLog` from a template (program occurrence or library template):

- Each exercise gets `warmupSets` empty `warmup` rows followed by `sets` empty `working` rows.
- `target` = `{sets, warmupSets, repRange, restSeconds}`.
- A template pair (first member's `superset`) is copied onto the first log exercise of the pair with both rests.
- Blank workouts and added exercises have no warm-ups, no target and no pair.

## 3. Logger UI

Follow docs/design-system/README.md (Feature design and review checklist) and the tracker's mobile-first layout.

- **Warm-up rows:** the set column shows `W1`, `W2`… (working rows keep `1`, `2`… numbered among working sets only). Warm-up rows use a muted label style; fields, ✓, remove and keyboard behaviour are identical to working rows. Accessible names include the kind (e.g. `Warm-up set 1 reps, Bench press`; `Set 1 reps, Bench press`).
- **Add warm-up:** a secondary action beside **Add set** (`Add warm-up, {exercise}`), inserting an empty warm-up after the last warm-up. Disabled at the 20-set cap. Uses the existing set-row insert motion (200ms collapse pattern; instant with reduced motion). In a finished log it adds a done row like Add set does.
- **Superset frame:** the two member cards render inside one frame with the editor's accent rail. The frame header shows `Superset · {between} between · {after} after round` (formatDuration) and icon actions **Reorder superset** (drag, keyboard ↑/↓, Reorder menu; the pair moves as one block, nothing drops between members) and **Unlink superset**. Member cards are labelled `A1`/`A2` before their names and hide their own Reorder action. Unlink/removal use the editor's frame motion pattern (200ms, closing completes before removal, rapid reversal safe, instant with reduced motion); initial render, resume and reorder show the final state.
- **Swap** on a member keeps the pair (the marker stays on the first position). **Remove** of a member dissolves the pair. **Add exercise** always appends an unpaired exercise.
- **Guided focus:** when a *working* set of a paired exercise is checked (✓ turning done) in an active log, focus moves to the partner's first not-done working set; if the partner has none, to this exercise's next not-done working set; if neither exists, focus stays. The target row scrolls into view (`block:'nearest'`, no smooth scroll). Warm-up ✓, unchecking, finished-log editing and unpaired exercises keep current focus behaviour. Focus moves never steal from a field the user is typing in (only triggered by the ✓ activation).
- Finished and read-only logs show W rows and the superset frame without editing actions.

## 4. Last time, placeholders and history

- `GET /api/workouts/last` returns each set with `kind` (`'working'` for version 1 logs). The client shows **Last time** as the done *working* sets only (existing format). An exercise whose last log has no working sets shows `No history`.
- **Working placeholders:** unchanged rule applied to working sets only (same-numbered working set last time, then the previous working row, then `target.repRange.min` for reps).
- **Warm-up placeholders:** same-numbered warm-up last time, else the previous warm-up row's values (weight, reps, RIR); never from the target.
- **History** `doneSets` (summary) counts done working sets only.

## 5. Finish

- The warning counts not-done *working* sets only (`{n} sets not completed — finish anyway? Uncompleted sets will be removed.`); with only warm-ups unchecked, Finish proceeds without a dialog.
- On finish, all not-done sets (both kinds) are removed, then exercises without a done working set (including exercises left with only warm-ups).
- Finished-log editing: removing the last working set of an exercise removes the exercise (with its warm-ups) after the existing last-set confirmation.
- If no done working set remains, Finish is refused: `Log at least one working set, or discard the workout.`
- Removing a member during finish pruning dissolves its pair (the remaining exercise is unpaired).

## 6. Sync, server and validation

- Shared validation (client and server) as in §1; the server keeps strict validation and the 256 KiB limit; the variant index and Last time query are unchanged except for returning `kind`.
- Mirror/sync/conflict behaviour is unchanged; version 1 snapshots in the mirror or queue validate and upgrade.

## Verification

`npm test`, `npm run test:e2e`, `npm run build`. Unit: v1→v2 upgrade, kind ordering, superset invariant on logs, createWorkoutLog with warm-ups/pairs, add-warm-up/remove/swap/reorder/unlink transforms, placeholders per kind, Last time filtering, doneSets, finish rules and warning count, guided-focus target selection (pure). Server: Last time returns kind; v1 stored logs. E2E (phone 390×844 touch and 1366×768): start from a template with warm-ups and a pair; W rows and labels; Add warm-up; ✓ guidance A1→A2→A1; unlink and block reorder; swap keeps the pair; finish with unchecked warm-ups (no dialog) and with unchecked working sets (dialog); Last time ignores warm-ups; a version 1 active log in the mirror resumes; reduced motion. Record results in docs/superpowers/verification/2026-11-04-log-warmups-supersets.md. Never claim a pending deployment was verified.
