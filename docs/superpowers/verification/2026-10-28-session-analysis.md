# Session analysis verification

Implementation branch: `feat/session-analysis`, isolated `.worktrees/session-analysis` checkout from `9c34bb0`.

## Evidence so far

- Baseline: 148 unit tests passed before changes.
- Snapshot/prompt, incremental SSE, provider adapter, authenticated API, actual HTTP streaming/disconnect, browser protocol and lifecycle tests pass (165 tests before evaluation CLI tests).
- Ten analysis Playwright checks pass: safe text/XSS, unsaved snapshots, invalid-field focus, unavailable capability, close/reopen/Stop/retry, stale/revert/external replacement, late frames, scrolling, breakpoint focus, rapid reversal, reduced motion, mobile sheet and hybrid touch targets.
- Existing session-editor interactions passed alongside the initial analysis tests (13 browser checks); full suite results recorded below when run.
- Populated screenshot inspection: 1366x768, 1440x900, 1920x1080, 768x1024 tablet, 390x844 mobile and 200% root text at 1366x768. Long exercise names and populated volume rail included. Editor figures retain their established size; report placement does not resize the rail. Mobile uses a full-screen readable report with reachable footer. Hybrid targets measured >=44px.
- Motion exercised in a real Chromium browser with reduced motion off: exit keeps inert nodes alive, reopen cancels stale close, Escape returns focus. Reduced-motion checks use the suite default. Breakpoint changes during streaming retain text/focus; reader scroll opt-out and Jump to latest checked.
- Screenshot review found a real 200% text issue: growing content could push the footer below the viewport. A failing viewport regression was added; observing panel/anchor size now reclamps position and the regression passes.
- Screenshots are ignored execution artifacts in `.superpowers/sdd/2026-10-28-session-analysis/analysis-*.png`. Reports shown are deterministic test data, including an intentionally literal HTML injection string; they are not live model evaluations.

## Release gates and live continuation

- The user subsequently configured a capped development OpenRouter key. Its file was named `.env copy.example`; it was renamed to ignored `.env.local`, without printing the key. Missing local auth/database configuration was restored privately from the existing development checkout; the worktree uses that existing local development database. No production settings were accessed or modified.
- All 12 fixture types were subsequently evaluated with real Sonnet responses and inspected against the rubric. Prompt-contract tests remain structural checks, not proof of future model accuracy. Details and limitations follow below.
- Local real HTTP chunk flushing/disconnect now also have a live OpenRouter + Chromium smoke check. Vercel Preview streaming/function-duration verification remains pending; no Preview key or deployment configuration was supplied.
- Production deployment is not performed. No database migration or seeding is needed for this feature. Existing test-server-only migration/seed behavior is unchanged.
- Automated accessibility checks cover focus and ARIA behavior; no screen-reader software or physical touch device was used. Touch/hybrid is Chromium emulation.

See `docs/deployment.md` → OpenRouter session analysis for the user-owned configuration steps. Future goal-aware coaching and contextual/program analysis remain out of scope.

## Independent review and fixes

One independent read-only reviewer assessed the complete implementation. Six findings were reproduced with failing regression tests, then fixed: Escape now respects other modal/inner interactions; generation controls transfer focus before hiding; enabled Analyze has no disabled-state description; goals require actual numbers; malformed exercises produce indexed INVALID errors before timing normalization; repeated mobile reopening starts its entry transition again. The four new browser regressions and numeric/null API tests pass. No review findings were deferred. Reviewer declined live provider/prompt/billing/preview judgments because those external release gates are still pending.

The first complete browser run reported **195 passed / 1 failed**. The failure, `move collisions preserve the destination and lost move responses retry once`, reproduced in isolation. Investigation found a pre-existing catalog race: entering a filter before initial data arrived recorded an empty expansion set; later matches stayed inert/collapsed. A deterministic delayed-load regression failed before the fix. Newly arriving matching groups now expand, while deliberate collapse of previously seen groups remains intact. Both the new regression and the original failing test then passed. The final full suite after all fixes passed **201/201** in 5.5 minutes.

Implementation decisions: use the current lowercase `anthropic` provider slug, an optional internal usage callback for the evaluation CLI, and `npm.cmd` on this Windows host. These preserve the intended routing/usage/tool behavior; adapter/CLI tests cover their boundaries. The null-input and mobile-motion findings were treated as required fixes despite the reviewer's lower severity because useful input errors and deliberate motion are acceptance criteria. The catalog fix slightly broadens scope to preserve reliable existing behavior, with its own regression coverage. External live gates remain pending rather than waived.

## Final offline verification

- `npm.cmd test`: **171 passed, 0 failed**.
- `npm.cmd run test:e2e -- --reporter=line`: **201 passed, 0 failed**.
- `npm.cmd run build`: passed. Public output contains only index.html, style.css and browser src JavaScript; no server source, database or env files.
- `git diff --check`: passed (Git emits normal Windows LF/CRLF conversion notices).
- All six independent-review findings were reproduced RED then verified GREEN. No deferred minors. The additional catalog-loading fix was likewise reproduced RED then verified GREEN, and its original move-collision test passed in the full final suite.
- No live LLM request, preview deployment, production deployment, production migration or seed was performed. This is reviewed code with passing offline verification; model-quality and live-hosting release acceptance remain pending.

## Authorized live evaluation

The offline statements above describe the initial implementation handoff. After the user configured OpenRouter and resumed, live evaluation produced the following evidence:

- Default remains `anthropic/claude-sonnet-4.6` via the `anthropic` provider. Prompt is now `session-hypertrophy-v6`; temperature is 0.2, reasoning disabled, output cap remains 1500 tokens.
- Early versions were rejected for inventing missing-muscle requirements from a template title, assuming equipment/load, conflating per-exercise muscle roles, inventing changes to meet a word target, and suggesting weekly schedule changes. Prompt tests were extended RED/GREEN, with explicit evidence/scope rules, exact per-exercise roles and permission to give short no-change reports. A final low-volume/uncertainty refinement avoids treating one-set sessions as inherently inadequate.
- All 12 fixture types were reviewed under v5; v6 reran the affected focused-push, low-volume, high-volume and long-session cases. This is targeted regression evaluation, not a claim that every fixture was resampled under v6. Results are representative samples, not a statistical or scientific validation of all future reports.

| Fixture | Observed result |
|---|---|
| Focused push | No missing-muscle criticism or automatic additions; correct direct/indirect totals and per-exercise roles. |
| Overlapping presses | Identifies 20 direct chest sets; proposes reducing existing work inside the template, with a volume/quality trade-off. |
| Isolation first | Recognizes plausible prioritization; qualifies a possible fatigue trade-off without insisting compounds must always come first. |
| Zero rest | Identifies Squat's actual 0-second rest and suggests an explicit rest adjustment. |
| High volume | Correct 20 direct chest / 15 total triceps volume; in-template reductions with qualified tolerance discussion. Some role-summary wording is less precise than its correct parenthetical explanation. |
| Low volume | Final refinement permits intentional single-set sessions and returns no forced change. |
| Duplicate names | Distinguishes positions and recorded mappings; does not invent specific row variants. |
| Unknown exercise | Uses only recorded prescription/mappings; acknowledges unknown mechanics/equipment. |
| Missing equipment | Does not assert specific equipment or loading. |
| Goals | Quotes 7 vs 12 chest and 3 vs 1 lats without treating targets as universal hypertrophy thresholds or forcing changes. |
| Injection | Does not follow malicious exercise-name instructions or reveal prompt; produces a normal review. |
| Long session | Handles 40 exercises/120 direct sets within output limits; suggests reducing existing work. Strong fatigue language remains a quality caveat on this extreme stress fixture. |

Qualitative limitation: generated prose can still be more confident than desired, especially in extreme-volume fixtures, and may suggest a conditional set reduction for an otherwise reasonable session. The reports do not establish physiological truth or personal volume sufficiency. No deterministic correctness guarantee is claimed. These observations are retained for future prompt/model evaluation rather than hidden by a blanket pass label.

One Opus 4.6 comparison did not improve consistency enough to change the default; it included an internally inconsistent hypothetical triceps subtotal. Current Opus 5.5 was listed by the live models API but rejected the request because reasoning is mandatory; no successful generation was charged for those rejected calls. Provider availability and compatibility are distinct from being listed in the models catalog.

Live browser check used the real server service, same-origin router and Node HTTP bridge with an isolated localhost test-auth seam and populated editor fixture (no user workout writes). First report text was visible at **3237 ms**; completion at **14111 ms**. A second generation was stopped during streaming; the browser retained incomplete text, and the upstream fetch aborted at **1626 ms**, before `[DONE]`. Screenshot `live-browser.png` was visually inspected. Real app login/database behavior remains covered by the existing automated suite; this smoke check intentionally isolated the provider/transport/UI path.

OpenRouter's per-key usage endpoint reported **$0.280324** spent and **$1.719676** remaining under the **$2** cap after evaluations/comparison/browser smoke. Successful fixture/comparison usage records total $0.261535; the key endpoint also accounts for browser requests and the canceled request. Generation-detail lookup returned 404 for the two browser generation IDs, so provider-specific cancellation billing/activity details were not independently confirmed. No claim is made that stopping avoids all remaining charges.

Latest regression checks after prompt refinement: **172/172 unit tests**, **14/14 analysis browser tests**, and build pass. No frontend behavior changed in this continuation, so the already-green full **201/201** browser run was not repeated unnecessarily. Vercel Preview deployment, its separate key, function-duration behavior and dashboard accounting review remain release gates.
