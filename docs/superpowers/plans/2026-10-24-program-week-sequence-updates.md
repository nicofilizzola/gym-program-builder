# Program Week and Sequence Updates Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking. Implementation is a separate phase from this planning request.

**Goal:** Simplify program cards, make Week the default for new programs, animate layout switches, and support persistent rest days in Sequence.

**Architecture:** Keep session data in `program.workouts` and weekday assignments on each workout. Add an optional sequence of workout references and rest entries, with pure operations maintaining its relationship to canonical workout order. Reuse existing sortable, action-tooltip, transition, validation, and autosave infrastructure; weekly volume continues to count workouts only.

**Tech Stack:** Plain JavaScript ES modules, CSS, inline SVG, Node.js 24, SQLite/libSQL, node:test, Playwright. No new dependencies.

**Spec:** Requirements and confirmed product decisions below; existing constraints in `docs/design-system/README.md`, `docs/superpowers/specs/2026-10-24-compact-desktop-design.md`, and `docs/superpowers/specs/2026-10-23-programs-persistence-design.md` continue to apply.

## Requirements and product decisions

1. Rename the program's Sequence list heading from `Session templates` to `Sessions`. Keep library navigation and template-picker terminology unchanged.
2. Remove session-card Move up and Move down buttons. Preserve drag handles and keyboard reordering.
3. Animate Week ↔ Sequence changes in both directions, scoped to the session area. Reuse the existing 75 ms fade-out / 100 ms fade-in, ease-out transition; reduced motion switches immediately. Keep the weekly volume panel steady.
4. Replace the Edit text button with a pencil icon button using existing action-button sizing and tooltip behavior. Accessible name remains `Edit {session name}`.
5. Remove the session-card Day select in Week. Mouse/touch users move between day groups with drag-and-drop. Provide keyboard day movement through the handle, described below.
6. Selector order and copy: `Week`, then `Sequence`. Keep internal mode values `schedule` and `simple`. New programs default to `schedule`; existing saved/imported modes remain unchanged. Newly added sessions remain Unscheduled until assigned.
7. Sequence has an `Add rest day` button. It appends one compact `Rest day` card, immediately focusable for reordering. Rest cards can be dragged among sessions or moved with handle arrow keys and removed with an icon button. No custom rest names, exercise editor, duplicate action, or volume contribution. Leading, trailing, consecutive rests and rest-only programs are allowed.
8. Rest cards are saved, hidden in Week, and restored on returning to Sequence. Switching layouts never translates rests into weekdays or changes existing day assignments.
9. Removing a rest card is immediate; restore focus to the next sequence handle, previous handle, or Add rest day. Session removal keeps its existing confirmation.

## Global constraints

- Keep the dark palette, orange accent and Barlow typography; reuse existing component patterns.
- Compact 32px controls apply only on desktop with a fine primary pointer and no available coarse pointer. Touch/hybrid controls retain at least 44×44px targets.
- Desktop body figures remain 180–200px tall. Preserve weekly panels, highlighting, goal semantics and mobile placement.
- Persist complete drafts through existing revision-protected server saves; no browser persistence mirror or transient animation state in saved documents.
- Existing version-1 session and version-2 template/program files remain importable. Reject malformed new sequence data as a whole.
- Only index.html, style.css and browser src assets may be published.
- Run npm run db:migrate explicitly; never migrate production automatically during builds/requests.
- No implementation, deployment or production data migration is authorized by this planning deliverable.

## Review focus

- Legacy programs with no sequence field retain their saved mode, order and weekday assignments.
- Mixed session/rest ordering survives duplication, removal, Week reordering, save/reload and file round trips without dangling references.
- Rapid layout switches, navigation and server updates during a fade settle on the newest view with usable focus and no stale inert/opacity state.
- Removing day selects leaves a discoverable keyboard path to all seven days and Unscheduled.
- Rest-only programs, long names, 200% text and hybrid touch input remain usable without changing volume or hiding body figures.

## Data and interaction contracts

Use an optional `program.sequence` array:

```js
// Internal persisted format:
[{type:'workout', workoutId:'a'}, {type:'rest', id:'r1'},
 {type:'workout', workoutId:'b'}]
```

Absence means the legacy workout-only sequence. An explicit sequence must reference every workout exactly once, have no unknown references, and have its workout references in the same order as `program.workouts`. Rest IDs must be nonempty unique strings, disjoint from workout IDs. Reject invalid entries in both strict and draft validation; only names and primary muscles retain the existing draft relaxations. Avoid adding an empty sequence in createProgram: existing tests/callers sometimes construct fixtures by spreading it and supplying workouts.

Expose these pure helpers from a focused `src/program-sequence.js` module:

- `getSequence(program) -> SequenceEntry[]`: return a deep independent explicit sequence, or synthesize workout entries for legacy programs.
- `addRestDay(program, restId) -> Program`: materialize sequence and append a rest entry, rejecting duplicate IDs.
- `removeRestDay(program, restId) -> Program`: remove only that rest entry; missing IDs are an error.
- `placeSequenceEntry(program, key, {beforeKey = null}) -> Program`: move a rest/session entry before another, or append; update canonical workouts to match the workout-reference subsequence; preserve all day assignments. Keys are workoutId or rest id.
- `reconcileSequence(program) -> Program`: after a workout-list mutation, retain rest entries at their current absolute sequence slots, refill workout slots in canonical workout order, remove surplus workout slots, and append extra workouts. Legacy programs without rests/sequence remain legacy. This deterministic policy also governs Week reordering; switching views alone never calls it to reorder anything.

Call reconciliation after existing add, duplicate, remove and Week placement operations. Sequence moves use placeSequenceEntry directly. Program duplication remaps all workout references and rest IDs using the supplied ID factory.

Portable version-2 JSON keeps existing workout objects without IDs. When a sequence exists, serialize workout references as `{type:'workout', workoutIndex:0}` (zero-based), and rest entries as `{type:'rest'}`. Parse allocates fresh workout and rest IDs, resolves indices, and then validates the entire document. Missing sequence remains a legacy file. Invalid types, out-of-range/noninteger indices, duplicate/missing workout references or incompatible reference order reject the whole file. Old clients cannot preserve this additive field: document that imports into older app versions lose explicit rest days; no claim of forward compatibility.

Keyboard contract: Up/Down on a handle reorder within its current Week group or the mixed Sequence list. Alt+Up/Alt+Down in Week move a session to the previous/next group in Monday…Sunday, Unscheduled order, appending in the destination; endpoints are no-ops. Explain shortcuts in visible Week helper text and attach that text to handles with aria-describedby. Restore focus to the moved handle and announce destination through the existing polite live region. Do not intercept ordinary arrows on other controls.

## Task 1: Add rest-day domain operations and preserve canonical ordering

**Files:** Create `src/program-sequence.js`; modify `src/program.js`; test `test/program.test.js`, new `test/program-sequence.test.js`, `test/program-volume.test.js`.

**Interfaces:** Produces the four helpers plus reconciliation specified above. Existing moveWorkout/placeWorkout signatures remain stable; duplicateProgram remaps references and rests. createProgram changes only its mode default to schedule.

- [x] Write node:test cases with assertions for: new mode schedule; legacy getSequence yielding a,b; add rest producing a,b,r; move r before b producing a,r,b; moving b before a producing b,a,r and workout order b,a; all days unchanged; add/remove/duplicate reconciliation; rest-only and consecutive rests; rejection of invalid IDs/anchors; no input mutation or shared nested copies.
- [x] Pin reconciliation with a,r,b reordered in Week to b,a: result b,r,a. Removing b leaves a,r. Adding c to a,r,b yields a,r,b,c. Duplicate a yields a,r,a-copy,b under the fixed-slot policy. Verify duplicateProgram remaps every reference and rest ID, preserving days and deep independence.
- [x] Add a volume regression: adding/reordering/removing rests leaves every direct/indirect total and contributor count unchanged, including unscheduled workouts.
- [x] Run `node --test test/program.test.js test/program-sequence.test.js test/program-volume.test.js`; confirm new assertions fail before implementation.
- [x] Implement the module and integrate reconciliation into existing domain mutations. Keep workout payloads unchanged and avoid cyclic imports: the sequence module operates on plain program objects.
- [x] Run the same tests and confirm PASS. Commit as `feat: model sequence rest days and default new programs to week`.

## Task 2: Validate, persist and round-trip rest days

**Files:** Modify `src/document-validation.js`, `src/document-file.js`; test `test/document-validation.test.js`, `test/document-file.test.js`, `test/repository.test.js`, `test/api.test.js`.

**Interfaces:** validateDocument retains its `{document}` / `{error}` result and draft option, now preserving valid internal sequence data. serializeDocument/parseDocument retain version 2 and implement the portable mapping above. Repository/API continue using the shared validator and existing revision checks.

- [x] Add tests that legacy documents with simple and schedule modes validate without mode conversion, strict/draft documents retain rests, rest-only programs validate, and malformed sequence arrays/references/order fail atomically. Include duplicate rest IDs and collisions with workout IDs.
- [x] Add file tests for mixed/rest-only round trips, fresh IDs on repeated import, unchanged version-1 sessions/version-2 templates/legacy programs, 1 MiB limit, invalid indices and missing workout references. Assert portable sequence has indices and no internal IDs.
- [x] Add repository/API tests saving and reading mixed/rest-only drafts, unchanged revision conflict behavior, and rejected sequence writes leaving stored data/revision untouched.
- [x] Run `node --test test/document-validation.test.js test/document-file.test.js test/repository.test.js test/api.test.js`; confirm new cases fail.
- [x] Implement validation and conversion. Existing JSON document storage requires no table migration. Leave old records untouched on read; sequence can materialize on the first rest edit. Save-as-copy must use the updated duplication/remapping path.
- [x] Run the same tests and confirm PASS. Commit as `feat: persist and export program sequence rest days`.

## Task 3: Simplify program controls and render accessible mixed sequences

**Files:** Modify `src/program-view.js`, `src/action-controls.js`, `style.css`, `docs/design-system/README.md`; update `e2e/programs.spec.js`, `e2e/drag-reorder.spec.js`, `e2e/program-overview.spec.js`; create `e2e/program-sequence.spec.js`.

**Interfaces:** Consumes sequence helpers from Task 1. Keep `.workout-item` and data-workout selectors for real sessions only; use `.sequence-rest-item` and data-rest for rests, and a shared data-sequence-key for sortable keys. Edit retains data-edit and accessible action name for return-focus behavior.

- [x] Add browser assertions for selector Week then Sequence; new program Week checked; existing saved Sequence retained; Sessions heading; no session Move up/Move down or Day select; Edit SVG with accessible name and hover/focus tooltip. Update existing tests that operate removed controls to use handles or pointer dragging.
- [x] Add tests for Add rest day shown only in Sequence, append/focus behavior, mouse/touch/keyboard moves around sessions, rest removal focus, consecutive/leading/trailing/rest-only states, Week hiding rests and round-trip restoration, unchanged volume/highlighting and template independence.
- [x] Add keyboard tests for Week Up/Down reordering and Alt+Up/Down across empty/nonempty days and Unscheduled. Assert focus retention, destination announcements, boundary no-ops and visible shortcut instructions.
- [x] Run `npx playwright test e2e/programs.spec.js e2e/drag-reorder.spec.js e2e/program-overview.spec.js e2e/program-sequence.spec.js`; confirm new behavior assertions fail.
- [x] Implement Week-first markup, scoped Sessions copy, pencil actionIcon, icon-only Edit matching Duplicate/Remove, removed controls, and mixed Sequence rendering. Reuse existing mountSortable with shared entry keys in Sequence; preserve existing Week groups and empty 44px drop targets. Rest cards use neutral surfaces, text and handle/remove controls, with no fake exercise metadata or muscle-match marker.
- [x] Route all session additions, copies and removals through reconciliation. Keep editor updates from deleting sequence data. Implement the keyboard contract and focus/live announcements; do not remove shared move icons still used by the session editor.
- [x] Add compact rest/action styling in style.css first and document exact UI/control behavior in the design-system README in the same change. Long names and enlarged text must wrap; hybrid devices keep touch sizes.
- [x] Run the targeted browser suite and `npm test`; confirm PASS. Commit as `feat: simplify program cards and add sequence rest controls`.

## Task 4: Animate layout switches with cancellation-safe lifecycle

**Files:** Modify `src/program-view.js`; reuse `src/view-transition.js` unchanged unless a demonstrated test requires a shared fix; update `e2e/navigation-transitions.spec.js`, `e2e/program-sequence.spec.js`, `docs/design-system/README.md`.

**Interfaces:** A separate createViewTransition instance owns only data-workouts. Its lifecycle must not conflict with the existing overview/editor transition. Mode changes update the data and selected radio immediately; deferred commits read the newest value.

- [x] Add browser tests for both directions using a populated mixed program: session area opacity animation occurs; weekly panel is not animated/rebuilt; mode/day/order/rest data are preserved; radio retains focus. Reduced-motion mode has no layout-switch animation.
- [x] Add rapid Week→Sequence→Week, add/remove during transition, editor navigation, mounted update and destroy cases. Assert newest layout wins, no lost edits, no orphaned sorting artifacts, and no stuck opacity or inert state. Avoid timing-only sleeps: await animation lifecycle or final UI conditions.
- [x] Run `npx playwright test e2e/navigation-transitions.spec.js e2e/program-sequence.spec.js`; confirm new animation expectations fail.
- [x] Integrate dedicated cancellable swaps with the helper's 75/100 ms ease-out fade. Disable interaction only in the changing session area during the swap; keep selector usable for reversal. Cancel/reconcile a pending layout swap before immediate list rebuilds, editor navigation, update and destroy. Restore usable interaction in completion and cancellation paths. Initial render and ordinary edits must not trigger this layout fade.
- [x] Document timing and reduced-motion behavior. Run the targeted suite and confirm PASS. Commit as `feat: animate program week and sequence switches`.

## Task 5: Verify complete programs, recovery and responsive behavior

**Files:** Update `e2e/persistence.spec.js`, `e2e/recovery.spec.js`, `e2e/import-export.spec.js`, `e2e/compact-desktop.spec.js`, `e2e/layout-polish.spec.js` as needed; add a concise verification record to this plan after execution.

**Interfaces:** Exercises the final browser UI and existing persistence/recovery API; introduces no new product interface.

- [x] Add end-to-end mixed-sequence autosave/reload and export/import checks, including saved Sequence mode and preserved weekdays. Exercise save failure/Retry and revision conflict Save as copy with rests; assert all references resolve and no data is lost. Run relevant cases before fixing any discovered integration failures.
- [x] Inspect populated Week and Sequence at 1366×768, 1440×900 and 1920×1080, plus 390×844 mobile and 820×1180 tablet. Include multiple sessions per day, Unscheduled, rests and long names. Verify body prominence, no horizontal overflow, normal scrolling, tooltip positioning, actions and weekly panel fallback.
- [x] Check 200% text, keyboard-only interaction, reduced motion, coarse touch and hybrid input. Assert computed action targets are at least 44×44px on touch/hybrid and desktop figures at least 180px; confirm mobile weekly panel behavior and native sliders remain unchanged.
- [x] Run `npm run db:migrate` against the isolated local test/development database explicitly, then `npm test`, `npm run test:e2e`, and `npm run build`. Expected: all commands exit 0. Never target production or add a migration hook to build/request paths.
- [x] Inspect the diff and built assets for unintended library terminology changes, removed session-editor controls, secrets, new dependencies or transient persisted state. Record actual commands, browser checks and any remaining limitations; do not claim unrun checks.
- [x] Commit verification/test updates as `test: verify week and sequence rest-day workflows`. Implementation is reviewable when all checks pass; publishing remains a separate action.

## Planning self-review

All seven requested changes map to Tasks 1–4; Task 5 covers cross-feature persistence and responsive verification. Each review-focus risk has explicit owning tests. The additive sequence contract isolates rest data from workout volume and retains legacy modes. Week reordering and mixed-list synchronization have one deterministic policy. No schema migration, frontend dependency, production write or unrelated UI restyle is required.

## Execution verification

Completed 2026-10-25 on `feat/program-week-sequence`. All 108 unit tests and 91 browser tests pass; explicit isolated local migration and static build pass. See [verification record](../verification/2026-10-25-program-week-sequence.md) for viewport/input checks, compatibility and implementation decisions.
