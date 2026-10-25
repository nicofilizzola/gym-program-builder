# Exercise catalog implementation and verification

Implemented natively on branch feat/exercise-catalog, based on 58e835d. Implementation plan: [2026-10-25-exercise-catalog.md](../plans/2026-10-25-exercise-catalog.md). Approved design: [exercise catalog](../specs/2026-10-25-exercise-catalog-design.md).

## Delivered behavior

- App-owned catalog with 64 curated entries, stable exercise/family identity, equipment filters, editable mappings, usage previews, and archive/restore.
- Accessible in-card autocomplete, explicit legacy linking/replacement, read-only linked definitions, and named variant creation preserving workout sets/reps.
- Transactional propagation through templates and program workouts, authoritative snapshot resolution, stale-editor recovery and protected exports.
- Existing unlinked records remain unchanged. Versions 1 and 2 import independently; version-2 exports remain self-contained without trusted catalog IDs.
- Explicit additive migration and idempotent seeding. No external API, new dependency, framework, browser persistence or statistics feature.

## Verification evidence

| Command/check | Result |
| --- | --- |
| npm test (npm.cmd on Windows) | 113 passed, 0 failed |
| npm run test:e2e | 95 passed, 0 failed |
| npm run build | Passed; browser asset allowlist retained |
| npm run db:migrate | Passed against a worktree-local verification SQLite database |
| npm run db:seed, run twice | Passed; automated seed test separately proves edited/archived entries stay unchanged |
| git diff --check | Passed |
| Focused catalog, responsive and recovery browser cases | Included in full green suite; final targeted catalog/layout run 16 passed |

Populated editor, picker, variant form and catalog screens were inspected at 1366×768, 1440×900, 1920×1080, 768×1024 and 390×844. Hybrid touch targets and 200% text were checked. Both desktop body figures remain 180–200px. Existing sliders, volume/readout, collapse, tooltip, drag, program schedule and import/export regression tests pass.

The design-taste app inspector ran on a populated static editor snapshot at 1440/768/390 and passed with documented allowances: its first-h1 heuristic sees the hidden login heading, while browser tests verify the visible application heading; the existing mobile volume panel shadow and small Front/Back figure labels are required by the approved design system. Actual interactive browser screenshots, rather than serialized input values in the static snapshot, were used to judge forms and picker behavior.

## Independent review and fixes

One fresh-context read-only whole-branch reviewer reviewed 58e835d..0d275a1. No Critical issues were reported; two Important issues and one focus issue labeled Minor were found. No behaviors were declined for judgment. All were addressed in one regression-backed fix pass, followed by the full green suite; there was no second reviewer dispatch.

| Finding | Resolution and regression |
| --- | --- |
| Focus refresh can mistake an unacknowledged own write for an external change and leave autosave paused | Refresh defers to in-flight acknowledgements; delayed committed PUT browser test verifies the next edit still saves |
| Same-tab catalog mutations leave picker cache stale | Shared in-memory store invalidation plus editor-entry revalidation; browser navigation test finds a newly created exercise without window blur/focus |
| Escape from legacy linking focuses a hidden control | Restore focus to Link to catalog; keyboard regression verifies the invoking control receives focus |
| Full-suite popup placement covers Back to program | Reserve visible application/program navigation space; existing animated embedded-workout navigation test passes |
| Save acknowledgement can close an open variant draft | Compare definition fields independently of object property order and update linked text in place; delayed acknowledgement test preserves the open form and typed variant name |

Earlier failing UI checks also caught Save remaining enabled after failed usage previews, popover display CSS overriding native hiding, missing selected-chip role classes, missing explicit text-input styling and a suggestion overlay covering the equipment controls. Each was corrected and verified before the final run.

## Rulings and tradeoffs

| Ruling | Reason | Cost if wrong |
| --- | --- | --- |
| Use PowerShell-native execution bookkeeping and npm.cmd/npx.cmd | Windows execution policy blocks npm.ps1; equivalent ledger and verification evidence were retained | Bookkeeping/command portability, without changing app behavior |
| Keep version-2 exports and explicitly strip catalog identity | Approved imports must preserve definitions without silently establishing links | Imported files intentionally require explicit linking; lost identity is the agreed portability tradeoff |
| Add transient catalogCopyOf hints for saved-template copies into programs | Whole-document copyOf cannot identify a source template during a program update; server verifies source membership and removes hints before persistence | A faulty check could reject legitimate archived copies or permit unintended archived selections; both cases have repository coverage |
| Adopt authoritative snapshots only for the acknowledged edit generation, with in-place definition updates | Newer local edits and open variant drafts must survive network acknowledgements | Incorrect generation handling could discard edits or display stale mappings; queue and browser regressions cover both |
| Reposition picker overlays during scrolling and reserve navigation space | Browser auto-scroll must not dismiss a just-opened menu or make Back unreachable | Popovers may flip above controls or show fewer rows on small viewports; viewport and navigation tests cover this |
| Treat the reviewer's Minor focus issue as required accessibility work | The spec requires sensible focus restoration; keyboard users must return to their invoking control | Small additional focus-handling scope, with no domain-model change |
| Allow only the inspector's documented inherited-design/hidden-login findings | Preserve approved figure labels and mobile panel treatment; the hidden login h1 is not the visible page heading | Automated heuristics alone cannot certify these cases; populated screenshots and browser assertions provide the evidence |

No minor findings were deferred. No merge, push, deployment, remote migration, remote seed, or production data change was performed. Adoption requires running the explicit migration and seed commands separately against each intended environment.
