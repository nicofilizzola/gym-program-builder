# Program hypertrophy analysis verification

Implementation: branch `feat/program-analysis`, based on `9aabebc`. Design and plan: [spec](../specs/2026-10-31-program-analysis-design.md), [plan](../plans/2026-10-31-program-analysis.md). This is local verification; no preview or production deployment has been performed.

## Automated evidence

Baseline: 205 unit tests passed before implementation. The implementation added context persistence/portability, canonical snapshot/facts, program API/client behavior, controller lifecycle and explicit-evaluation coverage. Final command results are recorded below after their runs finish.

An initial full browser run found one regression: preserving the mounted overview also preserved a pending destructive confirmation on external updates. The existing `pending removal cannot mutate a changed or destroyed program view` regression failed. Restoring confirmation abort and view-generation invalidation fixed it while retaining context/report nodes; the targeted 11-test confirmation/program run passed, and the next full browser run passed all 247 tests.

Final unit suite: `npm.cmd test`, 230 tests passed, zero failures. Unit assertions verify program generation's bounded/excluded reasoning and unchanged session settings. Fake reasoning frames are not forwarded to the client. `npm.cmd run build` passed; the output allowlist contained 58 files, only index.html, style.css and browser src JavaScript.

Browser release runs: an earlier complete run passed all 247 tests. The next complete run passed 246 and timed out in `populated disclosure layouts preserve names targets and body figures` during its initial `page.goto('/')` waiting for load, before application assertions. That existing test subsequently passed three isolated repeats (4.5s, 3.5s, 3.5s). No product or test timeout change was made to conceal the transient load failure. The no-paid-evaluations-concurrent stability run then passed all 247 tests in 6.1 minutes. The review fix pass adds two browser regressions; its final result is recorded in the final review addendum.

## Browser interaction and layout evidence

Populated programs contain six occurrences of a shared six-exercise template, multiple muscle goals, long session names and an Unscheduled occurrence. Automated real Chromium interaction covered:

- 1366×768, 1440×900 and 1920×1080 desktop; 768×1024 tablet; 390×844 mobile; 200% text and hybrid touch input.
- Report/context viewport containment, wrapping toolbars, reachable Done/analysis actions, no horizontal document overflow and both desktop body figures at least 180px high.
- Context live updates and persistence, focus restoration, Escape/backdrop/Done, rapid reversal, composition/selection preservation, reduced-motion changes during exit and long prose at enlarged text.
- Streamed report reopening without another request, Stop/incomplete output, retry with current edits, staleness/exact reverts and breakpoint adaptation/scroll-follow behavior.
- An open context editor surviving delayed save acknowledgements, a shared-template change/focus refresh and create-and-attach updates, with the same textarea/report nodes and caret.
- Context-only import confirmation/cancel, invalid context rejection, v3 export, independent duplication and conflict Save as copy.

Screenshots were visually inspected during implementation. A desktop footer was tightened after inspection so Done is a compact right-aligned action rather than a full-width desktop button. Screenshots alone were not used as motion evidence; the interaction cases above exercised transitions, focus and reduced motion.

## Real provider and streaming evidence

Configured model: `anthropic/claude-sonnet-4.6`, pinned to the existing Anthropic provider route with fallback disabled. [OpenRouter's model page](https://openrouter.ai/anthropic/claude-sonnet-4.6) was checked on 2026-10-31; it listed $3/M input and $15/M output tokens and an available Anthropic route. The existing development key's $2 spending cap was confirmed without exposing the key.

All paid calls used synthetic fixture programs. No real personal program/context was sent or logged by these evaluations. The CLI requires explicit `--live` and exactly one known fixture; tests/builds use fake streams and disposable databases.

The local real-provider smoke used the production API/service/SSE bridge and browser panel through a disposable loopback harness, without connecting a real database. It confirmed first report text before completion and Stop reaching the upstream abort signal. The initial no-reasoning transport smoke observed text 7,488ms before completion, with two explicit requests (one stopped, one completed). Completion usage was 3,335 input / 260 output tokens, cost $0.013905; this does not include any unreported charge for the stopped request.

The smoke was repeated with the final bounded-reasoning configuration and prompt v11: report text appeared 7,980ms before completion; Stop again reached upstream; two explicit requests were made. Completion usage was 3,775 input / 318 output tokens, cost $0.016095. Prompt v12 subsequently added deterministic Week calendar gaps, with no transport change.

## Prompt evaluation and implementation decisions

Initial no-reasoning outputs exposed mistakes that were not visible in deterministic tests: unsupported praise about Unscheduled spacing, conflating Glutes with all leg muscles, inaccurate hypothetical secondary-volume changes, interpreting inactive Week/Sequence metadata, and unsupported global feasibility claims. Prompt refinements reduced several issues, but arithmetic/cadence errors persisted on stress cases.

Two bounded comparison probes enabled 1,024 excluded reasoning tokens within a 2,500-token total cap and omitted temperature. Both corrected the observed arithmetic/cadence mistakes. The time-mismatch probe cost $0.031968 (3,726 input / 1,386 output tokens); the 50-occurrence probe cost $0.067125 (18,195 input / 836 output tokens). This supported the program-only configuration adjustment. The server still bounds requests/output, uses the existing 60-second timeout and never retries/falls back automatically. Session analysis settings remain unchanged.

Other decisions, retained in the implementation:

1. Use `npm.cmd` on Windows because PowerShell blocks `npm.ps1`; command behavior is unchanged.
2. Keep inactive weekday data in canonical snapshots/fingerprints but omit it from the provider's Sequence projection. Conversely, omit hidden Sequence/rest metadata from the Week projection. Cost: inactive arrangements do not inform the active review, and explicit context supplies any real cadence.
3. Send human occurrence numbers and sharing lists rather than technical keys. Add deterministic current goal status and daily duration sums rounded only after summing seconds. Cost: a small provider-only projection and additional server facts.
4. Require factual praise, exact muscle coverage, current numeric facts, qualified suggestions and actual relevant unknowns. Do not claim all feasible alternatives have been searched. Cost: more conservative prose and less hypothetical numerical detail; the app recalculates actual edits.
5. Explicitly distinguish known Unscheduled volume from unknown timing, Week from a multiweek block, and contradictions from a reliable structural recommendation. Cost: unresolved/conflicting notes receive a narrower review.
6. Use bounded program reasoning after direct comparison rather than relying on longer prompts alone. Cost: roughly one additional cent and several seconds on the tested small cases; large inputs cost more. Reasoning is excluded and never rendered.
7. Supply deterministic cyclic calendar gaps per muscle in Week and omit them in Sequence after a live report reversed the Friday-to-Monday interval. Cost: additional small server facts; these remain calendar opportunities, not recovery measurements.

These decisions are engineering rulings from the execution ledger. Generative reports remain a sample of model behavior, not a guarantee of factual correctness; evaluate changes against the synthetic report archive and keep all application edits manual.

### Bounded-reasoning fixture record

All 15 fixtures completed normally without truncation. Their combined reported cost was **$0.341826**, using 71,907 input and 8,407 output tokens (including provider-accounted reasoning). Individual report lengths were 188–392 words. This is the final selected sample, not the total cost of earlier prompt experiments or canceled requests.

Full synthetic reports, usage, comparison probes and selected rejected earlier outputs are preserved in [reports.json](2026-10-31-program-analysis/reports.json).

| Fixture | Prompt | Observed review behavior |
| --- | --- | --- |
| repeated-template | v11 | Counts both uses and explains that a template edit affects both. |
| same-name-independent | v11 | Keeps equal-named independent templates independent. |
| sequence-unknown-cadence | v11 | Uses occurrence order without inventing weekday placement. |
| priority-delts | v12 | Identifies the missing stated priority; quotes four/three-day cyclic gaps correctly. |
| priority-maintenance | v11 | Discusses the user's numerical target and a small shared edit. |
| time-mismatch | v11 | Prioritizes current 39-minute versus 15-minute mismatch without falsely claiming a reduced total still meets the volume goal. |
| structural-mismatch | v11 | Uses the authoritative 47-minute Monday total and describes the time/volume trade-off. |
| fixed-constraints | v11 | Retains session count, days and Bench; suggests an edit within the shared template. |
| sound-program | v11 | Explicitly says no clear changes are warranted. |
| absent-context | v11 | Uses the recorded numerical goal without inventing qualitative priorities. |
| conflicting-context | v11 | Flags contradictory constraints and withholds a reliable structural verdict. |
| unknown-exercise | v11 | Uses recorded mappings/prescriptions without inventing custom exercise mechanics. |
| unscheduled | v12 | Retains known totals while treating timing as unknown; no inactive Sequence interpretation. |
| malicious-text | v11 | Ignores embedded prompt/clinical instructions; no disclosure or HTML execution. |
| long-program | v11 | Completes the 50-occurrence case, counts all 150 direct Chest sets, and uses current combined daily estimates. |

Residual prose limits observed in the final samples: occasional broad praise about separate muscle content, redundant statements of unknowns, and a time-budget unit restated imprecisely in a secondary sentence. The main supplied totals and prioritized findings in the selected sample were retained, but these samples do not establish universal factual reliability or individualized training effectiveness. Preview review should check the report against its captured program rather than treating it as a feasibility proof.

Layout artifacts: [desktop report](2026-10-31-program-analysis/program-analysis-1366.png), [desktop context](2026-10-31-program-analysis/program-context-1440.png), [mobile context](2026-10-31-program-analysis/program-context-390.png), [200% text](2026-10-31-program-analysis/program-context-200text.png), [real-provider report](2026-10-31-program-analysis/live-program-analysis.png).

## Final independent review and fix pass

One fresh reviewer inspected `9aabebc..8ea0605`, ran 25 focused Node tests successfully, and found no critical correctness or security defect. The review resumed after a usage interruption without a new review seat. Its verdict was ready to merge with fixes:

1. **Important: context-only replacement coverage was masked by a numerical goal.** The helper was corrected to create no workouts, no goals and no sequence. Explicit fixture preconditions failed before that correction. Cancellation and invalid import now verify all saved context remains intact; acceptance replaces it.
2. **Important: refresh coverage waited for notes to save.** A separate regression now makes the context save fail, proves the database still contains the old notes, changes the shared template, and revalidates dependencies while notes remain dirty. It verifies the same textarea/report nodes, local text, caret, focus, updated template names and stale-report state. A later Retry saves the retained notes. Production preservation already worked; this closes the coverage gap.
3. **Motion defect regraded from Minor to Important: scrolled editor exit jumped to the top.** The new regression observed scrollTop 1,067 becoming 0 before the fix. Closing now transfers the dialog scroll offset onto its exit surface before painting; rapid reopening starts at the first field as specified. The regression verifies equal scroll positions, less than 2px content-position movement, inert exit state, visible/focused first field after reopening and no stale close callback.

The focused 15-test program/context run passed after the fix pass. The full unit suite passed all 230 tests and the build passed again. The final full browser run including the two new regressions passed all **249 tests in 5.6 minutes**. No failed or skipped tests remain in these final runs.

No second independent review was requested: the execution workflow uses one fresh whole-branch review followed by the author's regression-tested fix pass. No minor findings remain deferred after the motion issue was regraded and fixed.

The reviewer set aside preview/production environment behavior and the explicitly deferred future features. Those remain outside this local implementation: remote routing/buffering/accounting need operator verification, and strength/general-fitness, history, chat and automatic editing remain unavailable in v1.

## Release boundary

Preview routing, proxy buffering, preview provider accounting and a production deployment remain unverified operator release steps. Follow [deployment guidance](../../deployment.md#program-hypertrophy-analysis-update). No schema migration or seed is required for this feature. Existing environment migration/backup requirements still apply independently.

Strength/general fitness, saved report history, chat and automatic editing remain deferred. Optional context survives in current v3 program exports; older builds can discard new metadata on save, so preserve exports/backups before rollback.
