# Gym Program Builder

## Warm-ups, supersets and training profile (2026-11-03)

Design: docs/superpowers/specs/2026-11-03-warmups-supersets-training-profile-design.md; plan: docs/superpowers/plans/2026-11-03-warmups-supersets-training-profile.md. These approved requirements supersede the "Workout duration" estimation rules (and the original MVP domain model) where they conflict.

- Template exercises own `warmupSets` (integer 0–5, default 0; missing normalizes to 0). Warm-up sets never count toward volume (direct, indirect, weekly, goals or heatmaps). The Warm-up sets native slider sits after Sets (value text `None` at 0); collapsed summaries append `+ N warm-up` (omitted at 0).
- A superset is exactly two consecutive exercises: `superset {restBetweenSeconds 0–120 by 15, default 30; restAfterRoundSeconds 0–300 by 15, default max of both members' rest at pairing}` lives only on the first member. Any pair-invariant violation rejects an import/save as a whole (`Exercise N: Invalid superset.`). Members keep their own `restSeconds`, unused while paired. Limits live once in the shared duration limits; pure helpers live in `src/superset.js`.
- Duration (60 s per warm-up or working set): straight exercise `W·60 + (W > 0 ? rest : 0) + n·(60 + rest)`; a pair runs both members' warm-ups back to back plus one round rest when there are any, then rounds of `60 + between + 60 + round rest` (a leftover set is `60 + round rest`). Rest after the final set/round still counts. Buffer applies to warm-up + execution + rest + extra; only the final total rounds up. Breakdowns show a Warm-up line before Execution.
- Session editor (templates and program workouts): a link-icon pair action (`Superset <exercise> with next exercise`) appears only when this card and the next are unpaired. Pairs render in a `.superset` frame with an accent rail and one compact header (label, rest summary; Superset rest settings disclosure, Swap exercises, Reorder superset, Unlink superset). Members hide their own Reorder and show `Rest set by superset`; removing a member dissolves the pair.
- A pair reorders as one block (pointer drag, touch hold, ↑/↓ on its handle, Reorder menu); nothing drops between members and single cards step over pairs. Pair/unpair and the settings disclosure use the 200ms ease-out collapse pattern, finish closing before nodes are removed and reverse safely; initial render, import, swap and reorder show the final state; reduced motion is instant.
- Export bundles are version 4 (templates and programs) and always write `warmupSets`, plus `superset` when present; versions 1–3 still import with 0 warm-ups and no pairs. Catalog propagation, linking, moves and copies preserve both fields. No SQL migration (template JSON documents).
- The program review input carries warm-ups and pairs (`supersetWith` partner positions plus both rests), introduced in prompt `program-hypertrophy-v14` (current prompt v15; see Part B); server facts own duration and the model never recalculates it.
- Training profile (Part B) supersedes the program-context/background rules in "Program hypertrophy analysis" and the profile bullet in "Program follow-ups" where they conflict. The single-user profile (`src/profile.js`, `user_profile.profile_json`, no SQL migration) holds two prose fields (Training background and approach; Constraints and preferences; ≤2,000 UTF-16 units each) plus `maxTrainingDaysPerWeek` 1–7, `availableWeekdays` unique sorted 0 (Mon)–6, `maxSessionsPerDay` 1|2, `maxSessionMinutes` 20–180 by 5, `experienceLevel` beginner|intermediate|advanced, `typicalRepsInReserve` 0–4 and `equipment` (unique `EQUIPMENT` subset in `EQUIPMENT` order). `null`/`[]` mean unknown; `normalizeProfile` fills defaults, drops unknown keys and rejects invalid values; limits live once in `PROFILE_LIMITS`. Revision/conflict rules are unchanged and it is never exported.
- Program context is now Goals and priorities only. Stored or imported `constraintsAndPreferences` (v1–v4 files) is dropped by normalization on next load/save, with no backup or migration (by decision).
- The profile page (`#/profile`) has headed sections Schedule (max days slider 0–7, 0 = `No limit`; Mon–Sun `aria-pressed` day pills, none = not specified; sessions per day radios No limit/1/2), Session length (slider 15–180 by 5, 15 = `No limit`), Experience (level radios Not set/Beginner/Intermediate/Advanced; reps in reserve slider −1–4, −1 = `Not set`), Equipment (icon pills, none = not specified) and Notes (both textareas). Two columns at ≥761px, stacked below. Every change autosaves through the header save status (Retry; conflicts offer Reload saved version only).
- `profileChecks` (`src/profile-checks.js`, pure) reports `trainingDays` (distinct scheduled days over max), `unavailableDays`, `crowdedDays` and `unscheduledCount` in Week only (Unscheduled occurrences excluded from day checks), plus `longSessions` (`displayMinutes` over max, every occurrence) and `equipmentMismatches` (exercises without equipment skipped) in both modes; Sequence omits day checks. Empty fields produce no check.
- Prompt `program-hypertrophy-v15`: the server injects the whole saved profile as `athlete` (client copies ignored) and `facts.profileChecks` (day keys removed in Sequence); limits are fixed constraints, checks are authoritative and never recalculated, experience and reps in reserve are self-report.
- In-app hints (warning icon plus text, never colour alone): program card duration `over 60 min max` (tooltip "Longer than your max session length (Profile)"), Week day labels `Not an available day` / `3 sessions · max 2`, weekly panel `5 training days · max 4`, and the session editor duration suffix. They derive from `profileChecks` on every render, update live, are never stored or exported, never animate, and never block saving, export or analysis. Equipment mismatches appear only in AI facts. Program and editor routes load the profile on entry and on window focus but never wait for it: views mount without hints, adopt them when the latest load settles, and a failed load hides them silently.
- Verification: docs/superpowers/verification/2026-11-03-warmups-supersets-training-profile.md. Never claim a pending deployment was verified.

## Workout tracker V1 (2026-11-03)

Design: docs/superpowers/specs/2026-11-03-workout-tracker-design.md. For workout logging only, these approved requirements supersede the out-of-scope "workout logging" and "calendar dates/history" items, the "no browser persistence mirror"/"offline editing" rules (active workout only) and requirement 14's sliders (logging inputs only).

- Mobile-first logging started from a program occurrence, a session template or blank. Logs are snapshots: never written back to templates/programs/catalog, never exported, not in program volume or AI review. kg only.
- Sets log weight (0–999.75 by 0.25; blank/0 = bodyweight), reps (1–100) and optional RIR (0–5) with placeholders from last time and a done toggle. Swap/add use catalog variants only. Last time is keyed by variant ID.
- One active log at a time (DB-enforced). The active log is mirrored synchronously to `localStorage` and syncs automatically with backoff; conflicts offer Keep this device's version or Use saved version. Finished logs are edited online through the existing autosave.
- Migration 008 adds `workout_logs` and `workout_log_variants`; run it explicitly per environment.

## Program follow-ups (2026-11-01)

Design: docs/superpowers/specs/2026-11-01-program-follow-ups-design.md; plan: docs/superpowers/plans/2026-11-01-program-follow-ups.md. These approved requirements supersede conflicting rules in the sections below.

- Sequence rest cards keep Reorder then Remove in one action group at the right end, aligned with workout cards' actions, on every viewport.
- Drag previews render exactly like their source card (size; title, metadata and action positions within 1px) for Week/Sequence workout cards, rest cards and exercise cards, with the review dock open or closed, while staying fixed, inert, `aria-hidden` and noninteractive.
- Program header: title, Program name, then the Week/Sequence selector as one identity group; Program context, Import, Export and AI review form one file-action group that never wraps internally at ≥761px at default text size (right-aligned, moving to its own row when needed; it wraps internally only when a full row cannot hold it, such as enlarged text, and may wrap at ≤760px). At ≥761px the selector stays on one line, centered on the name input, and the name field keeps at least 12rem.
- The review docks from 1024px (340px, 360px at ≥1600px); below it stays the full-screen modal. From 1024px to 1279px an open dock stacks the weekly panel above the sessions as an instant reflow at the start of opening and at the end of closing (the stack is held until the dock column finishes closing; immediate with reduced motion); body figures stay ≥180px.
- Training background and approach lives in a single-user, revisioned server-side profile (`GET/PUT /api/profile`) edited at `#/profile` via the header Profile button before Log out. It autosaves through the header save status (Retry; conflicts offer Reload saved version only), is injected server-side into program reviews and is never exported. Migration 007 creates the profile and backs up/removes legacy per-program background; run it explicitly per environment.
- Session-template AI analysis is removed; the program review modules and `GET /api/analysis` remain.
- Verification: docs/superpowers/verification/2026-11-01-program-follow-ups.md. Never claim a pending deployment was verified.

## Program review dock and Week agenda (2026-11-01)

Design: docs/superpowers/specs/2026-10-31-program-review-dock-design.md; plan: docs/superpowers/plans/2026-11-01-program-review-dock.md. These approved requirements supersede the program analysis section's anchored popup, "Analyze program" trigger and context-dismisses-report rules where they conflict.

- The program AI review is a right-side dock at viewport widths ≥1024px (340px, 360px at ≥1600px; sticky, full height below the app navigation, fixed header/footer, scrolling report) and a full-screen native modal below 1024px. From 1024px to 1279px, an open dock stacks the weekly panel above the sessions (instant, never animated: the switch happens at the start of opening and at the end of closing, holding the stack until the dock column finishes closing; immediate with reduced motion; panel fully reachable, body figures ≥180px). Breakpoint changes while open move the same content, preserving report, scroll and focus.
- The program route host is a two-column grid whose dock column animates from 0px to `--review-width` (180ms grid-template-columns plus dock translate/opacity; instant with reduced motion; never on initial render). The dock is non-modal and stays open behind Program context; the volume panel and body figures keep their full sizes.
- Week is always a single-column agenda (fixed day-label column when the day row is ≥30rem, stacked below), whether or not the review is open. Preserve dragging, Reorder menus, keyboard day changes, Rest day drop targets, highlighting and Sequence behavior.
- One labeled "AI review" toggle sits last in the program file actions (16px from Export) with `aria-expanded`/`aria-controls`. It uses accent-family gradients only, one 450ms fine-pointer hover sweep, a 1600ms sparkle breath only while generating, no idle motion and no motion under reduced motion. Focus moves to the review title on open and back to the toggle on Close/Escape (Escape only from inside the dock).
- Analysis behavior, route, limits, prompt, provider settings and lifecycle are unchanged. Session-template AI analysis (its Analyze action, anchored popup, `POST /api/analysis` route, prompt and evaluation CLI) was removed on 2026-11-01; `GET /api/analysis` remains the capability check. It will return reusing the program review modules (`analysis-panel`, `analysis-controller`, `analysis-client`, `analysis-input`, `analysis-service`).
- Verification: docs/superpowers/verification/2026-11-01-program-review-dock.md. Never claim a pending deployment was verified.

## Program hypertrophy analysis (2026-10-31)

Design: docs/superpowers/specs/2026-10-31-program-analysis-design.md; plan: docs/superpowers/plans/2026-10-31-program-analysis.md.

- Programs own optional plain-text context: Goals and priorities, Constraints and preferences. Each allows 2,000 UTF-16 code units. Preserve context across revisioned saves/recovery, independent program copies and portable v3 bundles; legacy files without it still import. Context alone counts as content for replacement confirmation. Training background and approach (2026-11-01) lives in the single-user server-side profile (`GET/PUT /api/profile`, revisioned, never exported); the server injects it into program analysis as `athlete.trainingBackgroundAndApproach` and ignores any client copy. Imports/validation drop legacy per-program background; migration 007 backs it up and removes it (docs/operations/program-background-rollout.md).
- Analyze program is a read-only hypertrophy review of the current resolved snapshot, including unsaved edits and every repeated/Unscheduled occurrence. Strength/general fitness, saved reports, chat and automatic changes remain deferred. Context saving works without AI configuration.
- Server facts own volume, goal comparison and duration arithmetic. Sequence order/rests do not establish a calendar cadence; inactive retained weekdays stay in the snapshot but are withheld from the provider projection. Describe sharing through human occurrence numbers. Suggested template edits may affect other occurrences/programs.
- Reuse session streaming, cancellation and safe text rendering. Program requests use POST /api/analysis/program, at most 256 KiB, 50 occurrences, 40 exercises per distinct template and 400 expanded exercise instances. Paid synthetic evaluations are explicit CLI runs only.
- Program generation uses a bounded 1,024-token reasoning budget inside a 2,500-token total cap, excludes reasoning from output, and omits temperature. This was selected after live arithmetic/cadence comparison. Preserve the 60-second timeout and existing provider routing.
- Routine program updates retain context/report DOM, focus and caret while canceling pending destructive confirmations and invalidating obsolete actions. Relevant edits mark reports stale; revision-only acknowledgements do not. Close retains generation/report; route navigation discards it. Preserve 180ms overlay motion, rapid reversal and reduced motion.
- Follow docs/superpowers/verification/2026-10-31-program-analysis.md for actual verification and outstanding preview/production release checks. Never claim a pending deployment was verified.

## Reference metadata, tags and breadcrumbs (2026-10-29)

Design: docs/superpowers/specs/2026-10-29-linked-sessions-catalog-design.md; plan: docs/superpowers/plans/2026-10-29-catalog-metadata-navigation.md. These approved requirements supersede older variant-owned equipment and independent program-copy rules.

- Reference exercises own one equipment value, optional plain-text description (max 2,000 characters) and optional default primary/secondary muscles. Equipment creation/editing uses native single-select icon pills with visible labels. Variants inherit equipment, own their actual muscles and optional description, and cannot override equipment.
- Reference muscles initialize a new variant only; later default edits never change existing variants. Create variant from a variant starts with its own muscles, description and tags. Moves inherit destination equipment/reference description while preserving variant identity/own fields, archive state and workout rest/prescriptions.
- Brand is zero/one tag; Focus is zero/many independent free-form tags, never a replacement for the fixed volume muscles. Manage tags in the catalog's dedicated Tags screen: create, rename, archive/restore, with stable IDs and revision checks. Names are 1–80 characters and unique case-insensitively within kind. Archived assignments remain visible; new archived assignments reject except source-verified cloning of retained source assignments.
- Search reference/variant names, equipment and tag labels. Show labeled tags in catalog/autocomplete/workout cards, including collapsed cards. One accessible info surface shows both description levels; hide its trigger when both are empty. Long content wraps/scrolls inside the viewport without covering its trigger.
- Reference equipment/description and tag label mutations propagate transactionally to templates, once per affected template even when multiple variants are used. Guard definition/impact revisions; preserve dirty edits, open variant drafts and all timing rules.
- Migration 006 leaves mixed-equipment/empty references unconfigured for manual choice and preserves old values in an equipment backup. Never split existing references. Existing linked snapshots stay readable; block new selections/variants/move destinations until configured. Run migration/seed version 3 explicitly per environment and preserve all personal metadata on seed replay.
- Breadcrumbs replace redundant Back controls on nested views, retain program occurrence context and reveal catalog reference/variant targets. Keep global labeled navigation, native links, live names, valid ancestor routes, wrap/touch sizing and existing motion/reduced-motion behavior.
- Follow docs/operations/catalog-metadata-rollout.md for manual cleanup and explicit rollout. V3 files retain portable metadata values, never trusted internal IDs; v1/v2 import support remains.

## Shared session templates (2026-10-29)

Design: docs/superpowers/specs/2026-10-29-linked-sessions-catalog-design.md; plan: docs/superpowers/plans/2026-10-29-shared-session-templates.md. These approved requirements supersede older independent program-copy rules.

- Programs persist occurrences `{id,templateId,day}` and arrangement only. Session name, ordered exercises, prescriptions, goals and duration allowances belong to the shared template and save with its own revision.
- Adding/duplicating a program session links the same template; creating an empty workout creates and attaches a new template atomically. Duplicating a program shares its templates but copies arrangement/weekly goals. Library template duplication remains independent.
- Count each occurrence in weekly volume, including repeated and Unscheduled occurrences. Removing occurrences/programs never deletes templates. Templates in use cannot be deleted; show affected program links.
- Migration 005 explicitly converts each old embedded workout to a separate linked template without guessing sources or merging equal content. Preserve timing, catalog links, drafts and scheduling. Never migrate in production builds/requests.
- Export self-contained v3 bundles with distinct templates and file-local occurrence references; retain v1/v2 imports. Imports are atomic, remap identities and never trust catalog IDs. Shared editor import replaces the same template after the existing nonempty replacement confirmation; library import creates new records.
- Preserve retries/revisions and dirty edits. Save as copy opens an independent template and does not silently relink existing programs. Revalidate shared dependencies on entry/focus, coordinating with in-flight acknowledgements.
- Follow docs/operations/shared-sessions-rollout.md for an explicit environment-specific migration/backup/maintenance rollout.

## UI workflow: compact layout and deliberate motion

For every feature that adds or changes UI, read [the design system](docs/design-system/README.md), including its **Feature design and review checklist**, before designing or implementing. These are acceptance criteria from the start, not optional polish after the feature works. Existing feature-specific requirements still apply.

- **Design for density first.** In the design/spec and implementation plan (or the task's short design note), identify the existing layout and controls to reuse, where new controls fit, and which details belong behind a disclosure. Prefer aligned inline fields, compact toolbars and direct action strips over extra cards, stacked sections, repeated labels or full-width secondary buttons. Preserve readable content, body-map prominence and touch targets.
- **Choose action presentation deliberately.** Default familiar, repeated row/card actions to existing icon buttons with accessible action-and-target names and shared hover/focus tooltips. Keep visible text for primary, unfamiliar or ambiguous actions and wherever existing requirements mandate it. Do not hide a small action strip in a menu merely to save space. Follow the design system's pointer-aware 32px/44px sizing.
- **Specify interaction transitions.** For each new disclosure, popover/dialog, conditional region or other visible state change, state its entry/exit or expand/collapse behavior, properties, duration/easing and reduced-motion behavior. Reuse the nearest established pattern. User-triggered reveals and removals should transition smoothly in both directions; any instant behavior needs a concrete usability reason in the design note. Keep typing, slider values and data updates immediate; do not animate initial rendering or routine refreshes just to add motion.
- **Implement the complete interaction.** Preserve closing motion before hiding/removing nodes, support rapid reversal without stale callbacks, and keep focus, inert/hidden state and ARIA correct throughout. Avoid blanket `transition: all`, artificial delays and new animation dependencies.
- **Review behavior as well as screenshots.** Exercise the changed interactions in a real browser with populated data: open/close, expand/collapse, rapid toggles, keyboard/focus, touch and reduced motion. Inspect density at the viewport/text/input settings below. Fix abrupt transitions, excessive spacing and avoidable stacking before declaring completion. Report what was inspected and any verification gaps; screenshots alone cannot verify motion.

## Workout duration (2026-10-26)

Design: docs/superpowers/specs/2026-10-25-workout-duration-design.md; plan: docs/superpowers/plans/2026-10-25-workout-duration.md.

- Estimate execution as 60 seconds per set and rest after every set, including the last. Buffer applies to execution, rest and fixed extra time; round only the final displayed total upward to minutes. Empty workouts show ~0 min.
- Reference exercises own Compound/Isolation classification, supplying initial rest of 180/90 seconds for all variants. Legacy unclassified/custom exercises use 120 seconds. Existing workout rest never changes on reference edits, replacement, linking, moving, propagation or copying.
- Each workout exercise saves independent restSeconds, 0-300 by 15. Each template/program workout saves extraMinutes, 0-60 by 1 (default5), and bufferPercent, 0-50 by 5 (default10). Derived totals and disclosure state are never persisted.
- Show live duration in the shared editor and program workout metadata. Version-2 exports retain timing; missing legacy timing gets defaults, explicit invalid timing rejects the whole file. Preserve revisions and recovery.
- Run migration004 and seed version2 explicitly per environment. Type seeding must not overwrite chosen types, renamed references or archives.

## Reference exercises and nested catalog (2026-10-25)

Design: docs/superpowers/specs/2026-10-25-reference-exercises-design.md; plan: docs/superpowers/plans/2026-10-25-reference-exercises.md. These requirements supersede the previous catalog's flat display and no-move restriction.

- A reference exercise is a named grouping, never a selectable workout exercise. Variants own equipment and muscle mappings. Reference CRUD includes independent empty-group creation, reading, rename, archive and restore.
- Catalog groups start collapsed and search expands matches. Autocomplete shows labeled reference groups with selectable variants only; arrows follow rendered variant order and skip headings. Preserve active selection by variant ID on refresh.
- Reference archive state is independent of individual variant archive state. Restoring a reference never restores individually archived variants. Archived references cannot receive new variants or move destinations; existing links and verified copies remain usable.
- Moving a variant preserves identity, effective archive state, mappings and workout prescriptions, and transactionally updates reference IDs and revisions in linked snapshots. Guard source/destination/reference/impact revisions; never merge colliding variant names.
- Keep legacy familyId/table/wire names as internal compatibility identifiers. All user-facing catalog copy uses reference exercise and variant. Preserve JSON versions 1/2 and stable IDs.
- Migration 003 adds parent archive state. Run it explicitly per environment; builds/requests never migrate or seed. Preserve prior async-save, cache, focus, layout and accessibility regressions.

## Exercise catalog and autocomplete (2026-10-25)

These approved catalog requirements supersede older exercise-library restrictions and copy-independence rules where explicitly stated. Design: docs/superpowers/specs/2026-10-25-exercise-catalog-design.md; plan: docs/superpowers/plans/2026-10-25-exercise-catalog.md.

- Own the catalog in the existing SQLite/Turso database, with a curated starter list, equipment, fixed primary/secondary muscles, and stable exercise/family IDs. No external API or family ancestry tree.
- Session cards use explicit autocomplete selection. Linked exercise names and muscle mappings are read-only; sets/reps remain independent workout settings. Create variant saves a named catalog entry in the same family and switches only the invoking workout instance. Variants may share muscle mappings.
- Catalog definition edits propagate transactionally to every exact-entry use in templates/programs, with impact previews and document revisions. Other variants are unaffected. Template/program copies share definitions intentionally, while their prescriptions, order, goals and selected entries remain independent.
- Archive entries rather than deleting them. Preserve existing archived links and source-verified copies; exclude archived entries from new selections.
- Keep existing/imported exercises unlinked until explicit confirmation. Version-2 exports remain self-contained and strip internal catalog metadata; versions 1 and 2 still import without trusting catalog IDs.
- Revalidate the in-memory catalog on editor entry/focus and after mutations. Preserve dirty edits on external revision conflicts, coordinate refresh with in-flight save acknowledgements, and preserve open variant drafts when saves settle.
- Run db:migrate and db:seed explicitly per environment; never migrate or seed production during builds or requests. Preserve the existing design system, accessibility, volume behavior and verification requirements below.

## Current release: programs and persistence (2026-10-23)

These approved requirements supersede the original MVP restrictions below wherever they conflict. Full design: docs/superpowers/specs/2026-10-23-programs-persistence-design.md; implementation plan: docs/superpowers/plans/2026-10-23-programs-persistence.md.

- The app is personal, protected by one password, with named session templates in a library and named weekly programs.
- Programs contain deep independent template copies. Edits never propagate between copies or back to the library.
- New programs default to Week (Monday–Sunday), with Sequence available and existing programs retaining their saved mode. Multiple workouts per day and Unscheduled remain supported. Preserve canonical order and day assignments when toggling modes.
- Sequence supports saved draggable/removable rest days; hide them in Week without changing weekday assignments. Rest days never contribute volume. Program cards use icon actions, whole-card dragging and accessible Reorder actions/menus (including rest cards), with no separate Move up/Move down buttons or day select.
- Weekly volume counts every program workout once, including unscheduled; weekly goals are 0.5–30 by 0.5, separate from workout goals (0.5–12). Slider 0 clears either goal. Weekly panels use goal-status bars and an interactive weekly volume heatmap independent of goals: 0, 0.5–6, 6.5–12, 12.5–18, 18.5+ sets. Hovering or focusing a muscle previews panel details; selecting a muscle highlights contributing workouts, matching the session template editor. Weekly panels exclude per-session productive-set recommendations. Design: docs/superpowers/specs/2026-10-24-program-overview-design.md; plan: docs/superpowers/plans/2026-10-24-program-overview.md.
- Autosave complete data and unfinished drafts to SQLite: local file for development, Turso/libSQL through Vercel Node.js 24 API for production. No browser persistence mirror, ORM or frontend framework.
- Save revisions prevent stale cross-device overwrites; failures retain edits with Retry, conflicts offer Reload saved version or Save as copy. Do not store derived volume or transient hover/collapse state.
- Version-2 JSON exports contain a named template or complete program; existing version-1 session files still import. Library imports create new records, editor imports replace after confirmation; reject invalid files as a whole.
- Draft saving relaxes empty names and absent primary muscles only. Strict validation still gates import/export. Preserve all existing muscle, exercise, volume, slider, collapse, tooltip and accessibility behavior.
- Password/session/database secrets stay server-side. Only index.html, style.css and browser src assets may be published. Preview and production databases/secrets are separate.
- Verification: npm test, npm run test:e2e, npm run build. Run npm run db:migrate explicitly; never migrate production automatically during builds/requests.
- Out of scope: multiple accounts, live collaboration, offline editing, calendar dates/history, workout logging, template-copy synchronization and whole-library backup UI.

## Design system: compact desktop by default

Before adding or changing UI, read and follow [the design system](docs/design-system/README.md). The approved [compact desktop design](docs/superpowers/specs/2026-10-24-compact-desktop-design.md) governs desktop layout and supersedes older spacing/layout guidance wherever they conflict. Preserve this direction for future features unless the user explicitly requests a change.

- **Useful density.** Use available desktop width, compact headers and toolbars, aligned fields and visible actions. Avoid oversized headings, redundant labels/branding, excessive padding and unnecessary stacked sections. Reuse existing CSS tokens and component patterns instead of introducing a separate visual style.
- **Visual and friendly.** Keep the dark palette, orange accent and Barlow typography. Both body figures must remain prominent, readable and interactive: use the existing 180–200px desktop figure heights, never shrink them below 180px or hide/crop them to gain space. Keep volume data and actions legible alongside them.
- **Responsive structure.** Adapt from laptop to monitor; preserve ordered exercise editing, responsive weekly day grids and Unscheduled. Prefer normal document scrolling over clipped content or extra internal scroll areas. Oversized volume panels must remain fully reachable through their existing flow fallback.
- **Accessible controls.** Compact 32px controls apply only on desktop with a fine primary pointer and no available coarse pointer. Touchscreens, including hybrid mouse/touch laptops, retain at least 44×44px targets. Native slider hit boxes remain 44px on every device. Preserve visible labels, focus, tooltips, keyboard behavior, stable readouts and reduced-motion support.
- **Mobile preservation.** Desktop compaction must not shrink mobile/tablet touch targets or change the existing session and program panel behavior. Allow content to wrap and grow with long names, errors and enlarged text.
- **Verify and document.** For UI changes, inspect populated screens at 1366×768, 1440×900 and 1920×1080, plus relevant mobile/tablet widths, 200% text and touch/hybrid input. Check overflow, density, body prominence and interaction regressions; do not rely on empty-state screenshots alone. Follow the project verification commands above. Change authoritative values in `style.css` first, then update `docs/design-system/README.md` in the same change.

## Purpose

A simple interface for building gym session templates. While the user builds a session, they see the **training volume per muscle group** update in real time.

This is an **MVP**. Keep the tech stack and the code as simple as possible. Do not add features, dependencies, or abstractions that the requirements below do not call for.

## Domain model

```
Session
├── exercises: Exercise[]   // ordered; the user controls the order
└── goals: Partial<Record<MuscleGroup, number>>   // optional volume goal per muscle; a missing key means no goal

Exercise
├── name: string (required)
├── sets: integer from 1 to 10
├── repRange: { min: integer from 1 to 30, max: integer from 1 to 30 }   // min <= max
├── primaryMuscles: MuscleGroup[]
└── secondaryMuscles: MuscleGroup[]

Goal value: multiple of 0.5 from 0.5 to 12 (for example 10 or 4.5)

MuscleGroup (fixed list, exactly these 12 values, in this order):
  Chest, Lats, Upper back, Biceps, Triceps, Front delts, Side delts, Rear delts, Abs, Quads, Hamstrings, Calves
```

## Functional requirements

1. **Session form.** The user can create a session template: add exercises, edit them, remove them, and reorder them. A session has no name.
2. **Exercise fields.** For each exercise the user sets the name, the number of sets, the rep range, the primary muscle groups, and the secondary muscle groups. Sets and the rep range are set with sliders (see requirement 14); the name is a text field.
3. **Muscle group choices.** Primary and secondary muscle groups come only from the fixed `MuscleGroup` list above. Users cannot add custom muscle groups.
4. **Live volume panel.** A panel always shows the session's volume per muscle group and updates on every edit. No submit or refresh step is needed. The volume list shows only the muscle groups that are relevant to the session (see requirement 12).
5. **Reorder exercises.** Each exercise card has a drag handle. Dragging it with a mouse or by touch moves the exercise to a new position. When the handle has keyboard focus, the ↑ and ↓ arrow keys move the exercise up or down one place, and focus stays on the moved exercise's handle. Order does not affect volume.
6. **Volume goals.** A "Set goals" button in the volume panel opens a dialog with one goal slider per muscle group, in `MuscleGroup` order (see requirement 14). The user can set, change, or clear a goal for any muscle; sliding to the far left (0, shown as `No goal`) clears it. Every goal is optional. Changes apply live while the user slides. A "Done" button, Escape, or a click outside the dialog closes it; there is no Save/Cancel step. A slider cannot hold an invalid value, so the dialog shows no goal errors; it shows no recommended range or range warning either. Each muscle's info is available in a tooltip (see requirement 19).
7. **Volume relative to goals.** In the volume list, a muscle with a goal shows its volume against the goal (for example `7 / 10`), a bar with a goal marker (see requirement 13), and its status (see requirement 21). A muscle without a goal shows its volume alone, with no marker and no status. The body map does not show goal status (see requirement 15).
8. **Export session.** An "Export" button downloads the current session (exercises in order, and goals) as a JSON file named `gym-session-YYYY-MM-DD.json`, using today's local date. Export is refused while any exercise is invalid: nothing is downloaded, and a message names the first invalid exercise (for example `Fix exercise 2 before exporting.`). A session with no exercises can be exported.
9. **Import session.** An "Import" button opens a file picker for `.json` files. A valid file **replaces** the whole current session (exercises and goals). If the current session has any exercise or goal, the user is asked to confirm the replacement first; declining changes nothing. A file that is not valid JSON or does not match the session file format is **rejected as a whole**: the session does not change, and one error message says what is wrong (for example `Exercise 2: unknown muscle group "Glutes".`).
10. **Direct and indirect volume.** In the volume list, each muscle's bar has two stacked segments: **direct** volume (from exercises where it is a primary muscle) first, then **indirect** volume (from exercises where it is a secondary muscle). Direct is a solid fill of the bar's colour; indirect is a soft fill of the same colour with an outline of that colour. The bar's colour comes from its goal status (see requirement 13). The bar does not use heat colours. The filled part of the bar reads as one rounded pill: its left end and the right end of its last visible segment are fully rounded, like the track, and the join between direct and indirect stays straight. This holds for every bar (direct only, indirect only, or both, including a full bar), and the indirect segment's orange outline follows its rounded ends instead of being clipped into a square corner. A small "Direct / Indirect" key sits above the list (hidden on mobile, where bars are hidden); its swatches use the neutral no-goal colour. Each row still shows one number: the total, or `total / goal`. The split is shown as text in the readout (for example `Triceps 5 sets (3 direct · 2 indirect) · 2 exercises`, or `Triceps 5 / 4 sets (3 direct · 2 indirect) · over · 2 exercises` with a goal), always naming both parts even when one is 0, and in a visually hidden text inside each row button for screen readers.
11. **Expand and collapse exercises.** Each exercise card has a chevron toggle button in its header, between the highlight tag and the remove button. It hides or shows the card's fields; its `aria-expanded` reflects the state and its label is `Collapse exercise` or `Expand exercise`. A collapsed card keeps its header (drag handle, `Exercise N`, highlight tag, toggle, remove button) and shows a one-line summary below it instead of the fields (see **Exercise summary**). "Expand all" and "Collapse all" buttons sit in the session toolbar above the exercise list (see requirement 20) and are hidden when the session has no exercises. A newly added exercise starts expanded; every exercise loaded by an import starts collapsed. A collapsed invalid exercise shows a `Needs fixing` text marker in its header. When export is refused, the exercise it names expands and its first invalid field gets focus. Collapsing changes nothing in the session: not volume, order, validation, or the exported file. Reordering (mouse, touch, keyboard), removing, and muscle highlighting work the same on collapsed cards, and an exercise keeps its collapsed state when it moves. Collapsing and expanding animate (see requirement 16).
12. **Hide irrelevant muscles in the volume list.** The volume list hides a muscle's row when the muscle has **no goal and** its volume is **0** (both must be true; see **Visible volume rows**). Visible rows keep `MuscleGroup` order. Rows appear and disappear live on every edit, including goal edits. When no row is visible, the list shows `No volume yet. Add an exercise or set a goal.` and the "Direct / Indirect" key is hidden. The body map is unchanged by this rule: it still shows every muscle, in its body map colour (see requirement 15). Selecting a muscle works the same whether or not its row is visible (for example by clicking a body map region); a hidden row stays hidden even when its muscle is selected, and the readout still describes it.
13. **Goal-coloured bars on a shared scale.** In the volume list, each bar's colour shows its goal status: **amber** when under, **green** when met, **red** when over, and a **neutral grey-blue** for a muscle without a goal. Direct and indirect segments both use that colour (solid and soft, see requirement 10), and the met checkmark uses the met colour (see requirement 21). A muscle with 0 volume shows only the grey empty track. All bars share one scale, so one set has the same length in every row (see **Bar scale**). A muscle with a goal shows a thin vertical **goal marker** on its bar at the goal's position; the fill can run past the marker, so the user sees by how much they are over. The marker is visual only (`aria-hidden`); the `volume / goal` value and the status (checkmark, and hidden text for screen readers) carry the same information. Nothing is cut off: the scale always fits the largest volume. Bars, marker and key stay hidden on mobile. The body map uses its own volume heatmap colours, not these (see requirement 15).
14. **Sliders for numbers.** Every number the user enters is set with a slider instead of a number field; there is no typing.
    - **Sets:** one slider, whole numbers from 1 to 10.
    - **Rep range:** one slider with two thumbs (min and max), whole numbers from 1 to 30; the part of the track between the thumbs is filled. min can never pass max: moving one thumb past the other pushes the other thumb along, so min ≤ max always holds and the rep range error can no longer appear in the form.
    - **Goals:** one slider per muscle, from 0 to 12 in steps of 0.5; 0 means no goal and is shown as `No goal`. A new dialog opens with every slider at its applied goal, or at 0.
    - Each slider shows its current value as text next to its label, updating live while the user slides: sets as `3`, reps as `8–12` (en dash) or `8` when min = max, goals as `4.5` or `No goal`.
    - Every change applies on every movement (no release step needed), like typing did before; volume, goal status, summary and validation update live.
    - Sliders are native `<input type="range">` elements: they work with mouse, touch and keyboard (arrow keys, Home, End, Page Up/Down), have a visible focus ring, an accessible name (for example `Sets`, `Reps min`, `Reps max`, `Chest goal`), and a value text for screen readers (`No goal` at 0).
    - Imported values outside these limits are rejected (see **Session file format**). New exercises keep the defaults 3 sets and 8–12 reps.
15. **Body map as an absolute volume heatmap.** Each body map muscle is filled by its volume alone, in one of five levels (see **Body map heat levels**): **grey** at 0, then a ramp that builds to the accent orange at the ideal 4–6 sets and leans toward red above it: **muted orange** for 0.5–3, **accent orange** for 3.5–6, **orange-red** for 6.5–9, **red** for 9.5 and above (volume above 12 stays in the top level). Goals do not affect the body map, so its colours no longer match the volume-list bars, which keep their goal-status colours. The body map has no direct/indirect split; it uses the total volume. A small legend sits under the two figures, on desktop and mobile: a swatch for each level labelled `0`, `1–3`, `4–6`, `7–9`, `10+`. The legend is visual only (`aria-hidden`), like the body map. Hover, focus and selection on the body map work as before. The Direct / Indirect key above the volume list stays. The body map stays `aria-hidden`; the volume list and readout carry the numbers and status as text.
16. **Smooth collapse and a stable readout.**
    - **Collapse animation:** when a card collapses, its fields slide closed (height to 0) while fading out, and the one-line summary slides open while fading in; expanding reverses it. It takes 200 ms, `ease-out`, and the cards below glide with it. The chevron keeps its rotation. A single toggle, "Expand all" / "Collapse all", and the expand on a refused export all animate the same way; with the bulk buttons every card animates at once. Cards that are newly built (page load, add, import, reorder, remove) appear in their state with no animation. With `prefers-reduced-motion: reduce` the change is instant. A collapsed card's fields are not focusable and are hidden from screen readers, as before. Collapsing still changes nothing in the session.
    - **Stable readout:** the readout line in the volume panel always reserves the height of two lines of its text, on desktop and mobile, so switching between the hint (`Tap a muscle to highlight its exercises.`) and a muscle's details never moves the elements below it or changes the panel's height. The text is centred vertically and horizontally in that space. The readout text and format are unchanged. A readout that needs more than two lines still grows (rare; not a goal to prevent).
17. **Smooth readout and steady hover.**
    - **Readout crossfade:** when the readout switches subject (hint → muscle, muscle → hint, or muscle A → muscle B, by hover, tap, click or keyboard), the old text fades out and the new text fades in, about 150 ms in total, `ease-out`. Live updates for the same subject (for example its numbers changing while the user moves a slider or edits an exercise) change the text at once, with no fade. If the subject changes again during a fade, the readout goes straight to the newest subject; it never shows a stale muscle. It works the same on desktop and mobile. With `prefers-reduced-motion: reduce` the change is instant. The readout keeps its reserved two-line height (requirement 16), its text, and its `aria-live` behaviour; screen readers hear only the final text.
    - **No dead zones between rows:** in the volume list, neighbouring rows' hover areas touch: there is no gap between rows that belongs to no muscle. The rows look the same as before (the visual spacing comes from inside the row, not from space between rows).
    - **Hover grace:** when the mouse leaves a muscle (a volume row or a body map region) for a spot that is not a muscle, the readout and the hover highlight keep that muscle for about 150 ms before going back to the selected muscle or the hint. If the mouse reaches another muscle within that time, the readout goes straight to it, with no hint in between. Leaving the volume panel works the same way. Hovering never changes the selection.
18. **Three delt muscles.** `Shoulders` is replaced by **Front delts**, **Side delts** and **Rear delts** everywhere a muscle appears: the exercise muscle choices, the volume list, the readout, the goals dialog, the summary and the session file. On the body map, the front figure shows **Front delts** and the back figure shows **Rear delts**, each in the inner part of the old shoulder shape; **Side delts** is a thin cap on the outer edge of the shoulder, drawn on both figures. All three regions colour, hover, focus and select like every other muscle (see requirement 15). A file that names `Shoulders` is rejected like any unknown muscle group (`Exercise 1: unknown muscle group "Shoulders".`); there is no migration.
19. **Muscle info tooltip.** In the goals dialog, each muscle row ends with a small info button (an "i" icon) in its own fixed-width column at the right, after the value text, so the buttons line up vertically in every row on desktop and mobile. Its accessible name is `About Chest` (and so on). The button shows a tooltip with the muscle's info text (see **Muscle info**): a "Productive sets" line and a "Programming" line. The tooltip is an **overlay**: opening it never changes the dialog's layout, and the dialog's scroll area never clips it.
    - **Hover and focus peek:** hovering the button with a mouse, or giving it keyboard focus, shows its tooltip. The tooltip hides when the pointer leaves both the button and the tooltip (after a grace of about 150 ms, so the pointer can move onto the tooltip to read it) or when the button loses focus, unless it is pinned.
    - **Click pins:** clicking the button (mouse, tap, Enter or Space) pins its tooltip open; clicking it again unpins and hides it. A pinned tooltip stays open until its button is clicked again, the user clicks or taps anywhere outside the button and the tooltip, or presses Escape. On touch screens, a tap toggles the pinned tooltip; there is no hover.
    - **One at a time:** showing a tooltip hides any other one, pinned or not.
    - **Escape:** while a tooltip is shown, Escape hides it and keeps the dialog open; with no tooltip shown, Escape closes the dialog as before. Scrolling the dialog or resizing the window hides any shown tooltip.
    - **Position:** the tooltip appears below the button, its right edge aligned with the button's right edge, and flips above the button when there is not enough room below. It always stays inside the window with a margin of at least 8 px.
    - **Animation:** the tooltip fades in while sliding about 4 px toward its final spot, and fades out the same way in reverse, about 150 ms, `ease-out`. With `prefers-reduced-motion: reduce`, it appears and disappears at once.
    - **Accessibility:** the button's `aria-expanded` is `true` while its tooltip is shown, `aria-controls` points to the tooltip, and `aria-describedby` points to it so screen readers read the info text on focus.
    - Every tooltip is hidden each time the dialog opens. Showing a tooltip changes nothing in the session.
20. **Session toolbar.** Import, Export, Expand all and Collapse all sit in one row above the exercise list: Import and Export at the left end, Expand all and Collapse all at the right end. The row wraps on narrow screens. Each button shows an inline SVG icon before its text (Import: arrow into a tray, Export: arrow out of a tray, Expand all: chevron down, Collapse all: chevron up), drawn like the "Add exercise" icon (`currentColor` stroke, `aria-hidden`); the text labels stay. Expand all and Collapse all stay hidden when the session has no exercises; Import and Export are always shown. The file message (export refused, import error) shows below the row. The buttons work exactly as before.
21. **Met checkmark instead of status words.** In the volume list, the visible status words **under**, **met** and **over** next to the bar are removed. A muscle whose goal is **met** shows a small green checkmark icon (inline SVG, `currentColor` stroke in the met colour, `aria-hidden`) in the status spot instead. A muscle that is **under** or **over** shows nothing there; the bar colour (amber or red) and the `volume / goal` value carry its status. The red outline pill around `over` is removed. The same holds on mobile chips. Each row with a goal keeps its status word (`under`, `met` or `over`) as visually hidden text inside the row button, so screen readers still announce it. Rows stay aligned: once any goal is set, the status spot keeps its own fixed-width column whether or not it shows the checkmark. The readout text is unchanged and still names the status as a word (for example `Triceps 5 / 4 sets (3 direct · 2 indirect) · over · 2 exercises`). The goal status rule, the bar colours, the goal marker, the body map and the goals dialog are unchanged.

## Volume calculation (core business rule)

For each muscle group:

```
volume(muscle) = Σ over exercises:
                   sets × 1    if muscle ∈ primaryMuscles
                   sets × 0.5  if muscle ∈ secondaryMuscles
                   0           otherwise
```

- Rep range does **not** affect volume.
- Volume is a multiple of 0.5. Show it as-is (for example `4.5`); do not round it.

### Worked example (use as a test case)

| Exercise    | Sets | Primary          | Secondary          |
|-------------|------|------------------|--------------------|
| Bench press | 4    | Chest            | Triceps, Front delts |
| Dips        | 3    | Chest, Triceps   | Front delts          |
| Pull-ups    | 3    | Lats             | Biceps, Upper back |

Expected volume: Chest **7**, Triceps **5**, Front delts **3.5**, Lats **3**, Biceps **1.5**, Upper back **1.5**. Every other muscle group is **0**.

## Goal status (business rule)

For a muscle with a goal:

```
status = under   if volume < goal
         met     if volume = goal
         over    if volume > goal
```

- A muscle with no goal has no status. It is never shown as under.
- Volume and goal are both multiples of 0.5, so an exact equality comparison is safe.
- Status is never shown by colour alone: in the volume list, **met** shows a checkmark, and **under** and **over** are read from the `volume / goal` value (for example `3 / 6`, `5 / 4`) next to the coloured bar. Every row carries its status as visually hidden text for screen readers, and the readout always names it as a word (see requirement 21).

### Worked example (use as a test case)

Using the volume from the volume worked example above, with goals Chest **7**, Triceps **4**, Lats **6**, Quads **8**:

| Muscle  | Volume | Goal | Shown      | Status |
|---------|--------|------|------------|--------|
| Chest   | 7      | 7    | `7 / 7`    | met    |
| Triceps | 5      | 4    | `5 / 4`    | over   |
| Lats    | 3      | 6    | `3 / 6`    | under  |
| Quads   | 0      | 8    | `0 / 8`    | under  |
| Biceps  | 1.5    | —    | `1.5`      | —      |

## Direct and indirect volume (business rule)

For each muscle group:

```
direct(muscle)   = Σ sets         over exercises where muscle ∈ primaryMuscles
indirect(muscle) = Σ sets × 0.5   over exercises where muscle ∈ secondaryMuscles
volume(muscle)   = direct(muscle) + indirect(muscle)
```

- Indirect is **counted volume** (half sets), not raw secondary sets, so the two parts always add up to the volume.
- Goal status still compares the total volume to the goal.

The bar fills **direct first**, on the same scale for both segments (the shared `scale` from **Bar scale**):

```
directFill    = min(direct / scale, 1)
indirectFill  = min(indirect / scale, 1 − directFill)
```

The shared scale always fits the largest volume, so in practice nothing is cut off; the `min` caps are only a safeguard.

## Bar scale (business rule)

All bars in the volume list use one scale: the number of sets that fills a whole bar.

```
maxGoal   = the largest goal, or none when no goal is set
maxVolume = the largest volume over all muscles
scale     = max(maxGoal / 0.75, maxVolume)   if a goal is set
            maxVolume / 0.75                  if no goal is set and maxVolume > 0
            1                                 otherwise (nothing is visible; avoids dividing by 0)
marker(muscle) = goal(muscle) / scale        // only for a muscle with a goal; 0 to 1 from the bar's left end
```

- The largest goal's marker sits at 75% of the bar, unless some volume is larger than `maxGoal / 0.75`: then the scale grows to fit that volume, the largest volume fills the whole bar, and every marker moves left.
- With no goals, the largest volume fills 75% of the bar.
- The scale is computed on render from the volume and the goals; never store it. It changes live on every exercise or goal edit.
- Fill widths and marker positions are fractions and do not have to be multiples of 0.5. Tests compare them with a small tolerance.

### Worked example (use as a test case)

Volume worked example with the goal worked example's goals (Chest 7, Triceps 4, Lats 6, Quads 8): maxGoal = 8, maxVolume = 7, scale = max(8 / 0.75, 7) = 32/3 ≈ 10.667.

| Muscle     | Direct | Indirect | Goal | Colour  | Direct fill | Indirect fill | Marker  |
|------------|--------|----------|------|---------|-------------|---------------|---------|
| Chest      | 7      | 0        | 7    | green   | 0.65625     | 0             | 0.65625 |
| Triceps    | 3      | 2        | 4    | red     | 0.28125     | 0.1875        | 0.375   |
| Lats       | 3      | 0        | 6    | amber   | 0.28125     | 0             | 0.5625  |
| Quads      | 0      | 0        | 8    | amber   | 0           | 0             | 0.75    |
| Front delts| 0      | 3.5      | —    | neutral | 0           | 0.328125      | —       |
| Biceps     | 0      | 1.5      | —    | neutral | 0           | 0.140625      | —       |
| Upper back | 0      | 1.5      | —    | neutral | 0           | 0.140625      | —       |

Other cases:

- Volume worked example, no goals: scale = 7 / 0.75 = 28/3 ≈ 9.333; Chest fills 0.75.
- Volume worked example, only goal Chest 4: scale = max(4 / 0.75, 7) = 7; Chest fills the whole bar (direct fill 1), its marker is at 4/7 ≈ 0.571, and it is red (over).
- Empty session, goal Calves 6: scale = 6 / 0.75 = 8; Calves fill 0, marker 0.75.
- Empty session, no goals: scale = 1.

## Exercise summary (business rule)

A collapsed card shows one line built from its exercise:

```
summary = name · sets × reps · primary muscles · secondary: secondary muscles
```

- **name**: trimmed; `Untitled exercise` when empty.
- **reps**: `min–max` (en dash), or just `min` when `min = max`.
- A sets, min or max value that is not a positive whole number shows as `?` (for example `? × 8–12`).
- Muscles are joined with `, `, in `MuscleGroup` order. The primary part is left out when there are no primary muscles; the `secondary: …` part is left out when there are no secondary muscles.
- Parts are joined with ` · `.

### Worked example (use as a test case)

| Exercise                                                  | Summary                                                          |
|-----------------------------------------------------------|------------------------------------------------------------------|
| Bench press, 4 sets, 6–10, Chest / Triceps, Front delts   | `Bench press · 4 × 6–10 · Chest · secondary: Triceps, Front delts` |
| Dips, 3 sets, 8–8, Chest, Triceps / Front delts           | `Dips · 3 × 8 · Chest, Triceps · secondary: Front delts`           |
| New exercise (defaults)                                   | `Untitled exercise · 3 × 8–12`                                   |
| `"  Row "`, sets empty, 8–12, no primary / Biceps         | `Row · ? × 8–12 · secondary: Biceps`                             |

## Visible volume rows (business rule)

```
visible(muscle) = goal(muscle) is set  OR  volume(muscle) > 0
```

- Uses the computed volume, so a muscle chosen in an exercise whose sets are empty or invalid has volume 0 and is hidden if it has no goal.
- A muscle with a goal is always visible, even at volume 0 (it shows as **under**).

### Worked example (use as a test case)

- Volume worked example, no goals: visible = Chest, Lats, Upper back, Biceps, Triceps, Front delts. Hidden = Side delts, Rear delts, Abs, Quads, Hamstrings, Calves.
- Volume worked example with the goals from the goal worked example (Chest 7, Triceps 4, Lats 6, Quads 8): visible = Chest, Lats, Upper back, Biceps, Triceps, Front delts, Quads. Hidden = Side delts, Rear delts, Abs, Hamstrings, Calves.
- Empty session, no goals: no muscle is visible.
- Empty session, goal Calves 6: visible = Calves.

## Body map heat levels (business rule)

```
heatLevel(volume) = 0   if volume = 0
                    1   if 0 < volume ≤ 3
                    2   if 3 < volume ≤ 6
                    3   if 6 < volume ≤ 9
                    4   if volume > 9
```

- Uses the computed total volume (direct + indirect), so empty or invalid sets count as 0. Goals are not used.
- Volume is a multiple of 0.5, so the levels hold 0.5–3, 3.5–6, 6.5–9 and 9.5 and above. The legend labels them `1–3`, `4–6`, `7–9`, `10+`.
- Colours: 0 = untrained dark grey (`--untrained`), 1 = muted orange (`--heat-1`, `#9a4a1f`), 2 = accent orange (`--heat-2`, the `--accent` value `#f97316`), 3 = orange-red (`--heat-3`, `#f0522d`), 4 = red (`--heat-4`, `#dc2626`).
- 4–6 sets is the ideal range, so level 2 is the accent orange; the levels above lean toward red.

### Worked example (use as a test case)

Volume worked example (goals make no difference):

| Muscle | Chest | Lats | Upper back | Biceps | Triceps | Front delts | Side delts | Rear delts | Abs | Quads | Hamstrings | Calves |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Volume | 7 | 3 | 1.5 | 1.5 | 5 | 3.5 | 0 | 0 | 0 | 0 | 0 | 0 |
| Level | 3 | 1 | 1 | 1 | 2 | 2 | 0 | 0 | 0 | 0 | 0 | 0 |

Boundaries: 0 → 0, 0.5 → 1, 3 → 1, 3.5 → 2, 6 → 2, 6.5 → 3, 9 → 3, 9.5 → 4, 12 → 4, 15 → 4.

## Session file format (business rule)

```json
{
  "version": 1,
  "exercises": [
    {
      "name": "Bench press",
      "sets": 4,
      "repRange": { "min": 6, "max": 10 },
      "primaryMuscles": ["Chest"],
      "secondaryMuscles": ["Triceps", "Front delts"]
    }
  ],
  "goals": { "Chest": 10, "Triceps": 4.5 }
}
```

- `version` must be exactly `1`. Any other value is rejected (`Unsupported file version.`).
- Values must be within the slider limits (sets 1–10, reps 1–30, goals 0.5–12); a value outside them rejects the whole file, for example `Exercise 2: Sets must be a whole number from 1 to 10.` or `Goal for Chest must be a multiple of 0.5 from 0.5 to 12.`
- `exercises` is an array, possibly empty, in session order. Each exercise must pass the same validation as the form (see **Validate input**). Muscle names must match `MuscleGroup` values exactly, with the same case.
- `goals` is an object whose keys are `MuscleGroup` values and whose values are valid goals. It may be empty. A muscle without a key has no goal.
- Unknown extra keys are ignored on import and never written on export.
- Export writes JSON indented with 2 spaces.
- **Round trip:** exporting a session and importing the file gives an identical session.

## Muscle info (content)

Shown in the info tooltip in the goals dialog (requirement 19). Keep this text in the code next to the muscle list, keyed by `MuscleGroup`.

| Muscle | Productive sets | Programming |
|---|---|---|
| Chest | 4–8 direct sets per session. | Combine pressing and flyes; pressing fatigue can impair later performance. |
| Lats | 4–8 direct sets per session. | Include shoulder-adduction and extension patterns; consider grip fatigue. |
| Upper back | 4–8 direct sets per session. | Chest support may reduce lower-back fatigue; diversify scapular loading. |
| Biceps | 2–6 additional direct sets after pulling; 4–8 if trained largely alone. | Account for pulling; use curls targeting different elbow-flexor functions; monitor tendon symptoms. |
| Triceps | 2–6 additional direct sets after pressing; 4–8 if trained largely alone. | Overhead extensions complement pressing; monitor elbow fatigue. |
| Front delts | 0–4 additional direct sets after substantial pressing; around 3–6 with little pressing. | Often receive sufficient work without front raises; manage shoulder-press fatigue. |
| Side delts | 3–8 direct sets per session. | Direct lateral raises allow targeted loading with limited systemic fatigue. |
| Rear delts | 2–6 additional direct sets after rowing; around 3–8 with little rowing. | Reverse flyes and rear-delt rows can complement broader back work. |
| Quads | 4–8 direct sets per session. | High-fatigue compound movements often justify fewer sets than isolated extensions. |
| Hamstrings | 4–8 combined hip-extension and knee-flexion sets. | Include both functions; stretched-position and eccentric loading may increase recovery demand. |
| Calves | 4–8 direct sets per session. | Consider gastrocnemius and soleus; use controlled stretch and full ROM. |
| Abs | 2–6 direct sets per session. | Use progressively loaded spinal-flexion and/or anti-extension exercises; manage trunk fatigue. |

## Implementation guidelines for agents

- **Keep the volume calculation in a pure function**, separate from the UI (for example `computeVolume(session) → Record<MuscleGroup, number>`). Unit-test it, including the worked example above.
- **Keep the direct/indirect split and the bar fill pure**, separate from the UI: for example `computeVolumeSplit(session) → Record<MuscleGroup, { direct, indirect }>`, with `computeVolume` derived from it (`direct + indirect`) so the volume rule lives in one place, and `barSegments(direct, indirect, scale) → { direct, indirect }`. Unit-test both, including the direct/indirect worked example. Compute them on render; never store them.
- **Define the muscle group list once** as a single constant, and use it for the form choices, the volume panel, and validation.
- **Prefer derived state.** Compute volume from the session on render. Do not store it separately.
- **Validate input:** exercise names must not be empty, sets are a whole number from 1 to 10, reps are whole numbers from 1 to 30 with `min ≤ max`, goals are a multiple of 0.5 from 0.5 to 12 (a goal slider at 0 clears the goal). The form's sliders cannot produce out-of-range values, but validation still checks them, because imported files are validated with the same rules.
- **Define the slider limits once** (sets 1–10, reps 1–30, goals 0.5–12 in steps of 0.5) as a single constant, and use it for the slider `min`/`max`/`step` attributes and for validation.
- **Keep the rep range push rule in a pure function**, separate from the UI (for example `setRepBound(repRange, bound, value) → repRange`, where moving `min` above `max` raises `max` to it and moving `max` below `min` lowers `min` to it). Unit-test it.
- **Sliders use native `<input type="range">` with no library.** The two-thumb rep range is two overlapping range inputs on one track, styled with CSS.
- **Keep goal status in a pure function**, separate from the UI (for example `goalStatus(volume, goal) → { status } | null`). Unit-test it, including the goal worked example above. Compute it on render; never store status.
- **Keep the bar scale in a pure function**, separate from the UI (for example `barScale(volume, goals) → number`), and feed it to `barSegments` and the marker position. Unit-test it, including the bar scale worked example. Compute it on render; never store it.
- **The goals dialog uses the native `<dialog>` element**, with no library.
- **Keep the muscle info as data next to `MUSCLE_GROUPS`** (for example `MUSCLE_INFO: Record<MuscleGroup, { sets, notes }>`), with exactly one entry per muscle. Unit-test that every muscle has an entry. The recommended ranges and `goalRangeCheck` are removed.
- **The info tooltip uses the native `popover` attribute** (top layer, so the dialog's scroll area cannot clip it), positioned with a little JavaScript from the button's position, and animated with CSS transitions. No library. Keep the placement math (below or flipped above, kept inside the window) in a pure function, for example `tooltipPosition(anchorRect, tipSize, viewport) → { top, left, placement }`, and unit-test it.
- **Icons are inline SVG** in the markup, with no icon library or font.
- **Keep reordering logic pure.** Moving an exercise is a pure function on the exercise list (for example `moveExercise(exercises, from, to) → Exercise[]`), unit-tested separately from the drag UI.
- **Drag and drop uses pointer events, with no dependencies.** Do not use the native HTML5 drag API (unreliable on touch) or a library.
- **Keep the session file logic pure**, separate from the UI: for example `serializeSession(session) → string` and `parseSession(text) → { session } | { error }`. Reuse `validateExercise`, `validateGoal`, and `MUSCLE_GROUPS`; do not duplicate the rules. Unit-test the round trip (with the volume worked example and the goal worked example) and every rejection case.
- **Keep the exercise summary in a pure function**, separate from the UI (for example `exerciseSummary(exercise) → string`). Unit-test it, including the summary worked example above. Compute it on render; never store it.
- **Keep the body map heat level in a pure function**, separate from the UI (for example `heatLevel(volume) → 0 | 1 | 2 | 3 | 4`), with the band limits (3, 6, 9) defined once next to it. Unit-test it, including the heat level worked example and its boundaries. Compute it on render; never store it. `bodyMapTone` is removed. Define the five colours once as CSS tokens and use them for both the body map and its legend.
- **Keep row visibility in a pure function**, separate from the UI (for example `visibleMuscles(volume, goals) → MuscleGroup[]`, in `MuscleGroup` order). Unit-test it, including the visible rows worked example. Compute it on render; never store it.
- **Collapsed state is view state**, not domain state: it is not a field of `Exercise` or `Session`, it is never exported, and it is not kept between page loads. Keep it in the UI next to the session (for example a boolean per exercise, in session order), and move it with the same pure `moveExercise` when exercises are reordered.
- **File I/O uses browser built-ins only:** a `Blob` with an `<a download>` link for export, a hidden `<input type="file" accept=".json,application/json">` for import, and the native `confirm()` for the replace prompt. No libraries.

## Decided

- **Volume goals** (2026-10-09): a single target per muscle, not a range. Volume above the goal is flagged as **over**. Goals are part of the single in-memory session; they are not persisted, like the rest of the session. The body map stays on absolute heat colours.
- **Session import/export** (2026-10-09): one session per JSON file, with exercises and goals. Import replaces the whole session after a confirmation (asked only when the current session is not empty). Export is blocked until every exercise is valid. An invalid file is rejected as a whole. The file name is `gym-session-YYYY-MM-DD.json`. This is a manual, user-triggered file exchange; the app still keeps nothing between page loads.
- **Direct and indirect volume** (2026-10-09): indirect volume is counted volume (secondary sets × 0.5), so direct + indirect = volume. The volume-list bar shows two stacked segments, direct first, coloured like the primary and secondary chips; heat colours stay on the body map only. When volume exceeds the bar's scale, direct fills first and indirect is cut off. Rows show only the total; the split appears in the readout and in screen-reader text. Goals, the session file format, and the body map are unchanged.
- **Expand and collapse exercises** (2026-10-09): a chevron toggle per card plus "Expand all" / "Collapse all" above the list. A collapsed card shows its header and a one-line summary (name, sets × reps, primary and secondary muscles). New exercises start expanded; imported exercises start collapsed. A collapsed invalid exercise shows a `Needs fixing` marker, and a refused export expands the exercise it names and focuses its first invalid field. Collapsed state is UI-only: not in the session, not in the file, not persisted.
- **Hide irrelevant muscles** (2026-10-09): the volume list hides a muscle when it has no goal and 0 computed volume (empty or invalid sets count as 0). It applies to the volume list only; the body map still shows every muscle. Visible rows keep `MuscleGroup` order. When nothing is visible, a short `No volume yet. Add an exercise or set a goal.` message replaces the list and the Direct / Indirect key is hidden. Selecting a muscle whose row is hidden keeps working (body map and readout); the row is not forced visible and the selection is not cleared.
- **Rounded bar ends** (2026-10-09): the filled part of each volume-list bar is one pill. The outer ends (left end, and the right end of the last visible segment) are fully rounded, and the direct/indirect join stays straight. It applies to all bars, not only those with indirect volume. The indirect outline is drawn around its rounded ends, including when the fill reaches the full bar. Visual only: volume, fill widths (`barSegments`), goals, and the body map are unchanged.
- **Goal-coloured bars on a shared scale** (2026-10-10): this replaces the orange bar colours and the per-row scale (goal, or 10) from the direct/indirect decision. Bar colour comes from goal status: amber under, green met, red over, neutral grey-blue without a goal; 0 volume shows only the grey track. The direct/indirect split stays (solid and soft of the status colour), and the status text takes the same colour (the status words are later replaced by a met checkmark; see the 2026-10-11 "Met checkmark" decision). One shared scale for all bars: the largest goal's marker sits at 75%, and the scale grows when a volume would pass the bar's end, so nothing is cut off. With no goals, the largest volume fills 75%. A thin goal marker shows the goal on each bar that has one. This adds status colours next to the orange accent; the design system is updated to match. `goalStatus` no longer returns `progress`. The body map, the readout text, the session file format, and mobile (bars hidden) are unchanged.
- **Sliders for numbers** (2026-10-10): sets, the rep range and goals are set with sliders instead of number fields, so one drag replaces click-and-type. Limits: sets 1–10, reps 1–30, goals 0.5–30 in 0.5 steps. The rep range is one two-thumb slider; thumbs push each other, so min ≤ max always holds. A goal slider's far-left 0 position means `No goal` and clears the goal. Each slider shows its value as text. The limits are part of validation, so an imported file with an out-of-range value is rejected as a whole (no clamping). Native range inputs, no library. The domain model shape, the file format keys, and volume rules are unchanged.
- **Body map in goal-status colours** (2026-10-10; replaced by the 2026-10-11 "Body map volume heatmap" decision): this replaces the body map's absolute heat colours (from the volume goals, direct/indirect and goal-coloured bars decisions). The body map uses the bars' status colours: amber under, green met, red over, neutral grey-blue for volume without a goal, dark grey for no goal and 0 volume. A muscle with a goal and 0 volume is amber (under). One solid colour per muscle, with no direct/indirect split. The heat legend is removed on all screen sizes, and the heat-level function, its bands and its colour tokens are removed. The Direct / Indirect key, the volume list, the readout, and the session file are unchanged.
- **Smooth collapse and stable readout** (2026-10-10): collapsing and expanding a card animate (height slide plus fade, 200 ms ease-out, summary and fields cross over), for single toggles, the bulk buttons and a refused export alike; newly built cards and reduced-motion users get no animation. This replaces the earlier "no collapse animations" scope line. The readout reserves two lines of height on every screen size, so hovering or selecting a muscle never shifts the panel; its text is unchanged.
- **Smooth readout and steady hover** (2026-10-11): the readout crossfades (about 150 ms, ease-out) when its subject changes, by hover, tap, click or keyboard, on every screen size. Same-subject live updates stay instant, and reduced-motion users get no fade. Moving the mouse between muscles no longer flashes the hint: volume rows touch with no gap between them (same look), and leaving a muscle waits about 150 ms before the readout falls back, which also covers gaps in the body map. Readout text, height, and selection behaviour are unchanged. This adds a second allowed animation next to the collapse slide.
- **Delts, recommended ranges, muscle info and toolbar** (2026-10-11): `Shoulders` is split into Front delts, Side delts and Rear delts (12 muscles). On the body map, front delts are on the front figure, rear delts on the back figure, and side delts are an outer shoulder cap on both. Old files with `Shoulders` are rejected; no migration, the file version stays 1. The goal limit drops from 30 to 12 for the slider and for import validation (no clamping). Each muscle has a fixed, inclusive recommended range; the goals dialog always shows it and replaces it with a non-blocking amber above/below warning when the goal is outside it. An info button per muscle toggles an inline panel with the productive-sets and programming notes. (The recommended ranges, the warnings and the inline panel are replaced by the 2026-10-11 "Muscle info tooltip" decision.) Import, Export, Expand all and Collapse all share one toolbar row (file buttons left, bulk buttons right) with inline SVG icons and their text labels.
- **Muscle info tooltip** (2026-10-11): the inline info panel in the goals dialog becomes an overlay tooltip, so opening it never shifts the layout. Hovering or keyboard focus peeks at it; a click or tap pins it until clicked again, an outside click or Escape. Only one is shown at a time. It fades and slides about 4 px in and out (about 150 ms, ease-out; instant with reduced motion). The info button moves to a fixed column at the right end of each row, after the value, so the buttons line up. The recommended range line, the above/below warnings, the recommended range data and `goalRangeCheck` are removed entirely; the tooltip shows only the productive-sets and programming text. Goals, their limits, the volume list, the body map and the session file are unchanged.
- **Met checkmark** (2026-10-11): the volume list's visible status words are removed to make the list more visual. Only a met goal gets a mark: a green checkmark icon. Under and over show no mark; their amber or red bar and the `volume / goal` value already tell them apart. Screen readers still get the status word through visually hidden text in each row, and the readout keeps the word. The status rule, colours, marker, body map, goals dialog and session file are unchanged.
- **Body map volume heatmap** (2026-10-11): this replaces the body map's goal-status colours (from the 2026-10-10 "Body map in goal-status colours" decision). The body map shows absolute volume in five levels: 0, 0.5–3, 3.5–6, 6.5–9, 9.5 and above (the goal limit is 12, but volume can pass it and stays in the top level). The ramp builds to the accent orange at the ideal 4–6 sets, then leans toward red: muted orange, accent orange, orange-red, red, with dark grey at 0. Goals no longer colour the body map, so it no longer matches the bars; the bars keep their goal-status colours. A small legend (`0 · 1–3 · 4–6 · 7–9 · 10+`) returns under the figures on every screen size. The volume list, readout, goals dialog and session file are unchanged.

## Open decisions (ask the user before deciding)

- **Tech stack.** It is not chosen yet. Propose the simplest option that works (for example, a single static page with no build step, or a minimal framework) and get approval before you scaffold.
- **Persistence.** It is unspecified whether sessions are saved (in memory only, `localStorage`, or a backend). The MVP default is in memory only, unless the user says otherwise.
- **Same muscle as primary and secondary.** It is unspecified whether one exercise can list a muscle as both. The recommended default is to prevent it in the UI.
- **Exercises with no primary muscle.** It is unspecified whether an exercise may have zero primary muscle groups.
- **Multiple sessions.** It is unspecified whether the MVP supports several sessions or a program made of sessions. The default is a single session.

## Out of scope for the MVP

Authentication, multiple users, exercise libraries or presets, weight/RPE tracking, scheduling, and analytics beyond per-muscle set volume (with its direct/indirect split) and per-muscle volume goals. Goal presets or templates, and goal ranges (min–max), are out of scope. For import/export: automatic saving, merging or appending an imported session, partial imports, several sessions per file, migrating other file versions, and other formats (CSV and so on) are out of scope. For collapsing: remembering collapsed state between page loads or in the session file, and collapsing the volume panel are out of scope; animations beyond the collapse/expand slide (requirement 16), the readout crossfade (requirement 17) and the info tooltip fade (requirement 19) are out of scope. For hiding muscles: a "show all muscles" toggle, sorting rows by volume, and hide/show animations are out of scope. For muscle info: recommended ranges and range warnings (removed), editable info text, info tooltips outside the goals dialog, and migrating `Shoulders` in old files are out of scope.
