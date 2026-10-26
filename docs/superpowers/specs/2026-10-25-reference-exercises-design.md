# Reference exercises and nested catalog design

## Purpose and approved decisions

Make the catalog readable as reference exercise → variants and let the user manage reference exercises independently. A reference exercise is a named grouping, not a selectable workout exercise. Equipment and primary/secondary muscle mappings belong to variants. This extends the exercise-catalog release; its linking, volume, persistence, import/export, password and accessibility rules remain binding except where this document explicitly amends them.

Agreed behavior:

- Replace the user-facing term family with reference exercise.
- Create, browse, rename, archive and restore references. References may exist without variants.
- Group both the catalog and session autocomplete beneath reference headings. Only variants are selectable in autocomplete.
- Allow moving an existing variant to another reference while preserving its identity and workout links.
- Archiving a reference hides its active variants from new selections. Restoring it does not restore variants previously archived individually.
- A reference-name search shows its active variants; a variant-name search shows matching variants under their reference. Equipment filtering applies in either case.
- Catalog groups start collapsed, with an active variant count. Searching expands matching groups. Autocomplete groups remain expanded.

## Architecture choice

Extend the current grouping records rather than replacing them. Existing catalog_families IDs, catalog_entries.family_id, familyId snapshots and legacy wire fields remain stable internal compatibility identifiers. New code and all user-facing copy call these reference exercises. This avoids an unrelated full naming migration or rewriting stable workout links solely for terminology.

An alternative full table/API/snapshot rename would add migration and stale-client risk without changing user behavior. Introducing a selectable parent exercise or inheritance would conflict with the chosen named-grouping model. Neither alternative is included.

Add a version-3 additive schema migration containing catalog_families.archived INTEGER NOT NULL DEFAULT 0. Existing entries, individual archive flags and seed IDs remain unchanged. Do not modify earlier migrations or seed versions. Only explicit environment-specific migration commands apply this change.

## Reference and archive model

A reference has id, name, revision and archived. Names are trimmed, required and at most 200 characters. Preserve existing reference-name behavior: duplicate display names are allowed, groups are keyed by ID, and no migration merges or renames records. Variant names remain unique within their reference, including individually archived variants, under existing normalized comparison rules.

Keep two independent archive states:

    effectiveArchived(variant) = variant.individuallyArchived OR reference.archived

The existing catalog_entries.archived column stores the individual state. The API entry.archived field becomes the effective state for compatibility with existing picker and document-copy rules. Expose individuallyArchived and referenceArchived separately. Reference archiving changes the parent flag only; restoring it reveals exactly the children whose individual flag is false. Do not overwrite child flags to simulate cascade archiving.

New selection, new variant creation and move destinations require an active reference. Existing linked workouts and verified copies remain usable when either the variant or its reference is archived. Editing a variant definition remains possible while archived, with the existing usage preview and propagation rules. Restoring an individual variant while its reference is archived is refused with “Restore the reference exercise first.”

Reference revisions also increment on variant creation, individual archive-state changes and membership changes. This protects count-based archive previews from concurrent adds, archives or moves. Name/muscle edits to a variant do not change reference membership or counts and need not increment its parent revision.

Reference create uses a client-generated stable ID and supports replay after a lost response. Rename and archive/restore are revision-checked and safely replay identical one-revision-old successful requests. Changed previews or genuinely stale mutations return conflicts and preserve the open form.

## Catalog layout and actions

Retain the existing catalog route and compact visual style. The main action is New reference exercise. It opens a name-only modal and may save an empty reference. Each reference header has a real disclosure button with name and count, plus sibling Add variant and Reference actions controls. Reference actions offers Edit reference exercise and Archive reference exercise or Restore reference exercise. Reading and expanding the group fulfils reference viewing; no separate detail route is required.

Expanded groups show indented variants with name, equipment, primary and secondary muscles. Variant actions are Edit variant, Create variant (a prefilled copy in the same reference), Move to reference exercise, and Archive variant or Restore variant when available. Do not repeat the reference-rename action on every child. Never put interactive actions inside a disclosure button.

Under an archived reference, Add variant and same-reference Create variant are unavailable with an explanation to restore the reference first. Existing variants may still be viewed, edited or moved to an active destination. Apply this rule to variant-creation actions in session cards as well as the catalog.

An active empty reference displays “No variants yet.” and Add variant. An active reference containing only archived variants displays “No active variants.” Normal browsing shows active references, including empty ones; Show archived additionally includes archived references and individually archived children. Headers distinguish active and archived variant counts when archived items are visible.

Archive confirmation says how many active variants will disappear from new selections and explicitly preserves existing workouts. Restore confirmation counts children that will become available, excluding individual archives. Parent-archived child rows explain their inherited state and offer reference restoration at the header.

Default groups are collapsed on each fresh catalog mount. Expansion is transient UI state. A new search or equipment filter temporarily opens all matching groups; users may subsequently collapse a group for that filter. Clearing filters restores browsing expansion choices. No browser persistence is introduced.

## Shared matching and grouped autocomplete

Normalize queries as the existing catalog does: case/accent-insensitive, trimmed whitespace and all-word matching. A full reference-name match includes that reference's eligible variants. Otherwise, match all words against each variant's name, reference name and equipment. Equipment filters always narrow the children; they never force unrelated variants into results.

For catalog results, return all matching children. Show matching empty references only without an equipment filter, when their reference name matches the query (or the query is empty). Do not show an empty heading merely because a nonmatching child was filtered out.

For autocomplete, exclude effectively archived children and archived references, and exclude empty references. Rank exact variant names, then variant-name prefixes, then other all-word matches. Select at most eight variants globally before grouping; headings do not consume this cap. Order groups by their best selected child rank, then reference name/ID; order children by match rank, then variant name/ID. With an empty query, use reference name/ID and then variant name/ID. Catalog browsing sorts references and variants alphabetically with ID tie breakers.

Use one listbox containing labeled role=group sections with nonselectable reference headings and role=option variants. Arrow keys follow the actual rendered variant order and skip headings. Enter selects the active variant only; Escape, Tab, pointer/touch and existing result announcements remain intact. A refresh preserves the active variant by ID when still visible, otherwise clears active selection. Result announcements count variants, not headings.

Keep Equipment, New variant and Cancel selection outside the listbox in normal document focus order. New variant supports choosing an active existing reference or creating a new reference with its first variant atomically. The reference-scoped Add variant form fixes that reference; Create variant copies stay in the same reference. Update all form labels, messages, headings and accessible names from family/exercise-entry terminology to reference exercise/variant where they describe catalog objects. The session field may remain labeled Exercise because it chooses the workout's exercise.

## Move variant

Move to reference exercise opens a modal with the source reference read-only, a destination selector of other active references, and an affected-workout count. Duplicate reference names are disambiguated using variant-name previews in the destination selector/help text; never use a display name as identity.

Explain “Moves this variant and its linked workouts to another reference exercise. Muscle mappings, sets and reps stay unchanged.” Confirming requires the variant revision, source and destination reference revisions, and the existing affected-document impact token. Refuse a duplicate variant name in the destination with a specific message; do not merge entries or silently rename. A user may explicitly rename the variant through its existing edit flow before retrying the move.

The move runs in one transaction: validate source/destination/impact, change membership, increment the variant revision and both reference revisions once, and propagate current snapshots to every linked occurrence. Increment each affected document revision once. Preserve entry ID, name, equipment, muscles, sets, reps, exercise order, goals, workout IDs, days and program mode. Future family-based statistics therefore retain variant identity under its newly chosen reference; there is no historical-statistics migration in this release.

Preserve the variant's effective archive state when moving it. If it was hidden solely because its source reference was archived, moving to an active destination sets its individual archive flag, so moving does not unexpectedly restore it. Individually archived variants stay archived. The user may restore a moved variant explicitly. A source may be archived; the destination may not.

A repeated acknowledged move returns its already-moved entry without duplicate revision or document writes when the requested entry revision is exactly one behind and the current destination matches. Other stale moves conflict. A transaction failure rolls back membership, archive state, all revisions and all document snapshots.

Amend link resolution: catalogId remains the authoritative identity; the server resolves its current reference association along with its name and muscle mappings. Structurally valid stale familyId metadata must not prevent an old open editor from receiving its normal document-revision conflict or saving a copy with the current reference. Unknown catalog IDs remain invalid. Do not trust client-supplied reference IDs to change catalog membership.

## Cache, migration and safety

Continue using the shared in-memory catalog store. Reference CRUD, archive/restore, moves and variant mutations invalidate it; editor entry/focus revalidates it, and invalidations during pending reads force a subsequent fresh read. Grouping and expansion are derived/transient, never stored in SQLite or browser persistence.

Existing IDs and document links survive migration. Existing standalone archives remain standalone archives. Rerunning db:seed must not reactivate archived references/variants or overwrite user edits. Version-1/version-2 import/export behavior and portable file shape stay unchanged.

No production migration, seed, deployment or existing preview-database mutation happens as part of this planning task. Implementation verification uses an isolated development database, then documents explicit migration requirements for other environments.

## Verification

Use TDD for grouped matching, reference lifecycle, effective archives, guarded moves and replay, API/client contracts, grouped UI and picker navigation. Specifically exercise simultaneous child creation during parent archive confirmation, a moved variant in several workouts of one program, moving out of an archived reference, destination-name collisions, lost responses, stale open editors and copy/export recovery.

Preserve the prior catalog's delayed-acknowledgement/open-variant-draft regression, in-flight-focus-refresh regression, same-tab cache invalidation and navigation overlay regressions. Run npm test, npm run test:e2e and npm run build; run npm run db:migrate explicitly against development and verify seed idempotency.

Inspect populated expanded/collapsed groups, search matches, empty references, archived states and move/create dialogs at 1366×768, 1440×900, 1920×1080, phone/tablet widths, 200% text and touch/hybrid input. Preserve both desktop figures at 180–200px, 32px fine-pointer controls only when no coarse pointer exists, 44×44px touch targets and 44px slider hit areas. Update authoritative CSS values before the design-system documentation.

## Exclusions

No selectable reference exercise, inherited muscle mappings, reference tree, nested variant lineage, reference merging, hard deletion, bulk moving, custom equipment taxonomy, exercise media, statistics, logging, external API or file-format change.
