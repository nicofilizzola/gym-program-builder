# Workout duration implementation report

## Scope delivered

Implemented all six plan tasks on `feat/workout-duration`: live estimates, independently saved exercise rest, extra minutes and percentage buffer, accessible editor details, collapsed rest summaries, program labels, legacy defaults and portable JSON timing. Execution is one minute per set and rest counts after every set. Reference groups supply 180-second compound / 90-second isolation defaults on initial selection only; custom/unclassified exercises use 120 seconds. Default session allowances are five minutes and ten percent.

The catalog prerequisite was initially unavailable on main. On resumption its committed implementation was found on `feat/exercise-catalog` through 964f00b and integrated into this feature branch at 2d7509a. It includes the newer reference-group/variant model, so classification belongs to references exactly as the user requested. The source branch, original checkout and its separate local preview were not changed. Migration 004 and explicit seed version 2 implement reference classification; no new catalog subsystem was invented.

## Verification

- Explicit `npm.cmd run db:migrate` succeeded against a disposable local SQLite file at `.superpowers/sdd/2026-10-25-workout-duration/migration.db`. No production database or secrets were used.
- `npm.cmd test`: 140 passed, zero failures after the final source changes.
- Combined catalog/reference/duration/recovery checks: 32 passed; the dedicated reference-default/linking/variant/retry checks passed 3/3.
- `npm.cmd run test:e2e`:121 passed, zero failures after the review fix (3.6 minutes).
- `npm.cmd run build` succeeded; the build still copies only index.html, style.css and browser src assets. Unit build tests verify the allowlist.
- `git diff --check` passed.

Tests cover the 27-minute worked example, final-set rest, zero and maximum inputs, fractional buffer, final-only rounding, empty/unfinished sessions, strict timing validation in drafts/imports, v1/v2 files, copy independence, idempotent legacy saves, stale conflicts, autosave/reload, retry, Save as copy and Reload saved version.

## Visual and interaction review

Also inspected reference-type forms at 1366x768,1440x900,1920x1080,768x1024 and390x844. Inspected populated editors at 1366×768, 1440×900, 1920×1080, tablet 900px, mobile 760px/390px and 200% root text. Inspected program overview screenshots at the desktop sizes plus 900px and 390px. Existing compact-desktop captures exercise six populated cards/all muscle goals. Screenshots and execution evidence are archived locally under `.superpowers/artifacts/2026-10-25-workout-duration/`; they are excluded from production assets.

The duration summary shares the desktop heading; details expand in normal flow. Both figures retain 180–200px desktop heights. Mobile retains its existing pinned volume panel and document scrolling. Browser assertions cover no document overflow, one-line rest readouts with enlarged text, 44px native slider hit areas, coarse/hybrid targets, focus preservation, disclosure state and accessible estimate descriptions. Existing suites cover volume interaction, tooltip/collapse behavior, reordering and reduced motion.

The first full browser run found enlarged-text overflow in program metadata: its new duration label inherited `flex:none`. The label now shrinks/wraps, and both web-font and fallback-font responsive tests pass. Screenshot review also found awkwardly wrapped rest values at 200% text; slider headings now wrap while preserving one-line numeric readouts. Each correction has a reproduced failing test followed by a passing run.

## Decisions and remaining work

- Use native Windows npm.cmd/npx.cmd because PowerShell script policy blocks npm.ps1; no runtime behavior changes.
- Use a managed isolated worktree and retain the approved compact design. The original checkout and unrelated untracked plan were left untouched.
- Integrated the committed prerequisite into the duration feature branch only. Cost: a larger combined diff and verification surface; the prerequisite branch and preview stay untouched.
- Classification belongs to reference groups; variants share the group initial default. Cost: a mixed reference group shares a default, adjustable per workout. Existing custom references with no classification retain the two-minute fallback until explicitly edited.
- Workout timing inputs stay in existing document JSON. Migration 004 adds nullable exercise_type to catalog_families. Run db:migrate and db:seed explicitly per environment; the local migration and seed were each repeated successfully. Never run them in builds or requests.
- No merge into main, push, publication or production migration was performed.


## Independent review and fix

One independent read-only review found no Critical issues and one Important creation-retry issue. If inline reference creation committed but its response was lost, a later retry with a changed reference type could return success with the original type. Unit and real-browser lost-response regressions reproduced this before the fix. Replay now checks supplied reference name/type intent and returns a conflict on changes; restoring the original values retries idempotently. Variant creation under an existing reference omits hidden creation fields. The four targeted catalog-duration unit tests and three browser tests pass; final full verification after the correction passed 140 unit tests and 121 browser tests, and the build succeeded.

Deferred minor: malformed imported exercises such as null are rejected as a whole, but normalization reports a generic error instead of the indexed exercise validation message. No invalid file is applied and saved data is unchanged.

Reviewer exclusions were assessed explicitly: unchanged prerequisite behavior relies on its prior independent review plus the combined regression suite; remote migration/deployment remains a separate operator step; the fixed execution-time assumption and reference classifications are the chosen planning model, not measured elapsed workout time. Browser verification is completed by the executor and recorded below.
