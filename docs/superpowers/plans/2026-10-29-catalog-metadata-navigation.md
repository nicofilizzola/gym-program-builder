# Catalog Metadata and Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add inherited reference equipment, reference muscle defaults, two description levels, editable Brand/Focus tags, equipment pills with icons and contextual breadcrumbs.

**Architecture:** References own equipment/default muscles/descriptions, variants own actual muscles/description/tag assignments, and tag records own stable editable labels. Server joins produce effective variant metadata and transactionally refresh template snapshots; compact existing forms and a dedicated tag-management route expose these capabilities. Shared session storage from Stage A remains authoritative.

**Tech Stack:** Existing vanilla JavaScript, Node.js 24, SQLite/libSQL, native radios/dialogs/popovers, inline SVG, node:test and Playwright. No dependencies, framework or icon library added.

**Spec:** [Approved design](../specs/2026-10-29-linked-sessions-catalog-design.md), Stage B and shared acceptance sections. Prerequisite: [Stage A plan](2026-10-29-shared-session-templates.md) completed and verified.

## Global Constraints

- Reference equipment is single-valued and cannot be overridden by a variant. Keep the eight existing equipment values and 12 fixed muscle groups.
- Existing reference equipment conflicts are resolved manually by the user; never split references or select a majority winner.
- Reference defaults initialize only new variants. Actual variant muscles can differ and never change merely because defaults change.
- Zero/one Brand and zero/many Focus tags; free-form Focus is independent of volume muscle groups. Tags support create, rename, archive/restore, not deletion/merge.
- Descriptions are plain text <=2,000 characters per level; tag names 1–80 characters, trimmed and unique case-insensitively per kind.
- Preserve catalog IDs, user-selected type/equipment, rest prescriptions, reference/variant archive independence, revision recovery and strict portable validation.
- Reuse Barlow/dark/orange, existing compact rows/actions/chips and native controls. Keep 32px fine-pointer desktop only without coarse pointer, 44px touch/hybrid and slider targets, and 180–200px desktop figures.
- Explicit migration 006 and explicit seed only. Builds/requests never migrate or seed; do not touch live data during implementation.
- Read and apply frontend-design, design-taste-frontend (app-screen path), ui-ux-pro-max and web-design-guidelines under the project design system; preserve project-specific rules when generic styles conflict. No redesign of the established shell.

## Review Focus

1. Mixed-equipment reference after migration: existing links render, new selection is blocked until manual configuration, no metadata is guessed (Tasks 1, 4).
2. A stale form assigns a tag archived on another device: reject new assignment, preserve the draft and allow refresh/retry (Tasks 3, 4).
3. A variant moves between references while equipment/usage changes: stale impact fails atomically and existing rest/own fields never reset (Task 2).
4. Descriptions/tags contain HTML-like text, long tokens or many labels: render as text, wrap safely, preserve all information and focus (Tasks 4, 5, 6).
5. Deep link points to a moved/archived/deleted target, or closing is reversed quickly: route recovers correctly; no stale exit handler hides reopened content (Tasks 5, 6).

## Data contracts and file map

```js
// Reference = existing fields plus:
// {equipment:Equipment|null, description:string,
//  defaultPrimaryMuscles:Muscle[], defaultSecondaryMuscles:Muscle[]}
// null equipment is a migrated-unconfigured state only; new references require equipment.
// Tag = {id,kind:'brand'|'focus',name,archived,revision}
// VariantWrite = {name,primaryMuscles,secondaryMuscles,description,brandId:null|string,focusTagIds:string[]}
// Effective Variant = existing fields plus:
// {equipment:Equipment|null,referenceDescription,description,brand:Tag|null,focusTags:Tag[],equipmentConfigured:boolean}
// Linked exercise snapshot retains catalogId/catalogRevision/familyId and adds portable values:
// {equipment?,referenceDescription?,variantDescription?,brand?:string,focusTags?:string[]}
```

Keep catalog table/wire `familyId` identifiers for compatibility. Add `server/tag-repository.js` for tag transactions, `src/equipment-controls.js` for native icon pills, `src/catalog-metadata.js` for safe metadata rendering, `src/tag-view.js` for management, and `src/breadcrumbs.js` for semantic trails. Extend existing catalog repository/forms/store/picker rather than creating a parallel catalog system. All template propagation uses Stage A's template-only impact boundary.

### Task 1: Migrate reference metadata and preserve equipment for manual cleanup

**Files:** Create `migrations/006-catalog-metadata.sql`, `server/migrate-catalog-metadata.js`, `test/catalog-metadata-migration.test.js`; modify `server/db.js`, `server/reference-repository.js`, `server/catalog-repository.js`, `server/catalog-seed.js`, `test/reference-repository.test.js`, `test/catalog-repository.test.js`.

**Interfaces:**
- Add reference columns `equipment`, `description`, `default_primary_json`, `default_secondary_json`; add variant `description`. Existing legacy entry equipment is retained only in an immutable migration backup table `catalog_equipment_backup(variant_id,reference_id,equipment)`; after cleanup the runtime never treats it as variant-owned authority.
- Add `catalog_tags(id,kind,name,normalized_name,archived,revision)` with unique `(kind,normalized_name)`, and `catalog_variant_tags(variant_id,tag_id)` with FK constraints and primary key. Cardinality/kind checks belong in the transaction validator, with corresponding integration tests.
- `migrateCatalogMetadata(tx) -> {configured,unconfigured}` fills reference equipment only for exactly one distinct child value, otherwise null; initializes descriptions/default muscles empty without changing variant mappings.
- Reference CRUD accepts `{id,revision?,name,exerciseType,equipment,description,defaultPrimaryMuscles,defaultSecondaryMuscles,impact?}`; only legacy migrated records can remain unconfigured until explicitly saved with equipment.

- [ ] Write pre-006 fixtures for a unanimous Barbell reference, mixed Barbell/Dumbbell reference, empty reference, archived parent/child and chosen custom type/name/rest. Assert respective equipment `'Barbell'`, `null`, `null`; every old variant value is backed up; muscles/rest/IDs/archive/names are identical. Rerun migration with chosen metadata and assert none is reset. Inject an insertion failure and assert rollback of metadata/version advancement.
- [ ] Add validation assertions for invalid equipment, optional empty default muscles, unknown/duplicate/overlapping default muscles, and description lengths 2,000 accepted/2,001 rejected. New reference without equipment fails; editing a migrated unresolved reference requires explicit equipment. Source text like `<img onerror=...>` stays plain data.
- [ ] Run `node --test test/catalog-metadata-migration.test.js test/reference-repository.test.js test/catalog-repository.test.js`; establish new failures.
- [ ] Implement schema/data hook within the explicit migration framework from Stage A and extend reference reads/validation. Catalog projections expose `equipmentConfigured:false` for null equipment. Preserve linked snapshots during unresolved cleanup; never replace known snapshot equipment with null. Adapt catalog seeds to specify reference equipment and preserve all existing selected/custom metadata on replay. Do not seed tag brands/focus values speculatively.
- [ ] Rerun focused tests to zero failures; commit as `feat: migrate reference-owned equipment and metadata`.

### Task 2: Enforce inheritance and revision-safe reference edits/moves

**Files:** Modify `src/catalog.js`, `src/document-validation.js`, `server/catalog-repository.js`, `server/reference-repository.js`, `server/catalog-propagation.js`, `server/catalog-links.js`, `server/api.js`, `src/api-client.js`, `test/reference-move.test.js`, `test/duration-catalog.test.js`, `test/catalog-links.test.js`; create `test/reference-metadata.test.js`.

**Interfaces:**
- `validateReference(value) -> {reference}|{error}` and `validateCatalogEntry(value) -> {entry}|{error}` normalize ownership-specific fields. Canonical `VariantWrite` omits equipment; an optional legacy equipment input must equal the configured parent or reject INVALID.
- `catalog.referenceImpact(referenceId) -> {referenceRevision,variants:[{id,revision}],templates:[{id,revision,count}],programs:[{id,name,count}]}` served at `GET catalog/references/:id/impact`. Reference updates and moves validate their submitted reference/variant/template impact set in the same transaction; descriptive program usage is refreshed server-side, not a write target.
- `snapshotExercise(exercise,effectiveVariant)` adds portable metadata while preserving sets/reps/rest. Description keys differ deliberately: effective variant `.description` becomes snapshot `.variantDescription`.

- [ ] Add integration tests: mismatched variant equipment rejects; reference equipment update reaches every exact-child template snapshot, increments each affected variant/template revision once, and leaves rest at 45 seconds. Default-muscle edits leave existing variants/template prescriptions unchanged. A description-only update refreshes reference information, not muscles/rest. Invalid impact rolls back parent/children/templates together.
- [ ] Extend move tests for Barbell-to-Machine: destination equipment/reference description appear, variant ID/muscles/own description/tags/archive remain, linked exercises retain 45-second rest and existing sets/reps. Stale source, destination, variant or template revision fails with no changes; name collision still rejects. Null-equipment destination cannot receive new variants or moves; an existing linked unresolved reference remains readable.
- [ ] Run `node --test test/reference-metadata.test.js test/reference-move.test.js test/duration-catalog.test.js test/catalog-links.test.js`; expect new assertions to fail.
- [ ] Implement server-derived equipment and joined descriptions. Reuse template-only propagation with transaction-scoped helpers rather than nesting transactions. Exclude unresolved references from new picker selection; source-verified existing copies remain readable without fabricated equipment. Supply impact previews/recovery methods through API/client.
- [ ] Update `snapshotExercise`, portable unlinking and validation so the Stage A v3 values survive without trusting IDs; v1/v2 defaults remain unchanged. Preserve unlinked imported snapshot metadata when editing prescriptions. Reference type changes still affect only initial rest for future selections.
- [ ] Rerun focused tests to zero failures; commit as `feat: enforce reference equipment inheritance and safe propagation`.

### Task 3: Add revisioned Brand/Focus management and assignments

**Files:** Create `server/tag-repository.js`, `test/tag-repository.test.js`, `test/tag-api.test.js`; modify `server/catalog-repository.js`, `server/catalog-propagation.js`, `server/api.js`, `src/api-client.js`, `src/catalog-store.js`, `api/index.js`, `scripts/dev-server.js`.

**Interfaces:**
- `createTagRepository(db)` returns `list({kind?})`, `create({id,kind,name})`, `update({id,revision,name})`, `archive({id,revision,archived})`; exact create replay is idempotent, different intent conflicts. Use existing `normalizeSearch` for normalized uniqueness and preserve display case.
- Endpoints `GET/POST catalog/tags`, `PUT catalog/tags/:id`, `PUT catalog/tags/:id/archive` return `{tags}` or `{tag}`; clients `listTags`, `createTag`, `updateTag`, `archiveTag`. Route these before generic catalog entry IDs.
- Catalog list returns `{families,entries,tags}` from one read transaction. Variant writes add `brandId` and `focusTagIds`; server verifies tag kinds, cardinality, existence and archive eligibility atomically.

- [ ] Add tag tests: same-kind case/diacritic-normalized duplicate conflicts including archived labels; same label across Brand/Focus is allowed. Reject blank/81-character names and wrong-kind assignment. Permit null Brand and empty Focus; reject duplicate focus IDs, unknown IDs and multiple-brand payloads. Rename preserves IDs/assignments and advances affected variant/template revisions once, with complete rollback on propagation failure.
- [ ] Test archived rules: retain an existing assignment through edit; arbitrary new assignment rejects; removing then re-adding rejects; source-verified Create variant can preserve the source's archived assignments but cannot add unrelated archived IDs. A tag archived after the form loaded causes save failure, not silent omission. Restore allows selection again. Rename and archive retries with stale revisions conflict safely.
- [ ] Run `node --test test/tag-repository.test.js test/tag-api.test.js test/catalog-repository.test.js`; establish new failures.
- [ ] Implement repository/endpoints/assignment joins and revision updates. Existing tag-label snapshots remain readable on archive and update on rename. Include an archive marker in effective Tag records; portable export uses labels only. Invalidate/revalidate the existing catalog store on tag mutations and editor focus, retaining dirty form selections when a save or refresh settles.
- [ ] Rerun focused tests to zero failures; commit as `feat: manage brand and focus tags with stable assignments`.

### Task 4: Build compact reference/variant forms, icon pills and tag management

**Files:** Create `src/equipment-controls.js`, `src/tag-view.js`, `e2e/catalog-metadata-forms.spec.js`, `e2e/catalog-tags.spec.js`; modify `src/reference-form.js`, `src/catalog-form.js`, `src/catalog-view.js`, `src/router.js`, `src/app.js`, `style.css`, `docs/design-system/README.md`, `e2e/reference-exercises.spec.js`, `e2e/catalog-layout.spec.js`.

**Interfaces:**
- `mountEquipmentPills(root,{name,value,onChange}) -> {setValue(value),setDisabled(disabled),destroy()}` renders a native labeled fieldset/radio group; eight existing options, no multiselect. Icons are inline decorative currentColor SVG, 18–20px, before visible text. Recognizable silhouettes: bar/plates, paired dumbbell ends, pulley/cable, machine frame, person, kettlebell handle, looped band and neutral tools/Other. No independent icon targets or icon-only options.
- `mountTagView(root,{api,kind='brand',query='',onNavigate}) -> {destroy()}` uses `#/catalog/tags?kind=brand|focus&q=...`; local tabs/search update this route, browser restoration preserves them. Existing root router must parse query separately.
- `openReferenceForm` adds equipment, description and default-muscle fields; `openCatalogForm` adds inherited equipment text, variant description, Brand control and Focus selection. Both continue returning `{destroy}` and preserve draft values through save conflicts.

- [ ] Add browser tests for radio semantics: clicking label/icon selects exactly one equipment; arrow keys change native choice, visible focus, accessible group name, no dropdown in creation. Assert every option has visible text plus aria-hidden SVG, and touch/hybrid targets >=44px. Long equipment labels wrap without clipping.
- [ ] Test defaults: adding under reference preselects reference muscles; modifying them affects only the draft. Create variant from an existing variant starts with source muscles, tags and description; changing reference does not overwrite user-touched muscles, but untouched new-variant fields initialize from the new reference. Existing variant edits never reapply defaults. A new reference created inside the variant workflow requires equipment/type and optional defaults/descriptions, committed atomically with its variant.
- [ ] Test tag management create/rename/archive/restore, duplicate-name error, separate kinds, stale revision recovery and returning to catalog. Tag selectors show archived current assignments visibly but not new choices. Unresolved reference row shows Needs equipment; editing it with a chosen pill shows impact before committing and unlocks selection afterward. Tag form content survives catalog save acknowledgements/focus refreshes.
- [ ] Run `npx playwright test e2e/catalog-metadata-forms.spec.js e2e/catalog-tags.spec.js e2e/reference-exercises.spec.js`; establish failures.
- [ ] Implement reusable pills and existing-dialog layout: aligned name/type fields, equipment group, side-by-side default muscles and a 200ms ease-out description disclosure. Variant equipment is text, not disabled editable pills; muscles remain editable. Brand/Focus controls use existing chip/search patterns in aligned rows; put Manage tags in the catalog toolbar. Tag view uses compact tabs/search/create and rows with direct rename/archive/restore icon strips, no extra settings cards or action menus.
- [ ] Implement 150ms ease-out modal entry/exit opacity plus optional 4px translation. Keep nodes through closing; focus stays correctly contained until native close, then returns to the invoking row/action. Guard rapid reversals/stale callbacks and settle instantly under reduced motion. Selection/typing/search/results remain immediate. Update CSS authoritative values and design-system guidance together.
- [ ] Rerun focused browser tests to zero failures; commit as `feat: add reference metadata forms and visual equipment pills`.

### Task 5: Surface tags/descriptions and extend catalog search

**Files:** Create `src/catalog-metadata.js`, `test/catalog-metadata.test.js`, `e2e/exercise-info.spec.js`; modify `src/catalog.js`, `src/catalog-groups.js`, `src/catalog-view.js`, `src/exercise-picker.js`, `src/session-editor.js`, `src/session-markup.js`, `src/tooltip.js` only where reuse needs an extension, `src/reference-form.js` move preview, `style.css`, `docs/design-system/README.md`, `test/catalog.test.js`, `test/catalog-groups.test.js`, `e2e/catalog.spec.js`, `e2e/exercise-disclosure.spec.js`.

**Interfaces:**
- `catalogSearchText(entry,reference?) -> string` returns normalized name/reference/equipment/Brand/Focus labels for both search entry points. Existing rank/cap/rendered group order remains.
- `renderVariantMetadata(root,{equipment,brand,focusTags})` safely creates labeled text/chip nodes; accepts portable label values or effective Tag objects via explicit normalization, never interpolates untrusted HTML.
- `mountExerciseInfo(button,{getDescriptions,onDismiss?}) -> {hide(),destroy()}` uses shared top-layer positioning/lifecycle; label `About [variant]`, `aria-expanded`, `aria-controls`, `aria-describedby`. Do not invent a second tooltip timer/positioning system.

- [ ] Add search tests for case/diacritic normalization, mixed name+brand+focus words, archived assigned tag labels, exact/prefix name ranking and eight-variant cap. Assert headings remain nonselectable and arrow order equals `flattenVariantOptions(groups)`. Renaming a tag invalidates labels/search without changing active variant ID.
- [ ] Add populated browser tests asserting all tag labels remain visible in catalog rows, autocomplete, expanded/collapsed linked exercises, create/edit/move previews, and imported unlinked metadata. Multiple long Focus labels wrap; no `+N` hiding. Empty metadata has no blank placeholders. Descriptions contain literal HTML-like text without executing markup, and long words wrap inside a constrained info surface.
- [ ] Test info interaction at both template/program entrypoints: reference+variant labels, omit empty sections/button if both empty, hover/focus peek, click/tap pin, pointer grace 150ms, one at a time, Escape/outside, flip/clamp, scrolling/resizing/collapse/teardown and focus restoration. With a containing dialog, first Escape closes only info. With normal motion, closing retains nodes through exit; rapid reopen cannot be hidden by an old callback. Reduced motion is synchronous.
- [ ] Run `node --test test/catalog-metadata.test.js test/catalog.test.js test/catalog-groups.test.js test/tooltip.test.js` and `npx playwright test e2e/exercise-info.spec.js e2e/catalog.spec.js`; establish failures.
- [ ] Implement shared search text and metadata rendering everywhere variants are identified, preserving grouped autocomplete selection by ID. Mount info in the expanded action strip and collapsed header with a 150ms ease-out opacity/4px transition, no extra metadata card. Preserve figure sizes, existing icon strips and readable summaries. New info buttons must not initiate drag/card expansion; retain native click/keyboard behavior.
- [ ] Rerun focused tests to zero failures; commit as `feat: show searchable variant tags and exercise descriptions`.

### Task 6: Add contextual breadcrumbs and recoverable deep links

**Files:** Create `src/breadcrumbs.js`, `test/router.test.js`, `e2e/breadcrumbs.spec.js`; modify `src/router.js`, `src/app.js`, `src/program-view.js`, `src/catalog-view.js`, `src/library-view.js`, `style.css`, `docs/design-system/README.md`, `e2e/library-navigation.spec.js`, `e2e/navigation-transitions.spec.js`.

**Interfaces:**
- `mountBreadcrumbs(root,{items}) -> {update(items),destroy()}`, where item is `{label,href?}`; final item has no navigation href and `aria-current='page'`.
- Preserve Stage A session routes. Add `#/catalog/references/:referenceId` and `#/catalog/references/:referenceId/variants/:variantId`; these reveal/focus existing grouped rows. Tags route/query uses Task 4 contract. Accept encoded names only as display data, never identity.
- `mountCatalog` accepts route target and `onNavigate`; reference/variant links replace transient “find in catalog” navigation. If a variant moved, resolve its ID and replace the stale parent route with its actual parent, retaining the selected variant. Archived direct targets reveal with the existing archived filter rather than disappearing.

- [ ] Write parser assertions for root, existing template/program, program occurrence, catalog reference/variant and tag query routes; malformed IDs/query encodings return a recoverable not-found result, never throw into a blank screen.
- [ ] Add browser tests for exact trails: Session templates › Push A; Programs › Strength › Push A; Exercise catalog › Barbell Bench Press › Paused bench press; Exercise catalog › Tags. Ancestors are actual links; current item is announced; no duplicate Back button or breadcrumbs on root lists. Names with `<`, long tokens and Unicode render safely and wrap.
- [ ] Test Back/Forward/reload/deep links, changed names, moved variant canonicalization, archived targets, missing/deleted target recovery and Shared template navigation. Returning focuses the invoking occurrence/variant and restores sensible scroll without hiding the focused item under fixed UI. All navigation flushes relevant pending queues or retains the existing failure/conflict recovery screen; never discards a dirty shared template.
- [ ] Run `node --test test/router.test.js` and `npx playwright test e2e/breadcrumbs.spec.js e2e/library-navigation.spec.js e2e/navigation-transitions.spec.js`; establish failures.
- [ ] Implement semantic labeled nav/ordered list/anchors/decorative separators above the existing heading. Retain global nav, remove redundant local Back controls, keep modal Cancel/Close. Breadcrumbs update immediately with edits; only the existing view fade runs on navigation. Restore catalog expansion/filter/focus for route targets without persisting transient disclosure state in session/program documents.
- [ ] Rerun focused tests to zero failures; commit as `feat: add contextual breadcrumbs and catalog deep links`.

### Task 7: Verify metadata portability, browser behavior and rollout

**Files:** Modify `test/document-bundle.test.js`, `test/document-import.test.js`, `e2e/import-export.spec.js`, `e2e/compact-desktop.spec.js`, `e2e/catalog-layout.spec.js`, `docs/design-system/README.md`, `AGENTS.md`, `README.md`; create `scripts/catalog-equipment-report.js`, `docs/operations/catalog-metadata-rollout.md`.

**Interfaces:** Reuse Stage A v3 portable metadata shapes exactly; do not introduce catalog ID trust or an unnecessary version bump. Equipment cleanup report is generated by a read-only command `node --env-file-if-exists=.env.local scripts/catalog-equipment-report.js` (create that script here), listing unconfigured reference IDs/names and backup equipment values without secrets.

- [ ] Extend round-trip tests with both description levels, Brand label, multiple Focus labels and equipment: all survive v3 export/import as unlinked snapshot data; tag/reference/catalog IDs and revisions do not. Assert invalid metadata rejects the whole import, <=1 MiB limit remains and v1/v2 still work. Imported metadata never creates or modifies catalog tags. Session analysis uses original fixed muscles/sets rather than interpreting Focus as volume muscles.
- [ ] Rehearse 006 on a disposable post-005 copy, run the read-only cleanup report, manually configure one conflicted reference through the UI, verify new selection works and old prescriptions/rest remain. Rerun migration/seed explicitly on the copy and assert selected metadata, names/types/archive states are unchanged. Record backup/restore and maintenance deployment order; never apply to production during a build/request.
- [ ] Inspect populated 1366×768, 1440×900, 1920×1080, tablet and 390px screens with long names, many tags, maximum descriptions, errors, archived/unconfigured states and 200% text. Measure desktop figures >=180px and touch/hybrid targets >=44px. Check all content reachable without horizontal page overflow or newly nested scroll regions outside overlays.
- [ ] In a real browser with `reducedMotion:'no-preference'`, exercise both directions of disclosures/dialogs/info, rapid reversals, keyboard radio navigation, focus, touch pinning/outside dismissal, drag interactions and Back/Forward. Repeat with reduced motion; no waits for missing transition events. Capture screenshots for layout and record actual interaction results separately.
- [ ] Apply the fresh Web Interface Guidelines review to changed files and run the design-taste app inspector if available; judge results against the authoritative project palette/layout, documenting intentional conflicts rather than reskinning. Review with frontend-design and ui-ux-pro-max guidance for density, hierarchy, accessible names, labels and focus. Fix regressions and report any tool/browser gaps.
- [ ] Run `npm test`, `npm run test:e2e`, `npm run build` and `git diff --check`; require zero failures and successful build. Run no further broad repetitions without new changes/failures.
- [ ] Update AGENTS.md's superseded variant-owned equipment rules and design-system sections for icon pills, descriptions/tags, breadcrumbs and motion. Commit as `docs: verify catalog metadata and navigation rollout`; report automated evidence, inspected viewports/inputs/motion, manual equipment cleanup remaining and explicit migration/seed/deployment steps still outstanding.

## Test assertion anchors and plan self-review

Use these assertions in the owning tests with their fixtures; keep broad behavior scenarios in the task test steps above:

```js
// Tasks 1–2: never choose a winner for mixed legacy equipment or reset rest.
assert.equal(migratedMixedReference.equipment, null);
assert.equal(movedVariant.equipment, 'Machine');
assert.equal(resolvedTemplate.exercises[0].restSeconds, 45);
assert.deepEqual(existingVariant.primaryMuscles, ['Chest']); // after changing parent defaults
// Task 3: tag labels may repeat across kinds, identities may not cross roles.
assert.notEqual(brandNamedUpper.id, focusNamedUpper.id);
await assert.rejects(assignArchivedTagToUnrelatedVariant(), {code:'INVALID'});
// Tasks 4–6: test semantic controls, not screenshots alone.
await expect(page.getByRole('radio', {name:'Barbell',exact:true})).toBeChecked();
await expect(page.getByRole('radio', {name:'Dumbbell',exact:true})).not.toBeChecked();
await expect(page.getByRole('navigation', {name:'Breadcrumb'})).toBeVisible();
await expect(page.getByRole('tooltip')).toContainText('<img'); // plain-text description fixture
```

Coverage checked against approved points 2–7: reference ownership/defaults/migration (1–2), descriptions (1/2/4/5), dynamic tags (3–5), equipment icon pills (4), breadcrumbs (6), portable metadata and acceptance checks (7). Stage A covers point 1 and shared persistence. Every Review Focus item has an owning regression scenario. Plans do not claim runtime/browser verification until execution.
