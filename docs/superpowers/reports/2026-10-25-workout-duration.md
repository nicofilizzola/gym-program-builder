# Workout duration implementation report

## Scope delivered

Implemented plan Tasks 1–4 on `feat/workout-duration`: live duration estimates, independently saved rest per exercise, extra minutes and percentage buffer, inline accessible editor details, collapsed rest summaries, program workout labels, legacy defaults and portable JSON timing. Execution is fixed at one minute per set and rest counts after every set. Defaults for currently supported custom/legacy exercises are two minutes rest, five extra minutes and ten percent buffer.

Task 5 is pending its explicit prerequisite. The approved exercise catalog exists only as a design document at this baseline; there is no catalog schema, picker, seed command or propagation implementation to extend. The pure reference-default function supports compound 180 seconds and isolation 90 seconds, but automatic classification/default selection is not exposed or claimed. The approved plan forbids implementing the entire catalog within this feature. This branch is preparatory work, not completion of the full approved release.

## Verification

- Explicit `npm.cmd run db:migrate` succeeded against a disposable local SQLite file at `.superpowers/sdd/2026-10-25-workout-duration/migration.db`. No production database or secrets were used.
- `npm.cmd test`: 112 passed, zero failures after the final source changes.
- Affected duration/program overview browser checks: 17 passed after layout fixes.
- Full browser suite: final run and independent review recorded below after completion.
- `npm.cmd run build` succeeded; the build still copies only index.html, style.css and browser src assets. Unit build tests verify the allowlist.
- `git diff --check` passed.

Tests cover the 27-minute worked example, final-set rest, zero and maximum inputs, fractional buffer, final-only rounding, empty/unfinished sessions, strict timing validation in drafts/imports, v1/v2 files, copy independence, idempotent legacy saves, stale conflicts, autosave/reload, retry, Save as copy and Reload saved version.

## Visual and interaction review

Inspected populated editors at 1366×768, 1440×900, 1920×1080, tablet 900px, mobile 760px/390px and 200% root text. Inspected program overview screenshots at the desktop sizes plus 900px and 390px. Existing compact-desktop captures exercise six populated cards/all muscle goals. Screenshots remain local under `.superpowers/sdd/2026-10-25-workout-duration/`; they are excluded from production assets.

The duration summary shares the desktop heading; details expand in normal flow. Both figures retain 180–200px desktop heights. Mobile retains its existing pinned volume panel and document scrolling. Browser assertions cover no document overflow, one-line rest readouts with enlarged text, 44px native slider hit areas, coarse/hybrid targets, focus preservation, disclosure state and accessible estimate descriptions. Existing suites cover volume interaction, tooltip/collapse behavior, reordering and reduced motion.

The first full browser run found enlarged-text overflow in program metadata: its new duration label inherited `flex:none`. The label now shrinks/wraps, and both web-font and fallback-font responsive tests pass. Screenshot review also found awkwardly wrapped rest values at 200% text; slider headings now wrap while preserving one-line numeric readouts. Each correction has a reproduced failing test followed by a passing run.

## Decisions and remaining work

- Use native Windows npm.cmd/npx.cmd because PowerShell script policy blocks npm.ps1; no runtime behavior changes.
- Use a managed isolated worktree and retain the approved compact design. The original checkout and unrelated untracked plan were left untouched.
- Preserve the catalog prerequisite instead of creating an unplanned catalog subsystem. Cost: automatic compound/isolation defaults and full-release signoff remain pending.
- Before completing Task 5, implement the approved catalog, record its concrete file paths and explicit seed command in the plan, then add required classification, reviewed fixtures, initial selection defaults and propagation-preservation coverage.
- Timing inputs live in existing document JSON; there are no new relational timing columns. Run environment migrations/seeds explicitly as required by the eventual catalog implementation. Never run them in builds or requests.
- Nothing was merged, pushed, published or migrated in production.
