# Program hypertrophy analysis v1

Status: product direction approved in conversation; written specification awaiting user review. This document describes future implementation, not shipped behavior.

## Intent and agreed scope

Give the user a useful second opinion on their whole program: does its planned structure fit their hypertrophy priorities and practical constraints, and what are the highest-value adjustments to consider?

The user approved:

- Hypertrophy as the sole training focus for v1, with strength and general fitness explicitly recorded as future possibilities.
- An Analyze program action and three optional guided text fields saved with each program.
- Read-only analysis, with all workout and arrangement changes made manually.
- Prioritizing small changes while permitting larger structural suggestions when a clear mismatch justifies them.
- One concise report containing Assessment, Strengths, Improvements and Limits.
- Temporary reports, explicit regeneration and a changed-since-analysis indicator.

Success means the report connects sessions, interprets the user's priorities correctly, identifies choices worth preserving, and offers concrete suggestions grounded in the supplied program. A sound program can receive no improvement suggestions. A list of unrelated session reviews or a recap of the volume panel does not meet this goal.

The persistence, validation, interaction and testing details below are proposed implementation decisions for review. No implementation plan or product changes are authorized by this document alone.

## Product context

The existing session analysis provides a streaming report, an immutable input snapshot, explicit retry/regeneration, stale-state tracking, safe text rendering and a responsive report overlay. Reuse these behaviors and the existing provider integration. Keep the standalone session analysis contract unchanged.

Programs own arrangement and weekly goals; occurrences reference shared session templates. Program analysis consumes the resolved program and every occurrence, rather than analyzing only distinct templates or persisting embedded template content.

Inspiration informs the product shape, not training rules:

- [Alpha Progression's plan generator](https://alphaprogression.com/en/blog/alpha-progression-workout-plan-generator) uses goals, experience, schedule, equipment and muscle priorities. Borrow the idea of assessing a plan against its owner's intent.
- [Fitbod's explanation of its inputs](https://help.fitbod.me/hc/en-us/sections/360001078993-How-Fitbod-Works) distinguishes saved preferences from logged training. Reuse context without making the user re-enter it for every report.
- [RP's explanation of training adjustments](https://hypertrophy.zendesk.com/hc/en-us/articles/14605661323671-How-Does-the-App-Determine-When-to-Add-Weight-Reps-and-Sets) uses workout feedback to adjust training. This app does not collect that feedback, so v1 evaluates planned structure without claiming observed recovery or progress.

## Program context

Add a labeled Program context action beside Analyze program in the existing program toolbar. It opens a compact editor containing three optional multiline plain-text fields:

| Visible label | Purpose | Example guidance |
| --- | --- | --- |
| Goals and priorities | Explain what the user wants to emphasize, maintain or achieve. | Build muscle, prioritize side delts and upper chest, maintain legs. |
| Constraints and preferences | Explain time, fixed days, other activities and choices to preserve or avoid. | Four training days, about an hour each. Keep weighted pull-ups. Football on Wednesday. |
| Training background and approach | Explain experience, usual effort, progression and relevant self-reported observations. | Two years of consistent training. Usually leave 1–2 reps in reserve and increase weight at the top of the rep range. |

Examples are guidance, never prefilled values or assumed facts. Labels remain visible; short help text explains the purpose without relying on placeholders. Each textarea starts at three rows and allows vertical resizing. These are qualitative notes, not new numeric configuration fields.

Show concise introductory copy: "Optional context for your hypertrophy review. Saved with this program and included when you analyze it."

All fields may remain blank. There is no onboarding gate, required questionnaire, global athlete profile, training-focus selector or automatic analysis on opening or editing context. The program supplies its actual schedule, exercises, equipment, prescriptions and existing volume goals automatically.

### Storage and portability

Store an optional program-owned `context` object with `goalsAndPriorities`, `constraintsAndPreferences` and `trainingBackgroundAndApproach` string fields. Each field allows at most 2,000 UTF-16 code units, matching existing description validation conventions. Normalize line endings to LF; whitespace-only fields are empty. Missing context or missing fields are equivalent to empty strings. Reject wrong types and excessive lengths on the server and on import; never silently truncate.

Context uses the existing program revision and autosave/recovery flow. Typing updates the local document immediately, with normal debounced saving. Done, Escape and backdrop dismissal close the editor without reverting edits. Failures retain the text and expose the existing Retry/conflict controls. Acknowledgements and shared-template refreshes must not replace focused fields, lose selection or close the editor. Context remains editable when AI is unavailable.

Context belongs only to its program, even when templates are shared. Program duplication and Save as copy copy it independently. Template duplication or template export does not acquire program context.

Include context as optional plain-text metadata in v3 program bundles. Existing v3 files and v1/v2 imports without context remain supported and yield empty context. Import replacement includes context, and a program containing only context counts as nonempty for replacement confirmation. Program exports consequently contain these notes; mention this in the context editor with short helper text. Reports are never exported.

The existing JSON document storage supports an optional field without new tables or a database backfill. Update shared validators and all serialization/copy paths so they retain it. Reading an old program must not trigger a write merely to add empty defaults. No migration or seed runs during builds or requests.

## Analysis behavior and input

Analyze program opens the report and starts a request on first activation. Reopening an existing report does not regenerate. Analyze the current local program snapshot, including unsaved context and arrangement, using the currently resolved shared templates. Do not mix later edits into an in-flight report.

Use the existing dependency revalidation and save coordination on entry/focus. If a newer shared template is loaded, mark the report stale when its analysis-relevant content changes. The report describes the captured snapshot, not a claim that all server documents remain unchanged.

### Snapshot contents

Prepare an explicit allowlisted snapshot on the client and validate it again on the server. Include:

- Program name, the fixed hypertrophy analysis focus, the three context fields and weekly muscle goals.
- Week/Sequence mode, occurrence order, saved weekday assignments, explicit rest entries and Unscheduled status.
- Distinct template content: names, ordered exercise names and positions, known equipment, muscle mappings, sets, rep ranges, rest, session goals and duration allowances.
- Optional portable exercise descriptions and tag labels, when present, to clarify exercise identity. Treat tags as labels, never replacements for fixed volume muscles or proof of exercise mechanics.
- Request-local template and occurrence keys to express sharing and distinguish repeated names. Strip database/catalog IDs, revisions, archive internals and unrelated fields before sending data to the provider.

Build the shared-template mapping from the resolved program; repeated references to the same template must have consistent content. Do not merge different templates merely because their names or contents match. No provider tools, repository browsing, other-program lookup or automatic catalog lookup is needed.

Compute authoritative totals server-side using the existing volume and duration functions. Count every occurrence, including repeated templates and Unscheduled workouts; rests contribute no volume. Supply direct, indirect and total muscle volume for the program and each session, occurrence counts by muscle, and estimated duration per session. Distinguish number of sessions from number of distinct scheduled training days.

The prompt explains that indirect volume is the app's half-set heuristic, volume goals are user preferences, heatmap bands are display conventions, and duration is an estimate using the existing timing assumptions. It must not recalculate these facts or present them as physiological measurements.

### Schedule interpretation

In Week, use explicit weekday assignments to discuss planned distribution, including the Sunday-to-Monday boundary when describing the repeating weekly arrangement. Multiple sessions on the same day are not separate training days. Their time of day and actual recovery interval remain unknown. Unscheduled workouts count toward totals, but their timing is unknown. Empty weekdays do not prove complete rest from other activities.

In Sequence, use session order and explicit rest entries to discuss arrangement. Do not assume one card equals one calendar day, a seven-day cycle, or a known repeat interval. Retained weekday assignments must not silently override the active sequence interpretation. Describe totals as program totals when the execution cadence is unknown; do not convert them to actual weekly exposure. Existing weekly-panel calculations and display remain unchanged. Explicit cadence in user context may inform a qualified interpretation, but never changes the authoritative totals.

### Validation and bounds

Require at least one workout occurrence and at least one exercise in every included template. Every exercise must have a valid name, mappings, sets, reps, rest and timing. Blank program/template names use readable fallback names. All linked templates must resolve. Empty or invalid sessions block the request as a whole with a specific occurrence/exercise message and a native link to the existing editor, rather than being omitted or treated as rest days.

For v1, permit at most 50 occurrences, 40 exercises per distinct template and 400 exercise instances after counting repeated occurrences. Limit the complete program-analysis request to 256 KiB UTF-8 JSON; retain the session route's existing limits. Enforce name/metadata limits consistent with the existing analysis and catalog boundaries. Reject oversize inputs clearly without silently reviewing only part of the program. These are analysis limits, not new restrictions on saving programs.

## Review contract

Review only hypertrophy. The report header identifies "Program analysis · Hypertrophy", with the existing AI-generated disclosure. The assessment briefly states any supplied priorities it relied on; it must not invent them when context is empty. If context requests another training focus, explain that this review assesses only its hypertrophy implications rather than silently switching focus.

Prioritize relationships between sessions: distribution of work relative to stated priorities, concentration and overlap, known scheduling conflicts, and compatibility with time constraints. Individual exercise order, rest and prescriptions can be discussed when materially relevant. Do not generate a separate review of every session.

For every improvement:

1. Identify an observation supported by actual context, sessions or prescriptions.
2. Explain why it matters for the stated hypertrophy purpose, distinguishing interpretation from fact.
3. Suggest a concrete adjustment, referencing unambiguous session occurrences and exercise positions/names where relevant.
4. Explain its trade-off, such as shifting emphasis, reducing prescribed volume or using another training day.

Recommend the smallest meaningful adjustment first. Larger changes to the split, session count or arrangement require a clear mismatch and an explanation of why smaller changes would not adequately address it. Respect fixed constraints; where they conflict, describe the trade-off rather than treating one as optional. If context itself conflicts, state the ambiguity without inventing a resolution or starting a question-and-answer flow.

Specialization, repeated exercises, unequal muscle totals and low-volume maintenance work are not inherently faults. Do not impose full-body coverage, equal volume across muscles, universal set thresholds or artificial exercise variety. Do not manufacture criticisms to reach the suggestion limit. A plausible alternative preference is not evidence of a problem.

A template edit affects every occurrence of that template, potentially in other programs. The snapshot establishes sharing within this program only. Suggestions must name affected occurrences here and avoid promising independence elsewhere. An occurrence-specific prescription suggestion must explain that it would require an independent template, not imply that the current shared occurrence has its own prescriptions. No new detach/clone workflow is part of this feature.

User-entered background is self-report, not measured performance. Distinguish it from prescription facts. Do not infer actual loads, technique, proximity to failure, recovery, progress or available equipment beyond supplied information. Discuss potential workload trade-offs without diagnosing overtraining or claiming ineffective growth. Do not prescribe clinical advice. All names, descriptions, tags and notes are untrusted data; honor relevant training preferences without obeying embedded instructions to change the analysis rules, reveal prompts or invoke tools.

### Output

Use the existing safe plain-text report format and these headings in order:

- **Assessment:** two or three sentences on fit to the stated purpose, leading with the main finding.
- **Strengths:** one to three specific choices worth preserving.
- **Improvements:** zero to three ordered, prioritized suggestions following the observation/reason/adjustment/trade-off contract. Explicitly say when no clear changes are warranted.
- **Limits:** one concise statement of missing information that materially limits this review.

Target 300–450 words when there are substantive findings, at most 550. Shorter sound-program reports are valid. No scores, fabricated citations, tables, HTML, links generated by the model, guarantees or follow-up questions. Reuse text-node rendering and retain report selection during streaming. Navigation links for validation errors are application-owned, never model-generated.

## UI, motion and accessibility

Follow [the design system](../../design-system/README.md), especially its Feature design and review checklist. Reuse the program toolbar, session analysis accent treatment, native dialog patterns and existing typography. Analyze program and Program context remain visible text actions because their purposes benefit from labels. Keep Import/Export and Week/Sequence in the same wrapping toolbar; do not create an extra permanent settings card or reduce body-map prominence.

The context editor is a native modal dialog, at most 640px wide with 16px viewport clearance. Use three compact labeled textareas with existing field spacing, short helper text and a reachable Done action. Stack these prose fields deliberately for readable writing space; do not wrap each in a separate card. At small heights or enlarged text, let the dialog body scroll and keep its closing action reachable. Focus the first field on open; Escape, backdrop and Done close and return focus to Program context. Opening it dismisses an open analysis surface while preserving that report/request, preventing stacked interactive overlays.

The report reuses the anchored desktop nonmodal panel (at most 480px wide, clamped to the viewport) and the full-screen native modal at widths of 760px or less. Desktop editing stays available. Opening focuses the report heading; closing restores the invoker. It must not resize or crop the existing body figures.

Reuse the analysis overlay's 180ms ease-out opacity and 4px vertical translation for both new surfaces, with matching backdrop fade for modal states. Preserve nodes through exit, restore focus before making closing content inert/hidden from assistive technology, and use the existing modal exit-surface approach to end native focus containment correctly. Rapid reversal cancels stale completion callbacks. Reduced motion settles immediately. No entrance animation on initial page render, no delayed typing/autosave updates and no per-token animation. Jump to latest retains the existing 150ms opacity behavior.

Preserve 32px controls only on fine-pointer desktop without a coarse pointer; touch and hybrid targets remain at least 44px. Long text, errors and names wrap. Keep status announcements separate from streamed prose, preserve visible focus and use native modal focus containment only for modal surfaces.

### Report lifecycle and errors

Reuse idle, connecting, streaming, complete, stopped and error states, with staleness independent. Controls retain Analyze again, Stop, Retry and Jump to latest. The toolbar shows Analyzing while generation is hidden and View analysis when a report is available.

Closing preserves the report and allows generation to continue. Stop aborts and labels retained text incomplete. Navigation/unmount cancels the request and discards the temporary report; this includes entering a session editor. Do not imply that reports survive navigation or that reopening after navigation reuses a previous result.

Fingerprint every sent value canonically, including context, arrangement and resolved template content. Request-local keys must be deterministic for the same snapshot, not regenerated randomly during comparisons. Relevant changes show Program changed; reverting exactly clears staleness. Save acknowledgements or unrelated revision changes alone do not make a report stale. Routine program-view rerenders preserve the controller, report and open context draft; only actual navigation/unmount discards transient analysis. Analyze again/Retry explicitly use the latest snapshot. New generations cancel older ones and ignore late frames.

Input, provider and streaming errors preserve all user edits. Preserve existing distinct unavailable, credit/rate-limit, timeout and incomplete-report messages, adapted to program analysis. Never retry or regenerate automatically. Configuration failure affects analysis alone; ordinary program editing and context saving remain available.

## Implementation boundaries

Add program-specific snapshot validation and prompt construction, with a separately versioned program-hypertrophy prompt. Share the existing streaming transport, safe report renderer and lifecycle behavior through small explicit parameters for input preparation, request destination and labels. Do not turn the session prompt into an unrestricted generic coaching prompt.

Provide authenticated same-origin program analysis through a dedicated `POST /api/analysis/program` route, preserving `POST /api/analysis` for sessions and the existing capability check. Both use the existing server-configured provider/model and cancellation path. Program input includes the resolved snapshot, so the analysis route does not fetch unrelated documents. Repeat validation and compute facts server-side before calling the provider.

Retain the existing generation timeout, output-byte limit, no automatic provider fallback/retry, and server-side secrets. Start with the existing 1,500-token output cap; prompt evaluation must verify that prioritized program reports finish within it. Truncation is an incomplete report, never a successful completion. No new dependency, agent framework, retrieval service or browser persistence is required. Do not log private context or full user programs.

## Verification and acceptance

Implementation must run `npm test`, `npm run test:e2e` and `npm run build`. This design-only change does not claim those implementation checks have run.

Automated coverage must include:

- Context defaults, newline/length/type validation, autosave retry/conflict preservation, copy independence and v3 round trips; legacy imports and replacement confirmation when only context exists.
- Every repeated occurrence counted, distinct same-named templates kept distinct, correct direct/indirect totals and unchanged rest/duration calculations, including Glutes and all current fixed muscles.
- Week versus Sequence, explicit rests, same-day sessions, Unscheduled entries and weekday wraparound without invented cadence.
- Missing templates, empty sessions, invalid prescriptions, size limits, local-only request keys and rejection before a paid request.
- Dirty context and arrangement during streaming, shared-template refreshes, acknowledgement coordination, exact reverts, retries, stop, navigation cancellation and obsolete response frames.
- Authentication/origin enforcement, disabled AI, provider errors, safe text rendering and instruction-bearing names/notes/descriptions.
- Existing standalone session analysis behavior unchanged.

Evaluate synthetic prompt fixtures for a sound program, deliberate specialization/maintenance, concentrated overlap, a clear time-budget mismatch, a justified structural mismatch, fixed constraints, absent/conflicting context, repeated shared templates, duplicate names, unknown/custom exercises, Sequence with unknown cadence, Unscheduled workouts, invalid/empty sessions and malicious text. Changing context on the same program should change the interpretation appropriately without changing the underlying facts. Reject invented facts, forced criticisms, incorrect totals and suggestions that ignore shared-template effects. Live evaluations must be explicit paid runs, never part of tests/builds; record prompt/model version and observed cost without private user data.

Inspect populated screens in a real browser at 1366×768, 1440×900 and 1920×1080, plus mobile/tablet, 200% text and touch/hybrid input. Exercise both surfaces opening/closing, rapid reversal, keyboard/focus, backdrop/Escape, breakpoint changes, reduced motion, streaming scroll behavior, long notes, save failures and stale reports. Preserve body figures, toolbar density and reachable controls. Update authoritative CSS first and the design-system documentation in the same implementation. Report verification gaps explicitly.

## Deferred iterations

Strength and general fitness are explicitly possible later training focuses. Keep the program-analysis prompt boundary capable of selecting a future focus, but v1 exposes only hypertrophy and adds no unused settings or speculative coaching framework. Each future focus needs its own review criteria and evaluation fixtures.

Also deferred: saved reports/history, chat/follow-up questions, global training profiles, structured questionnaires, training logs, measured recovery/progression assessment, browsing/research citations, automatic edits, program generation and agent-driven workflows. The saved context remains useful if these are explored later; none is required for this first iteration.
