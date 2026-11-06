# Workout Notes and Best Performance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking. Use superpowers:subagent-driven-development only if the user explicitly selects delegation.

**Goal:** Add workout-level notes and show each exercise's heaviest historical working set within its current rep range.

**Architecture:** Extend the existing version 2 log with an optional normalized workout note. Add a bounded historical-best endpoint and shared pure selection helpers, keeping Last time unchanged. Carry Best through a separate active-workout cache and render it in the existing history area.

**Tech Stack:** JavaScript ES modules, native DOM/CSS, Node 24, libSQL, node:test, Playwright; no new dependencies.

**Spec:** `docs/superpowers/specs/2026-11-06-workout-notes-best-performance-design.md` (read with this plan).

## Global Constraints

- Workout notes: 2,000 UTF-16 code units; missing defaults to `""`; retain log version 2; no SQL migration.
- Notes stay out of templates/programs/catalog, exports, AI review and volume/analytics, and are never copied forward.
- Best uses completed working sets of the exact variant in other finished logs, filtered by the current inclusive rep range; without a range, allow all rep counts (1–100).
- Rank by weight, reps, finish instant, then descending log ID; null/0 weight ranks as 0 and displays BW.
- Keep `/api/workouts/last`, its notes and all input placeholders unchanged.
- Motion: 200ms ease-out grid-height/fade for note state changes; reduced motion is instant; typing and acknowledgements never animate.
- Preserve 32px fine-pointer-only / 44px touch targets, focused controls, selection, composition, and dirty offline recovery.
- Never claim a pending deployment was verified.

## Review Focus

- A duplicated variant with different targets in one workout must get different qualifying Best values from the same cached candidates (Tasks 2, 5).
- Successful refresh after history deletion must replace a cached record with `[]`, rather than retain the previous winner (Tasks 3, 4, 5).
- A delayed response for a previous route/variant must not update the new logger or replace a newer cache entry (Tasks 4, 5).
- A finish/save acknowledgement arriving while the note is focused must preserve its text, caret and composition (Tasks 1, 4, 5).
- A legacy dirty mirror without Best or workout note must recover unsynced sets/notes without treating unknown history as empty history (Tasks 1, 4, 5).

## File map

- `src/workout-log.js`: note limit, initial value, canonical validation/defaulting; existing version upgrade path.
- `src/workout-edit.js`: immutable workout-note edit.
- New `src/workout-best.js`: bounded candidate reduction and range selection shared by server/client.
- `server/workout-repository.js`, `server/api.js`, `src/api-client.js`: indexed history lookup and endpoint/client contract.
- `src/workout-sync.js`, `src/workout-controller.js`: separate Best mirror/cache and owner-guarded refresh lifecycle.
- `src/app.js`: active/finished route data and handlers; keep independent history failures isolated.
- New `src/workout-note.js`: focused, reusable-in-place workout-note control lifecycle, leaving exercise/set note behavior alone.
- `src/workout-logger-view.js`, `style.css`: compact note host and Best line; keep the existing logger responsible for log edits.
- Existing `test/workout-*.test.js`, new `test/workout-best.test.js`, new `e2e/workout-best.spec.js`, existing note/offline browser specs: domain, integration and browser proof.
- Design system, AGENTS and verification doc: shipped contracts and evidence.

### Task 1: Store and preserve workout notes

**Files:** Modify `src/workout-log.js`, `src/workout-edit.js`, `test/workout-log.test.js`, `test/workout-edit.test.js`, `test/workout-repository.test.js`, `test/workout-api.test.js`.

**Interfaces:**
- Produces `WORKOUT_LIMITS.workoutNoteMax = 2000`, canonical `log.note: string`, and `setWorkoutNote(log, text) -> Log` (immutable, raw text until blur).
- Existing create/validate/upgrade/finish/save/recovery APIs retain their signatures.

- [x] **Step 1:** Add failing tests: `validateWorkoutLog({...valid, note:'a'.repeat(2000)}).log.note` equals the input; 2001 units yields `Workout note must be at most 2,000 characters.`; `note:null` yields `Invalid workout note.`; missing note in both supported versions becomes `''`. Include `😀`.repeat(1000) accepted and one extra unit rejected. Creation starts empty; immutable edit keeps raw whitespace/newlines and does not mutate its input. Finish/prune and unrelated exercise edits retain the workout note. API/repository round-trip it and reject invalid notes.
- [x] **Step 2:** Run `node --test test/workout-log.test.js test/workout-edit.test.js test/workout-repository.test.js test/workout-api.test.js`; confirm new assertions fail for missing note support.
- [x] **Step 3:** Implement the interfaces in the existing normalization and edit functions. Validate raw length before trimming, normalize only missing values, and include note in canonical output. Preserve existing byte limits and finish rules; update existing exact-object expectations to include canonical `note:''`.
- [x] **Step 4:** Repeat Step 2; expect all tests to pass, including old v1/v2 cases.
- [x] **Step 5:** Commit only this task's files with `feat: persist workout-level notes`.

### Task 2: Define historical Best selection as pure functions

**Files:** Create `src/workout-best.js`, `test/workout-best.test.js`.

**Interfaces:**
- `BestCandidate = {weightKg:number, reps:number, logId:string, finishedAt:string}`.
- `bestPerRep(candidates: BestCandidate[]) -> BestCandidate[]`: one winner per rep count, ascending reps, normalized numeric BW, no mutation.
- `selectBestPerformance(candidates: BestCandidate[], repRange: {min:number,max:number}|null = null) -> BestCandidate|null`.
- Inputs to these helpers are validated historical candidates; repository owns log/set eligibility. Both functions share one internal comparator: numeric weight descending, reps descending, parsed finish instant descending, log ID descending.

- [x] **Step 1:** Write failing tests named `range is inclusive`, `unranged allows 1 through 100`, `weight outranks reps`, `equal weights prefer reps then real finish instant then log id`, `BW prefers more reps`, `reduction preserves every possible range winner`, and `same candidates support different occurrence targets`. Assert 100×8 wins over 95×12 in 8–12 while 110×5 is excluded; 110×5 wins without range. Assert BW×12 beats BW×8; 0.25×8 beats BW×12. Prove `selectBestPerformance(all, range)` deep-equals selection from `bestPerRep(all)` for every min/max pair from 1–100 over a mixed fixture; reduced length is ≤100 and inputs remain unchanged.
- [x] **Step 2:** Run `node --test test/workout-best.test.js`; confirm failure because the module does not exist.
- [x] **Step 3:** Implement the interfaces and comparator; use a map keyed by reps for bounded reduction. Compare timestamps with `Date.parse`, never lexical offset strings. Return null for no qualifying candidate.
- [x] **Step 4:** Repeat Step 2; expect all assertions to pass.
- [x] **Step 5:** Commit with `feat: define range-aware historical best selection`.

### Task 3: Expose bounded Best history through the API

**Files:** Modify `server/workout-repository.js`, `server/api.js`, `src/api-client.js`, `test/workout-repository.test.js`, `test/workout-api.test.js`.

**Interfaces:**
- Consumes Task 2's `bestPerRep` and canonical log upgrade from Task 1.
- Repository `bestPerformance({variantIds:string[], exclude?:string}) -> Promise<Record<string,BestCandidate[]>>`.
- `GET /api/workouts/best?variantIds=v1,v2&exclude=current` -> `{bestPerformance:{v1:[...],v2:[]}}`.
- Client `api.bestPerformance({variantIds,exclude}) -> Promise<Record<string,BestCandidate[]>>`.

- [x] **Step 1:** Add failing repository tests covering active/current-log exclusion, unchecked/missing-reps/warm-up exclusion, old v1 working sets, all repeated occurrences, exact variant identity, and a winner older than 30 newer workouts. Assert candidate arrays contain only the four public fields, no notes/RIR, one candidate per rep count sorted ascending, `[]` for requested IDs with no records, and `{}` for zero IDs. Save an edited winner and delete it; assert subsequent calls recompute. Test empty arrays, invalid ID types, >40 IDs and duplicate IDs with the existing limit-before-dedup convention. Extend API tests for auth (401), non-GET (405), missing IDs (empty map), exclusion and >40 (400), plus unchanged `/last` responses. Match the existing repository validation error conventions.
- [x] **Step 2:** Run `node --test test/workout-repository.test.js test/workout-api.test.js`; confirm missing-method/endpoint failures.
- [x] **Step 3:** Implement the repository using a read transaction and 100-log keyset batches ordered by log ID. Select finished logs once each through `EXISTS` against `workout_log_variants`, restricted to requested IDs and excluding the viewed log. Upgrade each log and enumerate every matching exercise/set; accept only done working sets with non-null valid reps. Convert null weight to 0 and reduce incrementally with Task 2. Keep only one candidate per rep count across batches; close transaction in `finally`. Register reserved `best` before dynamic record-ID routing and expose the client method. Reuse `WORKOUT_LIMITS.lastTimeIds` as the common 40-ID bound without an unrelated rename.
- [x] **Step 4:** Repeat Step 2 and run `node --test test/workout-best.test.js`; expect passing results. Assert batched retrieval handles >100 logs, including duplicate occurrences, without returning duplicate candidates. Confirm this requires no migration.
- [x] **Step 5:** Commit with `feat: expose bounded workout best history`.

### Task 4: Carry Best through offline sync and route lifecycles

**Files:** Modify `src/workout-sync.js`, `src/workout-controller.js`, `src/app.js`, `test/workout-sync.test.js`, `test/workout-controller.test.js`.

**Interfaces:**
- Sync options/mirror/snapshot/current gain `bestPerformance: Record<string,BestCandidate[]>|null = null`; sync exposes `.bestPerformance` and `.setBestPerformance(map)`, mirroring Last time's cache setter without marking the log dirty.
- Controller attach handlers gain `setBestPerformance(map)` and `setBestStatus({variantIds,status})`; returned binding gains `onBestPerformanceNeeded(ids:string[]) -> Promise<void>`.
- Logger options gain `bestPerformance`, `onBestPerformanceNeeded`; public methods gain `setBestPerformance(map)` and `setBestStatus({variantIds,status:'loading'|'offline'|'error'|'ready'})` (implemented in Task 5).
- Cache missing/null = unknown; explicit variant `[]` = known empty. Merge partial maps by replacing each returned variant array, including empty arrays.

- [x] **Step 1:** Add failing tests for dirty old mirror recovery defaulting note/Best without losing reps/revision, mirror round-trip of cached candidates, cache writes preserving dirty state, and conflict Keep device / Use saved note behavior. Test cached mount with fresh fetch on every attach; independent Last time/Best failures; failed refresh retaining cached candidates; deletion refresh replacing candidates with `[]`; detached/replaced owner ignoring late replies; two out-of-order requests for the same variant preserving the latest result. Ensure Best refresh cannot trigger a log save.
- [x] **Step 2:** Run `node --test test/workout-sync.test.js test/workout-controller.test.js`; confirm new cache/lifecycle assertions fail.
- [x] **Step 3:** Implement cache fields at every ownership/recovery branch, including pending-finish ownership, conflict adoption, boot, start, snapshot and reattach. Fetch Best separately from Last time and without blocking logger mount; preserve Last time's behavior. On attach publish loading status only for uncached variants, then request all currently linked IDs even if cached. Guard by owner identity, attachment identity and per-variant request generation before merging; owner-valid results may update cache after detach but cannot patch a detached view. Handle network vs other errors independently, using existing reporting/auth paths, preserving cache and note edits. For finished routes mount immediately with unknown Best, then fetch; add the same route-lifetime and request-order guards. Do not await Best in `prepareRoute`. Wire add/swap refresh callback independently of Last time.
- [x] **Step 4:** Repeat Step 2; expect passing results. Include note editing during save acknowledgement to confirm canonical data cannot drop the field.
- [x] **Step 5:** Commit with `feat: cache workout best benchmarks for offline logging`.

### Task 5: Render workout notes and Best without disrupting logging

**Files:** Create `src/workout-note.js`, `e2e/workout-best.spec.js`; modify `src/workout-logger-view.js`, `style.css`, `e2e/workout-notes.spec.js`, `e2e/workout-offline.spec.js`. Reuse `e2e/workout-helper.js` fixtures.

**Interfaces:**
- `mountWorkoutNote(host, {note:string, readOnly:boolean, onInput:(text)=>void, onBlur:(trimmedText)=>void}) -> {update({note,readOnly}):void, destroy():void}`. Owns only editor view/focus/transition state; logger owns domain commits via Task 1.
- Implement Task 4's logger options and public setters; select Best with Task 2 against each current exercise target on render. Cache/status belongs to the view, never in `log`.

- [x] **Step 1:** Add failing browser tests for workout Add/open/newline/autogrow/blur-trim/reopen-caret/clear; exactly 2,000 units accepted; note survives reload, finish, online finished edit, offline reload/reconnect and both conflict choices. Test read-only plain text and hidden empty note, plus a fresh workout starts empty. Assert input DOM identity, selection and activeElement survive typing and save acknowledgement; dispatch composition events around acknowledgement and assert text/selection are retained. Exercise/set note tests must still pass.
- [x] **Step 2:** Add Best browser tests using saved historical fixture logs: 100×8 beats 95×12 in 8–12, 110×5 excluded, unbounded exercise shows 110×5, repeated variant with another range shows its own winner, BW formatting, date with year, no qualifying record, cached offline/unknown offline/loading/error, and no variant. Checking a new heavier current set does not change Best. Assert Last time inputs' placeholders and its note remain unchanged. Test successful refresh after deleting the record, failed refresh preserving cache, swap/add behavior and delayed responses after navigation/swap.
- [x] **Step 3:** Run `npx playwright test e2e/workout-notes.spec.js e2e/workout-best.spec.js e2e/workout-offline.spec.js`; confirm new feature assertions fail.
- [x] **Step 4:** Implement `mountWorkoutNote` using the existing note classes and 200ms collapsible behavior, with cancellation-safe closing/reopening and immediate inertness. Keep exercise/set note implementation intact; no broad note refactor. Mount directly below `.logger-header` and before exercise list. Use `maxLength`, accessible names and shared normalization. Patch values only when safe; preserve focused editor and composition during acknowledgements. Destroy event listeners, pending transitions and retained exiting nodes.
- [x] **Step 5:** Add a text-only Best row in each card's existing history area after Last time note. Render text with textContent and timestamp with `time.datetime`; format date locally with English short month/day/year. Implement exact spec copy and range labels. Select from cached candidates separately for each exercise. Cached data takes precedence over refresh errors; successful empty data shows the empty state. Use loading/offline/error only when no variant cache exists. No reveal animation on history response, typing, swap render or initial mount. Do not reorder or recreate focused set rows.
- [x] **Step 6:** Repeat Step 3; expect passing results. Run `npx playwright test e2e/workout-logger.spec.js e2e/workout-history-edit.spec.js e2e/workout-set-row.spec.js e2e/workout-warmups.spec.js e2e/workout-supersets.spec.js e2e/workout-final-fixes.spec.js e2e/mobile-navigation.spec.js` to check tracker/navigation regressions.
- [x] **Step 7:** Commit with `feat: show workout notes and historical best in tracker`.

### Task 6: Verify populated layouts, motion and the release candidate

**Files:** Modify `docs/design-system/README.md`, `AGENTS.md`; create `docs/superpowers/verification/2026-11-06-workout-notes-best-performance.md`; extend `e2e/workout-notes.spec.js` or `e2e/workout-best.spec.js` only for issues uncovered during acceptance checks.

**Interfaces:** Consumes the completed feature; produces a verification record with commands, actual results, screenshots, limitations and separate local/preview/production statuses.

- [x] **Step 1:** In a real browser inspect populated active and finished logs with long workout/exercise names, 2,000-character multiline notes, maximal numeric values, wrapped range/date labels, supersets and errors. Cover 360px and 390px touch, tablet, 1366×768, 1440×900, 1920×1080, 200% text and hybrid input. Assert no horizontal page overflow, reachable Finish/menu, preserved set-column alignment and 44px touch targets. Capture screenshots with paths in the verification record.
- [x] **Step 2:** With normal motion (Playwright defaults to reduced motion), open/close/reopen and clear notes rapidly; inspect that neighbors move smoothly and exiting nodes are inert. Check focus/caret after reopening and blur to another field, reduced-motion instant transitions, changing motion preference while closing, and mobile typing-bar behavior. Confirm long workout notes scroll away with the page. Fix acceptance defects and rerun only affected checks before final suite.
- [x] **Step 3:** Run `npm test`, the targeted browser commands from Task 5, and `npm run build`; record fresh exit codes/results. Run `git diff --check`; expect no whitespace errors. Inspect the final diff for accidental inclusion of Best in log documents, templates, exports or AI payloads. No paid AI evaluation is needed.
- [x] **Step 4:** Update design-system tracker documentation and add a dated AGENTS entry linking the spec/plan/verification. Record actual local verification and leave deployment checks explicitly pending until performed. Record that existing schema suffices and server/client release together; warn in operations evidence that old-version saves can drop new note data on rollback.
- [x] **Step 5:** Commit the verified acceptance changes with `docs: record workout notes and best performance verification`.

### Task 7: Ship and verify the actual environment

**Files:** Update `docs/superpowers/verification/2026-11-06-workout-notes-best-performance.md` with release evidence.

**Interfaces:** Consumes the verified release candidate; produces target deployment identity and verified environment-specific outcomes. Deployment requires the user's authorized target/release workflow at execution time; none was requested during this planning task.

- [ ] **Step 1:** Identify the intended environment and existing repository release workflow before deploying. Prepare the concrete reviewed change/PR with verification evidence. Do not run unrelated migrations or alter real training history to generate fixtures.
- [ ] **Step 2:** Release server/client together through the authorized workflow. Check authenticated `/api/workouts/best` returns bounded candidates and missing IDs are empty; unauthenticated access stays rejected. Confirm the deployed static assets include the new UI. Record deployment/version identity.
- [ ] **Step 3:** In that environment verify a workout note survives save/reload and finished-log edit, and Best correctly uses range/exclusion while Last time placeholders work. Use designated disposable data for offline/reconnect and historical edit/delete checks; remove only those fixtures after use. Record actual outcomes and any remaining production checks if only preview was tested.
- [ ] **Step 4:** If verification fails, preserve workout-note data and prefer a forward fix. Before any rollback, account for older code dropping `log.note` on save; do not promise a lossless rollback. Update the verification record and report the actual shipped status.

## Self-review and handoff

Before handing off, check spec coverage against Tasks 1–7, interface names/types across tasks, exact visible/accessibility copy, all five Review Focus cases, note preservation on every canonical/recovery path, and absence of unresolved product decisions. Keep implementation outside this planning task. Recommended execution: native, because these changes share log/controller/view interfaces and fit one implementer's context; delegation is optional only if explicitly selected by the user.

Execution status (2026-11-06): Tasks 1-6 implemented and locally verified; local integration into main completed by user choice, with 413 tests and build passing on the merged result. Task 7 deployment and environment verification remain pending; nothing was pushed. Final review found one stale Best error/auth race, fixed with RED-GREEN regression and a passing full 413-test suite. See the verification record for browser run details, including the isolated login timeout and passing rerun.
