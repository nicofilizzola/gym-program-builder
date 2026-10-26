# Workout duration estimate design

## Intent and scope

Help the user fit a planned workout into available time with a live, understandable estimate. Use a fixed one-minute execution assumption per set, editable rest per exercise, and both fixed session extra time and a percentage buffer. This is an estimate, not workout logging or a timer.

Show estimates in the session template editor, the shared editor for program workouts, and every program workout card in both sequence and schedule modes, including Unscheduled. No weekly duration total or library-list duration is included.

## Dependencies and existing architecture

The approved exercise catalog design is in `docs/superpowers/specs/2026-10-25-exercise-catalog-design.md`. At design time it was documented but not implemented. On resumption, the committed catalog/reference implementation became available on `feat/exercise-catalog` through `964f00b`; it is integrated into this feature branch. The newer `2026-10-25-reference-exercises-design.md` distinguishes reference groups from selectable variants. Classification belongs to the reference group, matching the user's explicit requested scope; this supersedes the initial entry-level terminology below.

Keep plain JavaScript, Node.js 24, SQLite locally and Turso/libSQL in production. No new dependency, frontend framework, ORM, browser persistence or service. Reuse current autosave, revision conflicts, copy recovery and server-side validation.

## Inputs and ownership

- Reference exercises gain `exerciseType`: `compound` or `isolation`. User-facing labels are Compound and Isolation. A reference supplies this default for all its variants; variants do not own another classification. Reference creation/edit and inline new-reference creation expose a required deliberate choice. Existing custom references may retain null (Type not set) until edited; their selections use the two-minute fallback. A reviewed fixture classifies known starter reference IDs; do not infer classification from names or muscles.
- Classification supplies an initial rest default: compound 180 seconds; isolation 90 seconds. It is not a workout constraint.
- Each workout exercise stores `restSeconds`: integer 0–300 inclusive, multiple of 15. The native Rest per set slider uses those bounds and steps. Display minutes and seconds, such as `1 min 30 sec`; expose equally understandable accessible value text.
- Selecting an entry on an unfinished new card initializes its rest from classification. After selection, rest belongs to the workout and remains editable. Replacing or linking a reference preserves current rest. Catalog edits, propagation, refresh and copy resolution never overwrite it. Repeated occurrences can have different rest.
- Unlinked/custom exercises, old saved exercises and old imports missing rest use 120 seconds, without automatic classification. An unfinished card may use this fallback until its initial reference selection.
- Each template/program workout stores `extraMinutes`: integer 0–60 inclusive, default 5; and `bufferPercent`: integer 0–50 inclusive, multiple of 5, default 10. Both are independently clearable to zero with native sliders. Program-level weekly goals do not own these settings.
- Execution time is fixed at 60 seconds per set; no execution-duration control, rep-dependent formula, supersets or transition-time model.

## Calculation and display

For every exercise, execution seconds = sets × 60 and rest seconds = sets × restSeconds. Count rest after every set, including the last set of each exercise.

For a nonempty workout:

```
baseSeconds = executionSeconds + restSeconds + extraMinutes * 60
bufferSeconds = baseSeconds * bufferPercent / 100
totalSeconds = baseSeconds + bufferSeconds
displayMinutes = ceil(totalSeconds / 60)
```

Sum precisely before rounding. Do not round individual exercises or buffer contributions in the calculation. Display the final total as `~N min`, including durations greater than an hour. Breakdown values may show minutes/seconds; any display rounding must not feed back into calculations.

Example: one 3-set compound exercise and one 3-set isolation exercise produce 6 minutes execution and 13.5 minutes rest. With 5 extra minutes and 10%, the total is 26.95 minutes, displayed `~27 min`.

An empty workout displays `~0 min`; allowances remain stored but contribute no displayed duration until an exercise exists. An unfinished exercise with valid sets contributes time even without a name or primary muscle. Invalid sets contribute zero execution/rest, consistent with volume's treatment of invalid sets; strict validation still blocks malformed saves/imports/exports as applicable. Timing inputs themselves must be valid in drafts as well as strict documents.

Totals and breakdown are derived, never stored. Reps, muscles, order, goals and collapsed state do not affect time.

## Editor and program UI

Follow `docs/design-system/README.md` and the compact desktop design. Retain dark palette, orange accent, Barlow typography, spacing tokens and normal document scrolling.

Place a compact Estimated duration summary near the session heading/name, showing `~N min`. An accessible disclosure expands an inline breakdown of Execution, Rest, Extra time and Buffer, with the Extra time and Buffer sliders. Use visible labels, meaningful percentage/minute readouts, keyboard operation, `aria-expanded` and predictable focus. Keep the summary visible while the disclosure is closed; disclosure state is transient.

Add a labeled Rest per set slider to expanded exercise cards and append the configured rest to collapsed summaries, without dropping existing summary content. Allow wrapping. The main exercise fields must remain readable when the additional slider requires another row.

Program workout cards show the same estimate as a small text label next to their existing metadata. Labels update after workout edits and survive reordering, day assignment and mode changes. Do not add interactive breakdown controls to program cards.

Leave both desktop body figures at their existing 180–200px heights. Preserve the volume panel, mobile pinned-panel behavior, stable readout, tooltips, collapse animation and all existing interactions. Native slider hit areas remain 44px everywhere; fine-pointer desktop compaction only applies without any coarse pointer. Touch/hybrid targets remain at least 44×44px. Support long names, errors, 200% text and reduced motion. Avoid announcing every slider movement through an additional live region; native slider values provide feedback.

## Persistence, copies and portable files

Persist only rest and session allowance inputs in existing document JSON. Extend constructors, validation/canonicalization, copies, editor imports, program workout extraction and updates so no timing fields are dropped. Deep copies preserve timing inputs independently. Existing save retry, conflict detection and Save as copy retain timing edits.

Missing timing properties in old saved documents and version-1/version-2 imports receive defaults. Default only absent fields: reject explicit nulls, strings, negatives, out-of-range values and invalid steps. Reject an invalid file as a whole. Normalize server reads for old documents without writing or incrementing revisions merely by opening them. Normalize before idempotency comparisons so old missing defaults do not cause false conflicts.

Continue version-2 exports with portable `restSeconds`, `extraMinutes` and `bufferPercent` included. Existing version-1 imports remain accepted. Classification and reference identifiers remain catalog metadata and are stripped from portable exports under the catalog design; importing a file preserves its explicit rest independently of reference identity. This extends the approved portable exercise shape to preserve timing. No new file version is required for optional additive fields; older app releases may discard these fields and are not guaranteed to preserve timing on re-export.

Classification is reference metadata returned with catalog reads, not part of saved workout snapshots or portable files. Updating a reference classification increments its reference revision and changes only future initial defaults; it does not rewrite existing workouts or their revisions. Moving a variant uses its destination reference for future initial defaults and preserves all existing workout prescriptions. Catalog impact previews and revision behavior otherwise remain as specified. Migration 004 adds nullable exercise_type to catalog_families. Explicit seed version 2 classifies unchanged, active starter references with missing types once; it never overwrites chosen classifications, renamed references or archives. No automatic production migrations or seeds during builds or requests. Duration inputs remain in document JSON.

## Verification and acceptance

Unit/integration coverage includes exact worked calculation, per-set final rest, zero rest/allowances, maximum inputs, fractional buffer, rounding only at the end, empty and unfinished workouts, invalid sets, constructors, legacy defaults, strict invalid-field rejection, JSON round trips, independent copies, server persistence/idempotency and conflict recovery.

Catalog integration coverage proves the two initial defaults from reference classification, shared defaults across variants, type-edit effects on future selections only, rest preservation on replace/link/move/definition propagation, and imported rest preservation. Browser coverage includes live slider updates, breakdown disclosure and focus, collapsed summaries, autosave/reload, program card labels in both modes/Unscheduled, copies and import/export.

Inspect populated screens at 1366×768, 1440×900 and 1920×1080, relevant mobile/tablet widths, 200% text and touch/hybrid input. Check overflow, body prominence, controls, keyboard behavior and existing volume/slider/collapse/tooltip regressions. Change authoritative visual values in `style.css` first and update `docs/design-system/README.md` in the same implementation change.

Run `npm run db:migrate` explicitly against development and the catalog's explicit seed command when required; run `npm test`, `npm run test:e2e` and `npm run build`. Never migrate production automatically.
