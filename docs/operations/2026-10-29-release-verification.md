# Shared sessions and catalog metadata verification

Implementation branch: `feat/shared-sessions-catalog`, based on `1db3e85`. This report covers both October 29 implementation plans. No personal, preview or production database was migrated or seeded, and no deployment was performed.

## Automated and operational evidence

- Final combined release gate: `npm.cmd test` passed 199/199; `npm.cmd run test:e2e` passed 215/215; `npm.cmd run build` succeeded; `git diff --check` reported no whitespace errors.
- The unit suite covers linked storage and projection, duplicate legacy copies, transactional attachment/deletion races, exact command replay, template-owned autosave conflicts, catalog propagation, portable v1/v2/v3 files and import rollback. Metadata tests cover migration rollback, preserved equipment backups, unresolved references, inheritance, unchanged prescriptions, defaults, tag archive/source-copy rules and revision guards.
- Disposable pre-005 file-database backup/conversion/rerun/restore rehearsal passed. A disposable pre-006 database was backed up, migrated and checked with the read-only cleanup report. Its mixed-equipment reference was configured through the real browser UI with an impact preview; existing four-set prescriptions and 45-second rest survived, and fresh linked selections became valid. Migration/seed replay preserved chosen metadata, and restoring the copied pre-006 backup recovered its original schema/equipment. The actual environment's manual cleanup remains an operator task.
- Full browser coverage includes shared edits across programs/library, repeated-occurrence volume, recovery and failed navigation, normal/reduced motion, catalog CRUD/moves/archive, metadata forms, tag management/search, info interactions, breadcrumbs and moved/archived/missing deep links.

## Layout and interaction inspection

Populated screens were inspected at 1366x768, 1440x900, 1920x1080, tablet widths and 390px mobile, including 200% text and touch/hybrid input. Long descriptions and six long Focus labels per exercise wrap without page overflow. Desktop body figures remain at least 180px; touch/hybrid actions remain at least 44px. Breadcrumbs now align with the existing canvas gutters.

Real-browser behavior checks covered native equipment-radio arrow navigation, description expand/collapse and rapid reversal, native modal closing/focus restoration, information peek/pinning/Escape/outside/scroll behavior, tooltip viewport clamping and long-description scrolling, dragging, Back/Forward and reload. Normal motion was explicitly enabled for transition tests; reduced-motion checks settle synchronously. Description fixtures containing HTML-like text remain literal text.

The design-taste app inspector finished with zero failures and two warnings across five widths. Existing small anatomical captions/metadata and the approved floating mobile volume-panel shadow were retained deliberately. Design lint finished with zero failures and 14 warnings for existing palette/layout patterns; existing radial slider-thumb geometry is documented as functional. Frontend design, UI/UX guidance and the fresh Web Interface Guidelines review were applied without changing the approved Barlow/dark/orange direction.

## Independent review and recovery fixes

The fresh whole-branch reviewer identified one attachment data-loss race and two tag recovery failures. All three received failing browser regressions before fixes. Empty-workout creation now reuses the existing shell interaction lock throughout flush, command and acknowledgement, preventing arrangement edits from being reset by its response. Controls become available when the command settles; this immediate busy state does not introduce a disclosure or decorative animation. Exact replay still recovers a lost command response without extra templates.

A definitive tag validation/conflict rejection now releases the failed create envelope so a corrected name can be submitted; ambiguous network failures retain the exact envelope for retry. Edit variant can refresh current tag eligibility after an archived-assignment rejection without replacing the draft, then remove/replace the visibly archived selection. Five recovery regressions cover delayed/lost responses and both tag paths. No minor review findings were deferred.

## Verification limits and rollout

Browser automation used Chromium and disposable local SQLite, not physical touch devices, assistive technology, remote Turso contention or a live production rollout. Screenshots support layout findings; interaction assertions establish motion/focus behavior. The unresolved-equipment migration fixture was also configured through the real UI during the additional disposable rehearsal.

Follow [shared-session rollout](shared-sessions-rollout.md), then [catalog metadata rollout](catalog-metadata-rollout.md). Back up the selected environment, stop old writers, run explicit migration/seed commands as applicable, resolve Needs equipment references manually, and require old tabs to reload. Restore the matching application/database pair if rollback is needed.
