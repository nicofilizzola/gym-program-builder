# Program Hypertrophy Analysis v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a read-only whole-program hypertrophy review informed by three optional, saved context fields, with concise actionable feedback and the existing streaming experience.

**Architecture:** Add program context to the existing revisioned JSON document and portable v3 bundle. Build a validated, self-contained program snapshot with request-local shared-template keys and server-computed facts, then route it through the existing provider/SSE transport with a separate program prompt. Reuse the session report/controller through explicit input and scope parameters; preserve the program toolbar and overlay instances during routine updates.

**Tech Stack:** Node.js 24, native JavaScript modules/DOM/CSS, SQLite/libSQL, native fetch/SSE and OpenRouter; node:test and Playwright. No new dependency.

**Spec:** [Approved program analysis design](../specs/2026-10-31-program-analysis-design.md). Read it and [the design system](../../design-system/README.md), including its Feature design and review checklist, before implementation.

**Planning outcome:** No unresolved product decision blocks implementation. The fixed focus is hypertrophy; larger structural suggestions require an observed mismatch. Context persists and exports; reports are temporary and disappear on navigation, including entry into a session editor. Strength and general fitness remain explicitly deferred. Implementation has not started.

## Global Constraints

- "Each field allows at most 2,000 UTF-16 code units"; normalize line endings to LF, whitespace-only fields to empty, and treat missing context/fields as empty. Reject invalid types and excessive lengths without truncation.
- "Include context as optional plain-text metadata in v3 program bundles." Preserve existing v3 and v1/v2 imports, autosave revisions, retries, conflicts, drafts, copy independence and shared-template links. No migration/backfill is needed.
- "For v1, permit at most 50 occurrences, 40 exercises per distinct template and 400 exercise instances after counting repeated occurrences." Program requests are at most 256 KiB UTF-8; session requests remain at most 64 KiB.
- "Count every occurrence, including repeated templates and Unscheduled workouts; rests contribute no volume." Use current muscle, volume and timing functions, including Glutes; no hard-coded old 12-muscle list.
- "Do not assume one card equals one calendar day, a seven-day cycle, or a known repeat interval." Week and Sequence have distinct interpretation rules; do not change the existing weekly panel.
- "Target 300–450 words when there are substantive findings, at most 550." Zero to three improvements; no required criticism, scores, model-generated links, HTML, chat, automatic changes or new training focuses.
- "Retain the existing generation timeout, output-byte limit, no automatic provider fallback/retry, and server-side secrets." Current values: 60 seconds, 64 KiB output and 1,500 output tokens; hosting maxDuration is 75 seconds. No paid requests in automated tests/builds and no private-program logging.
- "Reuse the analysis overlay's 180ms ease-out opacity and 4px vertical translation for both new surfaces"; reduced motion is immediate. Preserve nodes through exit, rapid reversal, focus/inert/ARIA behavior, 32px fine-only desktop and 44px touch/hybrid targets.
- "Routine program-view rerenders preserve the controller, report and open context draft; only actual navigation/unmount discards transient analysis." Exact content reverts clear staleness; revision changes alone do not make a report stale.
- Run `npm test`, `npm run test:e2e`, `npm run build` and the specified populated real-browser checks before shipping. Never migrate/seed a production environment during builds or requests.

## Review Focus

1. A shared-template refresh lands while context has focus and an unsaved edit: retain the dialog, value, caret and report; refresh analysis content without losing the local edit. Pin in Tasks 5–6.
2. A program contains only context and an imported file would replace it: request replacement confirmation; declining retains all context. Pin in Tasks 1 and 6.
3. Repeated occurrences share a template, but another template has the same name/content: preserve sharing only for the actual shared identity, count all occurrences, and explain the scope of suggested edits. Pin in Tasks 2 and 7.
4. A Sequence has retained weekday assignments, explicit rests and Unscheduled entries: preserve the raw facts without inventing a weekly cadence or treating a rest as an exercise. Pin in Tasks 2 and 7.
5. Unicode/long prose, malformed metadata or streamed/chunked oversized JSON reaches analysis: reject the complete invalid input before provider access; expose useful errors with no silent truncation or private ID leakage. Pin in Tasks 1–3.

## File and interface map

| Files | Responsibility |
| --- | --- |
| New `src/program-context.js` | Context field constants, normalization and nonempty detection shared by validation/UI/import. |
| Existing `src/document-validation.js`, `src/document-bundle.js`, `src/program.js`, `src/app.js`, `src/program-view.js` | Retain optional context across document boundaries, copies and replacement confirmation. |
| New `src/program-analysis-input.js` | Convert a resolved program to a canonical wire snapshot; independently validate/sanitize wire snapshots. |
| New `server/program-analysis-prompt.js` | Server facts, separately versioned hypertrophy prompt and messages. |
| Existing `server/analysis-service.js`, `server/api.js`, `src/analysis-client.js` | Program scope and endpoint through existing provider/SSE behavior. |
| Existing `src/analysis-controller.js`, `src/analysis-panel.js` | Reusable snapshot getter and scope labels; expose controlled close without rebuilding the report. |
| New `src/program-context-dialog.js` | Persistent context editor, live edits, motion/focus and external value synchronization. |
| Existing `src/program-view.js`, `src/app.js`, `style.css`, `docs/design-system/README.md` | Toolbar integration, capability, preserved mounting, refresh coordination, layout and authoritative UI documentation. |
| New `test/fixtures/analysis-programs.js`, `scripts/evaluate-program-analysis.js` | Synthetic prompt cases and explicit single-fixture paid evaluation. |
| New `docs/superpowers/verification/2026-10-31-program-analysis.md`; existing `docs/deployment.md`, `AGENTS.md` | Verification record, release instructions and current requirements. |

Keep current JSON storage, SSE parser, report renderer, autosave queue and domain math. Do not split unrelated app/catalog code. No new DB table, migration, seed, dependency or public asset type is required.

### Wire contract used by Tasks 2–4

`ProgramAnalysisSnapshot` is `{focus:'hypertrophy',name,context,mode,goals,templates,workouts,sequence}`. `templates` contains `{key,workout}`; `workouts` contains `{key,templateKey,day}`. `sequence` contains `{type:'workout',workoutKey}` or `{type:'rest',key}` and is always materialized from `getSequence` when absent on the source. `mode` retains existing wire values `'schedule'|'simple'`. Session content retains the existing analysis fields and adds only optional portable `referenceDescription`, `variantDescription`, `brand`, `focusTags`.

Generate `template-1`, `workout-1` and `rest-1` keys deterministically in first-occurrence/canonical order, never from internal IDs. Template keys reflect actual source `templateId` sharing, not content equality. The wire validator requires consecutive generated keys in their respective array/sequence order, preventing arbitrary private identifiers from passing through key fields. Exercise `position` is derived from array order. Canonicalize muscle/goals/context/metadata field ordering, so unchanged semantic content has identical JSON. Provider-visible occurrence labels use position, session name and weekday/Unscheduled where applicable; do not ask users to interpret request-local keys.

Use local `analysisError` metadata `{occurrenceIndex,exerciseIndex?,field?}` with zero-based indices for validation feedback. Application-owned links resolve the index against the current program; never use a model-generated destination. The builder rejects inconsistent source content for one template identity. The wire validator strips unknown fields/IDs and recomputes positions; it rejects unknown focus, duplicate/dangling keys, unused templates, invalid arrays/values and invalid sequence membership/order. Weekly goals use existing 0.5–30-by-0.5 validation; session goals retain 0.5–12-by-0.5 validation.

---

### Task 1: Preserve program context through validation, saving and portable files

**Files:** Create `src/program-context.js`, `test/program-context.test.js`; modify `src/document-validation.js`, `src/app.js`, `src/program-view.js`, `test/document-validation.test.js`, `test/document-bundle.test.js`, `test/document-import.test.js`, `test/program.test.js`, `test/shared-session-repository.test.js`. Modify `src/document-bundle.js` or `src/program.js` only if the new regression tests reveal a field-dropping boundary; their existing spread/deep-clone paths should already retain context.

**Interfaces:** Export `PROGRAM_CONTEXT_FIELDS` (the three approved property names in visible order), `PROGRAM_CONTEXT_MAX_LENGTH=2000`, `normalizeProgramContext(value=undefined) -> Context` and `hasProgramContext(program) -> boolean`. Normalization always returns all three string fields, rejects null/nonobjects/arrays/nonstring present fields, and preserves meaningful whitespace. Document validation persists normalized context only when at least one field is nonempty; missing context remains absent on old documents.

- [x] **Step 1:** Add failing tests for missing/partial/empty context, LF normalization before length validation, 2,000/2,001 boundaries including surrogate pairs, invalid types, and nonmutation. Pin the core assertions:

  ```js
  assert.equal(normalizeProgramContext({goalsAndPriorities:'a\r\nb'}).goalsAndPriorities,'a\nb');
  assert.equal(normalizeProgramContext({goalsAndPriorities:'💪'.repeat(1000)}).goalsAndPriorities.length,2000);
  assert.throws(()=>normalizeProgramContext({goalsAndPriorities:'💪'.repeat(1001)}),/2000|2,000/);
  assert.equal(hasProgramContext({context:{goalsAndPriorities:' \n '}}),false);
  ```

- [x] **Step 2:** Add persistence/portability assertions: draft and strict validators retain context; repository create/update/read and create-and-attach retain it; stale saves reject without altering it; duplication mutations do not affect the original; program bundles round-trip context and sharing; malformed context rejects an atomic import without new records; template exports contain no program context; missing-context v1/v2/v3 files still import. Run `node --test test/program-context.test.js test/document-validation.test.js test/document-bundle.test.js test/document-import.test.js test/program.test.js test/shared-session-repository.test.js`; expect failures from the missing helper and stripped context.
- [x] **Step 3:** Implement the helper and program validation retention. Reuse existing document/copy/import paths rather than changing their architecture. Keep the 1 MiB document/file limit. Normal reads do not add a revision or issue a write for empty defaults.
- [x] **Step 4:** In `src/app.js`'s `importFile` nonempty calculation and the legacy fallback in `src/program-view.js`, include `hasProgramContext(...)`. Preserve the existing confirmation generation/revision guards. Do not add a second confirmation flow.
- [x] **Step 5:** Rerun Step 2's command; expect zero failures. Add a repository assertion that reading an old context-free document leaves its revision unchanged. Commit the task files with `feat: persist portable program context`.

### Task 2: Define canonical program analysis inputs, facts and prompt

**Files:** Create `src/program-analysis-input.js`, `server/program-analysis-prompt.js`, `test/program-analysis-input.test.js`, `test/program-analysis-prompt.test.js`, `test/fixtures/analysis-programs.js`. Reuse `src/analysis-input.js`, `src/program-context.js`, `src/program-sequence.js`, `src/program-volume.js`, `src/volume.js`, `src/duration.js` without changing session math/allowlists.

**Interfaces:** Export `PROGRAM_ANALYSIS_MAX_BYTES=262144`, `prepareProgramAnalysisSnapshot(resolvedProgram) -> ProgramAnalysisSnapshot`, and `validateProgramAnalysisSnapshot(value) -> ProgramAnalysisSnapshot`. Both validate the full input and throw `analysisError`; the builder maps resolved internal identities to local keys, the wire validator never needs internal IDs. Export `PROGRAM_ANALYSIS_PROMPT_VERSION='program-hypertrophy-v1'`, `computeProgramAnalysisFacts(snapshot) -> {volume,occurrenceCounts,sessions,scheduledDays,unscheduledCount}`, and `buildProgramAnalysisMessages(snapshot) -> [{role,content},...]`. `volume[m]` is `{direct,indirect,total}`; `occurrenceCounts[m]` is the number of occurrences involving the muscle; `sessions` contains `{key,templateKey,name,day,volume,duration}` per occurrence; `scheduledDays` is sorted unique nonnull weekdays, never inferred cadence.

Fixtures export `programAnalysisFixtures`, a named map of valid resolved programs, including `repeated-template`, `same-name-independent`, `sequence-unknown-cadence`, `priority-delts`, `priority-maintenance`, `time-mismatch`, `structural-mismatch`, `fixed-constraints`, `sound-program`, `absent-context`, `conflicting-context`, `unknown-exercise`, `unscheduled`, `malicious-text`, `long-program`. Invalid cases belong in unit tests, not the paid-evaluation fixture map. The repeated-template fixture has two occurrences of one template with three Chest-primary sets and Triceps-secondary sets per occurrence, plus one three-set Glutes-primary independent session.

- [x] **Step 1:** Add failing canonicalization/privacy tests. Assert repeated fixture `templates.length===2`, `workouts.length===3`, first two template keys equal, no database/catalog IDs or revisions in JSON, same-name-independent keys differ, unchanged repeated preparation has the same `analysisFingerprint`, and validating prepared output is idempotent. Editing/reverting each context field, metadata label/description, prescription, goal, mode, order and rest entry changes/restores the fingerprint; changing only revisions does not.
- [x] **Step 2:** Add failing boundary/error tests: no workouts, empty/missing template, null exercise, invalid muscle/goal/timing, inconsistent source content for one template ID, missing source identity, duplicate occurrence ID, malformed metadata, dangling/duplicate wire keys, unused templates and invalid sequence. Pin exact limits: 50/51 occurrences, 40/41 exercises in a template, 400/401 expanded exercise instances, 200/201 Unicode code points in names and 262144/262145 UTF-8 request bytes. Count multibyte input in bytes, not string length. Error index/field points to the first offending occurrence/exercise; input is never mutated.
- [x] **Step 3:** Add facts/prompt tests with these exact assertions, and named assertions for Sunday/Monday, two same-day sessions, Unscheduled, explicit rests and Sequence with retained weekdays:

  ```js
  assert.equal(facts.volume.Chest.direct,6);
  assert.equal(facts.volume.Triceps.indirect,3);
  assert.equal(facts.volume.Glutes.direct,3);
  assert.equal(facts.occurrenceCounts.Chest,2);
  assert.equal(facts.sessions.length,3);
  assert.deepEqual(facts.sessions[0].duration,computeDuration(program.workouts[0]));
  ```

  Assert all current `MUSCLE_GROUPS` are present; prompts include supplied goals/context and authoritative facts, treat qualitative text as untrusted data/self-report, distinguish schedule modes and shared-template consequences, allow no improvements, and enforce the four headings/550-word cap. Test prompt contracts, not exact subjective prose.
- [x] **Step 4:** Run `node --test test/program-analysis-input.test.js test/program-analysis-prompt.test.js`; expect missing exports/functions to fail. Implement the wire contract, validation and facts using current domain helpers. Canonical serialization includes `{snapshot}` envelope overhead when enforcing the program request-byte limit. Reject complete inputs without dropping sessions; strip unknown metadata without accepting invalid known fields.
- [x] **Step 5:** Implement the separately versioned server prompt from the approved Review contract. Resolve each occurrence to its supplied template for facts; label per-occurrence recommendations unambiguously and disclose edit sharing within this program plus possible uses elsewhere. Preserve Week cycle boundaries; Sequence totals remain program totals absent cadence. No inference of actual recovery, weekly cadence, equipment availability or observed progression.
- [x] **Step 6:** Run Step 4's command plus `node --test test/analysis-input.test.js test/analysis-prompt.test.js test/program-volume.test.js test/duration.test.js`; expect zero failures. Commit `feat: define whole-program hypertrophy analysis contract`.

### Task 3: Serve program analysis through the existing streaming infrastructure

**Files:** Modify `server/analysis-service.js`, `server/api.js`, `src/analysis-client.js`, `scripts/dev-server.js`, `test/analysis-service.test.js`, `test/analysis-api.test.js`, `test/analysis-client.test.js`; create `test/program-analysis-api.test.js`. Existing `api/index.js` continues constructing one service; change it only if required by the chosen shared interface, with no provider/config fork.

**Interfaces:** Extend service `analyze(snapshot,{signal,scope='session'}={}) -> Response` with server-owned `'session'|'program'` dispatch to the correct messages/version. Add `streamProgramAnalysis(snapshot,options) -> Promise<void>` in `src/analysis-client.js`; it reuses one private SSE consumer with the session function. Program request is `POST /api/analysis/program` with `{snapshot}`; session request remains `POST /api/analysis` with `{workout}`. Capability remains `GET /api/analysis -> {enabled:boolean}`. Request bodies cannot select arbitrary providers/prompts or override route scope.

- [ ] **Step 1:** Add failing API tests for program success, unchanged session success, GET capability compatibility, unauthorized/cross-origin/wrong-method requests, disabled configuration and invalid inputs before spending. Use provider call counters and assert zero calls for rejects; program route validates wire snapshots using Task 2. Test exact 256 KiB versus 64 KiB route limits, truthful byte-limit messages, absent/false Content-Length and a chunked overflow canceled before service access. With `calls` counting the injected service and `invalidRequest` containing an empty template, pin:

  ```js
  const response=await handler(invalidRequest);
  assert.equal(response.status,400);
  assert.equal((await response.json()).error.code,'INVALID');
  assert.equal(calls,0);
  ```
- [ ] **Step 2:** Add service/client tests asserting dispatch, wire envelope, same-origin credentials, program prompt version in `start`, shared configuration, and one provider call per explicit request. Fake program streams must exercise truncation (`finish_reason:'length'`), early EOF, malformed frames, post-200 errors, timeout and Stop/disconnect abort; assert no successful `complete` for an incomplete report. Retain safe error messages/no secrets/no auto retry. Run `node --test test/program-analysis-api.test.js test/analysis-api.test.js test/analysis-service.test.js test/analysis-client.test.js`; expect the missing route/function and dispatch to fail.
- [ ] **Step 3:** Implement strict route selection before the general API fallthrough. Reuse auth/origin guards and shared error mapping; generalize `body(request,limit)`'s size message for 262144 while preserving existing messages. Validate before provider invocation and preserve only safe indexed error details for program validation, never IDs/private raw input.
- [ ] **Step 4:** Extend the service with fixed scope dispatch while keeping 1500 tokens, 0.2 temperature, 60000ms timeout, 65536 output bytes, upstream cancellation and provider settings unchanged. Program and session `start.promptVersion` identify their actual prompts. Reject unsupported internal scope before a provider call.
- [ ] **Step 5:** Implement the program client entry using the shared SSE consumer; forward sanitized validation details on typed errors. Adapt `scripts/dev-server.js --test`'s injected fake `analyze` to both scopes with deterministic report/version text. Test mode never reads a real AI key or contacts OpenRouter. Normal dev and Vercel reuse the same service; existing streaming/backpressure bridge needs no rewrite.
- [ ] **Step 6:** Rerun Step 2's command plus `node --test test/api.test.js test/http-response.test.js test/analysis-evaluation.test.js`; expect zero failures. Commit `feat: stream authenticated program analysis`.

### Task 4: Reuse the analysis controller and panel without session regressions

**Files:** Modify `src/analysis-controller.js`, `src/analysis-panel.js`, `test/analysis-controller.test.js`, `e2e/session-analysis.spec.js`; create `test/program-analysis-controller.test.js`, `e2e/program-analysis-panel.spec.js`. Reuse `src/analysis-report.js` unchanged.

**Interfaces:** `createAnalysisController({getWorkout,getSnapshot,request=streamAnalysis,onState})` uses `getSnapshot()` when supplied, otherwise existing `prepareAnalysisSnapshot(getWorkout())`. A getter returns validated canonical snapshot data with a top-level `name`. Extend `mountAnalysisPanel({anchor,getWorkout,getSnapshot,scope='session',onValidationError,request,enabled=true})`. Return current `refresh,setEnabled,destroy` plus `close({restoreFocus=true}={}) -> void`. Program scope uses `Program analysis · Hypertrophy`, `Close program analysis`, `Program changed`, initial trigger `Analyze program`, and status `Analyzing program`; session labels stay compatible. All scope strings enter DOM as trusted static labels/text nodes.

- [ ] **Step 1:** Add controller tests supplying Task 2's builder through `getSnapshot`. Assert immutable current edits, context/arrangement/shared-content staleness and exact reverts; revision-only refresh stays current; invalid latest edits mark an old report stale; Stop and superseded generations abort and ignore late frames; Retry uses current data; destroy stops notifications. A request resolving after destroy cannot revive the report. A controlled pending request must pin:

  ```js
  controller.start();
  program.context.goalsAndPriorities='Prioritize delts';controller.refresh();
  assert.equal(controller.getState().stale,true);
  assert.equal(requests[0].snapshot.context.goalsAndPriorities,originalPriority);
  program.context.goalsAndPriorities=originalPriority;controller.refresh();
  assert.equal(controller.getState().stale,false);
  ```
- [ ] **Step 2:** Add isolated panel browser tests with fake pending requests: program labels, four safe headings, hidden generation, Stop/incomplete text, explicit Retry, no request on reopen, indexed validation callback and close-without-focus-restoration. Preserve scroll position and selected text during deltas, 48px follow threshold, Jump to latest and separate status announcements. Run `node --test test/analysis-controller.test.js test/program-analysis-controller.test.js` and `npx playwright test e2e/program-analysis-panel.spec.js`; expect new getter/scope/close behavior to fail.
- [ ] **Step 3:** Implement only the explicit getter/scope parameters; use existing canonical JSON fingerprinting and generation IDs. Fix any obsolete-abort capture revealed by overlapping generations by capturing the request's own AbortController, rather than inspecting a mutable controller variable. Do not create a second lifecycle implementation.
- [ ] **Step 4:** Parameterize trusted scope labels, default action text and availability copy. Expose `close({restoreFocus:false})` so opening context can release modal containment and make the report inert without briefly focusing its trigger. Preserve report/request state and existing 180ms desktop/mobile exit/reversal implementation.
- [ ] **Step 5:** Extend browser assertions for Escape/Close focus restoration, desktop nonmodal editing, mobile containment, breakpoint movement while streaming, rapid close/reopen and reduced motion. Run Step 2's commands plus `npx playwright test e2e/session-analysis.spec.js e2e/session-analysis-review.spec.js`; expect all pass. Commit `refactor: reuse analysis lifecycle for program reviews`.

### Task 5: Build the compact program context editor

**Files:** Create `src/program-context-dialog.js`, `e2e/program-context-dialog.spec.js`; modify `style.css`, `docs/design-system/README.md`. Do not change the shared confirmation dialog's existing 150ms containment behavior to implement this editor.

**Interfaces:** `mountProgramContextDialog({anchor,getContext,onChange,onBeforeOpen=()=>{}})` returns `{open,close({restoreFocus=true}={}),refresh,destroy}`. `getContext()` returns the current optional context; each input calls `onChange(normalizedContext)` immediately. The component owns its modal/exit surface and event cleanup, not persistence. Opening calls `onBeforeOpen` before showing the native modal. Refresh does not recreate inputs or reassign unchanged field values, preserving focus/caret and composition.

- [ ] **Step 1:** Add an isolated browser fixture with externally mutable context and an event log. Assert all three exact labels, three-row textareas, optional blanks, maxLength=2000, visible guidance, LF normalization, immediate changes and dismissal without revert. Pin opening focus to Goals and priorities, Done/Escape/backdrop returning to the anchor, and copy: `Optional context for your hypertrophy review. Saved with this program and included when you analyze it.` Include helper copy that notes are included in program exports. The fixture exposes its immediate value as `window.context`:

  ```js
  await page.getByRole('button',{name:'Program context',exact:true}).click();
  await expect(page.getByLabel('Goals and priorities',{exact:true})).toBeFocused();
  await page.getByLabel('Goals and priorities',{exact:true}).fill('Prioritize delts');
  expect(await page.evaluate(()=>window.context.goalsAndPriorities)).toBe('Prioritize delts');
  ```
- [ ] **Step 2:** Add tests for refresh of unchanged values during typing/IME and caret selection, updates to other fields without rebuilding the active textarea, rapid reversal, repeated Done, teardown during closing, reduced-motion changes while closing, and no animation on initial page rendering. Run `npx playwright test e2e/program-context-dialog.spec.js`; expect missing component/styles to fail.
- [ ] **Step 3:** Implement the persistent native modal with width min(640px, viewport minus 32px), three compact prose fields, vertical textarea resizing and a reachable Done action. Each textarea's `name` is its corresponding context property; associate its visible label through a stable id. Use design tokens and field-level errors if runtime invalid data is supplied. Bound typing/paste with native maxLength; server/import validation still rejects excessive input rather than truncating it.
- [ ] **Step 4:** Implement 180ms ease-out opacity/4px translation and mobile-safe backdrop fade by reusing the analysis exit-surface approach. End native containment before restoring outside focus, retain the painted exit node inert/aria-hidden, cancel old callbacks on reversal, and settle immediately for reduced motion. Keep one interactive context surface, no dialog stacking or new animation dependency.
- [ ] **Step 5:** Update authoritative CSS before documenting this pattern in the design system, including the new qualitative text-field exception to its existing names-only input wording. Verify long content, 200% text and short viewport heights in the fixture; keep 32px fine-only/44px touch controls. Rerun Step 2's command and `npx playwright test e2e/confirm-dialog.spec.js`; expect zero failures. Commit `feat: add guided program context editor`.

### Task 6: Integrate program analysis and preserve mounted state during refresh

**Files:** Modify `src/program-view.js`, `src/app.js`, `style.css`, `docs/design-system/README.md`; create `e2e/program-analysis.spec.js`, `e2e/program-context.spec.js`. Extend `e2e/shared-sessions.spec.js` only where it improves existing authenticated dependency-refresh fixtures. Use existing `e2e/confirmation-helper.js` for import confirmation.

**Interfaces:** Extend `mountProgramView` options with `analysisEnabled=false` and optional `analysisRequest` for isolated deterministic tests; return `setAnalysisEnabled(value)` in addition to existing public methods. Mount program analysis using `getSnapshot:()=>prepareProgramAnalysisSnapshot(value)` and `request:analysisRequest??streamProgramAnalysis`. Context changes update only `value.context`, call existing `emit`, and omit fully empty context using Task 1 helpers. Keep the three-field draft on the same program autosave queue.

- [ ] **Step 1:** Add authenticated browser fixtures using API-created valid linked templates/programs with context and intercepted program SSE. Assert Analyze program and Program context share the existing toolbar, current unsaved notes/name/arrangement reach the request, Context works when AI is disabled, and the four report sections show. Assert Analyze unavailable/loading states give an explanation without provider access and capability completion from a previous route cannot affect a newly mounted program.
- [ ] **Step 2:** Add preservation regressions with explicit delayed saves/streams: context has focus/selection while a template is edited through a second page and window focus revalidates dependencies; a matching save acknowledgement settles during typing; create-and-attach calls `mounted.update`; a program reorder/layout update occurs during generation. Assert the same dialog textarea/report nodes and request survive, text/caret stay intact, updated analysis input becomes stale, and exact content reverts clear it. A remote program revision conflicting with dirty context shows Conflict and retains the local draft; Retry/Reload/Save as copy follow existing semantics.
- [ ] **Step 3:** Add context-only import replacement assertions: accepting replaces notes, cancel retains them, invalid imported context changes nothing. Add persistence/reload and duplication/Save as copy independence tests. For invalid/empty sessions assert zero provider calls and a named error with an application-built native workout link; follow it and verify ordinary navigation cancels/discards the report. Reentering the program starts with no old report. After opening/editing context and completing a dependency refresh in Step 2, pin the original element identity and active selection:

  ```js
  expect(await page.evaluate(()=>window.originalContextField===document.querySelector('[name="goalsAndPriorities"]'))).toBe(true);
  await expect(page.getByLabel('Goals and priorities',{exact:true})).toHaveValue('Unsaved local priorities');
  await expect(page.getByLabel('Goals and priorities',{exact:true})).toBeFocused();
  expect(await page.getByLabel('Goals and priorities',{exact:true}).evaluate(el=>el.selectionStart)).toBe(7);
  ```

  Run `npx playwright test e2e/program-analysis.spec.js e2e/program-context.spec.js`; expect absent toolbar/integration and current destructive update behavior to fail.
- [ ] **Step 4:** Add labeled Analyze program/Program context actions beside existing file actions, preserving toolbar wrapping and body figures. Reuse `.analysis-trigger` with the existing SVG and a `[data-analysis-label]` span so the shared panel updates its trigger label. Coordinate context `onBeforeOpen` with `analysis.close({restoreFocus:false})`; closing context allows report reopening with no new request. `src/app.js` obtains capability for programs without blocking rendering, checks mounted ownership before applying it, and preserves standalone session setup.
- [ ] **Step 5:** Refactor program overview updates to patch the mounted overview rather than call `buildOverview()` on every `update`. Keep toolbar anchors, context component and analysis controller for the lifetime of the mounted program. Patch name/mode only when changed; rerender the workout area and update volume independently. Call both components' refresh from local `emit`, `syncSaved` and external `update`; preserve current selection and focused fields. Separate list/editor cleanup from overlay destruction. Destroy overlays only on true view teardown (including the legacy inline editor transition); normal import replacement may remount through the existing route pipeline.
- [ ] **Step 6:** Keep the existing `refreshActive` guards for queue ownership, dirty revision conflicts and in-flight acknowledgements. Consume resolved templates and current local arrangement together; never save resolved workout content back into the program. Program validation errors produce text plus a native href from `workoutHref(value.workouts[index].id)` and focus that link; use plain fallback text for program-wide errors with no valid target. Do not automatically navigate or generate model links.
- [ ] **Step 7:** Update toolbar/context/report rules in CSS and design-system documentation together. Run Step 3's command plus `npx playwright test e2e/programs.spec.js e2e/program-sequence.spec.js e2e/program-sequence-persistence.spec.js e2e/program-overview.spec.js e2e/shared-sessions.spec.js e2e/session-analysis.spec.js`; expect zero failures. Commit `feat: integrate whole-program hypertrophy reviews`.

### Task 7: Evaluate report quality and complete release verification

**Files:** Create `scripts/evaluate-program-analysis.js`, `test/program-analysis-evaluation.test.js`, `docs/superpowers/verification/2026-10-31-program-analysis.md`; extend `test/fixtures/analysis-programs.js`, `e2e/program-analysis.spec.js`, `e2e/program-context.spec.js`, `docs/deployment.md`, `AGENTS.md`. Modify `server/program-analysis-prompt.js` only when fixture evaluation demonstrates a specific issue; bump the program prompt version for behavior refinements without modifying session analysis.

**Interfaces:** Export `runProgramEvaluation({args=process.argv.slice(2),env=process.env,fetch=globalThis.fetch}={}) -> {exitCode,fixture?,model?,promptVersion?,report?,usage?,error?}`. Require exactly one known `--fixture <name>` and explicit `--live`. Build the snapshot with Task 2 and call the service with `{scope:'program'}`. Reuse existing SSE parsing; do not add a fixture loop or automatic retries. CLI command is `node --env-file-if-exists=.env.local scripts/evaluate-program-analysis.js --live --fixture <name>`.

- [ ] **Step 1:** Write failing evaluation tests: missing --live and unknown/missing/multiple fixture values return exitCode 2; invalid fixture input returns exitCode 1 before provider access; a fake valid stream makes exactly one fetch and returns program version/report/usage; incomplete output returns a failure with labeled partial text; output never exposes credentials. Pin the zero-spend guard:

  ```js
  const result=await runProgramEvaluation({args:[],env:{OPENROUTER_API_KEY:'private'},fetch:()=>assert.fail('must not spend')});
  assert.equal(result.exitCode,2);
  assert.equal(JSON.stringify(result).includes('private'),false);
  ```

  Run `node --test test/program-analysis-evaluation.test.js`; expect missing script/export to fail.
- [ ] **Step 2:** Implement the explicit single-fixture CLI and rerun Step 1's command. Keep invalid/empty/oversized fixtures in zero-spend validation tests. Extend valid fixtures as needed to cover all approved prompt cases, especially changing priorities on the same underlying program, deliberate maintenance, shared-template consequences and unknown Sequence cadence.
- [ ] **Step 3:** Run `npm test`, then `npm run test:e2e`, then `npm run build`; each must exit 0. Automated tests use fakes and disposable DBs only. Resolve failures in their owning task boundaries and rerun affected tests; repeat the full release checks after final code changes. Inspect build output to confirm only allowed index/CSS/browser src assets are published, no server code, prompts, tests or secrets.
- [ ] **Step 4:** Exercise populated real-browser screens at 1366×768, 1440×900, 1920×1080, 768×1024 and 390×844, plus 200% text and desktop touch/hybrid emulation. Inspect toolbar density/overflow, both body figures at required desktop heights, long notes/names/errors and reachable controls. Play open/close, rapid reversal, Escape/backdrop, keyboard/focus, both overlay transitions, reduced motion, mid-stream resizing/scrolling, dirty edits and dependency refreshes. Save screenshots for layout evidence; record motion/focus observations separately.
- [ ] **Step 5:** Before paid evaluation, verify the configured model/provider availability and current pricing through primary provider documentation; use separate existing development/preview keys and spending caps. Execute explicit fixture commands one at a time, not an automatic loop. Evaluate groundedness, priority sensitivity, actionability, restraint, sharing and scheduling interpretation, and completion within 1,500 tokens. Record synthetic reports, model/prompt versions, verdicts and observed cost in the verification document; never record real private programs or keys. If credentials are unavailable, finish offline verification and clearly mark live quality/release checks pending rather than inventing results.
- [ ] **Step 6:** Document local and preview smoke tests for real incremental streaming, Stop/disconnect cancellation and readable provider errors. Reuse `/api/analysis` capability and existing env configuration; no schema rollout is required. Preview/production databases and keys stay separate. Record preview/provider checks as pending until actually performed; no deployment is authorized by executing a test command. Update `AGENTS.md` with the shipped context/review contract and future-focus boundary after implementation.
- [ ] **Step 7:** Review the final diff against the spec and this checklist, then record actual automated/browser/live results and remaining gaps in the verification document. Commit `docs: verify and document program analysis rollout` with the CLI/tests/verification/docs and any evaluated prompt refinement. Hand off branch integration/release through the repository completion workflow; do not claim the feature shipped while mandatory live/preview checks remain pending.

## Dependencies and execution handoff

Execute Tasks 1–7 in order. Task 2 consumes context normalization; Task 3 consumes the wire/prompt contract; Task 4 exposes the shared controller/panel interfaces; Task 5 supplies the context surface; Task 6 integrates their lifetimes with program autosave/dependencies; Task 7 verifies the completed product. These tasks form one feature and one shipping plan.

At execution time, follow the chosen execution skill and `using-git-worktrees` before product changes. Preserve existing unrelated edits. The user has approved the spec and requested this plan; implementation execution method has not yet been selected. Recommend native execution because the seven tasks share input, transport and mounting interfaces and build on one another; a whole-branch independent review can follow the implementation. A subagent-driven implementation remains available if the user prefers per-task independent review.

Self-review coverage: context/portability maps to Task 1; inputs/facts/scheduling/prompt to Task 2; auth/limits/streaming to Task 3; lifecycle/safe report reuse to Task 4; context density/motion/focus to Task 5; save/refresh/navigation/integration to Task 6; evaluation, populated inspection and rollout to Task 7. Every Review Focus case has assertions in its owning task. No database migration, unused focus selector, report persistence or editing agent is part of this plan.
