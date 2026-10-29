# Shared sessions and richer exercise catalog

Date: 2026-10-29. Status: approved for implementation planning, including equipment-pill icons; implementation has not started.

## Intent and confirmed decisions

Keep one session template editable from its library or any program that uses it. Narrow reference exercises own equipment and starting muscle selections; variants add technique-specific definitions, descriptions, Brand and Focus tags. Make those distinctions visible without crowding the workout editor. Retain the existing vanilla JavaScript, SQLite/libSQL, password protection, autosave recovery and compact design system.

Confirmed with the user:

- Share all session content: name, exercises, exercise order, sets, reps, rest, goals and duration allowances. Only occurrence identity, weekday and placement belong to the program.
- Convert every existing embedded program workout to its own new linked template. Preserve its exact draft content and placement; do not guess original source templates or merge identical sessions.
- Adding a template links it. Duplicate adds an occurrence of the same template. Empty workout creates a new linked template.
- Prevent deletion of a template used by any program. Removing an occurrence leaves its template intact.
- Equipment belongs exclusively to a reference. Do not split existing references; the user will manually resolve equipment differences in the small current database.
- Reference muscle defaults initialize new variants; changing those defaults never changes existing variants. Create variant from a variant starts with that variant's muscles and tags.
- Descriptions are optional at both levels. One workout info popover displays both, labeled, and is absent if both are empty.
- A variant has zero or one Brand and zero or more Focus tags. Focus labels are free-form, independent of the 12 volume muscles. Each tag type has create, rename and archive/restore management.
- Archived tags remain on existing variants but cannot be newly assigned. Renames update labels everywhere.
- Search names and tags; show tags in catalog, autocomplete and expanded/collapsed workout cards.
- Equipment creation/editing uses muscle-style single-select pills, each with an equipment-specific icon and visible text label.
- Breadcrumbs replace redundant Back controls and retain program context when editing a shared template.
- Self-contained program files include each distinct template once and retain repeated occurrences. Imports create new templates and never overwrite library templates automatically.
- Moving a variant inherits destination equipment and reference description, retains its own muscles, description and tags, and previews equipment changes and affected workouts.

## Current implementation evidence

`src/program.js:copyWorkout` deep-clones a template. `src/program-view.js` embeds that clone when adding a template and saves editor changes to `program.workouts`. `server/repository.js` stores each entire template/program document with one revision. There is no dependable source-template identity on every embedded workout. `catalogCopyOf` is temporary catalog-copy verification, not a reliable template relationship.

Reference forms currently own name/type; variant forms own equipment/muscles. Catalog definition propagation scans embedded exercise arrays. Portable version-2 files strip catalog links and repeat complete workouts. Shared templates require changes to these boundaries, not just UI copy.

## Stage A: shared session storage and editing

### Authoritative model

Keep templates as revisioned `documents` records. A stored program's workout entries become `{id, templateId, day}`. Program name, mode, weekly goals and mixed workout/rest sequence remain program-owned. Preserve occurrence IDs so drag, weekday assignment and sequence references remain stable.

Add a relational `program_template_links(program_id, occurrence_id, template_id)` index maintained transactionally with the program JSON. Foreign keys/indexes support lookup and deletion protection; the JSON remains the program order/placement authority. Index contents must match stored occurrences after every transaction. Disallow missing/non-template targets on writes; clients cannot create broken links by supplying an arbitrary ID.

Read responses expose the authoritative program document plus distinct template records keyed by ID. Build an in-memory resolved projection for existing card rendering, volume, duration and analysis. Never persist that projection or allow a program save to overwrite template content. Weekly volume counts each occurrence, including repeated uses of one template and Unscheduled. Rest days still contribute nothing.

### Save lifecycle and concurrency

Program arrangement edits use the program revision. Session edits use the selected template revision and a template-owned autosave queue, whether entered through the library or a program. Reuse one template queue per active identity; repeated occurrences display the same draft immediately. A program arrangement save never carries nested exercises.

Flush pending edits before leaving their editor; preserve existing Retry, Reload saved version and Save as copy recovery. Failure keeps local edits. Concurrent edits to the same template conflict regardless of entry route. Independent program arrangement and template edits do not spuriously conflict.

Save as copy from a conflicted shared session creates a new template and opens it without silently relinking any program occurrences. Existing occurrences remain on the original template. Explain this beside the recovery action. Retrying an ambiguously acknowledged create/import must be idempotent and must not duplicate templates.

Revalidate shared template records on program/editor entry and window focus. Coordinate with in-flight acknowledgements and dirty queues; never replace dirty local drafts with fetched content. No live collaboration or background polling is introduced. A template update refreshes every loaded occurrence and weekly totals; another device sees it on refresh/focus/entry under the existing model.

Program duplication creates independent program arrangement/weekly goals but retains links to the same templates. Removing occurrences or deleting a program never deletes its templates. Template duplication in the library still creates an independent template. Template deletion checks links in the same write transaction and returns affected program IDs/names so the UI can explain the block with navigation links.

Empty workout creation and linking must be atomic. If an obsolete UI request completes after navigation, storage stays coherent and no detached duplicate create occurs. Keep existing draft allowances for empty names and absent primary muscles.

### Existing-data migration

Explicit migration 005 converts each embedded occurrence to one new template and replaces its content with a template link in one transaction. Record a stable migration mapping so reruns cannot create extra templates. Preserve catalog IDs, archived links, chosen rest, timing allowances, blank names, order, goals, weekday, occurrence IDs and rest sequence entries. Do not reinitialize prescriptions from the catalog. Increment changed program revisions to reject stale clients. Validate every converted draft before committing; any failure rolls back the migration.

Take an environment-specific database backup before executing. Migration runs through an explicit command, never builds or requests. Test on a copied database and compare before/after resolved content. Old app versions must not write after conversion; deploy in a brief maintenance window with old clients required to reload.

### Portable files

Introduce version 3 for linked program files: a file-local `templates` collection and occurrences referencing file-local keys, never database IDs. Template files can use version 3 to retain portable exercise metadata. Preserve version-1 session and version-2 template/program import compatibility.

Export each distinct template once from a consistent server snapshot; reject invalid sessions strictly as today, identifying the first occurrence needing repair. Flush local dirty queues first so exports include current changes. Export descriptive catalog metadata as values, with no trusted catalog/tag/reference IDs or revisions. Imported exercises remain unlinked, as today, while retaining their portable descriptions, equipment and tag labels.

Validate the whole file before writes: kinds, unique keys, resolved references, sequence, muscles, timing, tag cardinality and size. Legacy embedded workouts each become a separate new template; do not infer sharing from equal content. A version-3 repeated key becomes repeated links to the same newly created template. Remap all file identities, then atomically create templates plus program (or replace the active program after existing confirmation/revision checks). Rejecting an import leaves both program and library unchanged. Old templates detached by a replacement remain in the library. Retain the 1 MiB limit and clear unsupported-version errors.

## Stage B: catalog metadata and navigation

### Reference and variant ownership

Extend `catalog_families` (keep internal compatibility names) with equipment, description, default primary muscles and default secondary muscles. Keep Compound/Isolation classification and current initial-rest rules. New references require one equipment selection. Default muscles are optional; when provided they must use the fixed list, be distinct and have no overlap between roles. Variant validation still requires a primary muscle.

Variant equipment is derived server-side from its reference; ignore no attempted override silently: reject writes containing an equipment value inconsistent with the parent. Remove editable variant equipment controls and show the inherited value as text with the reference identity. API projection may retain the `equipment` property for current consumers, but there is only one authoritative value.

Reference equipment edits update linked template snapshots transactionally, guarded by reference/variant/template impact revisions. Show affected variant/template/program usage before applying. A reference default-muscle edit does not propagate; a reference description edit updates visible information but never prescriptions. Initial rest still comes from classification only at new selection; edits/replacements/moves never reset existing rest.

Optional descriptions are plain text, maximum 2,000 characters at each level, normalized line endings, no HTML interpretation. Empty means absent. Create variant copies its source variant description as a starting draft as well as muscles and tags; a new variant under a reference starts with an empty variant description. Reference description is always displayed separately, never copied into a variant field.

Moving a variant preserves its stable ID, own fields, archive state and template prescriptions. Equipment and reference-description context change to the destination. Transactionally update affected template snapshots and revisions, with existing source/destination/impact collision guards. Existing rest remains unchanged.

### Equipment cleanup and migration

Migration 006 adds metadata/tag schema. References whose variants all agree inherit that equipment; references with no variants or conflicting values remain explicitly unconfigured. Preserve old equipment values in a migration backup/report, not as editable variant properties. Do not invent a winner or split references. Show a compact Needs equipment marker and allow reference editing; block new selections/new variants/move destinations until resolved. Existing linked workouts remain readable using their preserved snapshots during cleanup; catalog reads expose the unresolved state explicitly.

User manually selects equipment for each unresolved reference through its edit form; the confirmation previews affected existing variants/templates and completion removes the unresolved state. Reference defaults start empty rather than guessing mappings from divergent variants. Existing variants keep their muscles. Seeding must not overwrite selected equipment, types, names, defaults, descriptions, tags or archive states; migration and seed are explicit per environment.

### Brand and Focus tags

Add revisioned `catalog_tags` records with stable ID, kind (`brand` or `focus`), name and archive state, plus variant/tag associations. Names are trimmed, 1–80 characters, unique case-insensitively within kind; reject duplicates, never merge automatically. One brand per variant, distinct focus IDs, no same tag repeated. The same label can exist in different kinds. Tag IDs cannot cross kinds or reference nonexistent records.

New assignments must be active. Existing archived assignments survive edits and source-verified variant creation, consistent with preserving archived source definitions; newly adding an archived tag through arbitrary payloads is rejected. If a user removes an archived assignment, it cannot be reselected. A tag rename/archive transaction advances affected variant/template metadata revisions to coordinate existing caches and dirty drafts. Renaming preserves stable IDs and all assignments. Archive prevents selection, not reading. No hard-delete or merge feature.

Use a dedicated `Exercise catalog › Tags` screen, opened by a visible Manage tags toolbar action. Two compact Brand/Focus tabs, labeled search, inline create, and dense named rows with rename/archive/restore icon strips. Preserve selected kind/search on return. No separate general settings subsystem.

Variant forms show one Brand single-selection control and Focus multi-selection chips/search within existing aligned form rows. Reference equipment uses native radio inputs styled like existing muscle chips, with a visible legend and ordinary keyboard radio navigation. Each equipment pill includes a recognizable equipment-specific 18–20px inline SVG icon before its visible label: Barbell, Dumbbell, Cable, Machine, Bodyweight, Kettlebell, Resistance band and Other. Use a consistent currentColor outline style, no emoji, icon fonts or new dependencies; icons are decorative (`aria-hidden="true"`) because the text names the option. Icons and text share the complete clickable label and selected/focus treatment, with no separate icon target or tooltip required to understand the choice. All equipment options remain visible; one value can be selected. Preserve readable wrapping, existing pointer-aware target sizes and immediate radio selection without additional motion. Existing equipment filters can retain their compact dropdown because they filter rather than define exercises.

### Search and variant display

Extend normalized catalog search to reference name, variant name, inherited equipment and tag labels. Multiword queries require every word to match the combined searchable fields. Preserve exact/prefix variant-name ranking, stable IDs, reference grouping, eight-variant autocomplete cap, active selection and rendered arrow order. Archived tags remain searchable on assigned active variants. Existing archive filters still control reference/variant availability.

Show labeled `Brand: …` and `Focus: …` neutral chips alongside equipment in catalog variant rows, autocomplete options and workout cards. Do not show empty placeholders. Show all assigned tags with natural wrapping, including collapsed cards; no color coding by tag type, hidden overflow or extra metadata cards. Also show them wherever the variant is identified in create/edit/move/impact dialogs. Custom unlinked exercises show any imported metadata as plain snapshot values, without claiming live catalog linkage.

### Descriptions and motion

Reuse the existing top-layer tooltip/popover mechanics for a named `About [variant]` info button in the expanded action strip and collapsed header. Both descriptions appear under Reference exercise and Variant labels; omit each empty section. Long content remains viewport-constrained and scrollable without clipping. Mouse hover/focus peeks; click/tap pins; Escape/outside dismisses. One info surface at a time; closing an info surface does not accidentally close its containing dialog. No editing inside the info surface.

Info entry/exit: opacity plus 4px translation, 150ms ease-out. Reference/variant secondary details reuse 200ms ease-out grid-row and opacity disclosures. Tag management dialogs reuse 150ms opacity with at most 4px translation in both directions; retain native modal focus containment through the closing interval, then close/remove and restore focus. Rapid reversals cancel stale completion callbacks. Closing nonmodal regions become inert/aria-hidden immediately after moving focus outside; reduced motion settles synchronously. Keep text edits, radio/chip selection, values, search and save acknowledgements immediate. No initial entrance animation or new dependencies.

### Breadcrumbs and routes

Keep labeled global Programs / Session templates / Exercise catalog navigation. Put one compact semantic `nav aria-label="Breadcrumb"` above the existing title on nested views; omit on root lists. Use ordered lists, real anchors, decorative separators, and `aria-current="page"` on the final item. Remove redundant Back controls serving the same destination; retain modal Cancel/Close.

Routes: `#/programs/:programId/workouts/:occurrenceId` resolves the shared template in program context; `#/templates/:templateId` opens it directly. Catalog reference/variant routes select and reveal the corresponding existing grouped row instead of inventing a second catalog editor. `#/catalog/tags` opens tag management. Old root/template/program routes remain valid. Browser Back/Forward, reload and copied deep links reconstruct context from route IDs, never transient navigation history.

Examples: Session templates › Push A; Programs › Strength › Push A; Exercise catalog › Barbell Bench Press › Paused bench press; Exercise catalog › Tags. In program context the small Shared template link opens the direct template route. Renaming updates the trail immediately. Returning to a program/catalog restores the relevant occurrence/row focus and sensible scroll position. Missing/deleted route targets show a recoverable message and valid parent links.

Breadcrumbs wrap at narrow widths and 200% text, retain the current item and nearest parent without horizontal page overflow, and meet existing touch targets. They replace navigation chrome rather than adding a large heading region. Route transitions reuse the existing short view fade; no independent breadcrumb entrance effect.

## Visual design and review acceptance

Apply frontend-design, design-taste-frontend, ui-ux-pro-max and web-design-guidelines under the authoritative project system. The skill's alternative dark palettes/layouts conflict with the mandated existing palette; preserve project tokens and layout rather than reskinning. The product-specific visual anchor stays the interactive body maps and live volume, with equipment/muscle/tag metadata as compact supporting content. Keep Barlow, dark surfaces and orange accent; no marketing treatment, new font or decorative image generation.

Reuse reference dialogs, side-by-side muscle fieldsets, chip styles, flat nested rows, existing inline action strips and shared tooltips. Reference editing grows to include aligned name/type, equipment radios, optional description disclosure and default-muscle fields. Variant forms reuse that structure with inherited equipment text and editable muscles/tags/description. Secondary descriptions use a disclosure rather than a permanent tall textarea. Existing 180–200px desktop body figures stay prominent. Preserve 32px fine-pointer desktop controls only with no coarse pointer, 44px touch/hybrid targets and 44px slider hit boxes. Do not replace action strips with menus to save space.

Review populated screens at 1366×768, 1440×900, 1920×1080, tablet and 390px mobile, 200% text, fine/coarse/hybrid inputs and reduced motion. Exercise long reference/variant/tag names, multiple focus tags, descriptions at maximum length, errors, archived items, unresolved equipment, empty forms and shared-session save/conflict states. Inspect focus visibility, keyboard radio selection, autocomplete order, breadcrumbs, pinned/hover info surfaces, open/close/rapid reversal and touch scrolling. Screenshots establish layout only; actual interaction establishes motion/accessibility.

Web guidelines reference: https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md (retrieved 2026-10-29). Project-specific disclosure motion, palette, title case and target rules take precedence over conflicting generic guidance.

## Verification and delivery

Ship stage A before stage B, with separate reviewable plans sharing this spec. Each stage must run `npm test`, `npm run test:e2e`, `npm run build` and the relevant real-browser acceptance checks. Add integration coverage for migration rollback/idempotency, atomic imports, repeated-template volume, deletion races, archived catalog links, stale acknowledgements and cross-route shared-template conflicts. Update analysis inputs to consume resolved templates without duplicate/missing occurrences. Update authoritative CSS first and design-system documentation together for UI changes. Update AGENTS.md superseded copy/equipment requirements in the same delivery.

No production migration, data edits, seed execution or deployment has been performed during design. Completion reports must distinguish automated results, real-browser inspection and any gaps. Preserve v1/v2 imports, revision/recovery behavior, rest timing, volume calculations and program drag/sequence behavior throughout.
