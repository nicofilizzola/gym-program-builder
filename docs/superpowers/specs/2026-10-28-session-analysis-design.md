# Session hypertrophy analysis

Status: approved by the user before implementation planning. Implementation and offline verification are recorded in `docs/superpowers/verification/2026-10-28-session-analysis.md`; live release gates remain pending.

## Intent and scope

Provide useful, specific hypertrophy feedback on the current standalone session template. Success means the reader can identify what to keep and the highest-value changes, with evidence from their actual exercises and prescriptions. Analyze current edits, including unsaved changes. Never modify a workout automatically.

V1 is a single report, with no chat, profile, follow-up questions or surrounding program context. Goal-aware coaching, weekly/program analysis and personal training context are explicitly deferred. No saved reports, schema migration, export changes or browser persistence. Initially expose the feature only on standalone template routes, although the editor is shared with program workouts.

## UI and density

Reuse the session toolbar for a visible Analyze text action and a small original inline analysis SVG. Give this action an orange-tinted surface and accent border; no extra toolbar row unless ordinary wrapping requires it. Preserve Import/Export and bulk disclosure actions.

Open an anchored nonmodal report panel on desktop: width min(480px, viewport minus 32px), maximum height viewport minus 32px, positioned near the Analyze action with 16px viewport clearance. Prefer below the anchor, flip/clamp when necessary. It may temporarily overlay existing content but must not resize, crop or shrink the body figures. Use a top-layer manual popover with ordinary labeled region semantics, not a menu. Desktop editing remains available. Reposition on resize/scroll without stealing focus. No automatic dismissal on outside clicks: the user may interact with the session. Escape and Close dismiss.

At <=760px present the same report in a full-screen native modal dialog with safe-area padding, a compact header and reachable controls. The sheet covers the mobile pinned volume panel while open. Focus is trapped only for this modal. Adapt without losing report/request state when crossing the breakpoint.

The AI component stands out through a slightly elevated existing dark surface, restrained orange left edge, dedicated Session analysis header and editorial typography. Preserve Barlow, existing surface/text/accent tokens and 8/12/16px spacing. No gradients, new accent palette, chat bubbles, fabricated scores or repetitive finding cards. Show a compact AI-generated label and session snapshot name. Main reading order is assessment, strengths, improvements, limits. Improvements are an ordered text list with clear exercise references. Do not expose model configuration or token mechanics in this product flow.

Use text controls for Analyze/Analyze again, Stop, Retry and Jump to latest; shared accessible icon controls/tooltips for Close. Keep 32px controls only on fine-pointer desktop >=1100px without any coarse pointer; otherwise 44px. Preserve 44px slider hitboxes. Long names, errors and 200% text wrap without horizontal scrolling.

## Interaction and motion

First activation opens the panel and immediately requests analysis. Reopening shows the current report, without charging for another request. Opening moves focus to the report heading (tabindex=-1); closing restores the invoking control if mounted. On desktop Tab follows native order without a focus trap. On mobile use native modal focus containment and restoration.

Open/close transitions animate opacity and translateY(4px) over 180ms ease-out, with a matching restrained backdrop fade on mobile. Keep nodes/top-layer state alive until exit ends; closing content becomes inert and hidden from assistive technology immediately after focus moves out. Cancel obsolete callbacks on reversal. Reduced motion settles immediately without waiting for transition events. Initial editor render has no entrance animation.

State machine: idle, connecting, streaming, complete, stopped, error; stale snapshot status is independent. Show immediate Preparing analysis text before the first content, then stream real output without artificial typing. A small activity indicator may animate opacity during generation; disable its animation under reduced motion. No repeated entrance animation per token. Batch DOM updates at most once per animation frame while keeping content prompt and selection stable.

Follow output only if the reader is within 48px of the scroll bottom. Scrolling away disables follow; Jump to latest restores it. Show this control with a 150ms opacity transition and no layout jump. Keep keyboard focus stable during streaming. Mark the report aria-busy; announce connecting, complete, stopped and error using a separate polite status region. Do not put the growing report in an aria-live region.

Stop aborts generation and retains clearly labeled incomplete text. Close retains the report and allows generation to continue; the toolbar reads Analyzing while hidden, and View analysis after completion. Navigation/unmount cancels the request and drops transient data. Never claim that cancellation guarantees zero further provider charges.

Each request captures an immutable snapshot and generation ID. Edits during/after a request show Session changed and Analyze again; never regenerate automatically or mix new values into an old report. Fingerprint all sent fields canonically; if edits revert exactly, the stale flag clears. Starting Analyze again cancels any older request, replaces its report and ignores late frames. External refresh/reload/import is treated like any other changed input. Failures preserve current session edits. Retry is explicit and analyzes the latest snapshot.

## Input and deterministic facts

Require at least one exercise and valid exercise names, primary mappings, sets, reps, rest and timing; blank template names are allowed with Untitled session fallback. Keep Analyze available to explain missing requirements, expand/focus the first invalid exercise using the editor's established validation-focus pattern, and do not call the provider. Server repeats validation.

Allow at most 40 exercises, 200 Unicode code points per exercise/template name, and a 64 KiB UTF-8 JSON request body. Reject oversize inputs as a whole with a specific message; never silently truncate a session. Sanitize into an explicit allowlist: template name, ordered exercise position/name, equipment when known, sets, rep range, restSeconds, primary/secondary muscles, workout goals, extraMinutes and bufferPercent. Strip catalog IDs, document IDs, revisions, archive metadata and arbitrary client fields. No catalog or other documents are fetched.

Server computes direct/indirect/total volume and duration through existing domain functions. Include all 12 muscle totals and any session goals. Explain direct=sets and indirect=0.5*sets as an app heuristic, not equivalent physiological stimulus. Duration assumes 60 seconds execution per set and rest after every set including the last; buffer/extra are scheduling allowances. Goals are user targets, not validated hypertrophy thresholds. The AI must not independently recalculate authoritative totals.

## Prompt contract

Version the server-owned prompt and add realistic evaluation fixtures. System instructions establish a concise, constructive hypertrophy reviewer. Session JSON is untrusted data; names never become instructions. No tools, web access, auto-edits, external memory or user-supplied system messages.

The prompt must:

- Review only this session: selection/overlap, order, stimulus distribution, sets, rep ranges and rest; qualify uncertain deductions from names or missing equipment.
- Respect focused sessions. An untrained muscle is not automatically a missing exercise. Do not demand full-body coverage or use a generic checklist to manufacture issues.
- Distinguish facts, reasonable interpretations and unknowns. Do not infer proximity to failure, load, technique, range of motion, training age, weekly frequency or recovery. No weekly volume/progression verdicts.
- Avoid rigid universal rep/rest prescriptions, body-map heat bands as scientific thresholds, or treating every overlap as redundant. Explain the trade-off before suggesting changes.
- Cite actual exercise positions and names plus relevant prescriptions/numbers. Suggestions must be concrete and achievable within the session. Do not invent available equipment or nonexistent exercises as facts; alternatives are conditional.
- Give an Assessment (2-3 sentences), Strengths (1-3 short bullets), Improvements (0-3 ordered findings, each observation + why + specific adjustment), and Limits (one concise sentence). Prioritize rather than force three criticisms. Target 300-450 words, at most 550.
- Use plain headings and simple paragraphs/lists; no HTML, links, tables, scores, diagnoses, fabricated citations or guarantees.

Do not prescribe clinical advice. Avoid boilerplate disclaimers; limits should name the actual unavailable information.

Prompt acceptance fixtures: balanced focused push session, excessive overlapping presses, isolation-before-compound with plausible priority trade-off, zero-rest compounds, high session volume, intentionally low-volume session, duplicate names, custom/unknown exercise, absent equipment, goals above/below current totals, malicious exercise name, and long valid session. Manually evaluate groundedness, prioritization, conditional language, actionability and scope. Reject fabricated facts, weekly conclusions, instruction injection, mandatory missing-muscle criticism or incorrect quoted totals. Automated tests pin prompt/data contracts, not subjective prose. Record model/prompt version, fixture verdicts and approximate cost; no private user-session logging.

## Architecture and streaming

Use native server-side fetch to OpenRouter chat completions; no LiteLLM/Python service, frontend framework or new animation dependency. Default model anthropic/claude-sonnet-4.6, configurable only through server env. Route to Anthropic provider with provider fallback disabled initially, matching the documented stream-cancellation support; verify the exact provider identifier in a live smoke test. Do not silently substitute another model/provider.

Add authenticated same-origin POST /api/analysis. Reuse auth/origin protections, but give AI errors their own useful messages rather than the storage-unavailable fallback. Separate input preparation, prompt, provider stream adapter and browser report controller. Integrate both api/index.js and scripts/dev-server.js. The development server currently buffers Response.arrayBuffer(): replace that API transport behavior with chunk forwarding/backpressure and disconnect abort support so local streaming is real. Preserve all ordinary JSON API behavior.

Normalize provider SSE into app SSE events: start {requestId,promptVersion}, delta {text}, complete {}, error {code,message}. Browser uses fetch streaming, not EventSource (POST required). Parse UTF-8 and SSE across arbitrary chunk boundaries, multiline data, comments, CRLF, empty accounting frames and [DONE]. Provider errors may arrive after HTTP 200. Complete only after a normal finish and terminal stream marker; length exhaustion, malformed frames, disconnect or early EOF become incomplete errors. Enforce 64 KiB output bytes; abort rather than exceed it. No raw provider errors/secrets exposed.

Render a tiny safe text format: recognize only the four expected heading lines and simple list markers, build DOM text nodes; all other content remains text. Never use provider output as innerHTML, URLs or attributes. During partial lines preserve readable text; final formatting must not replace the entire report or steal selection/focus.

Use request abort and stream cancellation all the way to upstream fetch. Absolute generation timeout 60 seconds; hosting max duration at least 75 seconds. Do not add a first-token timeout shorter than the total timeout. Cap output at 1500 tokens, disable extended reasoning, no automatic application retries. One generation per mounted template UI; no paid requests in automated tests. Account/key caps provide global spend protection across serverless instances; do not pretend an in-memory limiter is a global budget.

Errors distinguish invalid session (400), unauthorized (401), origin forbidden (403), too large (413), provider/account credit exhaustion, rate limit (429), disabled configuration (503), provider unavailable (502), timeout and incomplete output. Before streaming use JSON errors; after streaming use the normalized error event. No automatic retry on reopening. Keep provider configuration failure isolated so the rest of the app remains usable without AI secrets.

## Configuration and rollout

User steps, needed only before the first live smoke test:

1. Create an OpenRouter account and add a small prepaid balance. Disable automatic credit top-up initially.
2. Create separate development, preview and production API keys. Suggested initial per-key limits: $2 development, $1 preview, $5 production, with no automatic reset for initial rollout. These are actual key spending caps, not monthly subscription prices.
3. Set OPENROUTER_API_KEY in ignored .env.local for development. Optionally set OPENROUTER_MODEL=anthropic/claude-sonnet-4.6; this is the documented default. Never paste keys into chat or browser configuration.
4. Add the matching server env values to each Vercel environment and redeploy. Preview must not inherit the production key. Existing database/auth secrets stay as configured.
5. Confirm model/provider access and OpenRouter data-policy settings, then run one explicit live smoke test locally and on preview: first output visible before completion, Stop reaches upstream, errors are readable, usage appears in OpenRouter activity.
6. Inspect preview and prompt evaluation results before enabling production. Recheck current model pricing/availability and provider naming at implementation time. Rotate/revoke any exposed key through OpenRouter.

Document values/placeholders in .env.example and docs/deployment.md. No account provisioning or paid smoke test is performed automatically. Missing key keeps Analyze unavailable with an explanation, without breaking template editing; use a safe authenticated capability response to expose enabled state, never the key.

At published $3/M input and $15/M output, 4000 input + 1500 output tokens is approximately $0.0345; this is an example, not a hard per-request ceiling. Input byte bounds are not token estimates. The output cap and OpenRouter key cap bound exposure; model/provider price changes require reevaluation.

## Verification and acceptance

Unit/integration: allowlist/limits, deterministic facts, no mutation, prompt snapshots, injection fixtures, authentication/origin, disabled configuration, server/browser SSE boundary splitting, UTF-8, accounting frames, normal finish, truncation, abort/timeouts, partial errors, safe text rendering and generation identity. Verify the local HTTP bridge sends a first chunk before the provider completes, not merely mocked browser fetch.

Playwright with deterministic fake streams: opening/closing/reopening, smooth exit/rapid reversal, streaming/stop/retry, edits/import/external refresh and stale state, late frames, navigation abort, autoscroll opt-out/Jump to latest, keyboard/focus, modal breakpoint adaptation, reduced motion and error states. No network/provider charges in CI.

Inspect populated templates at 1366x768, 1440x900, 1920x1080, tablet and mobile, 200% text, coarse/hybrid input; include long names, large reports and errors. Preserve body prominence in the editor, readable panel text, reachable controls and no overflow. Exercise actual motion in a browser; screenshots alone do not prove transitions. Update authoritative style.css first, then docs/design-system/README.md for new patterns/tokens.

Run npm test, npm run test:e2e and npm run build. Audit public build output for secrets/server source. No database migration or seed is needed for this feature. Record real live-provider/preview checks separately from automated mocked verification, including any gaps.

## References

- OpenRouter streaming and cancellation: https://github.com/OpenRouterTeam/docs/blob/main/api_reference/streaming.mdx
- Stream error behavior: https://github.com/OpenRouterTeam/docs/blob/main/api_reference/errors-and-debugging.mdx
- Key/credit limits: https://github.com/OpenRouterTeam/docs/blob/main/api_reference/limits.mdx
- Model pricing: https://openrouter.ai/anthropic/claude-sonnet-4.6/pricing
