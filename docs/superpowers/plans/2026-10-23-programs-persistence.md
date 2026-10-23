# Programs and Persistence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task, or superpowers:subagent-driven-development if the user selects delegation. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship named reusable session templates and independent weekly programs with autosaved, password-protected, cross-device storage.

**Architecture:** Preserve the vanilla frontend and pure volume functions. Add per-record autosave through a small Vercel Node API to SQLite documents stored remotely in Turso. Programs embed independent workout copies and retain one canonical order plus optional weekday assignments.

**Tech Stack:** JavaScript ES modules/JSDoc, native HTML/CSS, Node.js 24 LTS, Vercel Functions, Turso/libSQL, `@libsql/client`, Node test runner; Playwright and Vercel CLI as development tooling only.

**Spec:** [Programs and persistent storage](../specs/2026-10-23-programs-persistence-design.md). Read the entire spec before execution. Product answers are confirmed; remaining implementation defaults are explicitly recorded there for review.

## Global Constraints

- Standalone session templates live in a library. Adding one to a program creates a deep, independent copy, including its goals.
- Weekly goals accept 0.5–30; template/workout goals remain 0.5–12.
- Monday is 0. Each occurrence has one weekday or null. Simple order and assignments survive mode switches.
- Weekly totals count each workout once, including unscheduled workouts, and exclude the standalone library.
- Preserve the fixed 12-muscle order and existing exercise sliders, validation, drag, collapse, tooltips, heatmap and readout behavior.
- Persist unfinished drafts; exported/imported files must be valid complete domain documents.
- Keep computed volume and transient UI state out of SQLite and exported JSON.
- Single-password personal access; API secrets stay server-side. Production and preview use different databases and secrets.
- No ORM, frontend framework or generic state library. No offline store or live subscription.
- Every API response is `no-store`; every data endpoint authenticates.
- New exports are version 2 with two-space indentation; legacy version 1 session imports remain supported.

## Review Focus

1. A timed-out successful write must not duplicate a record or produce an unrecoverable conflict on Retry (Tasks 4–5).
2. Editing on device B must not silently overwrite device A's newer saved revision (Tasks 4–5, 9).
3. Switching editors, deleting a dirty document or logging out during a save must not lose edits or resurrect deleted data (Tasks 5–7).
4. Empty names/missing primary muscles must save as drafts while malformed numeric/muscle data and invalid exports remain rejected (Tasks 1, 3–4, 7).
5. Imported programs in simple mode must preserve hidden day assignments, count unscheduled workouts, remap IDs and remain independent of their source templates (Tasks 1–3, 8–9).

## File boundaries

Retain `src/muscles.js`, `src/exercise.js`, `src/body.js`, `src/tooltip.js` and existing pure tests. Add `src/program.js` for domain operations; `src/document-validation.js` for document shape/draft validation; `src/program-volume.js` for weekly sums; `src/document-file.js` for portable version 2 files; `src/api-client.js` and `src/autosave.js` for persistence; `src/library-view.js`, `src/program-view.js` and `src/router.js` for navigation. Extract `src/session-editor.js` and `src/volume-panel.js` from the 703-line `src/app.js` only to enable reuse. `src/app.js` becomes composition/auth/navigation glue.

Server-only code lives in `server/db.js`, `server/repository.js`, `server/auth.js`, `server/api.js`; `api/index.js` is the Vercel adapter. `scripts/` owns migrations/password/static build/local test serving. `migrations/001-initial.sql` defines storage. Tests live under `test/`; browser tests under `e2e/`.

### Task 1: Domain model, deep copies and draft boundaries

**Files:** Create `src/program.js`, `src/document-validation.js`, `test/program.test.js`, `test/document-validation.test.js`; modify `src/validate.js` and `test/validate.test.js`.

**Interfaces:** Export JSDoc `Workout`, `SessionTemplate`, `ProgramWorkout`, `Program`, `DocumentRecord` per spec. Export `createTemplate(): SessionTemplate`, `createProgram(): Program`, `copyWorkout(template: Workout, id: string): ProgramWorkout`, `duplicateProgram(program: Program, makeId: () => string): Program`, `assignDay(program, workoutId, day): Program`, `moveWorkout(program, workoutId, toIndex): Program`. Return new values; deep-copy nested exercise arrays/ranges/goals. Export `validateDocument(kind, value, {draft: boolean}): {document?: object,error?: string}` and `validateGoalFor(goal, limits): string|null`; retain `validateGoal`'s existing signature/default behavior. Add `LIMITS.weeklyGoal={min:0.5,max:30,step:0.5}`.

- [ ] **Step 1: Write failing tests.** Assert `copyWorkout(template,'w1').day === null`; mutating the copy's name, `repRange.min`, muscle arrays and goals leaves the source unchanged. Assign Monday then toggle simple/schedule twice: canonical IDs and day stay equal. Duplicate programs remap every occurrence ID. Reject duplicate IDs, day -1/7, unknown mode, null exercises, goal 30.5, NaN and muscle overlap. Accept weekly 0.5/30; reject 0 as a stored goal. Accept blank names/missing primaries only with `{draft:true}`; preserve existing exercise validity rules for strict mode.
- [ ] **Step 2: Run** `node --test test/program.test.js test/document-validation.test.js test/validate.test.js`; confirm new tests fail for missing exports/behavior.
- [ ] **Step 3: Implement the interfaces above.** Canonicalize known keys without mutating inputs, keep names as editable strings, use fallback names from spec for creation, and contextualize nested errors with workout/exercise indices. Inject IDs into pure operations rather than generating them inside assertions.
- [ ] **Step 4: Run the same command** and confirm all cases pass, including existing validation tests.
- [ ] **Step 5: Commit** these files as `feat: model independent program workouts and draft validation`.

### Task 2: Weekly volume and goal semantics

**Files:** Create `src/program-volume.js`, `test/program-volume.test.js`; retain `src/volume.js` as the single exercise volume implementation.

**Interfaces:** `computeProgramVolumeSplit(program): Record<MuscleGroup,{direct:number,indirect:number}>`; `computeProgramVolume(program): Record<MuscleGroup,number>` derived from the split; `contributingWorkouts(program,muscle): number`. Consume Task 1 types and existing `computeVolumeSplit`, `barScale`, `barSegments`, `goalStatus`, `visibleMuscles`.

- [ ] **Step 1: Write failing tests.** Put the AGENTS worked example into one workout and an unscheduled independent copy into another. Assert Chest 14, Triceps 10 (6 direct/4 indirect), Front delts 7, Lats 6, Biceps/Upper back 3, other totals 0. Assert mode/day/order changes leave totals unchanged, removing a workout halves them, template-library changes do not affect them, empty programs produce all zeroes. With weekly Chest goal 14 assert `met`; goal 15 `under`; goal 13 `over`. Weekly goal Calves 30 remains visible at 0 and its largest marker is 0.75.
- [ ] **Step 2: Run** `node --test test/program-volume.test.js`; confirm missing implementation failure.
- [ ] **Step 3: Implement** summation using the existing split function, with no duplicated set-weighting formula or stored totals. Contributing workout count includes each occurrence with that muscle once.
- [ ] **Step 4: Run** `node --test test/program-volume.test.js test/volume.test.js`; expect all pass.
- [ ] **Step 5: Commit** as `feat: calculate weekly volume and independent weekly goals`.

### Task 3: Portable template/program formats and legacy imports

**Files:** Create `src/document-file.js`, `test/document-file.test.js`; reuse `src/session-file.js` and preserve `test/session-file.test.js`.

**Interfaces:** `serializeDocument(kind,document): string`; `parseDocument(text,{makeId}): {kind,document}|{error}`; `documentFileName(kind,date=new Date()): string`. Consume strict Task 1 validation and existing `parseSession`. Export no persistence/occurrence IDs. Parse version 1 as `Imported session template`; parse version 2 exact envelopes from the spec, generating IDs for program occurrences.

- [ ] **Step 1: Write failing tests.** Round-trip template and program portable content; assert hidden assignments and mode survive, UUIDs are fresh, order preserved, unknown keys ignored and no IDs/revisions/timestamps exported. Assert weekly goal 30 accepts and workout goal 12.5 rejects. Test wrong version/kind, invalid JSON, nested unknown `Shoulders`, blank program/workout name, duplicate muscles and first-error context. Keep exact old-file behavior via the legacy parser. With local `new Date(2026,9,23)` assert filenames `gym-program-2026-10-23.json` and `gym-session-template-2026-10-23.json`.
- [ ] **Step 2: Run** `node --test test/document-file.test.js test/session-file.test.js`; confirm new failures and unchanged legacy tests.
- [ ] **Step 3: Implement** strict whole-file validation/canonicalization before returning content. Match the spec's version-2 field names; apply the 1 MiB UTF-8 size limit before parsing. Legacy parsing rejects unchanged legacy errors, then adds the fallback name.
- [ ] **Step 4: Run the same command**; expect pass, including empty valid program/template files and half-set goals.
- [ ] **Step 5: Commit** as `feat: add portable program and named template files`.

### Task 4: SQLite persistence, personal authentication and HTTP contract

**Files:** Create `migrations/001-initial.sql`, `server/db.js`, `server/repository.js`, `server/auth.js`, `server/api.js`, `api/index.js`, `scripts/migrate.js`, `scripts/hash-password.js`, `scripts/build-static.js`, `vercel.json`, `.env.example`, `test/repository.test.js`, `test/auth.test.js`, `test/api.test.js`; modify `package.json`, `.gitignore`; commit generated lockfile.

**Interfaces:** `createDb({url,authToken}): Client`; `createRepository(db,{now}): {list(kind),get(id),create({id,kind,document}),update({id,revision,document}),remove({id,revision})}` returning spec record shapes. `createAuth({db,passwordHash,authSecret,now,randomBytes})` supplies login/session/logout; `createApi({repository,auth,origin}): (Request)=>Promise<Response>`. API adapter supplies environment config, preserves original route path and exposes the same handler locally/tests. Repository errors use typed codes `NOT_FOUND`, `CONFLICT`, `UNAVAILABLE`; map at HTTP boundary.

- [ ] **Step 1: Add failing integration tests** with temporary local SQLite files. Persist/reopen documents, distinguish kind lists, retain timestamps and increase revision by one, accept draft content and reject structurally invalid data. Assert two concurrent writes at the same revision yield one success/one 409. Retry an acknowledged-lost create/update with identical canonical content and assert same record/revision; changed content conflicts. Delete with stale revision conflicts; repeated delete is harmless. Failed writes leave prior JSON intact.
- [ ] **Step 2: Add auth/API failure tests.** All document methods reject missing/expired/revoked cookies with 401; valid password issues a host-only HttpOnly Strict cookie, logout revokes it. Wrong password gives 401; sixth failure within 15 minutes gives 429 across separate auth instances. Expiry permits attempts again. Cross-origin writes reject, malformed/oversize JSON gives 400/413, wrong methods 405, storage outage 503 without SQL leakage, all responses no-store. Check each endpoint/response envelope listed in spec, not only the repository.
- [ ] **Step 3: Add `@libsql/client`**, Node 24 engine, migration/password/build scripts and local env sample. Run `node --test test/repository.test.js test/auth.test.js test/api.test.js`; confirm failures for missing behavior before implementation. Gitignore `.env*` except `.env.example`, local databases/sidecars and static build output.
- [ ] **Step 4: Implement** schema, migrations, parameterized CRUD/CAS updates and auth per spec. Run conditional update/delete and existence checks in write transactions. Store canonical JSON; canonical equality defines idempotent retries. Hash password with scrypt and session tokens with HMAC-SHA256. Use Vercel's trusted client-IP metadata for rate-limit buckets; never trust arbitrary spoofed forwarded headers. Enforce 1 MiB streamed body cap. Protect data endpoints before accessing documents.
- [ ] **Step 5: Implement static build and Vercel adapter.** Copy only allowed public assets to `public/`; configure output and API rewrite. Run migration twice against a fresh temporary file, expect a single migration row and intact data. Run build, assert no `.env`, `server/`, `.db`, scripts or tests in public output. Verify `/api/auth/session` reaches router under `vercel dev` and returns 401, while `/server/auth.js` and database paths return 404.
- [ ] **Step 6: Run** `node --test test/repository.test.js test/auth.test.js test/api.test.js`; expect pass. Close connections/clean temporary files in test teardown. No real account or production DB required.
- [ ] **Step 7: Commit** as `feat: persist private documents through a Vercel SQLite API`.

### Task 5: API client and reliable per-document autosave

**Files:** Create `src/api-client.js`, `src/autosave.js`, `test/autosave.test.js`, `test/api-client.test.js`.

**Interfaces:** `createApiClient({fetch}): {login,passwordSession,logout,list,get,create,update,remove}` where `login(password)`, `passwordSession()`, and document methods match Task 4 payloads. `createAutosave({record,save,createCopy,delay=400,onStatus,onRecord,onConflict,timers}): {change(document),flush(),retry(),reload(record),saveAsCopy(),dispose(),isDirty()}`. `save({id,revision,document})` returns the server record. `flush()` resolves only when the latest generation is saved, rejects on failure/conflict. `dispose()` cancels timers and is only called after successful flush or confirmed discard. Name the auth check `passwordSession` consistently in callers.

- [ ] **Step 1: Write fake-time tests.** 20 slider events inside 400 ms update local state immediately and yield one save; edits during in-flight save queue one newer snapshot; acknowledgement never replaces newer local input or shows Saved early. Independent record queues never mix IDs. Retry after lost acknowledgement uses idempotent server behavior. 401 retains edits and pauses; 409 never auto-overwrites; save-as-copy uses a new ID and preserved local content. A late response after delete/dispose does not update the app.
- [ ] **Step 2: Run** `node --test test/autosave.test.js test/api-client.test.js`; confirm new failures.
- [ ] **Step 3: Implement** client with same-origin cookies/no-store and typed status/code errors; queue saves by local generation. Track create vs update so initial network failure retries the same ID. Integrate explicit retry and conflict actions; no background infinite retry or localStorage copy. Reauthentication fetches current revision before resuming.
- [ ] **Step 4: Run the same command**; expect pass for success, rejection, delayed response and disposed queue cases.
- [ ] **Step 5: Commit** as `feat: autosave drafts with conflict and retry handling`.

### Task 6: Reusable session-template editor and volume panel

**Files:** Create `src/session-editor.js`, `src/volume-panel.js`; modify `src/app.js`, `index.html`, `style.css`; add `e2e/session-editor.spec.js`, `playwright.config.js` and a local HTTP test-server script in `scripts/`. Add Playwright as a dev dependency and `test:e2e` script.

**Interfaces:** `mountSessionEditor(root,{workout,onChange,onExport,onImport}): {setWorkout(workout),focusFirstError(),destroy()}`; `mountVolumePanel(root,{scope:'workout'|'week',onGoalsChange,onMuscleSelect}): {update({volume,split,goals,contributorCount}),destroy()}`. Program overview supplies weekly sums; workout editor supplies existing pure sums. Each view owns DOM listeners/timers/dialogs and cleans them on destroy.

- [ ] **Step 1: Capture failing browser tests** for opening a named template and firing `onChange` after name/exercise/goals/order edits. Assert moving the range updates volume immediately, keyboard exercise reorder retains focus/collapsed state, collapse excludes hidden inputs from tab navigation, reduced motion is honored, tooltips/Escape still work, and invalid export focuses first invalid field. Keep the existing worked-example numbers.
- [ ] **Step 2: Run** `npx playwright test e2e/session-editor.spec.js`; confirm new mounting/naming scenarios fail. Existing tests remain the baseline for extraction.
- [ ] **Step 3: Extract existing code** from `src/app.js` with minimal behavior changes, replacing global singleton state with mounted workout state. Persist only domain edits; collapse/hover/select do not trigger autosave. Name input is text, sets/reps/goals retain native sliders. Parameterize weekly goal maximum/readout/count and omit weekly body map/productive-set tooltips. Update visible wording to `Session template`.
- [ ] **Step 4: Run** `npm test` and the targeted browser suite; expect pass. Check no duplicate event handlers after mounting/unmounting twice and no stale readout/tooltip timer from a previous editor.
- [ ] **Step 5: Commit** as `refactor: reuse session template editor and scoped volume panel`.

### Task 7: Login, libraries and saved-record navigation

**Files:** Create `src/router.js`, `src/library-view.js`; modify `src/app.js`, `index.html`, `style.css`; create `e2e/libraries.spec.js`.

**Interfaces:** `parseRoute(hash): {view:'programs'|'templates'|'program'|'template',id?:string}|{view:'not-found'}`; `mountLibrary(root,{kind,records,onCreate,onOpen,onDuplicate,onDelete,onImport,onExport}): {update(records),destroy()}`. App owns active records, Task 5 queues and auth state; mounted views do not independently fetch/save records.

- [ ] **Step 1: Write failing browser tests.** Login once, create named template/program, reload and see saved records; wrong password and expired auth show actionable messages. Rename/duplicate/delete correct ID even with duplicate names. Cancel deletion changes nothing. Navigation/back/forward preserves acknowledged edits. Slow list/detail responses cannot overwrite dirty edits. Dirty logout failure remains visible; discard is explicit. Unknown ID produces recoverable message.
- [ ] **Step 2: Run** `npx playwright test e2e/libraries.spec.js`; confirm missing UI failures.
- [ ] **Step 3: Implement** password form, logout, hash navigation and libraries. Use create/duplicate fresh client IDs and API document kinds. Integrate autosave status with `aria-live=polite`, Retry and conflict buttons. On navigation/logout flush dirty queues; on failure retain view or ask explicit discard. Register beforeunload only while dirty. Delete terminates pending queue safely, performs revision-checked deletion, and restores focus. Render names via textContent, never raw HTML.
- [ ] **Step 4: Run** library tests plus `npm test`; expect pass. Keyboard-test login/library actions and 320px layout without horizontal overflow.
- [ ] **Step 5: Commit** as `feat: add personal program and session template libraries`.

### Task 8: Program composition, scheduling, weekly overview and file actions

**Files:** Create `src/program-view.js`, `e2e/programs.spec.js`, `e2e/import-export.spec.js`; modify `src/app.js`, `src/library-view.js`, `style.css` and shared editor integration.

**Interfaces:** `mountProgramView(root,{program,templates,onChange,onOpenWorkout,onImport,onExport}): {update(program),focusError(path),destroy()}`. `onChange(program)` feeds the program record's single autosave queue, including nested workout edits. All model changes consume Tasks 1–3; no second per-workout backend record.

- [ ] **Step 1: Write failing browser tests.** Add the same library template twice; edit first copy and assert second/library unchanged. Add empty workout, rename/duplicate/remove copies, reorder with keyboard/touch controls and preserve focused control. Schedule Monday and Sunday with two on Monday; switch simple and back, assert sequence/assignments retained. Unscheduled workouts count in weekly totals. Weekly goal slider accepts 30/0.5/No goal while workout max stays 12. Missing library template after deletion does not damage program copies.
- [ ] **Step 2: Write file-flow tests.** Import legacy JSON into library, template into selected workout, and a full program with hidden assignments; require confirmation only for content replacement. Decline/invalid/wrong-kind/oversize files leave current record unchanged and show one error. Export JSON round-trips portable content with local-date filenames; program export navigates into first invalid workout, expands exercise and focuses its bad field. Imported exercises start collapsed.
- [ ] **Step 3: Run** `npx playwright test e2e/programs.spec.js e2e/import-export.spec.js`; confirm new failures.
- [ ] **Step 4: Implement** program name/mode controls, template picker, copies, day selectors, accessible move controls, workout editor navigation and weekly panel. Day-group order derives from canonical array. Use per-record program autosave for every edit. Wire library imports as create and editor imports as confirmed whole-content replacement; preserve occurrence ID/day when replacing a workout. Strictly validate before asking confirmation/mutation. Add same-workout duplication for repeated days.
- [ ] **Step 5: Run** both browser suites and `npm test`; expect pass. Verify seven days and Unscheduled stack on mobile, goal checkmarks/status text still align, empty weekly feedback and 30-max slider labels are accessible, and no weekly per-session heatmap/tooltips appear.
- [ ] **Step 6: Commit** as `feat: compose weekly programs with schedules and portable files`.

### Task 9: Cross-device verification and deployment runbook

**Files:** Create `e2e/persistence.spec.js`, `docs/deployment.md`, `README.md`; update `AGENTS.md`, `CLAUDE.md` and `package.json` only as needed for current commands/requirements.

**Interfaces:** Existing API/UI contracts only. Add scripts `test` (existing unit/integration glob), `test:e2e`, `build`, `db:migrate`, `password:hash`, `dev` (Vercel dev). Document environment variables `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`, `APP_PASSWORD_HASH`, `AUTH_SECRET`, `APP_ORIGIN`; local DB URL may be `file:...` outside static output.

- [ ] **Step 1: Write cross-browser-context tests.** Context A saves, authenticated context B opens same record and sees its content. Both edit revision n; one saves and other gets conflict, retains local edits and can save-as-copy. Simulate offline/503 then Retry, expired cookie then login, delayed save during navigation/deletion and a program reload with mode/goals/order/days intact. Verify unauthenticated direct API cannot read or mutate private records.
- [ ] **Step 2: Run** `npx playwright test e2e/persistence.spec.js`; investigate any failure before broad validation, with no production access required.
- [ ] **Step 3: Document setup/release.** Local SQLite migration/start; create separate Turso preview/production databases; configure server-only env; generate salted password hash; migrate each DB explicitly; deploy preview; smoke login/CRUD/import/export across two browsers; inspect static output and unauthenticated API behavior. Include provider-supported backup and tested restore into a separate database before production migration, session revocation/password rotation SQL, and rollback to prior deployment without dropping documents. Explain autosave's acknowledgement boundary and reload-based cross-device visibility.
- [ ] **Step 4: Update project instructions** to replace the now-superseded no-name/in-memory/single-session/no-auth/no-schedule/import-only-version-1 restrictions, preserving exercise/muscle/volume/animation requirements. Record the confirmed decisions and link the spec. Do not rewrite unrelated historical plans.
- [ ] **Step 5: Run** `npm test`, `npm run test:e2e`, `npm run build`, and `git diff --check`; expect all pass. Verify migration rerun, static allowlist and Vercel preview routing using Task 4 checks. Record test evidence and any environment-dependent preview checks still outstanding; do not claim a deployment occurred if it did not.
- [ ] **Step 6: Commit** as `docs: verify and document persistent program deployment`. Deliver the reviewed branch and release checklist; production deployment is a separate explicit action.

## Plan self-review

Coverage: domain/copy/schedule invariants (1), weekly volume/goals (2), formats/legacy/round-trip (3), durable database/auth/API/deployment output (4), reliable autosave/conflicts (5), retained session UI (6), personal libraries/navigation (7), integrated programs/scheduling/files (8), cross-device evidence/runbook/instruction updates (9). Each review-focus risk has named tests in its owning tasks. No implementation is authorized by this planning artifact alone.

## Execution handoff

Recommended execution is inline via executing-plans because the API, record queue and mounted editor contracts are closely connected. Review this plan and its implementation defaults before execution. The current request ends with planning; do not install dependencies, create external resources or deploy as part of this handoff.
