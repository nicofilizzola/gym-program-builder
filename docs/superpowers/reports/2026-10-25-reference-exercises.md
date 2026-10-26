# Reference exercise implementation and verification

Implemented natively on `feat/exercise-catalog`, continuing from `8131b4b`. [Plan](../plans/2026-10-25-reference-exercises.md), [approved design](../specs/2026-10-25-reference-exercises-design.md).

## Delivered behavior

- Nested reference exercise / variant catalog with reference creation, rename, archive and restore, including empty references.
- Shared grouped search and autocomplete; only variants are selectable, with stable keyboard selection and an eight-variant cap.
- Independent parent and individual archive flags. Restoring a reference preserves individually archived variants.
- Transactional variant moves preserve identity, prescriptions and volume, update linked documents once, reject collisions, and guard concurrent changes.
- Revision-aware reference previews and draft recovery that refreshes parent metadata without losing variant fields or changing the pending creation ID.
- Existing internal family IDs and portable version-1/version-2 files remain compatible. No new dependencies or external exercise service.

## Verification

Final checks: `npm test` passed 125/125, `npm run test:e2e` passed 104/104, `npm run build` passed, and `git diff --check` passed.

The explicit migration and seed were rehearsed against an isolated development SQLite file. Repeating migration and seed retained all 64 seeded entries, stable IDs and both archive flags. Upgrade tests preserve previous document JSON and IDs. The user's separate local preview was subsequently migrated explicitly and restarted at http://localhost:3000; the original main database and remote environments were untouched.

Populated browser checks cover 1366x768, 1440x900, 1920x1080, 768x1024 and 390x844, including expanded groups, forms, long names, 200% text, hybrid input, keyboard behavior and figure sizes. Screenshots were inspected. The app-screen inspector reported zero failures and warnings with existing-design allowances for its hidden-heading heuristic, mobile volume shadow and small Front/Back labels.

## Independent review

One fresh whole-branch review found no Critical findings and two Important concurrency findings. Both were reproduced before fixes:

1. Catalog children and reference revisions could describe different database states. A read transaction now supplies a consistent snapshot; the interleaving regression passes.
2. Creation/clone drafts could only retry a stale parent revision. Refresh reference exercise now preserves fields and operation identity, updates revisions and disables saving under archived references. Add/clone regressions pass, including archive/restore during recovery.

No second review or implementation agents were used.

## Rulings and deferred minor

- Used native PowerShell bookkeeping and npm.cmd/npx.cmd instead of the skills' Bash helpers. Cost if wrong: bookkeeping portability; application behavior is unaffected.
- Committed tasks 5 and 6 together because terminology and shared selectors cross both UI surfaces; retained separate failing/passing evidence. Cost if wrong: less granular commit review, with no product behavior tradeoff.
- Inspector allowances preserve the approved existing design. Cost if wrong: those inherited patterns require a separate design review; they do not excuse new layout failures.
- Deferred minor: cancelling reference edit or Add variant returns focus to a neighboring logical reference control rather than the exact invoking action. Focus remains visible and usable.

The branch and worktree remain available for local testing. No merge, push, deployment or remote migration was performed.
