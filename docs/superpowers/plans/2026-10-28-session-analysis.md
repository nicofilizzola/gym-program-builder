# Session Analysis Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Read both this plan and its spec before execution.

**Goal:** Ship a visually distinct, genuinely streamed hypertrophy review of the current session template, without changing or persisting its data.

**Architecture:** Prepare and validate an immutable session snapshot, calculate authoritative facts server-side, and stream OpenRouter output through an authenticated same-origin API. A separate report controller owns transient generation and presentation state, with desktop popover/mobile dialog presentations. Repair the development HTTP bridge so streaming and cancellation work locally as well as on Vercel.

**Tech Stack:** Node.js 24, native fetch/Web Streams, vanilla JavaScript/CSS, existing libSQL/auth, node:test and Playwright. No new runtime dependencies.

**Spec:** `docs/superpowers/specs/2026-10-28-session-analysis-design.md` (approved).

## Global Constraints

- V1 is a single report, with no chat, profile, follow-up questions or surrounding program context.
- No saved reports, schema migration, export changes or browser persistence.
- Analyze current edits, including unsaved changes. Never modify a workout automatically.
- Initially expose the feature only on standalone template routes.
- Allow at most 40 exercises, 200 Unicode code points per exercise/template name, and a 64 KiB UTF-8 JSON request body.
- Default model anthropic/claude-sonnet-4.6; 1500 output tokens; 64 KiB output bytes; 60-second absolute timeout; hosting duration at least 75 seconds.
- No automatic application retries. No paid requests in automated tests.
- Preserve existing Barlow/dark/orange design, body figure sizes, autosave, catalog refresh, focus and pointer-aware 32px/44px controls.
- Read `docs/design-system/README.md` and its Feature design and review checklist before implementation.

## Review Focus

- HTTP disconnect after headers must cancel upstream generation, including through the real local HTTP bridge (Task 3).
- Accounting-only frames, split Unicode and duplicate finish metadata must not truncate or falsely complete output (Task 2).
- A late frame after Stop, retry or navigation must never replace the current report (Task 4).
- Editing and then exactly reverting a snapshot must clear stale state without another paid request (Task 4).
- Switching mobile/desktop during streaming or closing must preserve text and restore usable focus (Task 5).

## File map and contracts

New files:

- `src/analysis-input.js`: shared allowlist, validation, canonical snapshot/fingerprint.
- `src/sse.js`: incremental UTF-8/SSE reader usable in server and browser.
- `server/analysis-prompt.js`: versioned system prompt and deterministic facts.
- `server/analysis-service.js`: OpenRouter adapter and normalized response stream.
- `server/http-response.js`: Node HTTP bridge for Web Responses with backpressure/disconnect handling.
- `src/analysis-client.js`: POST/fetch SSE consumer.
- `src/analysis-controller.js`: transient generation state independent of DOM.
- `src/analysis-report.js`: safe incremental report text renderer.
- `src/analysis-panel.js`: responsive overlay, controls, motion, scroll/focus behavior.
- `test/analysis-input.test.js`, `test/analysis-prompt.test.js`, `test/sse.test.js`, `test/analysis-service.test.js`, `test/analysis-api.test.js`, `test/http-response.test.js`, `test/analysis-client.test.js`, `test/analysis-controller.test.js`.
- `test/fixtures/analysis-sessions.js`: nonprivate representative prompt fixtures.
- `e2e/session-analysis.spec.js`: browser interaction and rendering tests with fake streams.
- `scripts/evaluate-analysis.js`: explicitly invoked paid fixture evaluation, never part of test/build.
- `docs/superpowers/verification/2026-10-28-session-analysis.md`: inspection and evaluation record.

Modify `server/api.js`, `api/index.js`, `scripts/dev-server.js`, `src/app.js`, `src/session-editor.js`, `src/session-markup.js`, `src/api-client.js`, `style.css`, `docs/design-system/README.md`, `.env.example`, `docs/deployment.md`, `vercel.json`.

Shared types (document with JSDoc; no TypeScript migration):

```js
// AnalysisSnapshot = {name, exercises:[{position,name,equipment?,sets,
//   repRange:{min,max},restSeconds,primaryMuscles,secondaryMuscles}],
//   goals,extraMinutes,bufferPercent}; position is one-based.
// AnalysisError = Error with {code,status,exerciseIndex?,field?}.
// AnalysisEvent = {type:'start',requestId,promptVersion}
//   | {type:'delta',text} | {type:'complete'}
//   | {type:'error',code,message}.
// AnalysisState = {phase:'idle'|'connecting'|'streaming'|'complete'|'stopped'|'error',
//   text,snapshotName,stale,error:null|{code,message}}.
```

Only `complete` means complete; stopped/error text is incomplete. Events arriving after a terminal event are protocol errors. Do not expose upstream frames to the UI.

### Task 1: Snapshot validation, authoritative facts and prompt

**Files:** create `src/analysis-input.js`, `server/analysis-prompt.js`, `test/analysis-input.test.js`, `test/analysis-prompt.test.js`, `test/fixtures/analysis-sessions.js`.

**Interfaces:**

- `prepareAnalysisSnapshot(workout) -> AnalysisSnapshot` throws AnalysisError; immutable clone, canonical muscle order and field order.
- `analysisFingerprint(snapshot) -> string` returns canonical JSON (no hash dependency).
- `buildAnalysisMessages(snapshot) -> [{role:'system',content:string},{role:'user',content:string}]`.
- `ANALYSIS_PROMPT_VERSION = 'session-hypertrophy-v1'`.

- [ ] Write input tests: reject 0/41 exercises, 201-code-point names, invalid sets/reps/mappings/rest; allow 40 exercises and 200 code points including astral characters; blank template name becomes Untitled session; strip IDs/arbitrary fields; retain known equipment; do not mutate source. Equipment is optional for custom exercises, invalid explicit equipment rejects.
- [ ] Write fact tests using Bench 4, Dips 3 and Pull-ups 3 from AGENTS.md: Chest=7, Triceps=5, Front delts=3.5, Lats=3, Biceps=1.5, Upper back=1.5; duration matches `computeDuration`; user totals never override computed values. Assert stable fingerprint after exact reversion and difference after each sent field changes.
- [ ] Write prompt tests asserting four report sections, zero-to-three improvements, 300-450-word target/550 maximum, heuristic caveat, no weekly verdicts or required full-body coverage, no invented effort/technique, untrusted JSON separated from system instructions. Add every fixture listed in the spec, including malicious exercise names and missing equipment.
- [ ] Run `node --test test/analysis-input.test.js test/analysis-prompt.test.js`; confirm meaningful failures before implementation.
- [ ] Implement the three exported functions. Reuse `normalizeWorkoutTiming`, `validateExercise`, timing/goal validation and `MUSCLE_GROUPS`; do not relax exercise validation simply to allow a blank template name. Explicitly allowlist fields rather than forward existing document/catalog metadata. Derive facts with `computeVolumeSplit`, `computeVolume`, `computeDuration`. Write the complete system prompt from the approved prompt contract, not a placeholder.
- [ ] Rerun the targeted command; expect all pass. Commit `feat: define session analysis input and prompt` with only task files staged.

### Task 2: Robust OpenRouter streaming service

**Files:** create `src/sse.js`, `server/analysis-service.js`, `test/sse.test.js`, `test/analysis-service.test.js`.

**Interfaces:**

- `readSse(stream,{signal,maxFrameBytes=65536}={}) -> AsyncIterable<{event:string,data:string}>`; caller owns JSON decoding.
- `createAnalysisService({apiKey,model='anthropic/claude-sonnet-4.6',fetch=globalThis.fetch,timeoutMs=60000,provider='Anthropic'}) -> {enabled:boolean, analyze(snapshot,{signal}):Promise<Response>}`.
- Response is normalized SSE containing Task 1/above AnalysisEvents. Empty key returns enabled=false; analyze fails with CONFIGURATION/503 before any upstream request. Create timeout per request, never at module initialization.

- [ ] Write SSE tests splitting a stream at every byte offset, including multibyte Unicode, CRLF, multiline data, comments, empty frames and an oversized unterminated frame; assert identical decoded events or bounded rejection.
- [ ] Write service tests with injected fetch: verify server-only Bearer auth, fixed endpoint, model/provider allowlist/no fallback, stream=true, max_tokens=1500, reasoning disabled and exact Task 1 messages. Assert content-free usage frames and repeated finish metadata are ignored.
- [ ] Test normal stop+[DONE] yields exactly one complete; finish_reason=length, missing terminal marker, provider error after HTTP 200, malformed JSON, output >65536 bytes and premature EOF yield incomplete error. Test 401/402/429/5xx mapping without secret leakage. Inject short timeoutMs to prove abort, and abort the downstream reader to prove upstream cancellation. No retry assertions: exactly one fetch per attempt.
- [ ] Run `node --test test/sse.test.js test/analysis-service.test.js`; confirm failure.
- [ ] Implement bounded incremental parsing and normalization. Start timeout before fetch and retain until reader ends/cancels; forward consumer and request cancellation, clean listeners/timers on every path. Count output UTF-8 bytes. Interpret upstream errors independent of HTTP status. Disable caching and transformation with SSE response headers. Validate provider-specific reasoning/provider fields against current official OpenRouter docs before locking request assertions; preserve spec behavior if API spelling differs.
- [ ] Rerun targeted tests; all pass. Commit `feat: stream bounded OpenRouter session reviews`.

### Task 3: Authenticated API and real HTTP streaming

**Files:** modify `server/api.js`, `api/index.js`, `scripts/dev-server.js`, `src/api-client.js`, `.env.example`, `vercel.json`; create `server/http-response.js`, `test/analysis-api.test.js`, `test/http-response.test.js`.

**Interfaces:**

- Extend `createApi` options with optional `analysis` service; existing callers remain valid.
- `GET /api/analysis` returns `{enabled:boolean}` after authentication.
- `POST /api/analysis` accepts `{workout: object}` and returns normalized SSE. Enforce streamed body <=65536 bytes even if Content-Length is absent/false. Reuse JSON parsing with configurable per-route limit; existing document limit remains 1 MiB.
- `pipeWebResponse(response,res,{signal}={}) -> Promise<void>` forwards Web Response status/headers/chunks, respects Node backpressure and cancels body on disconnection.
- API client adds `analysisCapability: async () => {enabled:boolean}`.

- [ ] Write API tests for capability secret exclusion, missing key/503, allowed method matrix (GET/POST only), login/origin enforcement before any provider call, JSON/body limit at and above 65536 bytes, invalid snapshot rejection, and independent useful AI errors. Assert documents/catalog still work with no configured service.
- [ ] Write an actual ephemeral Node HTTP test: controlled upstream emits first chunk, then waits on a test latch; client must receive that chunk before releasing completion. Disconnect client and assert upstream abort/body cancel; test JSON responses and backpressure. Do not rely on arbitrary sleep to prove streaming.
- [ ] Run `node --test test/analysis-api.test.js test/http-response.test.js test/api.test.js`; confirm new tests fail.
- [ ] Implement routing and bridge. Create analysis service with server env in production and normal development only. Test server gets a deterministic injected service with enabled=true, never reads a real API key or accesses OpenRouter. Link Node incoming request aborted and response close-before-finish to Request signal; avoid treating ordinary incoming request end as a disconnect. Replace response.arrayBuffer buffering in the dev server.
- [ ] Add blank OPENROUTER_API_KEY and default OPENROUTER_MODEL to `.env.example`. Set Vercel function maxDuration=75 for `api/index.js`, validating the current config syntax. Preserve Node 24 and existing rewrites/build behavior. Missing configuration must not break API initialization.
- [ ] Rerun targeted tests and `node --test test/api-client.test.js`; all pass. Commit `feat: expose authenticated streaming analysis API`.

### Task 4: Browser client and transient generation lifecycle

**Files:** create `src/analysis-client.js`, `src/analysis-controller.js`, `test/analysis-client.test.js`, `test/analysis-controller.test.js`.

**Interfaces:**

- `streamAnalysis(snapshot,{signal,onEvent,fetch=globalThis.fetch}) -> Promise<void>` POSTs `{workout:snapshot}` (server accepts canonical position fields but recomputes positions), consumes app SSE and throws AnalysisError for transport/protocol failures. Uses `credentials:'same-origin'`, cache no-store, JSON request and Accept text/event-stream.
- `createAnalysisController({getWorkout,request=streamAnalysis,onState}) -> {getState(),start(),stop(),refresh(),destroy()}`. `start()` prepares current snapshot, aborts older generation, resets report and returns a promise; refresh recomputes only stale status; stop retains text; destroy aborts and silences callbacks. Catch errors into state so UI event handlers do not leak unhandled rejections.

- [ ] Write client tests for JSON pre-stream errors, content-type mismatch, invalid event shapes, split chunks/Unicode, error events, missing complete, duplicate terminal events, reader cleanup on callback failure and abort.
- [ ] Write controller tests for deep snapshot capture, one request/start, no request on refresh, immediate connecting/streaming transitions, no mutation, stopped/error partial retention and timeout message. Deliver late fake events after Stop, second start and destroy; assert no stale writes. Edit/revert a name, rest, goals and equipment and assert stale true/false appropriately. Validation error must include exerciseIndex/field for editor focus and must not invoke request.
- [ ] Run `node --test test/analysis-client.test.js test/analysis-controller.test.js`; confirm failure.
- [ ] Implement functions using Task 1 fingerprint and Task 2 parser. Guard every callback with request identity and abort status. Treat intentional Stop separately from failed network generation. UI close/open is not a controller start/stop; presentation owns visibility only.
- [ ] Rerun targeted tests; all pass. Commit `feat: manage transient analysis generation state`.

### Task 5: Distinct responsive panel and editor integration

**Files:** create `src/analysis-report.js`, `src/analysis-panel.js`, `e2e/session-analysis.spec.js`; modify `src/app.js`, `src/session-editor.js`, `src/session-markup.js`, `style.css`, `docs/design-system/README.md`, optionally shared `src/action-controls.js` for a semantically appropriate SVG.

**Interfaces:**

- `mountAnalysisReport(container) -> {update(text),destroy()}` uses text nodes and only recognizes expected headings/list markers. Preserve existing block nodes during appends, including incomplete lines; no raw HTML/links.
- `mountAnalysisPanel({anchor,getWorkout,onValidationError,request=streamAnalysis}) -> {refresh(),destroy()}` owns one Task 4 controller, capability supplied by caller only mounts/enables when appropriate.
- Extend `mountSessionEditor` options with `analysisEnabled=false`. `src/app.js` obtains authenticated capability without blocking or failing ordinary editor rendering, and opts in standalone templates only. Program workout mounts default false. During capability loading keep Analyze unavailable with an accessible explanation; configuration-disabled state similarly explains unavailability without a provider request.
- Editor calls panel.refresh from its central refresh/setWorkout paths and panel.destroy on teardown. Validation callback expands/focuses via the same helper used for refused export; refactor that helper locally if necessary rather than duplicate animation/focus logic.

- [ ] Add Playwright tests using deterministic injected test-server streams and/or page route interception: toolbar layout, current unsaved input sent, strict invalid-exercise reveal/focus, blank template name, no Analyze on program workout, disabled capability explanation, no extra request on reopen, hidden-generation status, complete report sections and XSS strings rendered as text. Intercept provider paths to assert no external network.
- [ ] Add lifecycle browser tests: Stop+partial label, errors+Retry using latest edits, import/external-update stale state, edit/revert, old frames ignored, navigation abort, Close while streaming, no automatic regeneration. Verify selections/focus survive appended tokens.
- [ ] Run `npx playwright test e2e/session-analysis.spec.js`; confirm tests fail for missing UI.
- [ ] Implement safe incremental report rendering, panel markup and editor integration. Desktop manual popover uses labeled region and no focus trap/outside dismissal; at <=760px move the same report nodes into a native dialog with focus containment. Preserve report/controller and scroll state across breakpoints. Use heading focus on explicit open and logical toolbar focus on close; breakpoint adaptation keeps focus inside a visible control without needless announcement.
- [ ] Implement state controls/copy from spec: Preparing analysis, Analyzing, View analysis, Session changed, Analyze again, Stop, Retry, Jump to latest and explicit incomplete labels. Keep report aria-busy with separate polite status announcements, not live token announcements. A hidden generation changes toolbar state without reopening it.
- [ ] Implement 48px bottom-follow threshold, stable user scroll/selection, frame-batched appends and 150ms Jump to latest opacity. Clamp desktop panel to 16px viewport clearance; width <=480px and height <=viewport-32px; reposition without dismissing while scrolling/resizing. Full-screen mobile sheet gets safe-area padding and reachable actions.
- [ ] Implement 180ms ease-out opacity/4px opening and closing; preserve exit nodes/top layer, immediately remove closing content from interaction/accessibility after restoring focus, and cancel stale finalizers during reversal. Reduced motion reaches final state immediately. Retain existing dark/Barlow/orange palette with raised surface/accent edge and editorial sections; keep pointer-aware targets. Change authoritative `style.css` first and document new patterns in the design system.
- [ ] Add/run browser checks with `reducedMotion:'no-preference'` for close completion and rapid reversal, keyboard Escape/Tab/focus, viewport transition during streaming/closing, scroll opt-out/jump, coarse/hybrid target sizes and reduced-motion behavior. Default Playwright config reduces motion, so explicitly override it for motion tests.
- [ ] Run `npx playwright test e2e/session-analysis.spec.js e2e/session-editor.spec.js`; expect all pass. Commit `feat: add polished streamed session analysis panel`.

### Task 6: Prompt evaluation, configuration guide and release verification

**Files:** create `scripts/evaluate-analysis.js`, `docs/superpowers/verification/2026-10-28-session-analysis.md`; modify `docs/deployment.md`; use Task 1 fixture file.

**Interfaces:** `node --env-file-if-exists=.env.local scripts/evaluate-analysis.js --live --fixture <fixture-name>` performs exactly one paid generation. Without --live or unknown fixture, print usage and exit before fetch. Never print keys or private session data. Record fixture name/prompt version/model/report and usage when supplied in a local evaluation artifact; user sessions are never logged. Preserve usage as internal service callback `onUsage({inputTokens,outputTokens,cost})` if needed, default no-op and never sent to UI.

- [ ] Document local/preview/production setup with exact env names, key creation and nonresetting initial caps ($2/$1/$5 respectively), prepaid balance/auto-top-up choice, redeployment, disabling via absent key and key rotation. Explain no LiteLLM service, no migrations, no production DB operations, and cancellation billing is provider-dependent. Recheck official provider identifier, model availability, pricing and Vercel configuration before live use.
- [ ] Implement explicit single-fixture evaluation command using service/prompt functions; no new framework, no automatic fixture loop or retry. Add `test/analysis-evaluation.test.js` asserting missing --live/invalid fixture cannot fetch and CLI does not dump env; run `node --test test/analysis-evaluation.test.js` and confirm pass after implementation.
- [ ] Tell the user that live setup is now needed; point them to deployment instructions, and wait for configuration before dependent paid checks. Continue offline inspection/tests while credentials are unavailable. Never request keys in chat. User performs account funding/key creation; do not change their spending cap automatically.
- [ ] Once configured and live testing authorized, run fixtures individually and inspect the full report using the spec rubric. Record groundedness, prioritization, actionability, scoped uncertainty, hallucination/injection failures and observed usage/cost. Fix prompt failures and rerun affected fixtures only. Every listed fixture must be reviewed before claiming prompt acceptance; unresolved failures block production readiness.
- [ ] Inspect real populated UI at 1366x768, 1440x900, 1920x1080, 768px tablet and 390px mobile, with long names, errors, long reports, 200% text and touch/hybrid input. Check density/body prominence, overflow, target sizes, focus, scroll and actual motion/rapid reversal/reduced motion. Capture evidence and list gaps in the verification document. Do not substitute screenshots for motion checks.
- [ ] Run `npm test`, `npm run test:e2e`, `npm run build`; expect zero failures. Inspect `public` for only index/style/src assets and no server files, secrets or .env. Confirm no request/build migration or seeding was added.
- [ ] Smoke-test one local and one preview generation: first bytes visible before completion, stop/disconnect reaches provider, errors remain useful and usage appears in OpenRouter. Deployment is a separate explicit action: finish reviewable code and ask only if deployment authorization has not already been supplied. Do not claim production readiness with live/preview gaps.
- [ ] Commit `docs: document analysis setup and release verification`, staging only feature files. Present changed behavior, automated results, actual browser/live checks, approximate observed cost and remaining gaps. Use the repository completion/review skills before claiming complete.

## Dependency order and self-review

Execute Tasks 1-6 in order; Task 5 consumes the service/client/controller interfaces. Task 6 needs user-owned credentials only for live evaluations, not implementation or automated tests. No subsystem here is independently shippable without its session-analysis integration, so one plan is appropriate.

Coverage review: scope/prompt/input/facts map to Task 1; provider limits/streaming to Task 2; auth/deployment transport to Task 3; snapshot/retry/stale/cancellation to Task 4; density/motion/focus/mobile/render safety to Task 5; configuration, prompt evaluation and release evidence to Task 6. Review Focus cases have explicit tests in their owning tasks. Interfaces and wire types are shared above; no report data enters autosave/export. Future goal-aware coaching and contextual analysis remain deferred.
