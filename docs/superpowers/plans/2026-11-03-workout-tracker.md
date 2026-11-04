# Workout Tracker V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mobile-first workout logging started from a program occurrence, a session template or blank, with "last time" per catalog variant, local-first sync for the active workout, and an editable history.

**Architecture:** A workout log is one JSON snapshot document per workout (`workout_logs`), with a `workout_log_variants` side index for "last time" lookups, behind new `/api/workouts` routes. Pure modules (`workout-log`, `workout-edit`, `workout-sets`, `workout-sync` decisions) hold every rule and are shared by client and server. The browser keeps the active log in a synchronous `localStorage` mirror and syncs it through the existing `createAutosave` wrapped with automatic network retry; finished logs edit online through the app's existing `track()` autosave.

**Tech Stack:** Vanilla ES modules, native `<dialog>`/popover, `@libsql/client` (SQLite/Turso), Node 24 `node:test`, Playwright. No new dependencies.

**Spec:** docs/superpowers/specs/2026-11-03-workout-tracker-design.md

## Global Constraints

- Logs are snapshots: never written to templates, programs or catalog; never exported/imported; not in program volume or AI review.
- kg only. `weightKg`: null or multiple of 0.25 from 0 to 999.75 (null/0 = bodyweight). `reps`: null or integer 1–100. `rir`: null or integer 0–5. A done set needs reps.
- Name 1–120 characters. At most 40 exercises per log, 20 sets per exercise. Request body ≤ 256 KiB. `GET /api/workouts/last` takes at most 40 variant IDs. History pages hold 30 summaries.
- Exactly one active log, enforced by a unique partial index.
- Mirror key `gpb.activeWorkout`, value `{ log, baseRevision, dirty, lastTime }`; every storage access in try/catch.
- Backoff: 2s, 4s, 8s, 16s, then 30s; retry immediately on `online`.
- Status copy, verbatim: `Saving…`, `Saved`, `Offline · saved on this device`, `Sign in to sync`, `Conflict`, `Not saved on this device`.
- Other copy, verbatim: `No history`, `Last time unavailable offline`, `Enter reps`, `Log at least one set, or discard the workout.`, `{n} sets not completed — finish anyway? Uncompleted sets will be removed.`, `Not synced yet`, `No workouts yet. Start one from a program, a session template or here.`, `Workout in progress · {name} · {elapsed}`.
- Motion: add/remove exercise or set 200ms ease-out height+fade (existing collapse pattern, complete before removal, reversible); set done 150ms background/color; active workout bar 180ms slide; dialogs via `dialog-motion`; nothing on initial render; reduced motion = instant. No `transition: all`.
- Touch targets per design system (32px fine pointer / 44px touch); logger and History capped at 40rem and centered above 761px.
- Migration 008 runs only through `npm run db:migrate`, never in builds or requests.
- Verification: `npm test`, `npm run test:e2e`, `npm run build`. Never claim a pending deployment was verified.
- Follow `docs/design-system/README.md` and its Feature design and review checklist for every UI task.

## Review Focus

- **Comma decimal weights:** a phone keyboard in a comma locale types `82,5`; it must be accepted as 82.5 kg (Task 3 `parseWeight` test).
- **History order across UTC offsets:** logs started before and after a DST change or while travelling must sort by real time, not by ISO string with differing offsets (Task 4: columns store UTC-normalized timestamps; test included).
- **Workout crossing midnight:** editing a finished log to 23:30 → 00:40 must mean the next day, not an error (Task 2 `setWorkoutTimes` test).
- **Offline-started log meets another device's active log:** the first sync gets `active_exists`; the user must get an explicit choice, never a silent drop of either workout (Task 6 conflict classification test, Task 10 dialog e2e).
- **Storage full or blocked mid-workout:** `localStorage.setItem` throws; logging must continue online with `Not saved on this device`, never crash (Task 6 test with a throwing storage).

---

### Task 1: Workout log model and validation

**Files:**
- Create: `src/workout-log.js`
- Test: `test/workout-log.test.js`

**Interfaces:**
- Consumes: `MUSCLE_GROUPS` from `src/muscles.js`; `EQUIPMENT` from `src/catalog.js`.
- Produces:
  - `WORKOUT_LIMITS` frozen: `{weightMax:999.75, weightStep:0.25, repsMin:1, repsMax:100, rirMax:5, nameMax:120, exercises:40, sets:20, bytes:262144, lastTimeIds:40, historyPage:30}`
  - `toLocalIso(date: Date): string` — ISO 8601 with the local UTC offset, e.g. `2026-11-03T18:05:00.000+01:00`.
  - `validateWorkoutLog(value): {log} | {error: string}` — returns a canonical copy (known keys only, in spec order).
  - `createWorkoutLog({id, now: Date, makeId, template?: {id, document}, program?: {id, name}, occurrenceId?}): WorkoutLog`
  - `logExerciseFromEntry(entry, makeId): LogExercise` — from a catalog entry (`id, familyId, name, equipment, primaryMuscles, secondaryMuscles`): `target:null`, one empty set.
  - `workoutSummary(log): {id, name, source, startedAt, finishedAt, doneSets}`

- [ ] **Step 1: Write the failing tests**

```js
test('createWorkoutLog seeds a program occurrence snapshot',()=>{
 let n=0;const makeId=()=>'id'+(++n);
 const template={id:'t1',document:{name:'Push A',exercises:[{name:'Bench press',sets:3,repRange:{min:6,max:10},restSeconds:180,primaryMuscles:['Chest'],secondaryMuscles:['Triceps'],catalogId:'v1',familyId:'r1',catalogRevision:2,equipment:'Barbell'},{name:'Old curl',sets:2,repRange:{min:10,max:12},restSeconds:90,primaryMuscles:['Biceps'],secondaryMuscles:[]}]}};
 const log=createWorkoutLog({id:'log1',now:new Date('2026-11-03T17:00:00Z'),makeId,template,program:{id:'p1',name:'PPL'},occurrenceId:'o1'});
 assert.equal(log.logVersion,1);assert.equal(log.status,'active');assert.equal(log.name,'Push A');assert.equal(log.finishedAt,null);
 assert.deepEqual(log.source,{kind:'program',programId:'p1',occurrenceId:'o1',templateId:'t1',programName:'PPL',templateName:'Push A'});
 assert.deepEqual(log.exercises[0].target,{sets:3,repRange:{min:6,max:10},restSeconds:180});
 assert.equal(log.exercises[0].variantId,'v1');assert.equal(log.exercises[0].referenceId,'r1');assert.equal(log.exercises[0].sets.length,3);
 assert.deepEqual(log.exercises[0].sets[0],{id:log.exercises[0].sets[0].id,weightKg:null,reps:null,rir:null,done:false});
 assert.equal(log.exercises[1].variantId,null);assert.equal(log.exercises[1].equipment,null);
 assert.ok(validateWorkoutLog(log).log);
});
test('createWorkoutLog handles template and blank sources',()=>{
 // template → {kind:'template',templateId,templateName}; no template → {kind:'blank'}, name 'Workout', exercises []
});
test('toLocalIso keeps the local offset',()=>{
 const text=toLocalIso(new Date('2026-11-03T17:00:00Z'));
 assert.match(text,/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}[+-]\d\d:\d\d$/);
 assert.equal(new Date(text).toISOString(),'2026-11-03T17:00:00.000Z');
});
test('validateWorkoutLog enforces set bounds',()=>{
 // for each invalid weight [-0.25, 1000, 82.3, '80'], reps [0, 101, 2.5], rir [-1, 6, 1.5]: result has error
 // valid: weightKg 0, 999.75, null; reps null when done:false; rir null
 // done:true with reps:null → error
});
test('validateWorkoutLog enforces structure and limits',()=>{
 // name '' or 121 chars → error; 41 exercises → error; 21 sets → error; unknown muscle → error;
 // status 'finished' requires finishedAt > startedAt, ≥1 exercise, ≥1 set each, all done;
 // status 'active' requires finishedAt null; an active exercise may have 0 sets; unknown keys are dropped
});
test('workoutSummary counts done sets',()=>{/* 2 done of 3 → doneSets 2; name/source/startedAt/finishedAt copied */});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test test/workout-log.test.js`
Expected: FAIL with `Cannot find module` for `src/workout-log.js`.

- [ ] **Step 3: Implement `src/workout-log.js`**

Template exercise mapping: `catalogId→variantId`, `familyId→referenceId`, `equipment` or null, muscles copied, `target={sets, repRange, restSeconds}`, `target.sets` empty sets. `startedAt=toLocalIso(now)`. Error strings name the location, e.g. `Exercise 2, set 3: Weight must be a multiple of 0.25 from 0 to 999.75 kg.`

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test test/workout-log.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/workout-log.js test/workout-log.test.js
git commit -m "feat: add workout log model and validation"
```

---

### Task 2: Log editing transforms and Finish

**Files:**
- Create: `src/workout-edit.js`
- Test: `test/workout-edit.test.js`

**Interfaces:**
- Consumes: `logExerciseFromEntry`, `toLocalIso`, `validateWorkoutLog` (Task 1).
- Produces (all pure; never mutate input):
  - `setLogName(log, text): log` — trims; empty → `'Workout'`; truncated to 120.
  - `addExercise(log, entry, makeId): log`
  - `swapExercise(log, exerciseId, entry): log` — replaces `variantId, referenceId, name, equipment, primaryMuscles, secondaryMuscles`; `target=null`; keeps `id` and `sets`.
  - `removeExercise(log, exerciseId): log`
  - `moveLogExercise(log, from, to): log`
  - `addSet(log, exerciseId, makeId, values = {}): log` — appends `{weightKg:null, reps:null, rir:null, done:false, ...values}`.
  - `removeSet(log, exerciseId, setId): log`
  - `updateSet(log, exerciseId, setId, patch): log`
  - `toggleSetDone(log, exerciseId, setId, placeholder): {log} | {error: 'Enter reps'}`
  - `undoneSetCount(log): number`
  - `finishWorkout(log, now: Date): {log} | {error}`
  - `setWorkoutTimes(log, {date, startTime, endTime}): {log} | {error}` — `date` `YYYY-MM-DD`, times `HH:MM`, local.

- [ ] **Step 1: Write the failing tests**

```js
test('swapExercise keeps sets and clears target',()=>{
 const next=swapExercise(log,'e1',{id:'v9',familyId:'r9',name:'Incline press',equipment:'Dumbbell',primaryMuscles:['Chest'],secondaryMuscles:['Front delts']});
 assert.equal(next.exercises[0].id,'e1');assert.equal(next.exercises[0].variantId,'v9');assert.equal(next.exercises[0].target,null);
 assert.deepEqual(next.exercises[0].sets,log.exercises[0].sets);assert.notEqual(next,log);
});
test('toggleSetDone fills empty fields from the placeholder and needs reps',()=>{
 // set {weightKg:null,reps:null,rir:null} + placeholder {weightKg:80,reps:8,rir:2} → done, values 80/8/2
 // typed weight 82.5 is kept over placeholder 80
 // placeholder {weightKg:80,reps:null,rir:null} and reps null → {error:'Enter reps'}
 // toggling a done set → done:false, values kept
});
test('finishWorkout prunes undone sets and empty exercises',()=>{
 // 2 exercises; e1 one done + one undone set; e2 only undone → result has e1 with 1 set, no e2,
 // status 'finished', finishedAt = toLocalIso(now); validateWorkoutLog(result.log).log truthy
 // all undone → {error:'Log at least one set, or discard the workout.'}
 assert.equal(undoneSetCount(log),3);
});
test('setWorkoutTimes treats an end before the start as the next day',()=>{
 const {log:next}=setWorkoutTimes(finished,{date:'2026-11-03',startTime:'23:30',endTime:'00:40'});
 assert.equal((new Date(next.finishedAt)-new Date(next.startedAt))/60000,70);
 assert.deepEqual(setWorkoutTimes(finished,{date:'2026-11-03',startTime:'10:00',endTime:'10:00'}),{error:'End time must be after the start time.'});
});
test('setLogName, add/remove/move exercise and add/remove/update set',()=>{
 // setLogName(log,'  ')→'Workout'; addExercise appends with one empty set and target null;
 // moveLogExercise(log,0,1) swaps order; addSet(log,'e1',makeId,{weightKg:80,reps:8,done:true}) appends that set;
 // removeSet / updateSet change only the addressed set; unknown ids return the log unchanged
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test test/workout-edit.test.js`
Expected: FAIL with `Cannot find module`.

- [ ] **Step 3: Implement `src/workout-edit.js`**

`setWorkoutTimes` builds local `Date`s from the parts, adds one day to the end when `endTime < startTime`, rejects equality, and writes both with `toLocalIso`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test test/workout-edit.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/workout-edit.js test/workout-edit.test.js
git commit -m "feat: add workout log editing transforms and finish"
```

---

### Task 3: Set inputs, placeholders and "last time" formatting

**Files:**
- Create: `src/workout-sets.js`
- Test: `test/workout-sets.test.js`

**Interfaces:**
- Consumes: `WORKOUT_LIMITS` (Task 1).
- Produces:
  - `formatLastTime(sets: {weightKg, reps, rir}[]): string`
  - `setPlaceholder(exercise, index, lastTimeSets | null): {weightKg, reps, rir}` — order: `lastTimeSets[index]`; else for `index > 0` the previous row's effective values (its typed values over its own placeholder, recursively), which reaches the last set of last time when the earlier rows are untouched; else `{weightKg:null, reps:target?.repRange.min ?? null, rir:null}`. RIR only ever comes from last time or a previous row's effective value.
  - `parseWeight(text): {value: number|null} | {error}`; `parseReps(text): {value: number|null} | {error}`
  - `stepWeight(value, placeholder, delta): number`; `stepReps(value, placeholder, delta): number` — start from `value ?? placeholder ?? 0`, clamp to limits.
  - `formatElapsed(ms): string` — `'0 min'`, `'32 min'`, `'1 h 05 min'`.

- [ ] **Step 1: Write the failing tests**

```js
test('formatLastTime shows weight × reps, bodyweight and RIR',()=>{
 assert.equal(formatLastTime([{weightKg:80,reps:8,rir:2},{weightKg:80,reps:7,rir:null},{weightKg:77.5,reps:8,rir:null}]),'80×8 @2 · 80×7 · 77.5×8');
 assert.equal(formatLastTime([{weightKg:null,reps:10,rir:null},{weightKg:0,reps:9,rir:1}]),'BW×10 · BW×9 @1');
 assert.equal(formatLastTime([]),'No history');
});
test('parseWeight accepts comma decimals and enforces steps',()=>{
 assert.deepEqual(parseWeight('82,5'),{value:82.5});assert.deepEqual(parseWeight(' 80 '),{value:80});
 assert.deepEqual(parseWeight(''),{value:null});
 for(const text of ['82.3','-5','1000','abc'])assert.ok(parseWeight(text).error);
 assert.deepEqual(parseReps('8'),{value:8});for(const text of ['0','101','8.5','x'])assert.ok(parseReps(text).error);
});
test('setPlaceholder prefers last time, then the previous row, then the target',()=>{
 // lastTime [{80,8,2},{80,7,null}]: index 0 → 80/8/2, index 1 → 80/7/null, index 2 → previous row effective (80/7/null)
 // previous row typed weight 85 at index 2 with no lastTime[2] → index 3 placeholder weight 85
 // no last time, target repRange {min:6,max:10}, index 0 → {weightKg:null,reps:6,rir:null}; target null → reps null
});
test('steppers clamp and start from the placeholder',()=>{
 assert.equal(stepWeight(null,80,2.5),82.5);assert.equal(stepWeight(1,null,-2.5),0);assert.equal(stepWeight(999,null,2.5),999.75);
 assert.equal(stepReps(null,8,1),9);assert.equal(stepReps(1,null,-1),1);assert.equal(stepReps(100,null,1),100);
});
test('formatElapsed',()=>{assert.equal(formatElapsed(0),'0 min');assert.equal(formatElapsed(32*60000),'32 min');assert.equal(formatElapsed(65*60000),'1 h 05 min');});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test test/workout-sets.test.js`
Expected: FAIL with `Cannot find module`.

- [ ] **Step 3: Implement `src/workout-sets.js`**

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test test/workout-sets.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/workout-sets.js test/workout-sets.test.js
git commit -m "feat: add set input parsing, placeholders and last-time formatting"
```

---

### Task 4: Migration 008 and workout repository

**Files:**
- Create: `migrations/008-workout-logs.sql`, `server/workout-repository.js`
- Modify: `server/db.js` (add `[8,'008-workout-logs.sql']` to the migration list)
- Test: `test/workout-repository.test.js`

**Interfaces:**
- Consumes: `validateWorkoutLog`, `workoutSummary`, `WORKOUT_LIMITS` (Task 1); `domainError` from `server/repository.js`.
- Produces `createWorkoutRepository(db, {now = () => new Date().toISOString()} = {})` with:
  - `list({before?, beforeId?, limit = 30}): {records: Summary[], hasMore: boolean}` — finished logs only, newest first by `(started_at, id)`.
  - `active(): Record | null`, `get(id): Record` (NOT_FOUND otherwise). `Record = {id, revision, log}`.
  - `save({id, revision, log}): Record`
  - `remove({id, revision}): void`
  - `lastTime({variantIds, exclude?}): {[variantId]: {logId, finishedAt, sets: {weightKg, reps, rir}[]}}`
  - Conflict errors are `domainError('CONFLICT', message)` with `details: {reason: 'revision_conflict' | 'active_exists'}`.

SQL (no semicolons inside statements; `migrate` splits on `;`):

```sql
CREATE TABLE workout_logs(id TEXT PRIMARY KEY,revision INTEGER NOT NULL,status TEXT NOT NULL CHECK(status IN ('active','finished')),started_at TEXT NOT NULL,finished_at TEXT,log_json TEXT NOT NULL,created_at TEXT NOT NULL,updated_at TEXT NOT NULL);
CREATE UNIQUE INDEX workout_logs_one_active ON workout_logs(status) WHERE status='active';
CREATE INDEX workout_logs_history ON workout_logs(status,started_at DESC,id DESC);
CREATE TABLE workout_log_variants(log_id TEXT NOT NULL,variant_id TEXT NOT NULL,finished_at TEXT NOT NULL,PRIMARY KEY(log_id,variant_id));
CREATE INDEX workout_log_variants_latest ON workout_log_variants(variant_id,finished_at DESC);
```

- [ ] **Step 1: Write the failing tests** (in-memory DB, `await migrate(db)`, like `test/profile.test.js`)

```js
test('save creates, updates and replays idempotently',async t=>{
 // save({id:'a',revision:0,log}) → revision 1; same request again → same record (lost acknowledgement)
 // revision 0 with a different log for existing id → rejects {code:'CONFLICT',details:{reason:'revision_conflict'}}
 // save({revision:1,...}) → revision 2; stale revision 1 again with different log → revision_conflict
 // invalid log → {code:'INVALID'}; id longer than 100 or empty → INVALID
});
test('only one active log exists',async t=>{
 // save active 'a', then active 'b' at revision 0 → rejects {code:'CONFLICT',details:{reason:'active_exists'}}
 // finishing 'a' then saving active 'b' succeeds; a finished log saved back as active → INVALID
});
test('variant index follows finish, edits and delete',async t=>{
 // active log with v1 → no workout_log_variants rows; finish → one row (v1); swap to v2 and save → only v2;
 // remove({id,revision}) → log and rows gone; remove again → resolves (idempotent); stale revision → revision_conflict
});
test('lastTime returns the first occurrence in the latest finished log, excluding the current log',async t=>{
 // finished L1 (v1: 80×8) at T1, finished L2 (v1 twice: 85×6 then 60×12) at T2 > T1
 // lastTime({variantIds:['v1','v2']}) → {v1:{logId:'L2',sets:[{weightKg:85,reps:6,rir:null}]}} and no v2 key
 // lastTime({variantIds:['v1'],exclude:'L2'}) → L1 sets; 41 ids → INVALID
});
test('history orders by real time across UTC offsets and paginates',async t=>{
 // L1 startedAt '2026-11-03T10:00:00.000+02:00' (08:00Z), L2 '2026-11-03T09:30:00.000+00:00' (09:30Z)
 // list() → [L2, L1]; 31 finished logs → first page 30 with hasMore true; next page via before/beforeId → 1, hasMore false
 // active logs never listed; summaries match workoutSummary
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test test/workout-repository.test.js`
Expected: FAIL with `Cannot find module`.

- [ ] **Step 3: Implement the migration, `server/db.js` entry and `server/workout-repository.js`**

Each save runs in one write transaction: canonicalize with `validateWorkoutLog` (INVALID on error); reject `status:'active'` when the stored log is finished; insert at revision 0 or `UPDATE … WHERE id=? AND revision=?`; on no row affected, return the stored record when `stored.revision === revision + 1` and its canonical JSON equals the request, else `revision_conflict`; map a unique violation on `workout_logs_one_active` to `active_exists`. Store `started_at`/`finished_at` columns as `new Date(x).toISOString()` (UTC), keep offsets in `log_json`. Then `DELETE FROM workout_log_variants WHERE log_id=?` and, for finished logs, insert one row per distinct non-null `variantId`. `remove` deletes both tables in one transaction; absent → success. `lastTime` uses `ROW_NUMBER() OVER (PARTITION BY variant_id ORDER BY finished_at DESC)` over the variant index joined to `workout_logs`, `log_id <> exclude`, then takes the first matching exercise's sets from the JSON. History cursor: `started_at < ? OR (started_at = ? AND id < ?)`, `LIMIT limit+1`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test test/workout-repository.test.js && npm test`
Expected: PASS (existing migration tests still pass).

- [ ] **Step 5: Commit**

```bash
git add migrations/008-workout-logs.sql server/db.js server/workout-repository.js test/workout-repository.test.js
git commit -m "feat: add workout log storage with last-time index"
```

---

### Task 5: Workouts HTTP API and client

**Files:**
- Modify: `server/api.js`, `api/index.js`, `scripts/dev-server.js`, `src/api-client.js`
- Test: `test/workout-api.test.js`, `test/api-client.test.js`

**Interfaces:**
- Consumes: `createWorkoutRepository` (Task 4), `WORKOUT_LIMITS` (Task 1).
- Produces:
  - `createApi({..., workouts})`; routes (auth required):
    - `GET /api/workouts?before&beforeId` → `{records, hasMore}`
    - `GET /api/workouts/active` → `{record: Record|null}`
    - `GET /api/workouts/last?variantIds=a,b&exclude=id` → `{lastTime}`
    - `GET /api/workouts/:id` → `{record}`
    - `PUT /api/workouts/:id` body `{revision, log}` → `{record}` (256 KiB limit)
    - `DELETE /api/workouts/:id?revision=n` → 204
    - Errors with `details` on CONFLICT pass through as `{error:{code:'CONFLICT', message, details:{reason}}}`.
  - Client: `listWorkouts({before, beforeId} = {}) → {records, hasMore}`, `activeWorkout() → Record|null`, `getWorkout(id) → Record`, `saveWorkout({id, revision, log}) → Record`, `deleteWorkout({id, revision})`, `lastTime({variantIds, exclude}) → map`.

- [ ] **Step 1: Write the failing tests** (pattern of the profile HTTP test)

```js
test('workouts API requires auth and round trips',async t=>{
 // auth false → 401 for every route; PUT then GET /api/workouts/:id → same record; GET active → record
 // second active PUT → 409 with body.error.details.reason 'active_exists'
 // stale PUT → 409 'revision_conflict'; body over 262144 bytes → 413 'Request must be at most 256 KiB.'
 // DELETE ?revision=1 → 204; GET → 404; unsupported method → 405; cross-origin PUT → 403
 // GET /api/workouts/last?variantIds=v1 → {lastTime:{v1:{...}}}
});
```

In `test/api-client.test.js`: each new method calls the right path, method and body (`saveWorkout` → `PUT workouts/<id>` with `{revision, log}`; `deleteWorkout` → `DELETE workouts/<id>?revision=1`; `lastTime` encodes `variantIds` comma-joined and omits `exclude` when absent).

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test test/workout-api.test.js test/api-client.test.js`
Expected: FAIL (404 / missing methods).

- [ ] **Step 3: Implement**

Change `body(request, limit, message)` to take the size message from the caller (analysis keeps its current text; workouts pass `'Request must be at most 256 KiB.'`; default stays `'Request must be at most 1 MiB.'`). Match `active` and `last` before `:id`. Pass `details` for CONFLICT as for IN_USE. Wire `workouts:createWorkoutRepository(db)` in `api/index.js` and `scripts/dev-server.js`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add server/api.js api/index.js scripts/dev-server.js src/api-client.js test/workout-api.test.js test/api-client.test.js
git commit -m "feat: expose workout logs over the API"
```

---

### Task 6: Active workout sync, mirror and recovery

**Files:**
- Create: `src/workout-sync.js`
- Test: `test/workout-sync.test.js`

**Interfaces:**
- Consumes: `createAutosave` (`src/autosave.js`; `change`, `flush`, `retry`, `reload`, `conflict`, `dispose`, `isDirty`, `isSaving`); client methods (Task 5).
- Produces:
  - `MIRROR_KEY = 'gpb.activeWorkout'`
  - `readMirror(storage): Mirror | null`; `writeMirror(storage, mirror): boolean` (false when storage throws); `clearMirror(storage): void`
  - `backoffDelay(attempt: number): number` — 2000, 4000, 8000, 16000, then 30000.
  - `isNetworkError(error): boolean` — no `status`, or `status >= 500`.
  - `conflictReason(error): 'revision_conflict' | 'active_exists' | null`
  - `recoveryDecision({mirror, server, reachable}): {action: 'none' | 'use-server' | 'resume-local' | 'conflict' | 'clear-mirror'}`
  - `createWorkoutSync({api, storage, record: {id, revision, log}, lastTime = null, dirty = false, timers = globalThis, onStatus, onRecord, onConflict}) → {change(log), setLastTime(map), flush(), keepLocal(): Promise, useSaved(): Promise<Record|null>, dispose(), isDirty(), get log(), get revision(), get lastTime()}`

Recovery table (pure):

| mirror | server | reachable | action |
|---|---|---|---|
| none | active record | yes | `use-server` |
| none | none | any | `none` |
| clean | record | yes | `use-server` (`clear-mirror` if the record is finished) |
| clean | missing, baseRevision > 0 | yes | `clear-mirror` |
| dirty | — | no | `resume-local` |
| dirty | missing, baseRevision 0 | yes | `resume-local` |
| dirty | revision = baseRevision | yes | `resume-local` |
| dirty | revision > baseRevision, or missing with baseRevision > 0 | yes | `conflict` |

- [ ] **Step 1: Write the failing tests** (fake timers object and a `Map`-backed storage; a throwing storage for quota)

```js
test('backoff schedule',()=>{assert.deepEqual([0,1,2,3,4,9].map(backoffDelay),[2000,4000,8000,16000,30000,30000]);});
test('recoveryDecision covers every row of the table',()=>{/* one assertion per table row */});
test('every change is mirrored synchronously before saving',async()=>{
 // sync.change(log) → readMirror(storage) has that log with dirty true immediately (no timer run)
 // after the save resolves → mirror baseRevision = new revision, dirty false; status sequence ends with 'Saved'
});
test('network failures retry automatically with backoff and on online',async()=>{
 // api.saveWorkout rejects with TypeError twice then resolves; statuses include 'Offline · saved on this device';
 // the fake timers receive delays 2000 then 4000; dispatching 'online' on the provided event target retries immediately
});
test('401 and 409 pause without retry',async()=>{
 // 401 → status 'Sign in to sync', no timer scheduled, mirror kept
 // 409 revision_conflict → status 'Conflict', onConflict called with reason 'revision_conflict'
 // 409 active_exists → onConflict reason 'active_exists'
});
test('keepLocal overwrites with the server revision; useSaved replaces local',async()=>{
 // after revision_conflict: keepLocal() fetches getWorkout, saves local log at the server revision
 // after active_exists: keepLocal() deletes the server's active log (activeWorkout + deleteWorkout) then saves at revision 0
 // useSaved() → returns the server record (or null when absent) and rewrites the mirror from it
});
test('storage failure never blocks logging',async()=>{
 // storage.setItem throws → change() does not throw, status 'Not saved on this device', save still sent
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test test/workout-sync.test.js`
Expected: FAIL with `Cannot find module`.

- [ ] **Step 3: Implement `src/workout-sync.js`**

Wrap `createAutosave` with `save:({id,revision,document})=>api.saveWorkout({id,revision,log:document}).then(r=>({id:r.id,revision:r.revision,document:r.log}))` and `delay: 400`. Map its statuses: `Couldn’t save` after a network error → `Offline · saved on this device` and schedule `retry()` after `backoffDelay(attempt)`; reset `attempt` on success; `Sign in to save` → `Sign in to sync`. Listen for `online` on `timers` when it has `addEventListener` (default `globalThis`); remove on `dispose`. Write the mirror in `change` and `onRecord`. Clear the mirror when a finished log is acknowledged and not dirty.

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test test/workout-sync.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/workout-sync.js test/workout-sync.test.js
git commit -m "feat: add local-first sync for the active workout"
```

---

### Task 7: Routes, navigation and History

**Files:**
- Create: `src/workout-history-view.js`, `e2e/workout-helper.js`, `e2e/workouts.spec.js`
- Modify: `src/router.js`, `index.html` (nav link `<a href="#/workouts" data-nav="workouts">Workouts</a>` after Exercise catalog), `src/app.js` (`prepareRoute` for `workouts`), `style.css`
- Test: `test/router.test.js`, `test/workout-history.test.js`

**Interfaces:**
- Consumes: `listWorkouts` (Task 5); `workoutSummary` (Task 1); `formatElapsed` (Task 3); `readMirror` (Task 6).
- Produces:
  - `parseRoute('#/workouts') → {view:'workouts'}`; `parseRoute('#/workouts/abc') → {view:'workout', id:'abc'}`
  - `groupByLocalDate(summaries): {date: 'YYYY-MM-DD', label: string, items}[]` exported from `src/workout-history-view.js` (pure; local date of `startedAt`).
  - `mountWorkoutHistory(root, {records, hasMore, pending: Summary|null, onLoadMore: () => Promise<{records, hasMore}>, onStartBlank, onOpen(id), workoutHref(id)}) → {destroy()}`
  - `e2e/workout-helper.js`: `login(page)`, `resetWorkouts(page)` (deletes the active log via API and clears `localStorage`), `createLinkedTemplate(page, name) → {id}` (posts a template with two seeded catalog variants via `/api/documents`).

- [ ] **Step 1: Write the failing tests**

Router unit test for both routes and that `#/workouts/` with an invalid id character returns `not-found`. `groupByLocalDate` unit test: two logs on the same local day group together, newest first. E2E:

```js
test('Workouts nav shows History with empty state and Start blank workout',async({page})=>{
 await login(page);await resetWorkouts(page);
 await page.getByRole('link',{name:'Workouts',exact:true}).click();
 await expect(page).toHaveURL(/#\/workouts$/);
 await expect(page.getByRole('link',{name:'Workouts',exact:true})).toHaveAttribute('aria-current','page');
 await expect(page.getByRole('heading',{level:1,name:'Workouts'})).toBeVisible();
 await expect(page.getByRole('button',{name:'Start blank workout'})).toBeVisible();
 // with no finished logs: empty-state copy from Global Constraints
 // with 31 finished logs created via API: 30 rows, Load more shows the 31st, rows show name, source, time, duration, done sets
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test test/router.test.js test/workout-history.test.js && npx playwright test e2e/workouts.spec.js`
Expected: FAIL

- [ ] **Step 3: Implement routes, nav link, History view and styles**

Rows are native links (`workoutHref`) intercepted for `onOpen` like library links. `pending` (an unsynced mirror log) renders first with the `Not synced yet` label. Mobile-first single column; 40rem cap above 761px. No motion on render.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test && npx playwright test e2e/workouts.spec.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/router.js src/workout-history-view.js src/app.js index.html style.css test/router.test.js test/workout-history.test.js e2e/workout-helper.js e2e/workouts.spec.js
git commit -m "feat: add Workouts navigation and history"
```

---

### Task 8: Logger view (active workout)

**Files:**
- Create: `src/workout-logger-view.js`, `src/workout-set-row.js`
- Modify: `src/action-controls.js` (icons `start`: play triangle, `more`: three dots, `check`), `src/confirm-dialog.js`, `src/app.js`, `style.css`
- Test: `e2e/workout-logger.spec.js` (mounts through the app once Task 9 wires it; until then via a blank log saved through the API and opened at `#/workouts/:id` — `prepareRoute('workout')` mounts the logger for an active log in this task with a plain `createWorkoutSync` instance)

**Interfaces:**
- Consumes: Task 2 transforms, Task 3 helpers, `mountExercisePicker` (`src/exercise-picker.js`; pass `{api, exercise:{catalogId:variantId, familyId:referenceId, name, primaryMuscles, secondaryMuscles}, onSelect(entry)}`), `mountSortable`, `mountReorderMenu` (also used for the overflow menu via `toggle(button, choices)`), `confirmAction`, `mountActionTooltips`.
- Produces:
  - `chooseAction({title, message, choices: {value, label, destructive?}[], signal}): Promise<value | null>` in `src/confirm-dialog.js` (same dialog markup/motion as `confirmAction`; Cancel resolves null).
  - `createSetRow({exerciseName, set, index, placeholder, mode: 'active'|'finished', onPatch(patch), onToggle(), onRemove()}): HTMLElement` in `src/workout-set-row.js`.
  - `mountWorkoutLogger(root, {api, log, lastTime, mode, onChange(log), onFinish(), onDiscard(), onDelete(), onLastTimeNeeded(variantIds)}) → {setLog(log), setLastTime(map), setStatus(text), focusTitle(), destroy()}` — `onChange` is called only with logs that pass `validateWorkoutLog`. `lastTime` is the `GET /api/workouts/last` map, or `null` when the fetch failed: `null` → `Last time unavailable offline`; a linked variant missing from the map, or an unlinked exercise → `No history`. `onLastTimeNeeded` fires after Swap/Add with the new variant ID; the owner merges the result in through `setLastTime`.

- [ ] **Step 1: Write the failing e2e tests** (phone viewport 390×844 and 1366×768)

```js
test('placeholders and ✓ log a set in one tap',async({page})=>{
 // finished log with v1 80×8 @2 exists; active log from the linked template opened
 // 'Last time' line reads '80×8 @2'; set 1 weight input placeholder '80', reps '8'
 // click button 'Mark set 1 done, Bench press' → aria-pressed true, inputs now hold 80 and 8
 // set with no reps placeholder: ✓ shows 'Enter reps' and focuses the reps input
});
test('inputs, steppers and RIR',async({page})=>{
 // weight '82,5' is stored as 82.5 (reload shows 82.5); '82.3' shows an inline error and is not stored
 // + on an empty weight starts from the placeholder (80 → 82.5); reps − clamps at 1; RIR segmented 0–5 clears
 // labels: 'Set 2 weight, Bench press', 'Set 2 reps, Bench press'
});
test('swap, add, remove and reorder exercises',async({page})=>{
 // Swap exercise → pick another variant → name changes, sets keep values, Last time refreshes
 // Add exercise → new card with one empty set; Remove exercise with done sets asks for confirmation
 // Reorder via the Reorder menu moves the card and keeps focus on its handle
});
test('Finish warns about uncompleted sets and refuses an empty log',async({page})=>{
 // 2 of 5 sets done → dialog text '3 sets not completed — finish anyway? Uncompleted sets will be removed.'
 // confirm → URL #/workouts, row shows 2 sets; a log with 0 done sets → 'Log at least one set, or discard the workout.'
 // overflow → Discard workout → confirm → log gone (GET 404), History shown
});
test('logger touch targets and reduced motion',async({page})=>{
 // with hasTouch: set-row inputs and toggles ≥44px; adding a set with reduced motion inserts instantly
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx playwright test e2e/workout-logger.spec.js`
Expected: FAIL

- [ ] **Step 3: Implement the logger, set rows, dialog helper, icons and styles**

Sticky header: name input (commits through `setLogName` on change), elapsed (`formatElapsed`, refreshed every 60s and on `visibilitychange`), status text in a polite live region, labeled Finish, overflow menu (Discard workout). Exercise cards: name, equipment, `Last time` line (`formatLastTime`, with the `null`/missing rules from Interfaces), set rows, labeled Add set (`addSet` with no values; placeholders follow from `setPlaceholder`). Action group per card: Swap exercise, Reorder, Remove exercise (icon buttons with tooltips and `{action} {exercise name}` names). Done toggle is a button with `aria-pressed` and name `Mark set {n} done, {exercise}`. Motion per Global Constraints, reusing the collapse pattern's classes.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx playwright test e2e/workout-logger.spec.js && npm test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/workout-logger-view.js src/workout-set-row.js src/action-controls.js src/confirm-dialog.js src/app.js style.css e2e/workout-logger.spec.js
git commit -m "feat: add the active workout logger"
```

---

### Task 9: Workout controller, start points, active bar and offline recovery

**Files:**
- Create: `src/workout-controller.js`, `src/workout-bar.js`
- Modify: `src/app.js`, `src/program-view.js` (card action), `src/library-view.js` (template card action), `src/session-editor.js` + `src/session-markup.js` (toolbar button), `index.html` (bar host after `#app`), `style.css`
- Test: `e2e/workout-start.spec.js`, `e2e/workout-offline.spec.js`

**Interfaces:**
- Consumes: Tasks 1, 5, 6, 8.
- Produces:
  - `createWorkoutController({api, storage = localStorage, choose = chooseAction, confirm = confirmAction, navigate, bar}) → {boot(): Promise, get current(): {sync, log, lastTime} | null, start({template?, program?, occurrenceId?}): Promise, finish(): Promise<boolean>, discard(): Promise<boolean>, adopt(record): void, pendingSummary(): Summary | null}`
  - `mountWorkoutBar(host, {onResume}) → {show({name, startedAt}), hide(), destroy()}`
  - New options: `mountProgramView(..., {onStartWorkout(workout)})`, `mountLibrary(..., {onStartWorkout(record)})` (templates only), `mountSessionEditor(..., {onStartWorkout(session)})`.

- [ ] **Step 1: Write the failing e2e tests**

```js
test('start from a program card, a template card, the template editor and blank',async({page})=>{
 // program card button 'Start workout Push A' → #/workouts/<id>, name 'Push A', source shown in History later as 'PPL · Push A'
 // template library 'Start workout <name>', template editor and program-workout page labeled 'Start workout'
 // unsaved template edit (rename exercise sets to 4) → the started log has 4 set rows
});
test('a second start asks to Resume, Finish or Discard the current workout',async({page})=>{
 // Resume current → navigates to the existing log; Discard current → confirm → old log 404, new log opened
 // Finish current with no done sets → message 'Log at least one set, or discard the workout.' and no new log
});
test('active workout bar on other routes',async({page})=>{
 // on #/programs: 'Workout in progress · Push A · 0 min' with Resume link; hidden on the logger route; slides out on finish
});
test('offline logging survives reload and syncs on reconnect',async({page,context})=>{
 // start, context.setOffline(true), log 2 sets → status 'Offline · saved on this device'
 // page.reload() while /api/** is blocked (see note) → logger restored with both sets and status 'Offline · saved on this device'
 // setOffline(false) → status 'Saved'; GET /api/workouts/:id has both sets done
});
test('conflicts offer Keep this device’s version or Use saved version',async({page})=>{
 // save a newer revision via API while the page is offline with a local edit; reconnect → dialog with both choices;
 // Keep this device's version → server has the local sets; repeat with Use saved version → confirm → page shows server sets
 // offline-started log while another active log is created via API → dialog explains another active workout exists, same two choices
});
```

Note for the offline test: block only `/api/**` with `page.route` (`route.abort('internetdisconnected')`) so the reload can still load the page shell, then `page.unroute` to reconnect and dispatch `online`.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx playwright test e2e/workout-start.spec.js e2e/workout-offline.spec.js`
Expected: FAIL

- [ ] **Step 3: Implement controller, bar, start points and app wiring**

`boot()` runs after login: `readMirror`, `activeWorkout()` (catch network → unreachable), `getWorkout(mirror.log.id)` when a mirror exists, then applies `recoveryDecision`. `start` builds with `createWorkoutLog` (id `crypto.randomUUID()`, `now: new Date()`), writes the mirror, creates the sync, requests `lastTime` for linked variants (store the result through `sync.setLastTime`; on network failure store `null` so the logger shows the offline copy), then `navigate('#/workouts/'+id)`. With a current workout, `start` first calls `choose` with choices `resume`/`finish`/`discard` (titles: `Workout in progress`, message `Resume, finish or discard {name} before starting a new workout.`). Discard deletes on the server when `revision > 0` (offline → message `Connect to discard this workout.`) and clears the mirror. Conflicts call `choose` with `keep` (`Keep this device's version`) and `saved` (`Use saved version`, followed by `confirmAction`). In `app.js`: `prepareRoute('workout')` mounts the logger with the controller's sync for the current log, `adopt`s an active server log from another device, and leaves finished logs to Task 10; `prepareRoute('workouts')` passes `pendingSummary()`. Program card label `Start workout` with name `Start workout {session name}`, placed first in the card's action group. The program-workout route passes `onStartWorkout` to its session editor with the program and occurrence from its context, so its start records a `program` source; the plain template route records a `template` source.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx playwright test e2e/workout-start.spec.js e2e/workout-offline.spec.js && npm test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/workout-controller.js src/workout-bar.js src/app.js src/program-view.js src/library-view.js src/session-editor.js src/session-markup.js index.html style.css e2e/workout-start.spec.js e2e/workout-offline.spec.js
git commit -m "feat: start workouts from programs, templates and blank with offline recovery"
```

---

### Task 10: Editing finished workouts

**Files:**
- Modify: `src/workout-logger-view.js`, `src/workout-set-row.js`, `src/app.js` (`track()` record kind `workout`; Reload saved version via `getWorkout`; Save as copy hidden; `refreshActive` skips workouts), `style.css`
- Test: `e2e/workout-history-edit.spec.js`

**Interfaces:**
- Consumes: `setWorkoutTimes`, `addSet` with `{done:true, ...previousEffectiveValues}` (Task 2), `saveWorkout`/`deleteWorkout` (Task 5), `mountWorkoutLogger` `mode:'finished'` (Task 8).
- Produces: `workoutRecord({id, revision, log}) → {id, kind:'workout', revision, document: log}` in `src/app.js` for `track()`.

- [ ] **Step 1: Write the failing e2e tests**

```js
test('a finished workout edits online with autosave',async({page})=>{
 // open from History: no Finish, no done toggles, Date/Start time/End time inputs and duration shown
 // change reps 8→9 → header 'Saved'; reload shows 9; Last time for a new log now reads 80×9
 // set end 00:40 with start 23:30 → duration '1 h 10 min'; end = start → 'End time must be after the start time.' and not saved
 // clearing reps → 'Enter reps', save status unchanged until fixed; Add set copies the previous row's values as a done set
 // remove last set of an exercise → confirm → exercise removed; removing the last exercise is refused
});
test('delete and conflict on finished workouts',async({page})=>{
 // overflow Delete workout → confirm → History without the row
 // a newer revision saved via API → editing shows 'Conflict' with Reload saved version only (no Save as copy)
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx playwright test e2e/workout-history-edit.spec.js`
Expected: FAIL

- [ ] **Step 3: Implement finished mode and app wiring**

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx playwright test e2e/workout-history-edit.spec.js && npm test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/workout-logger-view.js src/workout-set-row.js src/app.js style.css e2e/workout-history-edit.spec.js
git commit -m "feat: edit and delete finished workouts"
```

---

### Task 11: Design system, rollout docs and full verification

**Files:**
- Modify: `docs/design-system/README.md` (logger set grid, segmented RIR control, steppers, active workout bar, motion entries, slider-rule exception for logging inputs)
- Create: `docs/operations/workout-tracker-rollout.md`, `docs/superpowers/verification/2026-11-03-workout-tracker.md`

- [ ] **Step 1: Update the design system README** with every new token/component added in `style.css` during Tasks 7–10.

- [ ] **Step 2: Write the rollout note** — back up the database, run `npm run db:migrate` explicitly against preview then production (migration 008 only adds tables), verify `GET /api/workouts/active` returns `{record:null}`, no seed needed.

- [ ] **Step 3: Run the full suite**

Run: `npm test && npm run test:e2e && npm run build`
Expected: all pass; `public/src` contains the new `workout-*.js` files.

- [ ] **Step 4: Manual review in a real browser with populated data** — phone widths 360/390/430px, tablet, 1366×768, 1440×900, 1920×1080, 200% text, touch and hybrid input; start/finish/discard, add/remove sets and exercises with rapid toggles, keyboard and focus, reduced motion, offline then reconnect. Fix abrupt transitions, spacing or stacking issues found.

- [ ] **Step 5: Record results** in the verification doc: commands and counts, what was inspected, gaps, and deployments as pending (never claim a pending deployment was verified).

- [ ] **Step 6: Commit**

```bash
git add docs/design-system/README.md docs/operations/workout-tracker-rollout.md docs/superpowers/verification/2026-11-03-workout-tracker.md style.css
git commit -m "docs: workout tracker design system, rollout and verification"
```
