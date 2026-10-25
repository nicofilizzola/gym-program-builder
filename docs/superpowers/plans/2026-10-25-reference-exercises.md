# Reference Exercises and Nested Catalog Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans for native implementation, preserving the user's existing execution preference. Implement task-by-task; steps use checkbox syntax. This document authorizes no implementation by itself.

**Goal:** Ship a reference exercise → variant catalog, independent reference CRUD, grouped autocomplete and safe variant reassignment.

**Architecture:** Retain current grouping and variant IDs and legacy internal familyId fields. Add an independent reference archive flag, derive effective variant availability, share pure grouping/search rules across catalog and autocomplete, and transactionally propagate variant moves to linked documents.

**Tech Stack:** Existing plain JavaScript/CSS, Node.js 24, SQLite/Turso/libSQL, node:test and Playwright. No new dependencies.

**Spec:** docs/superpowers/specs/2026-10-25-reference-exercises-design.md

## Global Constraints

- A reference exercise is a named grouping, not a selectable workout exercise.
- Equipment and primary/secondary muscle mappings belong to variants.
- Existing catalog_families IDs, catalog_entries.family_id, familyId snapshots and legacy wire fields remain stable internal compatibility identifiers.
- Only explicit environment-specific migration commands apply this change.
- No browser persistence is introduced.
- Only variants are selectable in autocomplete.
- Restoring a reference does not restore variants previously archived individually.
- Version-1/version-2 import/export behavior and portable file shape stay unchanged.
- Preserve both desktop figures at 180–200px, 32px fine-pointer controls only when no coarse pointer exists, 44×44px touch targets and 44px slider hit areas.
- No production migration, seed, deployment or existing preview-database mutation happens as part of this planning task.

## Review Focus

- A child added/moved/archived after the parent preview must make the old archive confirmation conflict (task 2).
- Archiving/restoring a parent repeatedly, including lost responses, must never resurrect individually archived variants (tasks 2 and 4).
- A move touching several occurrences in a program must preserve volume and increment that document once, including rollback and stale-editor copy recovery (task 3).
- Grouping must not reorder keyboard choices invisibly or merge different IDs with identical reference names; stale cache reads must not restore obsolete groups (tasks 1 and 6).
- Group actions/dialogs must preserve invoking focus and remain reachable with long names, expanded search, 200% text and touch/hybrid input (tasks 5 and 7).

## File responsibilities and compatibility

| Files | Responsibility |
| --- | --- |
| src/catalog-groups.js, test/catalog-groups.test.js | Pure grouping, matching, ranking, visible counts and flattened option order |
| migrations/003-reference-exercises.sql, server/db.js | Additive parent archive state; leave migrations 001/002 unchanged |
| server/reference-repository.js | Standalone reference create/get/update/archive/restore and aggregate revision guards |
| server/catalog-propagation.js | Shared impact reads, exercise traversal and snapshot propagation |
| server/catalog-repository.js, server/catalog-links.js | Effective variant state, membership guards, move transaction and authoritative association resolution |
| server/api.js, src/api-client.js | Authenticated reference/move routes and client methods; retain legacy rename route |
| src/reference-form.js, src/catalog-view.js | Name-only and move/reference lifecycle dialogs; grouped catalog disclosures and focus restoration |
| src/catalog-form.js, src/exercise-picker.js, src/catalog-store.js | Variant terminology, scoped creation, grouped options and cache invalidation |
| style.css, docs/design-system/README.md | Authoritative compact grouped-row/dialog styling and matching documentation |
| Existing catalog/link/API tests, new reference browser tests | Persistence, migration, access control, async recovery and UI acceptance |

Internal catalog payloads continue to use {entries,families}. Each family record gains archived. Each entry retains familyId/familyName and exposes archived (effective), individuallyArchived and referenceArchived. UI helpers call normalized groups references, avoiding a wire-format migration.

## Task 1: Pure reference grouping and shared search

**Files:** Create src/catalog-groups.js and test/catalog-groups.test.js. Reuse normalization and equipment definitions from src/catalog.js.

**Interfaces:** groupCatalog({entries,families},query='',{equipment='',showArchived=false,mode='catalog',limit=8}={}) → Array<{reference:{id,name,revision,archived},variants:Array<CatalogEntry>,activeCount:number,archivedCount:number}>. flattenVariantOptions(groups) → CatalogEntry[] in rendered keyboard order. Existing searchCatalog stays available for compatibility until both consumers migrate.

- [ ] Write tests with literal fixture expectations: reference r1 “Bench press” has v1 “Flat barbell press”, v2 “Incline dumbbell press”, v3 individually archived; r2 “Row” has v4; r3 “Empty” has no children. Assert query “bench press” yields r1 with [v1,v2], query “incline” yields r1 with [v2], equipment Dumbbell narrows to [v2], and an equipment filter excludes r3. A parent-archived r1 contributes no picker options. Distinct reference IDs with the same display name remain separate groups.
- [ ] Add ranking assertions: exact variant name precedes prefixes; select eight variants globally before grouping; headings do not count; flattenVariantOptions returns exactly the visual order. With an empty query, assert reference/name alphabetical order and stable ID tie breaks.
- [ ] Run node --test test/catalog-groups.test.js. Expected: failures because the new grouping functions are missing.
- [ ] Implement the two functions and matching rules from the spec. Return counts from the full group using effective availability, while variants contains the filtered visible subset. Empty matching references are allowed in catalog mode only.
- [ ] Run node --test test/catalog-groups.test.js and npm test. Expected: zero failures. Commit feat: define shared reference grouping and search.

## Task 2: Reference lifecycle, effective archives and additive migration

**Files:** Create migrations/003-reference-exercises.sql, server/reference-repository.js and test/reference-repository.test.js. Modify server/db.js, server/catalog-repository.js and test/catalog.test.js. Extend test/catalog-links.test.js.

**Interfaces:** createReferenceRepository(db) exposes create({id,name}), get(id), update({id,revision,name}), archive({id,revision,archived}); all return {id,name,revision,archived}. Export readReference(tx,id). createCatalogRepository exposes these as createReference/getReference/updateReference/archiveReference; renameFamily remains a compatibility delegate to updateReference. Entry projection includes effective and individual archive state as described above.

- [ ] Write migration/lifecycle tests: create an empty reference and replay the same ID/name; reject blank/over-200-character names; rename; archive; restore. Start with active variant A and individually archived B; archive/restore twice and assert A becomes selectable again and B does not. Verify stored child archive flags do not change on parent archive. Verify reference operations do not alter document revisions or workout settings.
- [ ] Write concurrency assertions: creation and an individual child archive increment parent revision. An archive using the previous revision returns CONFLICT; the subsequent fresh revision succeeds. Identical one-revision-old successful rename/archive replay returns the saved record without another revision bump. Invalid booleans and unknown reference IDs are refused.
- [ ] Run node --test test/reference-repository.test.js test/catalog-links.test.js. Expected: new-reference API/schema failures.
- [ ] Add archived INTEGER NOT NULL DEFAULT 0 to catalog_families in migration 003 and register it in migrate(). Preserve existing IDs, names, links and child flags; migrate() remains idempotent. Implement reference transactions, new effective entry projection and active-parent checks in existing create/archive methods. Variant creation against an existing parent accepts optional referenceRevision and rejects mismatches or archived parents; increment parent revision on create and on actual individual archive-state changes. New parent plus first variant stays atomic.
- [ ] Add tests for verified copies of parent-archived variants, refusing new archived selections, refusing individual restoration under an archived parent, and db:seed reruns preserving parent/child archives. Test upgrading a version-2 database fixture without changing its existing IDs or document JSON.
- [ ] Run node --test test/reference-repository.test.js test/catalog-links.test.js test/catalog-repository.test.js test/catalog.test.js and npm test. Expected: zero failures. Commit feat: manage reference exercises and inherited archive state.

## Task 3: Transactional moves and linked snapshot recovery

**Files:** Create server/catalog-propagation.js and test/reference-move.test.js. Modify server/catalog-repository.js, server/catalog-links.js, test/catalog-links.test.js and test/catalog-repository.test.js.

**Interfaces:** catalogImpact(tx,entryId) → sorted Array<{id,revision,count}>; documentExercises(document) → Exercise[]; propagateCatalogEntry(tx,entry,stamp) updates linked occurrences and returns affected document IDs. Preserve the existing documentExercises export from catalog-repository.js as a re-export if needed. createCatalogRepository.move({id,revision,destinationReferenceId,sourceReferenceRevision,destinationReferenceRevision,impact}) → updated entry.

- [ ] Write tests moving variant v from r1 to r2 where it appears once in template t and twice in program p. Assert v.id is unchanged, familyId becomes r2, each affected document revision increases exactly once, both references and v increase once, and name/equipment/muscles/sets/reps/order/goals/days/mode are unchanged. Compare literal pre/post volume totals or use the existing computeVolume/computeProgramVolume public APIs with independently specified expected totals.
- [ ] Add rejection cases: archived destination, missing destination, same destination, stale entry/reference/document-preview revisions, and a destination containing the same normalized variant name (including an individual archive). Assert no rows or documents change on rejection. A trigger-induced document-write failure must roll back all membership/revision changes.
- [ ] Add lost-response replay and archive cases: identical successful move replay does not increment revisions again; moving out of a parent-archived reference preserves effective archive by setting the individual flag; moving an individually archived variant keeps it archived.
- [ ] Run node --test test/reference-move.test.js test/catalog-links.test.js. Expected: missing move method or unmet assertions.
- [ ] Extract existing impact/propagation logic without changing catalog-edit behavior, then implement the guarded move transaction. Refactor link resolution to overwrite a structurally valid stale familyId with the entry's authoritative current association; unknown catalog IDs and invalid metadata structure still reject. Membership may only change through the move transaction.
- [ ] Test that an old editor after a move gets normal CONFLICT on a changed workout, and Save as copy resolves the new reference while retaining the unsaved sets/reps. Strict exports still omit catalog/reference metadata and imports never create links.
- [ ] Run node --test test/reference-move.test.js test/catalog-repository.test.js test/catalog-links.test.js test/document-file.test.js and npm test. Expected: zero failures. Commit feat: move variants while preserving linked workouts.

## Task 4: Authenticated reference and move endpoints

**Files:** Modify server/api.js and src/api-client.js. Extend test/catalog-api.test.js and test/api-client.test.js. Existing API bootstrap continues to inject one catalog repository.

**Interfaces:** POST /api/catalog/references → {reference}; GET /api/catalog/references/:id → {reference}; PUT /api/catalog/references/:id → {reference}; PUT /api/catalog/references/:id/archive → {reference}; PUT /api/catalog/:id/reference → {entry}. Requests use the signatures from tasks 2/3. Client methods are createReference(value), getReference(id), updateReference(value), archiveReference(value), moveCatalog(value). Keep PUT /api/catalog/families/:id and renameFamily as delegates for compatibility.

- [ ] Write client/server integration tests using real temporary SQLite: create/read/rename/parent archive/restore/move through the client and assert the resulting catalog groups and linked snapshots. Check unauthenticated requests return 401, cross-origin writes 403, invalid payloads 400, and stale revisions/name collisions 409. A missing reference returns 404.
- [ ] Run node --test test/catalog-api.test.js test/api-client.test.js. Expected: new method/route failures.
- [ ] Add the specific reference route matches before generic catalog-entry PUT routing. Preserve the current JSON size limit, safe error envelope and no-store responses. Support optional referenceRevision on the existing createCatalog payload. Invalidation remains a UI responsibility via the existing shared store.
- [ ] Run the targeted tests and npm test. Expected: zero failures. Commit feat: expose reference CRUD and variant move routes.

## Task 5: Nested catalog and reference/variant management UX

**Files:** Create src/reference-form.js and e2e/reference-exercises.spec.js. Modify src/catalog-view.js, src/catalog-form.js, style.css and docs/design-system/README.md; adjust existing catalog browser tests only where the intentionally replaced flat UI changes selectors.

**Interfaces:** openReferenceForm({api,reference,onSaved,onClosed}) handles name-only create/edit and returns destroy(); openReferenceArchive({api,reference,entries,onSaved,onClosed}) handles count-based archive/restore confirmation; openVariantMove({api,entry,references,entries,onSaved,onClosed}) handles destination, usage preview and move confirmation. Each captures a stable operation ID/envelope for safe retries and restores focus through onClosed to a newly rendered logical invoking control. Existing openCatalogForm gains optional referenceId/referenceRevision for scoped Add variant and clone operations.

- [ ] Write browser tests for New reference exercise creating an empty collapsed group; expand and find No variants yet/Add variant; add a scoped variant; edit the reference; and archive/restore a reference with one active and one already archived variant. Assert only the formerly active child returns to new selections. Name-only reference forms must not contain equipment or muscle controls.
- [ ] Test grouping/filter state: fresh mount is collapsed; header counts reflect active children; searching a reference expands matching variants; searching a variant shows its parent plus matching children; clear filters restores browsing disclosure choices. Test empty references, only-archived children, duplicate reference names and long names without merging groups or changing IDs.
- [ ] Assert Add variant and same-reference Create variant cannot create children under an archived reference and explain how to restore it, including creation from a session card. Existing archived children remain viewable/editable and movable to active destinations.
- [ ] Test Move to reference exercise preview/confirmation, duplicate-name refusal without lost form inputs, Retry after a lost create/move response, and stale parent preview conflicts. Cancel and successful Save return focus to the logical reference/variant action even after rows rerender. Switching dialogs and navigation tears down portals/listeners.
- [ ] Run npx playwright test e2e/reference-exercises.spec.js. Expected: absent reference controls or grouping assertions fail.
- [ ] Implement the grouped view with real disclosure buttons and sibling controls, reference/child archive labels and the dialogs. Reuse groupCatalog rather than maintaining a second matcher. Keep view expansion transient and preserve it when a catalog reload changes row content; after creating a variant, expand its reference to show the result. After a move, expand/focus its destination result or the search field if filters exclude it.
- [ ] Rename catalog-facing labels to reference exercise and variant throughout the existing form. Global New variant (used by the session picker) can choose an active reference or create a new one with its first variant; scoped Add variant and prefilled Create variant keep their parent fixed. Pass current parent revisions into guarded writes and invalidate the catalog store after every successful mutation.
- [ ] Set authoritative grouped-row, indentation, count, disclosure and dialog CSS first, then document those same values/patterns in docs/design-system/README.md. Preserve existing color/type/spacing and touch rules.
- [ ] Run npx playwright test e2e/reference-exercises.spec.js e2e/catalog.spec.js and npm test. Expected: zero failures. Commit feat: browse and manage nested reference exercises.

## Task 6: Grouped autocomplete and stable keyboard selection

**Files:** Modify src/exercise-picker.js and src/catalog-store.js only if the new shared grouping interface requires it. Extend e2e/reference-exercises.spec.js, e2e/catalog.spec.js and test/catalog-groups.test.js.

**Interfaces:** Picker render consumes groupCatalog(...,{mode:'picker',limit:8}) and flattenVariantOptions(groups). Each role=group has an accessible reference heading; only children are role=option. Keep the existing mountExercisePicker onSelect(entry) and session-editor integration contracts unchanged.

- [ ] Write tests where a reference has multiple matching variants and another reference also matches: assert headings appear once, cannot be selected, and ArrowDown/ArrowUp/Enter traverse the flattened visual variant order. Exact-name match stays first, the total selectable cap is eight, and the announcement counts variants.
- [ ] Test active selection across revalidation: retain the same active ID when it remains visible; clear it when moved/archived/filtered away. Reference rename/move/archive performed in the same tab must update group membership/headings without a window blur. A late older catalog read must not restore obsolete groups.
- [ ] Verify no empty/archived reference is offered; reference-name matching includes eligible children; equipment filtering applies to every group. Keep filter/New variant/Cancel selection keyboard-reachable outside the listbox. Legacy linking and replacement still preview mapping changes and preserve sets/reps.
- [ ] Run npx playwright test e2e/reference-exercises.spec.js e2e/catalog.spec.js and node --test test/catalog-groups.test.js. Expected: grouped-option/active-ID assertions fail against the flat picker.
- [ ] Implement labeled listbox groups and render-order flattening, preserve active IDs instead of blindly resetting the index on each refresh, and update announcements/terminology. Reuse the current top-layer positioning and protected navigation boundaries. Continue to invalidate/revalidate through the epoch-aware in-memory store.
- [ ] Run the same targeted tests plus npm test. Expected: zero failures, including the existing lost-response variant retry, delayed-save/open-variant-draft, own-save focus race, and same-tab cache regressions. Commit feat: group autocomplete variants by reference exercise.

## Task 7: Migration rehearsal, responsive verification and release documentation

**Files:** Extend e2e/catalog-layout.spec.js and e2e/reference-exercises.spec.js. Update README.md, docs/deployment.md, AGENTS.md and docs/design-system/README.md to point to this release; retain earlier specs as historical context. Record evidence in docs/superpowers/reports/2026-10-25-reference-exercises.md.

- [ ] Add populated checks/screenshots for collapsed/expanded groups, active/archived/empty references, search and move/create dialogs at 1366×768, 1440×900, 1920×1080, 768×1024 and 390×844. Assert no horizontal overflow, reachable Save/Cancel, correct disclosure aria-expanded and focus restoration, and 32px desktop-only / 44px hybrid controls. Include 200% text, reduced motion and touch. Require both desktop figures to remain at least 180px.
- [ ] Run npx playwright test e2e/catalog-layout.spec.js e2e/reference-exercises.spec.js. Expected: zero failures. Inspect actual populated screenshots and fix real clipping/coverage/focus issues using regression tests.
- [ ] Against a new isolated development SQLite file, run npm run db:migrate explicitly, then npm run db:seed. Rehearse upgrade from the previous schema and rerun both commands. Expected: unchanged IDs/data, preserved individual/parent archive states and no duplicate seeds. Do not use the running user preview database or any remote environment for rehearsal.
- [ ] Update operational docs with the explicit new migration step and reference/variant terminology, move semantics, inherited archives and preserved portable exports. AGENTS.md must supersede the older no-move restriction and document that legacy familyId names are internal compatibility fields.
- [ ] Run npm test, npm run test:e2e, npm run build and git diff --check. Expected: all green. Preserve all prior session/program/volume/slider/tooltip/collapse and recovery tests.
- [ ] Obtain one fresh whole-branch review at the end of native execution, covering the five Review Focus cases and all execution rulings. Reproduce and fix Important/Critical findings with regression tests, then rerun the required suites. Do not spawn implementers or per-task reviewers.
- [ ] Commit the completed implementation and evidence report. Report the branch and any remaining limitations. No merge, push, deployment or remote migration/seed without separate authorization.

## Planning self-review and handoff

Coverage: task 1 owns matching/group identity; tasks 2–3 own reference CRUD, selective restoration, moves and saved-link consistency; task 4 owns authenticated transport; tasks 5–6 own every catalog/picker action and keyboard contract; task 7 owns visual/migration/release verification. Each Review Focus case has an explicit test step above.

User choices are resolved; implementation defaults are explicit in the spec, including inherited archive flags, duplicate-name move refusal, active-only destinations, preservation of effective archive during moves and reuse of existing IDs. Native execution is the preserved preference. Implementation has not started; review this plan and spec before executing it.
