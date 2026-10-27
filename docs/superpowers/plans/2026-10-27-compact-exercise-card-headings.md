# Compact Exercise Card Headings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Native inline execution is recommended for this small, coupled UI change; delegate only if the user chooses delegation.

**Goal:** Make collapsed exercise cards a compact workout outline, identified by exercise name with secondary numbering and a prescription-only summary.

**Architecture:** Update the existing shared session editor and exercise picker rather than introducing a second card renderer. Derive headings and summary text from workout state; preserve transient collapse state and all catalog and persistence contracts.

**Tech Stack:** Vanilla JavaScript ES modules, CSS, Node test runner, Playwright. No new dependencies.

**Spec:** The agreed design below records the design approved in the conversation on 2026-10-27. Read it alongside `docs/design-system/README.md` and the repository AGENTS.md.

## Agreed design

- The user mostly works with collapsed cards. Prioritize scanning the workout and reducing redundant content.
- Replace the visible `Exercise 1` heading with a small muted `01` followed by the exercise name. Pad positions to at least two digits; positions above 99 remain complete.
- Show the full exercise name, preserving its case. Wrap long names; do not truncate, clip, or use a tooltip as the only way to read them. Blank/whitespace names display `Untitled exercise` without changing stored data.
- Use one semantic heading per card, at the level appropriate beneath the editor's existing headings. Its accessible text includes `Exercise 1` and the name, while the padded visual number is decorative. Duplicate names remain distinguishable by position.
- Collapsed summary: `3 Ã— 8â€“12 Â· Rest 3 min`. Equal rep bounds display `3 Ã— 8`; rest uses the existing duration formatter. Do not repeat the name or include muscle mappings in this summary.
- Retain the Primary/Secondary muscle-match tag when a muscle is selected, and retain `Needs fixing` on invalid collapsed cards.
- Keep Reorder, expand/collapse, and remove directly available. Order the main header as identity (number/name), muscle/error tags, then Reorder, toggle and remove. Controls and tags may wrap on narrow screens; prioritize readable names over squeezing everything onto one line.
- Expanded cards retain the same header identity without repeating the linked exercise name in the body. Keep the existing catalog action strip in the expanded body, along with equipment/archive metadata and muscle mappings. Custom exercises retain their labeled name input; that editable field is necessary even though its value also identifies the card above. New/unselected cards retain the labeled autocomplete and equipment filter.
- Catalog replacement keeps the current exercise name in the heading until an explicit selection succeeds; a search query is not a new exercise name. Cancellation leaves identity unchanged.
- Apply consistently to session templates and program workout editors through their shared editor. Program overview workout cards are outside scope.
- Preserve existing defaults: loaded/imported workouts start collapsed, newly added exercises start expanded, manual collapse state survives reorder. Do not persist disclosure state.
- No background numeral, new action menu, new inline rename interaction, or changes to catalog definitions, timing, volume, saves, or file formats.

## Global constraints

- Preserve dark surfaces, orange accent, Barlow typography, existing CSS tokens and component patterns.
- Small number: Barlow Condensed, 0.875rem, muted, tabular figures; name: Barlow, 1rem, weight 600, normal case. Use existing foreground/background tokens.
- Header identity uses `min-width: 0` and permits wrapping; no reserved drag gutter or fixed card height. Summary aligns with the name where space allows, without reserving excessive mobile width.
- Desktop 32px controls apply only at the established desktop fine-pointer breakpoint with no coarse pointer; touch/hybrid controls remain at least 44Ã—44px. Slider hit areas remain 44px everywhere.
- Preserve 200ms ease-out collapse and reduced motion, focus rings, top-layer tooltips/autocomplete, drag gestures and non-drag movement alternatives.
- Preserve visible labels and complete names at 200% text. Body figures remain at least 180px high on desktop.
- Change authoritative styles in `style.css`, then update `docs/design-system/README.md` in the same change.
- Do not run migrations or seed for this UI change. Required release checks: `npm test`, `npm run test:e2e`, `npm run build`.

## Current implementation facts

- `src/session-editor.js`: `CARD_HTML` owns `.card-head`; `renderExercises()` currently sets `.card-index` to `Exercise N`; `refresh()` updates derived text and validation without rebuilding inputs.
- `src/exercise.js`: `exerciseSummary(ex)` currently includes name and both muscle roles. Its only production caller is the session editor.
- `src/exercise-picker.js`: `mountExercisePicker(host, options)` renders the linked name, direct action strip, metadata, custom-link controls and autocomplete; its `display()` runs during refresh and catalog loads.
- `mountSessionEditor()` and `setWorkout()` already initialize all existing exercises collapsed. Add pushes `false`; import/reload uses `setWorkout()`.
- Both `src/app.js` and `src/program-view.js` mount the shared editor. No separate template/program card implementations are required.
- Existing drag tests target `.card-index`; keep that selector as the small visual position marker and add heading-surface coverage.
- An unrelated untracked plan exists at `docs/superpowers/plans/2026-10-24-program-week-sequence-updates.md`; leave it untouched and stage only task-owned files.

## File map

| File | Responsibility |
| --- | --- |
| `src/exercise.js` | Prescription-only summary formatting |
| `src/session-editor.js` | Semantic card identity, live heading refresh, header structure |
| `src/exercise-picker.js` | Optional suppression of duplicate linked name while retaining picker behavior |
| `style.css` | Compact number/name hierarchy and responsive wrapping |
| `docs/design-system/README.md` | Document the resulting card pattern |
| `test/exercise.test.js` | Exact summary behavior and malformed draft regressions |
| `e2e/session-editor.spec.js` | Identity, editing, collapse and keyboard behavior |
| `e2e/drag-reorder.spec.js` | Heading and summary drag surfaces; numbering after movement |
| `e2e/compact-desktop.spec.js` | Populated responsive layout coverage |
| `e2e/catalog.spec.js` | Existing real catalog flow coverage |

## Review focus

1. Very long or duplicate names: complete readable headings, distinct position context, reachable controls (Task 2).
2. Custom drafts and blank names: heading tracks committed edits without focus loss; accessible fallback remains clear (Task 2).
3. Replacement, variant creation and refreshed catalog definitions: heading matches saved snapshot, not query text or stale picker markup (Task 2).
4. Reordering mixed expanded/collapsed cards: positions update while focus, identity and disclosure state remain attached to the right exercise (Task 2).
5. Touch/hybrid and enlarged text: wrapping preserves full targets and avoids page overflow (Task 3).

## Task 1: Make collapsed summaries prescription-only

**Files:** Modify `src/exercise.js`; test `test/exercise.test.js`.

**Interfaces:** Preserve `exerciseSummary(ex: Exercise): string`; return only sets/reps and configured rest. Keep existing missing-rest fallback and defensive numeric display.

- [x] Update summary tests to assert exact output: 3 sets, reps 8â€“12, rest 90 seconds â†’ `3 Ã— 8â€“12 Â· Rest 1 min 30 sec`; equal reps 8 and rest 180 â†’ `3 Ã— 8 Â· Rest 3 min`; default exercise â†’ `3 Ã— 8â€“12 Â· Rest 2 min`.
- [x] Preserve malformed draft coverage: invalid sets display `?`, invalid rep bounds display `?`, inverted bounds retain their existing defensive display. Assert changing only name or muscle mappings does not change the prescription summary.
- [x] Run `node --test test/exercise.test.js`; confirm new exact-output assertions fail against the old summary.
- [x] Update `exerciseSummary()` and its comment to emit the agreed prescription string using existing numeric/duration formatters.
- [x] Run `node --test test/exercise.test.js`; expect all tests to pass.
- [x] Commit only these files with `refactor: focus collapsed exercise summaries on prescription`.

## Task 2: Make exercise identity the card heading

**Files:** Modify `src/session-editor.js`, `src/exercise-picker.js`, `style.css`; test `e2e/session-editor.spec.js`, `e2e/drag-reorder.spec.js` and `e2e/catalog.spec.js`.

**Interfaces:** Keep `mountSessionEditor(root, options)` public API unchanged. Add `showLinkedName = true` to `mountExercisePicker(host, options)`; shared cards pass `false`. Other callers preserve current behavior. No mutation or export schema changes.

- [x] Add browser coverage asserting initial cards are collapsed, heading accessible text includes position and name, visual index is `01`, summary is prescription-only, and empty/whitespace names show `Untitled exercise`. Verify duplicate names still have distinct positional context.
- [x] Add coverage for custom name edits updating the heading without replacing/focusing another input, add staying expanded, and imported/reloaded exercises staying collapsed. Assert pure disclosure changes do not change serialized workout data.
- [x] Extend catalog flow coverage: linked name is visible once in an expanded card; Replace exercise, Create variant and View in catalog remain available; replacement search/cancel preserves the old heading; successful selection/variant creation updates it. Exercise an external catalog rename through the existing revision-aware reload path and verify the new snapshot heading appears after acceptance, preserving dirty-conflict behavior.
- [x] Extend drag/movement coverage: drag from the exercise-name heading and prescription summary; reorder a mixed collapsed/expanded list; assert visual indices update, names remain matched to prescriptions, collapsed state follows each exercise, and keyboard movement retains focus. Preserve existing `.card-index` drag cases.
- [x] Run the changed Playwright files with `npx playwright test e2e/session-editor.spec.js e2e/drag-reorder.spec.js` e2e/catalog.spec.js; confirm the new identity assertions expose the current behavior.
- [x] Replace generic header text with semantic heading markup containing `.card-index` (decorative padded number), visually hidden unpadded positional context, and a dedicated `.card-name`. Keep tags outside the heading. Assign a stable heading ID per card and associate the card with it using `aria-labelledby`.
- [x] Update heading name in `refresh()` from `ex.name.trim() || 'Untitled exercise'` using `textContent`; update position during `renderExercises()`. Refresh does not recreate inputs or steal focus. Test a name containing literal `<` and `&` renders as text.
- [x] Implement `showLinkedName` in the picker so `display()` respects it on every load/refresh. Suppress only the duplicate linked-name node; preserve action strip, metadata, search labels, custom name input and focus restoration.
- [x] Add header identity styles in `style.css` using the agreed typography. Retain existing drag eligibility, action sizes, muscle/error tags, animations and expanded-body layout. Allow actions to wrap intact rather than compress targets.
- [x] Run the changed Playwright files; expect all tests to pass, including selection/cancellation and keyboard-focus regressions.
- [x] Commit task-owned source, styles and tests with `feat: identify workout cards by exercise name`.

## Task 3: Validate compact layouts and document the pattern

**Files:** Modify `e2e/compact-desktop.spec.js` and `docs/design-system/README.md`; adjust `style.css` only for observed layout failures.

**Interfaces:** No new runtime API. Use existing populated editor fixtures and pointer emulation conventions.

- [x] Extend populated layout fixtures with short, duplicate and long/unbroken exercise names, 12 cards, a muscle-match tag and an invalid collapsed card. Cover both all-collapsed and a mixed expanded/collapsed list. Use a linked-card fixture as well as custom cards so hidden duplicate names and catalog actions are exercised.
- [x] Add assertions for no horizontal document overflow, complete readable names, reachable controls and target dimensions: desktop fine-pointer controls at least 32px; touch/hybrid at least 44Ã—44px; slider hit areas at least 44px. Ensure the body figures retain their existing desktop height of at least 180px.
- [x] Inspect populated template and program-workout screens at 1366Ã—768, 1440Ã—900 and 1920Ã—1080; mobile 390Ã—844 and tablet 768Ã—1024; repeat relevant layouts at 200% text and with touch/hybrid input. Capture screenshots for review. Check long names, action wrapping and muscle/error tags in both disclosure states.
- [x] Compare collapsed-card height to the pre-change fixture at identical width/font/data. Confirm the summary removes repeated identity/muscles and that ordinary short-name cards do not grow. Avoid forcing a fixed height or hiding actions to achieve a numeric density target.
- [x] Check collapse/expand, bulk controls, refused-export reveal/focus, autocomplete overlays, catalog action tooltips and reorder options with keyboard and reduced motion. Use existing tests where they already cover these behaviors.
- [x] Fix observed CSS issues first, then document name-led headings, secondary numbering, prescription-only summaries, wrapping, expanded linked-action placement and disclosure defaults in `docs/design-system/README.md`. Update any old text that requires generic `Exercise N` headings or muscle summaries.
- [x] Run `npm test`, `npm run test:e2e`, and `npm run build`; require successful exits. Review `git diff --check` and the final diff for unintended schema/persistence changes.
- [x] Commit task-owned documentation/layout updates with `test: verify compact exercise card layouts`.

## Completion criteria

The shared editor presents name-led cards with small positional numbers and prescription-only collapsed summaries. Saved workouts remain collapsed by default; all existing editing, catalog, muscle highlight, timing, save, import/export and movement behaviors pass their regression checks. Document the actual checks and any unresolved limitation in the implementation handoff; do not publish or deploy as part of this plan.


## Execution record (2026-10-27)

Implemented natively on `compact-exercise-card-headings`. All three tasks are complete.

- Summary assertions failed against the old summary, then passed; heading assertions failed against the original renderer, then passed.
- `npm.cmd test`: 141 passing.
- `npm.cmd run test:e2e`: 158 passing, including populated layout, touch/hybrid, 200% text, catalog refresh/conflict, recovery and reordering checks.
- `npm.cmd run build`: passed. `git diff --check`: passed.
- Compared identical short-name collapsed fixtures using original main sources and current sources: 105.1875px before, 83.1875px after at 1366, 1440 and 1920px desktop widths (about 21% shorter).
- Inspected populated screenshots for template/program editors across the required desktop widths, phone/tablet, enlarged text and touch. Mobile names occupy a full row; prescription aligns beneath the name. Screenshots and density measurements remain in `.superpowers/compact-headings/` (ignored local artifacts).
- A fresh final reviewer found no Critical, Important or Minor issues. Manual screen-reader behavior was not independently tested; accessible heading/position and keyboard behavior are covered by browser tests.
- Used a feature branch in the current checkout to keep the work visible in the shared workspace. Other untracked plans were left untouched. Program overview cards and existing mobile volume-panel placement remain outside this change.
- No push, merge, deployment, migration or seed was performed.
