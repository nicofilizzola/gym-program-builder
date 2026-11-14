# Same-name variants verification

Plan: `docs/superpowers/plans/2026-11-12-same-name-variants.md`.
Spec: `docs/superpowers/specs/2026-11-12-same-name-variants-design.md`.
Executed on 2026-11-14–15 in managed worktree `b02f`, branch `feat/same-name-variants`.
Implemented locally; not deployed.

## Automated checks

- Baseline: `npm test`, 504 passing.
- Task 1: shared conflict, label and comparator tests failed before implementation, then passed. Full unit suite: 507 passing.
- Task 2: seven new server/migration/move tests failed before implementation, then passed. Full unit suite: 514 passing, including catalog and reference APIs.
- Task 3: grouping and search tests demonstrated incorrect ID-based ordering; browser checks demonstrated missing conflict focus. After implementation, 516 unit tests and 28 catalog/form/reference browser tests passed. Create and edit refusals retain name, brand and muscles without recovery buttons; creating from a variant succeeds after adding a focus tag; picker options announce tags.
- Task 4: recap and move preview tests failed on missing labels before implementation, then all 22 recap/reference browser checks passed.
- Final unit suite: 516 passing. Build: passed. Full browser suite: 706 passed, 7 skipped, 0 failed (13.8 minutes). The seven existing skips are regular phone tracker/note cases replaced by Focus coverage.
- A repeated final unit run stalled in the existing file-backed repository test. Stopped its owned processes; the isolated repository tests passed 3/3 and the full unit rerun passed 516/516. No repository behavior was changed.

## Migration rehearsal

Created a consistent copy of the existing local database with read-only SQLite `VACUUM INTO`; the source had migrations 1–9. Ran `npm run db:migrate` against the copy. Migration 010 appears exactly once and `catalog_family_name` is absent. Replayed the command and compared every migration record, including timestamps: unchanged. The original local database was not migrated.

Local original, preview and production migration 010: **pending**. Run explicitly in each environment; builds and requests never migrate.

## Name-only display audit

Ran `rg -n "\.name\b" src --glob '!*test*'` and inspected render candidates.

| Places | Result |
|---|---|
| `workout-recap.js` exercise rows | Apply labels over the complete workout on each render. |
| `reference-form.js` move destination preview | Sort all destination variants, label over that full reference, then take two. |
| `catalog-view.js`, `exercise-picker.js`, `session-editor.js` | Existing rows, suggestions and expanded/collapsed cards show brand/focus metadata. Keep their names and metadata. |
| `workout-logger-view.js`, `workout-focus-view.js`, `workout-overview.js` | Existing exercise cards, pinned groups and overview rows show tags. Preserve their accessible control names and metadata. |
| Exercise reorder/actions, confirmations, Focus context/partner/scrub/progress | Controls or contextual text for tagged exercise groups, not separate name-only variant lists. No new labels. |
| `app.js` breadcrumbs and catalog forms | A single selected variant with metadata in its page/form, not a collision list. |
| Home, History, start sheet, library, program view, workout bar | Lists name workouts/templates/programs, not exercise variants. |
| Tag view, equipment/muscle/volume panels | Names refer to tags, equipment or muscles, not variants. |
| Analysis projections, validators, model/edit/controller/file helpers | Data handling or AI inputs, not on-screen variant lists; explicitly unchanged. |

No additional name-only exercise lists required changes.

## Decisions and limits

- Commit on the worktree feature branch instead of the plan's `main`, following the user's explicit request.
- Register migration 010 in `server/db.js` because the runner uses a fixed migration list; update two existing migration-version expectations.
- Serialize each catalog repository's writes: installed libSQL rejects simultaneous in-memory transactions with `TRANSACTION_ACTIVE` and file transactions with `SQLITE_BUSY`. The regression test requires exactly one success and one duplicate-variant refusal. Database transactions remain the cross-process guard; real Turso concurrency is unverified.
- Preserve the existing accessible field label `Variant name`; the plan's `Exercise name` refers to that field's internal `exerciseName` name.
- No new style values were necessary; preserve existing layout and tokens.
- Tags screen usage counts, physical phones, production and deployment remain unverified.

## Browser inspection

Inspected catalog and open picker screenshots at 390×844 touch and 1366×768 fine-pointer/touch, each at default and 200% text. Three same-name variants remain adjacent (untagged, Hammer, Technogym), brand text wraps, and no page has horizontal overflow. Enlarged pickers scroll to reach remaining options. These are Chromium emulation checks, not physical-device verification.

## Independent branch review

Reviewed the complete acd71c2..19e9df5 diff and connected server, API, form, picker, metadata, propagation and recap flows. Review Focus 1–5 satisfied; no Critical, Important or Minor findings. Verdict: ready to merge.

The reviewer set aside unchanged contextual action and replacement-confirmation names. Decision: preserve these names because they are not independent collision lists and their surrounding selection flows already show tag metadata, as specified in §3. Cost if wrong: a future contextual wording adjustment.
