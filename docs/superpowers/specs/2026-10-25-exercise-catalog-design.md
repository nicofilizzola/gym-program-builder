# Exercise catalog and autocomplete design

## Intent and agreed scope

Make session building faster by selecting exercises with predefined primary and secondary muscles. The app owns an editable catalog seeded with common barbell, dumbbell, cable, machine, and bodyweight exercises. Users can add exercise families and reusable variants. Exercise identity and family membership support potential future statistics; statistics and workout logging are outside this release.

Use the existing plain JavaScript frontend, Node.js 24 API, SQLite development database, and Turso/libSQL production database. No external exercise API, ORM, frontend framework, browser persistence, or additional service is required. Use the existing password protection and separate preview/production databases.

## Domain model

- A family has a stable opaque ID and a required display name. It groups entries without a parent/child tree. Family membership never propagates muscle mappings between entries.
- A catalog entry has a stable opaque ID, family ID, revision, name, equipment, primaryMuscles, secondaryMuscles, archived flag, and timestamps.
- Equipment is one of Barbell, Dumbbell, Cable, Machine, Bodyweight, Kettlebell, Resistance band, Other. One value per entry; Other covers mixed or unlisted equipment for this release.
- Entry names are trimmed and required. At least one primary muscle is required. Only the existing 12 muscles are accepted, in canonical order, without duplicates or overlap between roles. Identical mappings across entries are allowed.
- Exact case-insensitive duplicate names within a family are rejected, including archived entries, with a message identifying the existing entry. The same name in different families is allowed.
- A workout exercise retains name, sets, repRange, primaryMuscles, secondaryMuscles. Linked exercises additionally store catalogId, catalogRevision, familyId, equipment as a validated snapshot. An unlinked exercise has none of these metadata fields.
- Sets and reps belong exclusively to the workout. They never create variants or update the catalog.
- Creating a variant copies a selected entry into a new entry in the same family; its own name, equipment and mappings are editable. There is no lineage field or inheritance. Creating a new family creates its first entry in the same transaction.

Template and program copies remain independent for ordering, sets, reps, goals and choice of catalog entry. Copies intentionally share the selected catalog definition. This is the explicit exception to the previous copy independence rule.

## Catalog page

Add Exercise catalog to the existing application navigation and a catalog route. Use a compact searchable list with equipment filtering, family names, muscle summaries, and an optional archived view. No new visual language or media assets.

Actions: New exercise (creates a family and initial entry), Create variant, Edit entry, Rename family, Archive, Restore. Family selection while creating an entry permits adding to an existing family. Do not support family merging or moving existing entries between families in this release.

Editing an entry requires explicit Save. Before saving a changed definition, show the count of saved workout instances using that exact entry, with copy: “Changes apply to every workout using this exercise.” Count a template occurrence and each program occurrence individually; other family entries are unaffected. Save uses the entry revision and a preview token for the affected document IDs/revisions, so a changed impact preview produces a conflict and requires refreshing the preview. An archive action only controls availability in pickers and does not change existing workout snapshots or document revisions. Archived entries remain readable and editable and can be used to create a new active variant.

Failures keep form values and offer Retry. Entry conflicts preserve edits and offer Reload saved version or Save as variant. Family rename conflicts preserve edits and offer Reload saved version; family names do not affect volume.

## Session editor

Add exercise creates an expanded card containing an Exercise autocomplete. It searches active catalog entries by case-insensitive, accent-insensitive name, family name, and equipment. All query words must match; rank exact entry-name matches, then name prefixes, then remaining matches, with name and stable ID as tie breakers. Show at most eight suggestions, plus a separate New exercise action carrying the typed name into the creation form. Opening an empty picker shows the first eight active entries alphabetically. No recent-history persistence or fuzzy-search dependency.

Fetch the small catalog into memory on editor entry and revalidate on window focus and after catalog mutations. Filter locally for immediate feedback. Refresh failures retain the last in-memory list with a warning and Retry; initial load failures show Retry and keep workout controls usable. No persistent browser cache and no offline editing. Server saves always validate selected IDs against current catalog data.

Results display name, equipment, family, and primary/secondary muscle text. Use a labeled accessible combobox/listbox, arrows to navigate, Enter to choose, Escape to dismiss, and normal Tab behavior. Typing never implicitly selects a result. Show a result-count announcement without announcing every keystroke redundantly. Keep create actions outside listbox options. Support pointer and touch selection, IME composition, and viewport-safe overlay positioning without clipping in collapsing cards or under the mobile volume panel.

After selection, display the catalog name and read-only muscle mappings in the existing card layout. Keep sets and reps editable. Menu actions: Replace exercise, Create variant, View in catalog. An archived selection gets an Archived label and remains usable. Replacing preserves sets/reps and previews old versus new muscle mappings before confirmation. Cancelling preserves the entire exercise.

Create variant opens a form prefilled from the selected entry, with name, equipment, and muscle controls. Explain “Creates a new catalog variant. Other workouts are unchanged.” No direct name or muscle editing is available on linked cards. A different name is required within that family, even if muscles match. Explicit Save creates the entry and switches only the invoking instance, preserving sets/reps. Cancel creates nothing. Use a client-generated entry ID to make retry after an ambiguous network response idempotent. If catalog creation succeeds but document autosave fails, retain the selected variant and unsaved state with Retry; do not create a duplicate entry. The variant remains available in the catalog even if the user subsequently abandons that workout edit.

New exercise from a picker uses the same form with new-family controls, creates the catalog data, and selects it in the invoking card. The editor must preserve the invoking exercise across async completion and reorder; introduce transient stable card identity rather than relying on an array index. Removing the invoking card must not attach the result to another card.

## Legacy exercises and linking

Previously saved and imported exercises remain unlinked and retain their existing editable names and muscle choices. Clearly label them Custom exercise and offer Link to catalog. That flow can select an existing entry or create a catalog entry from the current definition. Preview name, equipment and muscle differences before replacing the definition, preserve sets/reps, and require explicit confirmation. Never auto-match by name or silently change existing volume.

New exercise cards use the catalog workflow; an unselected card is an unfinished draft, not an automatically created catalog record. It is saved using existing relaxed draft rules and cannot export until valid. Existing unlinked exercises continue to pass existing strict validation when complete.

## Propagation and consistency

Retain self-contained workout snapshots in the existing document JSON. A catalog definition update runs in one write transaction: check entry revision and impact preview, update the entry, replace definition snapshots in every linked occurrence across template/program documents, and increment each affected document revision once. Preserve exercises' sets, reps, ordering, goals, workout IDs, weekdays and all unrelated fields. Reject the whole operation on failure. A family rename updates the family record only.

Every document create/update/copy resolves linked snapshots against the current catalog within its write transaction. The server owns linked name/muscles/equipment/family/revision; stale supplied values cannot change the catalog or reintroduce stale definitions. Unknown or inconsistent catalog IDs fail validation; archived IDs are accepted for existing uses and copies, but new picker selection is restricted to active entries. New link actions must be checked server-side, distinguishing unchanged links from newly introduced links. A copy may preserve an existing archived link.

An open stale editor must receive a document revision conflict after propagation. Preserve unsaved edits and the existing Reload saved version / Save as copy recovery. Saving as copy retains workout settings but uses current catalog definitions; clearly explain this in catalog-related conflict recovery. Refresh saved documents on window focus when clean; when dirty, check revision without replacing local edits and surface a conflict. This is refresh-based consistency, not live collaboration or a push subscription.

## Import and export

Continue version-2 template/program exports: strip catalog metadata and export fully resolved exercise names and muscle mappings using the existing portable exercise shape. Do not invent a file version solely for internal links. Flush/refresh before exporting so a stale definition is not silently exported; a conflict blocks export until resolved. Exporting does not detach the saved document.

Import versions 1 and 2 as independent exercises, preserving names and mappings. Never trust or retain extra catalog IDs supplied in imported JSON. Existing whole-file rejection, replacement confirmation, size limits and strict validation remain. Linking imported exercises is an explicit subsequent action.

## Starter data and lifecycle

Ship a reviewed seed fixture of approximately 60 common entries covering all five core equipment categories and all 12 primary-muscle choices. Families represent recognizable exercise groups such as Bench press, Row and Squat; naming identifies meaningful equipment/angle/grip variations. Maps use only the app's fixed muscle vocabulary. This is a curated programming aid, with user-editable mappings, not an anatomy expansion.

Record stable seed IDs and a seed version. An explicit, idempotent seed command inserts missing initial records once and never overwrites renamed, edited or archived entries. Re-running a seed cannot resurrect an archived entry. Future fixture additions require a new seed version; no automatic provider synchronization.

Run schema migration and catalog seeding explicitly for each environment. Never run production migrations or seeds during builds or requests. Schema changes are additive; existing documents need no automatic linking migration. Preserve the existing static publication allowlist.

## Visual and accessibility requirements

Follow docs/design-system/README.md and the approved compact desktop design. Keep dark palette, orange accent, Barlow typography, existing spacing tokens, visible labels, focus rings, reduced-motion support and normal document scrolling. Linked muscle choices may reuse the existing chip appearance as noninteractive labeled text rather than disabled fake controls.

Fine-pointer desktop controls may be 32px only when no coarse pointer is available; touch/hybrid targets stay at least 44×44px and native range hit areas stay 44px. Keep both desktop figures 180–200px and preserve mobile panel behavior. New overlays must handle long names, errors, 200% text, touch keyboards and scrolling. Opening/closing dialogs and picker menus preserves sensible focus; collapse, remove, navigation and teardown dismiss related overlays.

## Verification and acceptance

Unit/integration tests cover validation, seed idempotency, search ordering, family identity, archive/restore, authenticated API access, impact-preview conflicts, atomic propagation, preservation of workout settings, document revision increments, stale saves/copies, retry idempotency and untrusted import metadata.

Browser tests use populated templates/programs to cover keyboard/touch autocomplete, legacy linking, replacement, variant creation/cancellation/retry, catalog editing and resulting volume changes, archived selections, card reorder/remove during async work, conflicts, import/export, overlay clipping and focus recovery.

Run npm run db:migrate explicitly against development, then the explicit catalog seed command; run npm test, npm run test:e2e and npm run build. Inspect populated screens at 1366×768, 1440×900, 1920×1080, mobile/tablet widths, 200% text and touch/hybrid input. Check overflow, body prominence, controls, keyboard behavior and existing volume/slider/collapse/tooltip regressions. Update style.css first for authoritative visual values, then docs/design-system/README.md in the same implementation change.

## Exclusions

No external API integration, media/instructions catalog, provider synchronization, statistics, logging, multi-account access, offline editing, whole-catalog backup UI, family trees, family merging, AI-generated muscle mappings or automatic legacy matching.
