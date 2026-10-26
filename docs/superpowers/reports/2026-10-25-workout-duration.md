# Workout duration implementation report

## Scope delivered

Implemented plan Tasks 1-5 on `feat/workout-duration`: live estimates, independently saved exercise rest, extra minutes and percentage buffer, accessible editor details, collapsed rest summaries, program labels, legacy defaults and portable JSON timing. Execution is one minute per set and rest counts after every set. Reference groups supply 180-second compound / 90-second isolation defaults on initial selection only; custom/unclassified exercises use120 seconds. Default session allowances are five minutes and ten percent.

The catalog prerequisite was initially unavailable on main. On resumption its committed implementation was found on `feat/exercise-catalog` through964f00b and integrated into this feature branch at2d7509a. It includes the newer reference-group/variant model, so classification belongs to references exactly as the user requested. The source branch, original checkout and its separate local preview were not changed. Migration004 and explicit seed version2 implement reference classification; no new catalog subsystem was invented.

## Verification

- Explicit `npm.cmd run db:migrate` succeeded against a disposable local SQLite file at `.superpowers/sdd/2026-10-25-workout-duration/migration.db`. No production database or secrets were used.
- `npm.cmd test`: 139 passed, zero failures after the final source changes.
- Combined catalog/reference/duration/recovery checks: 32 passed; the final dedicated reference-default/linking/variant checks passed2/2.
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
- Integrated the committed prerequisite into the duration feature branch only. Cost: a larger combined diff and verification surface; the prerequisite branch and preview stay untouched.
- Classification belongs to reference groups; variants share the group initial default. Cost: a mixed reference group shares a default, adjustable per workout. Existing custom references with no classification retain the two-minute fallback until explicitly edited.
- Workout timing inputs stay in existing document JSON. Migration004 adds nullable exercise_type to catalog_families. Run db:migrate and db:seed explicitly per environment; the local migration and seed were each repeated successfully. Never run them in builds or requests.
- Nothing was merged, pushed, published or migrated in production.
