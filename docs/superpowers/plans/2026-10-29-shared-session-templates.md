# Shared Session Templates Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make program workouts occurrences of shared session templates, preserving existing data and portable imports.

**Architecture:** Templates remain revisioned document records; programs store occurrence links and arrangement only. A transactional relational link index protects references; clients resolve linked records into a transient display projection and save templates independently. Version-3 portable bundles preserve sharing without trusting database identities.

**Tech Stack:** Vanilla JavaScript ES modules, Node.js 24, SQLite/libSQL via existing client, native HTML/CSS, node:test and Playwright; no new dependencies.

**Spec:** [Approved design](../specs/2026-10-29-linked-sessions-catalog-design.md), Stage A and shared acceptance sections.

## Global Constraints

- Execute before [catalog/navigation plan](2026-10-29-catalog-metadata-navigation.md). Tasks are sequential; deliver this stage as a working release.
- Share name, exercises/order, sets/reps/rest, session goals and duration allowances. Only occurrence ID, template ID, weekday and placement belong to programs.
- Preserve exact workout timing, catalog identity/archive links, draft allowances, rest sequence and weekly goal rules. Count repeated occurrences separately.
- Keep `familyId` compatibility names internal. No browser persistence mirror, framework, ORM, live collaboration or automatic production migration/seed.
- All new API commands retain authentication, same-origin protection, payload limits and revision checks.
- Read AGENTS.md and docs/design-system/README.md before execution; use an isolated worktree according to using-git-worktrees. Preserve unrelated changes.
- UI retains Barlow/dark/orange tokens, existing rail, 180–200px desktop figures, 32px fine-pointer-only controls and 44px touch/hybrid targets/slider hit boxes.
- Testing auto-migration in `scripts/dev-server.js --test` remains confined to its disposable database; production builds/requests never migrate.

## Review Focus

1. Lost response after atomic template creation/import: exact replay returns the same objects, never extra library templates (Tasks 2, 5).
2. Catalog propagation while a shared template save is in flight: preserve dirty prescriptions and show conflict without accepting stale acknowledgement data (Tasks 3, 4).
3. Two identical legacy workout copies: migrate to two distinct templates, not accidental sharing (Task 1).
4. Deletion races with another device attaching a template: transactionally allow one valid result without dangling links (Task 2).
5. A slow read finishes after navigation or a newer save: never remount an obsolete editor or overwrite newer local edits (Task 4).

## Shared contracts and file map

```js
// Stored, validated, persisted forms:
// TemplateRecord = existing {id,kind:'template',revision,document,...timestamps}
// Occurrence = {id:string, templateId:string, day:number|null}
// LinkedProgram = {name,mode,workouts:Occurrence[],goals,sequence?}
// ProgramRecord = existing document record with document:LinkedProgram
// ProgramBundle = {record:ProgramRecord, templates:TemplateRecord[]}
// Resolved workout = {...template.document,id,templateId,templateRevision,day}
// Template metadata above is transient; never submit resolved workouts as program JSON.
```

`src/program-links.js` owns pure resolution/projection. `server/program-links.js` owns link-index integrity and hydration in a caller transaction. `server/document-commands.js` owns atomic create/link/import commands; `src/shared-session-controller.js` owns queue lifetimes. Keep `src/program-view.js` as presentation/arrangement and `src/session-editor.js` as the shared session form. Extend repositories/API/client instead of bypassing them. New tests go in existing `test/` and `e2e/` directories.

### Task 1: Introduce linked program validation and migrate embedded sessions

**Files:** Create `migrations/005-shared-sessions.sql`, `server/migrate-shared-sessions.js`, `src/program-links.js`, `test/shared-session-migration.test.js`, `test/program-links.test.js`; modify `server/db.js`, `src/document-validation.js`, `src/program.js`, `test/document-validation.test.js`, `test/program.test.js`.

**Interfaces:**
- `validateDocument('program', value, {draft})` validates stored occurrence links, days, mode, goals and canonical sequence; reject nested session bodies rather than silently stripping them.
- `resolveProgram(program, templateRecords) -> ResolvedProgram` is pure, accepts an array of unique template records, and throws on missing/wrong-kind targets.
- `migrateSharedSessions(tx, {now,makeId}) -> {convertedPrograms,createdTemplates}` executes inside the existing migration transaction before recording version 5.
- Link table: `program_template_links(program_id,occurrence_id,template_id)`, primary key `(program_id,occurrence_id)`, program FK cascades on delete, template FK restricts delete, index on template ID. Repository validation also enforces target kinds. `shared_session_migration_map(program_id,occurrence_id,template_id)` records conversion identities.

- [ ] Write migration fixtures using a DB stopped at migration 004: two identical embedded workouts, one blank draft, archived catalog link, explicit `restSeconds:45`, `extraMinutes:15`, `bufferPercent:25`, Week/Sequence and rest IDs. Assert distinct new template IDs, stable occurrence IDs/day/order, one program revision increment and exact resolved content after removing transient metadata. A second `migrate()` changes neither counts nor revisions. Inject failure on the second created template and assert zero partial conversions/schema-version advancement.
- [ ] Write pure validation/projection tests. Core assertions: `assert.equal(resolveProgram(p,[t]).workouts[0].exercises[0].sets,4)` and `assert.throws(()=>resolveProgram(p,[]), /template/i)`. Reject duplicate occurrence IDs, malformed IDs, wrong weekdays, unresolved sequence IDs and embedded-only legacy writes under the new validator. Keep legacy normalization in import/migration paths, not ordinary writes.
- [ ] Run `node --test test/shared-session-migration.test.js test/program-links.test.js test/document-validation.test.js test/program.test.js`; confirm failures identify the absent behavior before implementation.
- [ ] Implement schema and conversion, preserving original workout values and chosen IDs. Separate migration registration into explicit SQL plus optional data hook in `server/db.js`; keep all migration work on the same write transaction. Normalize missing legacy timing only, never overwrite explicit timing. Ensure FK enforcement on created clients; test it rather than assuming driver defaults.
- [ ] Implement stored validation and pure resolution; replace `copyWorkout` consumers only as subsequent tasks migrate their boundaries. Maintain intermediate fixture helpers that explicitly construct linked programs; do not retain an implicit production copy fallback.
- [ ] Rerun the focused command; expect zero failures. Commit the schema, conversion, validation and tests as `feat: migrate program workouts to shared template links`.

### Task 2: Make repository commands, link integrity and export snapshots transactional

**Files:** Create `server/program-links.js`, `server/document-commands.js`, `test/shared-session-repository.test.js`; modify `migrations/005-shared-sessions.sql` (still unreleased), `server/repository.js`, `server/api.js`, `src/api-client.js`, `api/index.js`, `scripts/dev-server.js`, `test/repository.test.js`, `test/api.test.js`, `test/api-client.test.js`.

**Interfaces:**
- `syncProgramLinks(tx, programId, document) -> Promise<void>` validates targets and reconciles the link index under the program write transaction.
- `readProgramBundle(tx, id) -> Promise<ProgramBundle>` reads the program and distinct templates on one consistent transaction snapshot.
- `repository.programBundle(id)`, `repository.templateUsage(id) -> [{id,name,count}]`.
- `commands.createAndAttach({operationId,programId,revision,templateId,occurrenceId,template}) -> ProgramBundle`: create new template plus append unscheduled occurrence atomically, reconciling sequence.
- `commands.importDocument({operationId,targetId?,revision?,bundle}) -> {record,templates}`: contract implemented in Task 5.
- Endpoints: `GET documents/:id/bundle`, `GET documents/:id/usage`, `POST document-commands/attach`, `POST document-commands/import`. Existing document GET/PUT retains `{record}` with authoritative stored JSON; template list/create/update contracts remain.
- Create `document_operations(id PRIMARY KEY,request_json,result_json)` in migration 005. Store normalized command intent and committed result in the same transaction; exact operation replay returns that result, different intent with same ID returns CONFLICT. Include request IDs in client retry envelopes.

- [ ] Add repository tests showing editing one template changes both resolved program occurrences; an arrangement save leaves template revision/content unchanged. Protect deletion with `{code:'IN_USE', details:{programs:[...]}}`; API maps IN_USE to 409 and preserves safe structured details in the client error. Assert removing a program/occurrence removes only index rows, never templates.
- [ ] Test attach rejection/rollback for missing/wrong-kind targets, stale revision and injected insertion/index failure. Simulate a committed write whose response is lost: replay attach envelope and assert exactly one template and one occurrence. Race attachment against template deletion using two clients to a temporary file DB; either attachment succeeds and deletion is IN_USE, or deletion wins and attachment fails NOT_FOUND, with no dangling link.
- [ ] Run `node --test test/shared-session-repository.test.js test/repository.test.js test/api.test.js test/api-client.test.js`; expect new assertions to fail.
- [ ] Implement repository/link-index transactions and command service; wire both production and test entrypoints. Preserve existing idempotent document saves. Reject old clients submitting embedded workouts; do not mutate them into links in requests. Add consistent bundle and usage reads, safe error details and endpoint client methods named `programBundle`, `templateUsage`, `createAndAttach`, `importDocument`.
- [ ] Rerun the focused tests to zero failures; commit as `feat: add transactional shared-session commands and deletion guards`.

### Task 3: Propagate catalog definitions through templates and count occurrence volume

**Files:** Modify `server/catalog-propagation.js`, `server/catalog-links.js`, `src/program-volume.js`, `src/analysis-input.js`, `test/catalog-repository.test.js`, `test/catalog-links.test.js`, `test/program-volume.test.js`, `test/analysis-input.test.js`; create `test/shared-catalog-propagation.test.js`.

**Interfaces:**
- `documentExercises(document)` returns exercises from templates only; stored linked programs contain no exercise snapshots.
- `catalogImpact(tx,catalogId)` returns distinct affected template `{id,revision,count}` entries. Add `programs:[{id,name,count}]` as descriptive usage to the impact response; program occurrence counts are not template write targets. Preserve guard comparisons on template revisions and catalog/reference revisions.
- Existing volume/analysis functions consume resolved workouts from Task 1. Their mathematical rules do not change.

- [ ] Add an integration test with one exact catalog entry in a template used twice by P and once by Q. After catalog edit, assert template revision increases once, both stored program revisions stay unchanged, all three resolved occurrences show the edit, and `restSeconds:45`, sets/reps/goals stay unchanged. Inject propagation failure and assert definitions/template revisions roll back together.
- [ ] Add volume tests: one shared four-set Chest template used twice contributes `Chest:8`; one scheduled and one unscheduled occurrence both count; rest entries contribute zero. Analysis of either occurrence uses its resolved session, not program aggregate volume. Add an archived-entry test showing template duplication still uses source verification and a bare forged catalog ID still rejects.
- [ ] Run `node --test test/shared-catalog-propagation.test.js test/catalog-repository.test.js test/catalog-links.test.js test/program-volume.test.js test/analysis-input.test.js`; expect new behavior failures.
- [ ] Update propagation to scan templates only and derive descriptive program impact via the link index. Adapt existing catalog fixtures to the stored link shape. Keep all existing archived-copy and exact-entry guards, and expose resolved data to volume/analysis without saving it.
- [ ] Rerun focused tests to zero failures; commit as `refactor: resolve shared templates for volume and catalog propagation`.

### Task 4: Separate program arrangement and session autosave in the UI

**Files:** Create `src/shared-session-controller.js`, `test/shared-session-controller.test.js`, `e2e/shared-sessions.spec.js`; modify `src/app.js`, `src/program-view.js`, `src/program.js`, `src/router.js`, `src/library-view.js`, `src/autosave.js` only if needed, `src/session-editor.js` only for required callbacks, `e2e/programs.spec.js`, `e2e/recovery.spec.js`, `e2e/program-sequence-persistence.spec.js`.

**Interfaces:**
- `createSharedSessionController({api,onStatus,onConflict,onTemplate}) -> {load(record),edit(templateId,workout),flush(),refresh(),saveAsCopy(templateId),dispose()}` owns one existing `createAutosave` queue per loaded template identity. `onTemplate(record)` updates all resolved occurrences; arrangement queue stays application-owned.
- Program view receives `{program,templateRecords,onArrangementChange,onTemplateChange,onOpenWorkout,onCreateEmpty,...existing export/API hooks}`. Arrangement callback submits only linked program fields. Editor callback receives `(templateId,workout)` and never updates occurrence metadata.
- Route parser accepts `#/programs/:programId/workouts/:occurrenceId` as `{view:'program-workout',id:programId,occurrenceId}`. Missing occurrence/template is recoverable; browser Back returns to overview. Shared template link uses existing `#/templates/:id`.

- [ ] Add controller tests with deferred save/read promises: edits through repeated occurrences share one queue; independently saving arrangement does not change template revision; an old focus refresh cannot override a newer acknowledgement; a remote template change while dirty yields conflict with draft retained; catalog propagation during in-flight save does not replace local prescriptions. After disposal, late results cause no UI callback.
- [ ] Add browser flows: edit template in program A, return to library and program B and see the edit; duplicate shares identity and doubles weekly volume; empty workout creates one template; library duplicate remains independent; program duplicate shares template IDs with independent arrangement; remove occurrence leaves template. Opening shared editor shows `Shared template` with direct link.
- [ ] Add recovery flows: two contexts edit the same template and stale one conflicts; Retry keeps the same envelope; Reload accepts saved version; Save as copy opens a new template and does not relink old occurrences. Error copy explicitly explains that original programs retain the original template. Deletion block presents affected program links. Slow bundle load after navigating elsewhere never steals focus/remounts the program editor.
- [ ] Run `node --test test/shared-session-controller.test.js test/autosave.test.js` and `npx playwright test e2e/shared-sessions.spec.js e2e/recovery.spec.js`; confirm new tests fail before implementation.
- [ ] Implement controller and view contracts, deep routes and race guards. Flush pending arrangement/template saves on navigation/export; reuse existing error recovery/creation retry surfaces. Refresh bundle templates on entry/focus even when program revision is unchanged. Sync only clean queues or acknowledged generations. Preserve open catalog variant drafts, collapse states and focused sliders on routine acknowledgements.
- [ ] Replace “Session template to copy” with “Session template”; Duplicate adds a linked occurrence with fresh occurrence ID and same day. Empty workout uses Task 2 atomic command. Reuse current layout and route fade; do not add cards or shrink figures. Preserve whole-card drag and keyboard Reorder with occurrence IDs.
- [ ] Rerun focused unit/browser tests to zero failures; commit as `feat: edit shared session templates from programs`.

### Task 5: Ship portable v3 bundles with atomic legacy-compatible import

**Files:** Create `src/document-bundle.js`, `test/document-bundle.test.js`, `test/document-import.test.js`; modify `src/document-file.js`, `src/document-validation.js`, `server/document-commands.js`, `src/app.js`, `src/program-view.js`, `test/document-file.test.js`, `e2e/import-export.spec.js`.

**Interfaces:**
- V3 program file: `{version:3,kind:'program',templates:[{key,template}],program:{name,mode,goals,workouts:[{key,templateKey,day}],sequence?:[{type:'workout',workoutKey}|{type:'rest',key}]}}`. Keys are nonempty strings <=100 characters, unique within their namespace; occurrence/rest keys also cannot collide. No DB IDs/revisions or catalog links are trusted.
- V3 template file: `{version:3,kind:'template',template:Workout}`. Portable exercise metadata is optional `{equipment,referenceDescription,variantDescription,brand,focusTags}` with string labels, no internal IDs. Task B extends metadata rendering; Stage A must already retain these optional validated values during round trips.
- `parseDocumentBundle(text) -> {bundle}|{error}` returns a normalized portable bundle for v1/v2/v3 without writes. Missing legacy timing defaults remain; explicit invalid values reject. Keep existing v1/v2 parser tests, adapting expected output at this new boundary.
- `serializeDocumentBundle(bundle) -> string` strictly validates, strips internal identities and deduplicates only by actual shared template ID. `commands.importDocument` remaps keys to server-generated stable IDs once per operation, validates all content, and commits all documents/index/operation result atomically.

- [ ] Add round-trip tests: exported repeated occurrences reference one `templateKey`; import creates one fresh template for them; two equal legacy copies create two fresh templates; duplicate/missing keys and references, malformed sequence, forged catalog IDs, invalid equipment/metadata types, explicit bad timing, unknown muscles and >1 MiB all reject with no writes. Assert v1/v2 inputs still import with timing defaults.
- [ ] Test import transaction rollback on final program insert/index failure, lost acknowledgement replay and mismatched replay intent. Existing-editor replacement requires its revision; a stale replacement rolls back all newly created templates. Detached old templates remain. User declining replacement creates nothing.
- [ ] Test importing a template into the shared template editor (including when entered from a program): after confirmation replace the same template ID at its expected revision, so all existing occurrences update. Library template import creates a fresh template instead. Program-bundle import into a template editor rejects kind mismatch; no templates or programs are created by that rejection.
- [ ] Run `node --test test/document-bundle.test.js test/document-import.test.js test/document-file.test.js` and `npx playwright test e2e/import-export.spec.js`; confirm new assertions fail.
- [ ] Implement bundle serializers/parsers and atomic command, keeping 1 MiB limits before parsing and before requests. Stage A portable metadata validation uses descriptions <=2,000 characters, Brand <=80 characters or absent, Focus distinct labels <=80 characters each, known equipment or absent. Stage B uses the same shapes; imported metadata remains unlinked and is never converted to trusted tag assignments.
- [ ] Implement import target branching: absent target creates a library record; template target replaces that template's content; program target replaces arrangement and attaches newly imported templates. Compare target revision and kind in the transaction before any writes. Keep exact-operation replay independent from the current target revision so a committed response can be recovered safely.
- [ ] Wire library/editor import and export to bundle commands; flush saves, fetch one consistent bundle snapshot, and reject if a template revision changed after the locally acknowledged revision rather than silently exporting someone else's unreviewed changes. Validate every occurrence and focus the first invalid session/field. Exporting one workout uses its template document; local date filename convention stays unchanged.
- [ ] Rerun focused tests/browser flows to zero failures; commit as `feat: preserve shared sessions in portable v3 files`.

### Task 6: Verify stage A and document safe rollout

**Files:** Modify `docs/design-system/README.md`, `AGENTS.md`, existing `README.md`; create `docs/operations/shared-sessions-rollout.md`; modify `e2e/compact-desktop.spec.js`, `e2e/navigation-transitions.spec.js` and relevant existing persistence/reorder tests.

**Interfaces:** Operational runbook describes the exact migration command (`npm run db:migrate`), environment selection via existing server env variables, migration version 5, backup/restore checks and maintenance-window sequencing. Never add production migration to builds/requests.

- [ ] Update existing program fixtures/helpers to create templates and link occurrences explicitly; retain tests proving genuine user behaviors. Add E2E assertions for shared-state labels, all recovery paths, real Back/Forward/reload, Sequence rest/Week assignments and archived catalog selection.
- [ ] Document and rehearse on a disposable pre-005 database: backup with a database-consistent mechanism (SQLite backup when local, provider snapshot when remote), record resolved contents/counts, run migration explicitly, compare contents and link integrity, rerun migration and verify unchanged counts/revisions. Restore the copied backup and verify the previous app/data together. Do not run against the user's local/production data during implementation without the authorized rollout scope.
- [ ] Review populated 1366×768, 1440×900, 1920×1080, tablet and 390px screens, 200% text, hybrid/coarse input, normal/reduced motion. Test disclosure reversal, keyboard/focus, Reorder, touch and error wrapping. Playwright defaults to reduced motion, so explicitly use `reducedMotion:'no-preference'` for actual motion checks. Record measurements/screenshots and behavioral results separately; fix density/transition problems before completion.
- [ ] Run `npm test`, `npm run test:e2e`, `npm run build`, then `git diff --check`; require zero failures and successful build. Do not describe unexecuted tests as passing.
- [ ] Update AGENTS.md's superseded independent-copy clauses, design-system sharing/editor rules and the rollout guide. Specify old tabs/clients must reload, no mixed-version writers during conversion, link deletion restrictions, v3 files and retained v1/v2 imports. Keep all prior catalog/timing constraints.
- [ ] Commit as `docs: verify and document shared-session rollout`; present evidence and remaining gaps. Stage A release gate: all checks pass, migration rehearsal preserves data, production rollout is separately explicit. Proceed to Stage B only against the linked storage model.

## Test assertion anchors and plan self-review

Use these assertions in the owning integration tests with fixture records named as shown; they pin the storage boundary without prescribing implementation bodies:

```js
// Tasks 1–3: preserve separate legacy copies, resolve repeated new occurrences.
assert.notEqual(migrated.workouts[0].templateId, migrated.workouts[1].templateId);
assert.deepEqual(Object.keys(storedProgram.workouts[0]).sort(), ['day','id','templateId']);
assert.equal(computeProgramVolume(resolvedRepeatedProgram).Chest, 8);
assert.equal(afterPropagation.programRevision, beforePropagation.programRevision);
assert.equal(afterPropagation.templateRevision, beforePropagation.templateRevision + 1);
// Tasks 2/5: exact replay must not create extra records.
assert.deepEqual(await commands.createAndAttach(request), firstCommittedResult);
assert.equal((await repository.list('template')).length, expectedTemplateCount);
// Task 5: reject dangling portable keys before beginning writes.
assert.match(parseDocumentBundle(danglingTemplateKeyJson).error, /template/i);
```

Coverage checked against the approved spec: storage/migration (1–2), concurrency and editing (2–4), catalog/volume/analysis (3), duplicate/remove/delete/recovery (2/4), portable files and replacement semantics (5), density/motion/rollout/documentation (6). Every Review Focus item has a named scenario in its owning task. This document is a plan, not evidence that its implementation tests have run.
