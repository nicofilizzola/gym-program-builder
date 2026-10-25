# Exercise Catalog Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Native execution was selected by the user. Steps use checkbox syntax for tracking.

**Goal:** Ship a reusable, editable exercise catalog with accessible in-card autocomplete and family-linked variants.

**Architecture:** Keep catalog definitions in relational tables and resolved snapshots in document JSON. Transactional catalog edits propagate snapshots and document revisions; all document writes resolve linked definitions server-side. Small dedicated browser modules own catalog forms, the catalog page and autocomplete.

**Tech Stack:** Plain JavaScript, CSS, Node.js 24, libSQL, node:test, Playwright; no new dependencies.

**Spec:** docs/superpowers/specs/2026-10-25-exercise-catalog-design.md

## Global Constraints

- Use the existing plain JavaScript frontend, Node.js 24 API, SQLite development database, and Turso/libSQL production database.
- No external exercise API, ORM, frontend framework, browser persistence, or additional service is required.
- Sets and reps belong exclusively to the workout.
- Never run production migrations or seeds during builds or requests.
- Fine-pointer desktop controls may be 32px only when no coarse pointer is available; touch/hybrid targets stay at least 44×44px and native range hit areas stay 44px.
- Keep both desktop figures 180–200px and preserve mobile panel behavior.
- Run npm test, npm run test:e2e and npm run build.

## Review Focus

- A lost response after variant creation must not duplicate the catalog entry (tasks 2, 6).
- Catalog changes while a dirty editor is open must never overwrite local workout settings or restore stale mappings (tasks 3, 7).
- An asynchronous selection must not attach to another exercise after reorder/removal (task 6).
- Imported IDs must not establish trusted links or mutate the catalog (task 3).
- Overlays must remain reachable above the mobile panel and outside collapsed-card clipping, including enlarged text (tasks 5, 6, 8).

## Task 1: Catalog model, schema and starter fixture

**Files:** Create src/catalog.js, server/catalog-seed.js, migrations/002-catalog.sql, scripts/seed-catalog.js, test/catalog.test.js. Modify server/db.js and package.json.

**Interfaces:** validateCatalogEntry(value) returns {entry} or {error}; searchCatalog(entries,query,{equipment,limit=8}) returns entries; snapshotExercise(exercise,entry) returns resolved linked exercise; EQUIPMENT is the fixed equipment list. seedCatalog(db) is explicitly invoked and idempotent.

- [ ] Write tests asserting invalid muscles/overlap/empty names are rejected, accent-insensitive all-word search ranks exact/prefix matches, archived entries are excluded, snapshots preserve 4 sets and 6–8 reps, and seed reruns preserve edits/archives.
- [ ] Run node --test test/catalog.test.js; expect missing-feature failures.
- [ ] Implement the interfaces and additive migration, plus a reviewed approximately 60-entry stable-ID fixture covering all 12 muscles and five core equipment categories. Add db:seed script; preserve prior migrations.
- [ ] Run node --test test/catalog.test.js and npm test; expect zero failures. Commit feat: add catalog model and explicit seed lifecycle.

## Task 2: Transactional catalog repository

**Files:** Create server/catalog-repository.js, test/catalog-repository.test.js. Reuse server/repository.js domain errors.

**Interfaces:** createCatalogRepository(db) provides list(), create({id,familyId,familyName,entry}), impact(id), update({id,revision,entry,impact}), archive({id,revision,archived}), renameFamily({id,revision,name}). List returns {entries,families}; entry includes familyName. impact returns [{id,revision,count}] sorted by document ID.

- [ ] Test idempotent create, duplicate names, family membership, archive/restore, stale revisions, atomic propagation into a template and two program occurrences, unchanged settings, one revision bump per document, refreshed impact conflicts, and failure rollback.
- [ ] Run node --test test/catalog-repository.test.js; expect missing-feature failures.
- [ ] Implement write transactions with validated payloads, revision checks and full-snapshot propagation. Same-ID create replay returns its original record only when its definition/family matches.
- [ ] Run targeted tests and npm test; expect zero failures. Commit feat: propagate catalog edits transactionally.

## Task 3: Trusted document links and portable files

**Files:** Modify src/document-validation.js, src/document-file.js, server/repository.js. Create server/catalog-links.js. Extend test/repository.test.js, test/document-validation.test.js, test/document-file.test.js.

**Interfaces:** resolveCatalogLinks(tx,document,{previous,copy=false}) validates IDs and replaces linked snapshots; validateDocument retains valid internal link metadata. Portable serialization/import explicitly strips link metadata. create accepts optional copyOf source document ID for authorized preservation of archived links.

- [ ] Test linked metadata roundtrips internally, unknown IDs reject, server overwrites forged mappings, archived new links reject while existing/copy links survive, stale document writes conflict after propagation, stale Save as copy uses current definitions, and imported IDs are discarded.
- [ ] Run the three targeted test files; expect assertion failures.
- [ ] Implement resolution within document transactions, portable metadata stripping and explicit copy source verification. Preserve existing v1/v2 file shape and strict validation.
- [ ] Run targeted tests and npm test; expect zero failures. Commit feat: validate linked exercises and preserve portable exports.

## Task 4: Authenticated catalog API and client

**Files:** Modify server/api.js, api/index.js, scripts/dev-server.js, src/api-client.js; extend test/api.test.js and test/api-client.test.js.

**Interfaces:** GET/POST /api/catalog; GET /api/catalog/:id/impact; PUT /api/catalog/:id; PUT /api/catalog/:id/archive; PUT /api/catalog/families/:id. Browser client exposes catalog(), createCatalog(value), catalogImpact(id), updateCatalog(value), archiveCatalog(value), renameFamily(value).

- [ ] Test unauthenticated catalog requests fail, cross-origin writes fail, invalid bodies fail, conflicts return 409, and an authenticated create/edit/list updates linked documents through real repository integration.
- [ ] Run targeted tests; expect new route failures.
- [ ] Wire the catalog repository in dev and production through the existing single API handler; retain request size limits and safe errors. Seed only the ephemeral test server automatically.
- [ ] Run targeted tests and npm test; expect zero failures. Commit feat: expose authenticated catalog endpoints.

## Task 5: Catalog page and reusable entry forms

**Files:** Create src/catalog-view.js, src/catalog-form.js; modify src/router.js, src/app.js, index.html, style.css, docs/design-system/README.md. Create e2e/catalog.spec.js.

**Interfaces:** mountCatalog(root,{api,onOpenDocument}) returns destroy(); openCatalogForm({api,entry,families,mode,onSaved}) returns a teardown handle and owns a native modal dialog. Mode create/variant/edit determines family and impact behavior.

- [ ] Add browser tests for navigation, filter/search, create family, create same-mapping variant, edit with usage preview, rename family, archive/restore, cancellation, retry and conflict recovery retaining inputs.
- [ ] Run npx playwright test e2e/catalog.spec.js; expect catalog navigation failure.
- [ ] Build the compact list, visible labels, native dialog forms, family handling, prefilled variant controls, idempotent IDs, impact previews and error/recovery actions. Use existing tokens; document components.
- [ ] Run new browser tests and npm test; expect zero failures. Commit feat: add exercise catalog management.

## Task 6: In-card autocomplete and linking workflows

**Files:** Create src/exercise-picker.js; modify src/session-editor.js and src/program-view.js; extend e2e/catalog.spec.js and existing editor tests only where new-card expectations intentionally change.

**Interfaces:** mountExercisePicker(host,{api,exercise,onSelect,onCreate,onVariant,onView}) returns destroy()/refresh(). Editor receives api and exposes unchanged onChange workout contract. Resolve async completions by exercise object identity rather than array index; preserve identity on updates/reorders.

- [ ] Test typing does not select, eight-result limit, keyboard/IME/escape/tab, equipment filter, catalog-load retry, selection and replacement preserve sets/reps, linked fields are read-only, legacy linking requires confirmation, and variant cancel/retry/reorder/removal do not change another card.
- [ ] Run new browser cases; expect missing picker failures.
- [ ] Implement top-layer viewport-safe picker overlays, in-memory load/revalidation and result announcements. Mark new cards as selection drafts through transient editor state while persisted empty drafts reopen with the picker. Keep imported/legacy complete unlinked exercises editable. Dismiss overlays on collapse/teardown. Preserve volume, sortable and validation focus behavior.
- [ ] Run catalog and session-editor browser tests and npm test; expect zero failures. Commit feat: add linked exercise autocomplete and variants.

## Task 7: Refresh, conflict and export integration

**Files:** Modify src/app.js, src/autosave.js only if necessary, src/session-editor.js, src/program-view.js. Extend e2e/recovery.spec.js and e2e/catalog.spec.js.

**Interfaces:** shared export callback flushes, fetches current saved revision and blocks conflicts; focus refresh checks active record revision and preserves dirty edits. Save as copy passes copyOf. Catalog-related conflict messages explain current definitions on copy.

- [ ] Test clean-editor focus reload, dirty-editor revision conflict without lost sets, blocked stale export, copy using latest catalog mappings, and program nested editor parity.
- [ ] Run targeted browser cases; expect stale refresh/export failures.
- [ ] Wire refresh guards with route-generation protection, existing autosave recovery and export validation/focus. Prevent a refresh racing navigation or inflight saves from replacing unsaved state.
- [ ] Run recovery/catalog/import-export browser tests and npm test; expect zero failures. Commit fix: protect catalog-linked edits across refresh and export.

## Task 8: Full verification, responsive inspection and final review

**Files:** Extend e2e/compact-desktop.spec.js or e2e/catalog.spec.js with populated responsive cases; update design-system docs and operational README.

- [ ] Add assertions for visible/reachable picker and dialog actions at 1366×768, 1440×900, 1920×1080, phone/tablet, hybrid touch and enlarged text. Run and address real layout failures.
- [ ] Run npm run db:migrate and npm run db:seed explicitly with a development-only database URL. Expect success; rerun seed and verify edits are not reset.
- [ ] Run npm test, npm run test:e2e, npm run build and git diff --check; require zero failures.
- [ ] Capture and inspect populated screenshots; verify 180–200px desktop figures, overflow, focus, reduced motion and touch targets.
- [ ] Obtain one fresh whole-branch reviewer using requesting-code-review; fix important findings with regression tests and rerun required suites. Record minor deferrals and rulings in the execution ledger.
- [ ] Commit final verification/documentation changes; report branch, plan/spec links, evidence and any remaining limitations. Do not merge, push or publish without authorization.
