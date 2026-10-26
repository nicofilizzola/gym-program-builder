# Workout Duration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking. Subagent-driven execution is an alternative only if the user selects it.

**Goal:** Show live workout duration estimates with independently editable exercise rest, session allowances, catalog-derived initial defaults and program card labels.

**Architecture:** A pure duration module owns limits, normalization and calculation; document validation and repository reads preserve/default inputs, while views derive totals. Catalog classification only initializes rest on first selection; saved workout rest is independent of subsequent reference changes. The committed catalog/reference prerequisite at 964f00b is integrated into this feature branch; reference groups own classification, and variants expose their group default for initial selection.

**Tech Stack:** Plain JavaScript ES modules, native range inputs, Node.js 24, SQLite/libSQL, node:test and Playwright.

**Spec:** `docs/superpowers/specs/2026-10-25-workout-duration-design.md` (approved).

## Global Constraints

- No new dependency, frontend framework, ORM, browser persistence or service.
- Execution time is fixed at 60 seconds per set.
- Count rest after every set, including the last set of each exercise.
- Exercise rest: integer 0–300 seconds inclusive, multiple of 15; fallback 120 seconds.
- Reference-group defaults: compound 180 seconds; isolation 90 seconds; variants share the group default.
- Extra time: integer 0–60 minutes inclusive, default 5.
- Buffer: integer 0–50 percent inclusive, multiple of 5, default 10.
- Buffer applies to execution, rest and fixed extra time together; round only the final displayed total upward to whole minutes.
- Empty workouts display `~0 min` without losing stored allowances.
- Persist timing inputs only; no derived totals or transient disclosure state.
- Continue version-2 exports and version-1/version-2 imports; missing timing fields receive defaults, explicit invalid values fail whole-file validation.
- Preserve autosave, revisions, retry/conflict recovery, copy independence, static publication allowlist and server-side secrets.
- Keep desktop figures 180–200px, native slider hit areas 44px and touch/hybrid targets at least 44×44px.
- Change authoritative visual values in `style.css` first and update `docs/design-system/README.md` in the same implementation change.
- Never run production migrations or seeds during builds or requests.

## Review Focus

1. Missing legacy fields versus explicit null/invalid fields: only absence defaults (Task 2).
2. Normalized legacy reads and ambiguous retries must not create revision changes or false conflicts (Task 2).
3. Catalog refresh, replacement, propagation and async reorder/remove must preserve independent rest (Task 5).
4. Large names, 200% text and hybrid input must keep controls, figures and duration details reachable (Tasks 3 and 6).
5. Copies, version-1 imports and program editor round trips must retain all timing settings without sharing mutable state (Tasks 2 and 4).

## Execution status

All six tasks are implemented and verified on `feat/workout-duration`. The committed catalog/reference prerequisite through964f00b was integrated at2d7509a. Final verification:140 unit tests,121 browser tests, explicit local migration/seed replay and production build all pass. One independent review's Important creation-retry finding was reproduced and fixed; its minor malformed-import message issue is documented as deferred. No merge into main or deployment has been performed. See `docs/superpowers/reports/2026-10-25-workout-duration.md`.

## File map and dependency checkpoint

- Create `src/duration.js`: limits/defaults, input normalization, pure totals and time formatting.
- Create `src/duration-controls.js`: scoped duration disclosure/sliders, update and teardown lifecycle.
- Modify `src/exercise.js`, `src/program.js`, `src/volume.js`: exercise/workout constructors, copies and typedefs.
- Modify `src/validate.js`, `src/document-validation.js`, `src/document-file.js`, `src/session-file.js`: strict timing validation, legacy defaults and portable round trips.
- Modify `server/repository.js`: normalize old reads and idempotent comparisons without write-on-read.
- Modify `src/session-markup.js`, `src/session-editor.js`, `src/program-view.js`: summary, rest sliders, live refresh and card labels.
- Modify `style.css`, `docs/design-system/README.md`: responsive layout and documented component rules.
- Add `test/duration.test.js`, `e2e/duration.spec.js`; extend existing domain, repository, file and recovery tests.
- Task 5 lists the concrete catalog/reference integration files and the explicit seed command after the committed prerequisite became available.

Tasks 1–4 can be developed using legacy/custom exercises before the catalog lands. Task 5 and release verification require the approved catalog feature, including its migration/seed command and propagation tests. Do not claim full feature completion from Tasks 1–4 alone.

### Task 1: Pure timing model and defaults

**Files:** Create `src/duration.js`, `test/duration.test.js`; modify `src/exercise.js`, `src/program.js`, `src/volume.js`, `test/exercise.test.js`, `test/program.test.js`.

**Interfaces:**
- Export `DURATION_LIMITS = {restSeconds:{min:0,max:300,step:15},extraMinutes:{min:0,max:60,step:1},bufferPercent:{min:0,max:50,step:5}}`.
- Export `defaultRestSeconds(exerciseType) -> number`: 180 for compound, 90 for isolation, 120 when undefined; reject other supplied values.
- Export `normalizeWorkoutTiming(workout) -> new workout`: preserve all fields, clone exercises, supply absent rest/allowance fields only; validation remains the validator's responsibility.
- Export `computeDuration(workout) -> {executionSeconds,restSeconds,extraSeconds,bufferSeconds,totalSeconds,displayMinutes}`. Accept absent fields through normalization; skip exercises whose sets are outside the integer 1–10 range; do not mutate input. Empty workouts return all-zero components.
- Export `formatDuration(seconds) -> string`: whole seconds formatted as `0 sec`, `30 sec`, `1 min`, `1 min 30 sec`; use nearest second for fractional breakdown values only.
- Export `durationLabel(workout) -> string`: `~${displayMinutes} min`.
- `createExercise()` supplies restSeconds 120. `createTemplate()` supplies allowances 5/10. `copyWorkout(template,id)` preserves allowances, rest and all catalog metadata while replacing workout ID/day as before.

- [x] **Step 1: Write failing calculation and copy tests.** Assert 3×180s rest plus 3×90s rest yields execution=360, rest=810, extra=300, buffer=147, total=1617, displayMinutes=27. Assert 3 sets with rest=120 and zero allowances yields 540 seconds; zero rest gives 180. Assert empty workout gives zero even with defaults; unnamed valid-set exercises count; invalid sets `0`, `11`, `1.5`, `NaN` count zero. Assert 1 set/rest=0/extra=0/buffer=5 gives 63 seconds and `~2 min`. Maximum one exercise gives 3,600 execution/rest base seconds + 3,600 extra seconds, then 50% = 10,800 seconds / 180 minutes. Assert no mutation, name/reps/muscle/order independence, and exact defaultRestSeconds mappings. Assert copied timing can change without changing source.
- [x] **Step 2:** Run `node --test test/duration.test.js test/exercise.test.js test/program.test.js`; confirm failures identify missing timing behavior.
- [x] **Step 3:** Implement the exported interfaces and constructor/copy changes. Update Exercise/Workout typedefs; do not introduce an alternate volume calculation.
- [x] **Step 4:** Run the same command; expect all tests pass. Update old constructor expectations with explicit timing fields.
- [x] **Step 5:** Commit as `feat: add workout duration calculation and defaults`.

### Task 2: Validation, compatibility and durable timing

**Files:** Modify `src/validate.js`, `src/document-validation.js`, `src/document-file.js`, `src/session-file.js`, `server/repository.js`, `test/validate.test.js`, `test/document-validation.test.js`, `test/document-file.test.js`, `test/session-file.test.js`, `test/repository.test.js`.

**Interfaces:** Consume Task 1 normalization/limits. Preserve `validateDocument(kind,value,{draft}) -> {document}|{error}`, `parseDocument`, `serializeDocument` and repository signatures. Successful canonical documents always include all timing inputs; v1's legacy parser can retain its old public session shape, but `parseDocument` must upgrade its output to a complete normalized workout. `validateExercise` checks explicit rest against limits while allowing legacy absence for callers; document canonicalization supplies defaults.

- [x] **Step 1: Write failing compatibility tests.** In both template and nested program workouts, absent fields become 120/5/10; null, strings, negatives, infinity, rest 301/14, extra 61/0.5 and buffer 51/7 fail strict and draft validation. Explicit zeros survive. Exercise errors identify exercise number. Export and reimport nondefault timing exactly; v1 and old v2 receive defaults; malformed later exercises reject the entire import. Catalog metadata remains stripped under the catalog contract while timing stays portable.
- [x] **Step 2: Write failing repository tests.** Insert legacy raw document JSON using the test DB helper; get returns normalized values without changing stored JSON/revision/timestamps. Replay an ambiguous create/update with normalized equivalent defaults and assert idempotent success, including a saved legacy payload. Two stale devices editing rest/allowances still conflict; accepted revision increments once and retains inputs. Confirm invalid timing cannot reach storage.
- [x] **Step 3:** Run `node --test test/validate.test.js test/document-validation.test.js test/document-file.test.js test/session-file.test.js test/repository.test.js`; confirm expected failures.
- [x] **Step 4:** Extend canonical field construction (currently it explicitly lists exercise/workout fields), legacy import upgrade and portable serialization. Normalize both operands in idempotency comparisons and read results without database writes. Keep stored revision checks and error recovery intact. Do not normalize invalid explicit fields into valid defaults.
- [x] **Step 5:** Run the same tests and `npm test`; expect all pass, adjusting exact object/JSON expectations where defaults are now canonical.
- [x] **Step 6:** Commit as `feat: persist and export workout timing with legacy defaults`.

### Task 3: Session duration controls and exercise rest

**Files:** Create `src/duration-controls.js`, `e2e/duration.spec.js`; modify `src/session-markup.js`, `src/session-editor.js`, `src/exercise.js`, `style.css`, `docs/design-system/README.md`, `test/exercise.test.js`.

**Interfaces:** `mountDurationControls(host,{workout,onChange}) -> {update(workout),destroy()}`; onChange emits `{extraMinutes,bufferPercent}` only. Its nodes are built once; update must not replace focused sliders or reset disclosure. Summary copy: `Estimated duration` plus Task 1 label; disclosure labels `Show duration details` / `Hide duration details`, breakdown labels Execution, Rest, Extra time, Buffer. Editor retains its existing API and onChange emits full workout including timing. Rest slider uses `data-field="restSeconds"`, accessible name `Rest per set`, and formatted aria-valuetext. Summary appends `rest ${formatDuration(restSeconds)}`.

- [x] **Step 1: Write failing browser tests.** Mount a populated template through existing authenticated fixtures: assert the 27-minute example; sets, rest and allowance input events update the total immediately without rerendering focused controls. Assert rest slider bounds/step 0/300/15, extra 0/60/1 and buffer 0/50/5; zero clears allowances. Verify keyboard arrows/Home/End, disclosure aria-expanded/focus, collapsed summary rest, empty `~0 min`, and an unfinished exercise contributing time. Test detail display preserves precision via seconds without rounding calculation components.
- [x] **Step 2:** Add summary unit expectations and run `node --test test/exercise.test.js` and `npx playwright test e2e/duration.spec.js`; confirm failures are feature assertions.
- [x] **Step 3:** Build compact summary/disclosure near heading, native allowance sliders and rest slider following existing fill/value/focus conventions. Wire refresh to timing without losing name, goals or metadata. Normalize incoming workout at mount/update boundaries. Destroy listeners/controls during editor teardown. Keep disclosure outside collapsing exercise cards; no additional live announcements.
- [x] **Step 4:** Apply CSS first, then document placement, responsive wrapping, slider values and 44px input rules in the design system. Match existing palette/Barlow tokens and preserve figure sizing and mobile panel flow. Add mobile/200% text/hybrid assertions to the duration browser test using existing layout-test helpers.
- [x] **Step 5:** Run unit summary tests and the duration browser test; expect pass. Check existing session editor and compact layout tests for regression.
- [x] **Step 6:** Commit as `feat: add live session duration and rest controls`.

### Task 4: Program labels and complete editing journeys

**Files:** Modify `src/program-view.js`, `e2e/duration.spec.js`, `e2e/recovery.spec.js`; extend `test/program.test.js` as needed.

**Interfaces:** Program cards consume `durationLabel(workout)` and show a noninteractive text element with accessible contextual text `Estimated duration ~N min`. Existing editor callbacks retain workout ID/day and all timing inputs; no program-level allowance or weekly total is added.

- [x] **Step 1: Write failing journey tests.** A copied template shows `~27 min` on its program card. Edit its rest/allowances, return, and assert updated label; source template is unchanged. Duplicate workout, edit duplicate timing and assert original unchanged. Switch sequence/schedule, assign day, move to Unscheduled and reorder; each workout keeps its estimate and settings. Round-trip a full program JSON with nondefault timing, then reload from server and assert exact inputs.
- [x] **Step 2:** Add a recovery test editing rest and allowances before a failed save: retry retains edits; stale revision conflict and Save as copy retain timing while Reload saved version adopts saved values.
- [x] **Step 3:** Run `npx playwright test e2e/duration.spec.js e2e/recovery.spec.js`; confirm failures.
- [x] **Step 4:** Render label in `.workout-metadata`; ensure no extraction path drops allowances. Extend metadata wrapping CSS/documentation if needed without disrupting muscle-match badge space, actions or day selector. Reuse existing save/recovery APIs rather than adding timing-specific transport.
- [x] **Step 5:** Run the same browser tests plus `node --test test/program.test.js`; expect pass.
- [x] **Step 6:** Commit as `feat: show duration estimates throughout programs`.

### Task 5: Reference classification and initial-rest integration

**Files:** Create `migrations/004-workout-timing.sql`, `test/duration-catalog.test.js`, `e2e/duration-catalog.spec.js`. Modify `server/db.js`, `server/reference-repository.js`, `server/catalog-repository.js`, `server/catalog-seed.js`, `src/reference-form.js`, `src/catalog-form.js`, `src/catalog-view.js`, `src/session-editor.js`; extend existing catalog/reference unit and browser fixtures, `e2e/recovery.spec.js`, `AGENTS.md`, `docs/deployment.md`, `docs/design-system/README.md`.

**Prerequisite:** Integrated catalog/reference implementation through 964f00b into this feature branch at 2d7509a. Its existing 136 combined unit tests passed before classification work. Do not modify the prerequisite branch or its separate preview database.

**Interfaces:** `reference.exerciseType` is compound/isolation; legacy references may retain null and use the 120-second fallback until classified. `referenceType(value)` in `server/reference-repository.js` validates new classes. New reference creation and new-reference-plus-variant creation require explicit type; name-only legacy updates preserve the stored type. Catalog reads expose each variant's current reference type, without persisting it in workout snapshots. First selection calls `defaultRestSeconds(entry.exerciseType ?? undefined)` only on a new unlinked, nonlegacy card. Existing prescriptions are preserved by replace/link/move/propagation/copy. Reference type changes increment only the reference revision, not document revisions.

- [x] **Step 1:** Write and watch failing tests for required classes, revision/retry conflicts, shared variant defaults, classification edits that leave saved documents unchanged, propagation/move/copy rest preservation, and reviewed seed defaults/idempotency. Tests live in `test/duration-catalog.test.js`.
- [x] **Step 2:** Write browser tests in `e2e/duration-catalog.spec.js` for initial 180/90-second values, override retention on replacement/reload/type edit, and required reference-form classification. Watch the initial-default assertion fail at actual120/expected180 before changing the editor.
- [x] **Step 3:** Implement migration 004's nullable exercise_type column, read/write validation, reference/inline creation controls, catalog labels and first-selection-only defaults. Explicit seed version2 classifies only missing types on unchanged active known seed references; preserve renamed/archived references and existing chosen classes. Update existing test fixtures to explicitly supply required classes.
- [x] **Step 4:** Run `npm.cmd run db:migrate` and `npm.cmd run db:seed` explicitly against disposable development SQLite; repeat to verify idempotency. Run `npm.cmd test`, combined catalog/duration/reference browser checks, then the full browser suite and build in Task6.
- [x] **Step 5:** Commit as `feat: initialize workout rest from reference exercise type`.

### Task 6: Release verification and documentation

**Files:** Extend `e2e/duration.spec.js`, existing relevant layout specs, `docs/design-system/README.md`; create `docs/superpowers/reports/2026-10-25-workout-duration.md` with observed verification results.

**Interfaces:** All previous public APIs remain stable. Production migrations/seeds are an explicit operator step, separate from publishing static files/build execution.

- [x] **Step 1:** Inspect populated template editors and program overviews at 1366×768, 1440×900 and 1920×1080; tablet 900px and mobile 390px/760px; include many exercises/muscles, long names, expanded details and errors. Inspect 200% text and hybrid/coarse input. Save review screenshots as local verification artifacts, not production assets.
- [x] **Step 2:** Assert no horizontal document overflow, duration/controls remain reachable, native slider hit areas stay 44px, hybrid targets stay at least 44×44px, and desktop figures remain at least 180px. Verify reduced motion, focus after disclosure/collapse/navigation, rest edits while collapsed summary refreshes, stable readout and tooltip overlays. Add targeted regression assertions only where the inspection reveals risk or a defect.
- [x] **Step 3:** Run `npm test`, `npm run test:e2e`, `npm run build` after the explicit development migration/seed. Expect all commands exit 0. Fix failures and rerun affected checks; rerun full required checks after final code changes. Confirm build output allowlist still excludes server code, fixtures and secrets.
- [x] **Step 4:** Review implementation against the spec, especially the catalog prerequisite, backward compatibility and reference-default independence. Record exact checks/results, screenshots, known limits and explicit environment migration/seed instructions in the report. Do not claim production migration/deployment unless separately performed.
- [x] **Step 5:** Commit as `docs: verify workout duration release` and present the resulting branch/changes for the user's chosen integration workflow.
