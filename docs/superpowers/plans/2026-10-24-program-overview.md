# Program Overview Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task, or superpowers:subagent-driven-development if the user chooses delegation. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Ship a cohesive program toolbar and an interactive weekly body heatmap that highlights contributing workouts.

**Architecture:** Keep `mountProgramView` responsible for program mutations and workout cards; extend `mountVolumePanel` to own the weekly map and transient muscle interaction state. Reuse `bodySvg` and existing CSS tokens, adding a weekly heat calculation in `program-volume.js`. A presentation-only callback passes the effective muscle to the workout cards without invoking autosave.

**Tech Stack:** Vanilla JavaScript ES modules, native HTML controls and SVG, CSS, Node.js 24 node:test, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-24-program-overview-design.md` (agreed conversation decisions).

## Global Constraints

- Weekly goals remain 0.5–30 by 0.5, with zero clearing a goal.
- Session thresholds and its legend remain unchanged.
- Preserve canonical order and day assignments when switching modes.
- Hover, focus and selection never trigger autosave and are never exported or persisted.
- No schema changes, migrations, browser persistence, dependencies, framework, authentication changes or import/export format changes are needed.
- Preserve unrelated working-tree changes in package.json and package-lock.json.
- Do not run a production migration or publish as part of this change.

## Review Focus

1. Crossing body regions, rows and blank panel space must cancel stale hover/fade callbacks and restore selection after 150ms (Task 3).
2. Duplicating, moving, deleting and assigning workouts while a muscle is selected must retain correct highlights, counts and canonical order (Task 4).
3. Import replacement or navigation during a pending hover/fade must leave no stale callbacks, highlights or document mutations (Tasks 3–4).
4. Empty and incomplete programs, zero-volume muscles and secondary-only contributors must keep valid counts, selection and heat levels (Tasks 1, 3–4).
5. Toolbar wrapping, panel growth and long workout names must not overflow or remove focus indicators at mobile widths or enlarged text (Tasks 2, 5).

## File map and implementation boundaries

| File | Responsibility |
| --- | --- |
| `src/program-volume.js` | Add weekly-only heat bands and heat level function; retain volume/count calculations. |
| `src/program-view.js` | Render toolbar and native layout radios; apply muscle highlights to workout cards. |
| `src/volume-panel.js` | Render weekly figures/legend; coordinate map, rows, readout and interaction callbacks. |
| `src/body.js`, `src/session-markup.js`, `src/session-editor.js`, `src/volume.js` | Reuse existing interfaces/markup as references; no change expected. |
| `style.css` | Scoped program toolbar, segmented controls and workout highlight styling; reuse body styles. |
| `test/program-volume.test.js` | Threshold boundaries and weekly aggregation invariants. |
| `e2e/programs.spec.js` | Update schedule selectors and retain existing persistence/independence regression. |
| `e2e/program-overview.spec.js` (new) | Toolbar, heatmap, highlight, lifecycle and responsive checks. |
| `AGENTS.md` | Replace outdated exclusion of weekly heatmap with agreed weekly thresholds. |

Prefer these focused extensions over extracting the entire session editor or introducing a second interaction framework. Keep all DOM queries scoped to the mounted root.

### Task 1: Add the weekly heat scale

**Files:** Modify `src/program-volume.js`, `test/program-volume.test.js`.

**Interfaces:**
- Consumes: `computeProgramVolume(program) -> Record<string, number>` and existing `heatLevel(volume)` from `src/volume.js` for regression checks.
- Produces: `WEEKLY_HEAT_BANDS = Object.freeze([6, 12, 18])`; `weeklyHeatLevel(volume: number) -> 0 | 1 | 2 | 3 | 4`.

- [x] **Step 1: Add failing boundary assertions** to `test/program-volume.test.js`:

```js
test('weekly heat uses weekly boundaries without changing session heat', () => {
  for (const [volume, expected] of [[0,0],[0.5,1],[6,1],[6.5,2],
    [12,2],[12.5,3],[18,3],[18.5,4],[30,4],[100,4]]) {
    assert.equal(weeklyHeatLevel(volume), expected);
  }
  assert.equal(heatLevel(3.5), 2);
  assert.equal(heatLevel(9.5), 4);
});
```

Import the two heat functions from their respective modules. Extend the existing aggregate test with `weeklyHeatLevel(v.Chest) === 3` for its 14-set example and assert all heat levels are unchanged when only weekly goals change. Include a secondary-only 0.5-set contributor and an empty program.

- [x] **Step 2: Run** `node --test test/program-volume.test.js`; expect failure because `weeklyHeatLevel` is not exported.
- [x] **Step 3: Implement** the exports in `src/program-volume.js`: zero or negative volume maps to 0; otherwise one plus the count of weekly upper limits exceeded. Keep the session function unchanged.
- [x] **Step 4: Run** `node --test test/program-volume.test.js test/volume.test.js`; expect all tests to pass.
- [x] **Step 5: Commit** only the Task 1 files as `feat: add weekly body heat thresholds`.

### Task 2: Make the program toolbar consistent and responsive

**Files:** Modify `src/program-view.js`, `style.css`, `e2e/programs.spec.js`; create `e2e/program-overview.spec.js`.

**Interfaces:**
- Consumes: `value.mode` (`simple | schedule`) and existing `emit()` / `renderWorkouts()` closures.
- Produces: native `Program layout` radio group with options `Sequence` and `Monday–Sunday`; existing import/export `data-*` hooks remain intact.

- [x] **Step 1: Add browser coverage** named `program toolbar groups file actions and switches layouts accessibly`. Sign in using the existing test-password flow, create a named program, and assert:
  - `getByRole('group', {name:'Program layout'})` contains the two labelled radios, Sequence initially checked.
  - Checking Monday–Sunday displays all seven day sections and Unscheduled; checking Sequence restores the single ordered list.
  - Import program and Export program are siblings in `.program-file-actions`, each with one decorative SVG; labels remain accessible.
  - At 1280px and 375px, toolbar bottom to `.program-grid` top is at least 24px, and document width does not exceed viewport width. Repeat with a visible import error.
  - Both options work by keyboard with visible focus and native radio arrow-key behavior.

Update the old checkbox selectors in `e2e/programs.spec.js` to radio `.check()` calls, using Sequence rather than `.uncheck()`.
- [x] **Step 2: Run** `npx playwright test e2e/program-overview.spec.js e2e/programs.spec.js`; expect missing radio-group assertions to fail.
- [x] **Step 3: Implement toolbar markup and mode event handling** in `renderOverview()`. Use a `fieldset`/`legend` named Program layout and `name="program-layout"` radios whose values are `simple` and `schedule`. A change on the checked option updates mode, emits once and rerenders workouts without rebuilding the toolbar. Preserve all day assignments.
- [x] **Step 4: Add scoped CSS** for `.program-toolbar`, `.program-layout`, `.program-file-actions`. Use 8px action gaps, 16px between groups, 24px bottom spacing, 44px minimum controls, existing tokens and clear checked/hover/focus states. Copy SVG paths from the session Import/Export controls; set SVGs to 20px and `focusable="false"`. Let the file group wrap if necessary on very small widths. Do not alter the global session `.toolbar` rule.
- [x] **Step 5: Run** the Task 2 browser command; expect both files to pass, including saved schedule/day assignments after reload.
- [x] **Step 6: Commit** only Task 2 changes as `style: align program toolbar with app controls`.

### Task 3: Mount the weekly map and coordinate muscle interactions

**Files:** Modify `src/volume-panel.js`; extend `e2e/program-overview.spec.js`.

**Interfaces:**
- Consumes: `bodySvg(view: 'front' | 'back') -> string`, `weeklyHeatLevel(volume)`, and the existing `update({volume,split,goals,contributorCount})` panel contract.
- Produces: an optional mount option `onMuscleFocusChange(muscle: string | null) -> void` for effective hover/focus/selection changes. Retain `onMuscleSelect` for selection changes only, and existing `update` / `destroy` methods.
- Callback rule: notify only when the effective muscle changes, including clearing it; data updates alone do not invoke a document mutation. Keyboard preview takes the same transient position as hover; clicking still pins/toggles selection.

- [x] **Step 1: Add failing browser checks** named `weekly body heat is independent from goals` and `map and rows share muscle interaction`. Use deterministic version-2 program imports via `[data-file]` (reuse the format in `src/document-file.js`; no live account data). Assert:
  - Both figures render and all twelve unique muscle names occur; Side delts occurs in both figures.
  - A 7-set Chest has heat 2 in every Chest region; setting Chest weekly goal to 30 changes the bar to under but leaves heat 2.
  - Legend text matches exactly `0`, `0.5–6`, `6.5–12`, `12.5–18`, `18.5+`.
  - Clicking a region selects its row (`aria-pressed=true`), clicking that row clears both; tapping works with touch emulation.
  - Focusing a row previews its weekly readout; Enter/Space toggle selection and blur restores selected subject or hint.
  - An empty program has twelve heat-0 muscles; selecting a zero-volume map muscle shows its zero readout while its irrelevant row stays hidden.
- [x] **Step 2: Add lifecycle browser checks** with `page.emulateMedia({reducedMotion:'no-preference'})` for hover grace and fading. Move Chest → blank panel space → Lats within 150ms and assert the newest subject wins; leave the panel and assert selection/hint returns. Keep a second test under default reduced motion. Assert current-subject weekly goal changes update text immediately. Navigate to a workout while a fade is pending and assert no page errors or delayed DOM writes.
- [x] **Step 3: Run** `npx playwright test e2e/program-overview.spec.js`; expect map assertions to fail.
- [x] **Step 4: Render figures instead of removing them** in `mountVolumePanel`. Populate the existing body container using the same figure/caption pattern as the session editor. Replace only this mounted panel's legend labels with the weekly labels. Update `data-heat` on `.region` elements with `weeklyHeatLevel` and use existing `.is-focus`, `.is-selected`, `.has-selection` styles. Retain current weekly goal sliders and bar behavior.
- [x] **Step 5: Unify delegated panel event handling** for regions and row buttons, resolving `closest('.region, .volume-row')` within the panel. Track selected, previewed and effective muscles; cancel stale hover timers on entry, and begin grace on exit to non-muscle space (not just panel exit). Keep pointer preview mouse-only. Use native row click activation for keyboard selection and focusin/focusout for preview. Crossfade callbacks read the newest subject/data. Preserve `onMuscleSelect`, emit `onMuscleFocusChange` only for effective changes, and cancel timers on destroy. Keep figures/legend `aria-hidden`; rows carry the accessible values.
- [x] **Step 6: Change the hint** to `Tap a muscle to highlight its workouts.` and run `npx playwright test e2e/program-overview.spec.js`; expect all panel interaction tests to pass. Inspect an ordinary session to confirm its figures, heat bands and tooltip behavior still use the existing implementation.
- [x] **Step 7: Commit** Task 3 changes as `feat: add interactive weekly body heatmap`.

### Task 4: Highlight contributing workouts without changing program state

**Files:** Modify `src/program-view.js`, `style.css`; extend `e2e/program-overview.spec.js`.

**Interfaces:**
- Consumes: Task 3 `onMuscleFocusChange(muscle)` and existing `contributingWorkouts(program,muscle)` membership semantics.
- Produces: closure `highlightedMuscle: string | null`; `updateWorkoutHighlights() -> void` applies `.is-muscle-match` and a visible `Trains {muscle}` marker to matching `.workout-item` elements. It never calls `emit()`.

- [x] **Step 1: Add failing test** `muscle interaction highlights matching workouts without saving`. Import a program with one Chest primary workout, one Triceps-primary/Chest-secondary workout, one unrelated workout and one empty workout; include scheduled and unscheduled workouts. Select Chest; assert exactly the first two cards show `Trains Chest`, all four remain visible, and the readout says 2 workouts. Hover Lats to preview its contributor, then leave and verify Chest highlights return. Click Chest again to clear. Count PUT/POST requests to `/api/` after setup has fully saved; pure muscle interactions must add none.
- [x] **Step 2: Add mutation/lifecycle assertions**: with Chest selected duplicate a contributor, move it, assign a day, switch layout, remove it, and verify matching cards and counts after each operation. Include a draft with no name and secondary membership. Successful replacement import must clear the old interaction state; cancelled import must preserve document and selection. Open an editor, change contributing muscles, return and verify a fresh overview with recomputed totals and no selection.
- [x] **Step 3: Run** `npx playwright test e2e/program-overview.spec.js`; expect highlight assertions to fail.
- [x] **Step 4: Wire the panel callback** to update `highlightedMuscle` and call `updateWorkoutHighlights()`. Match cards to workouts by `data-workout` ID; a workout matches when any exercise's primary or secondary array includes the effective muscle. Build the marker as a text node/span using `textContent`, hidden when unmatched. Reapply after every `renderWorkouts()` and reset on overview mount/replacement. Do not rebuild cards merely to preview a muscle or move keyboard focus.
- [x] **Step 5: Style `.workout-item.is-muscle-match`** using an accent border and subtle existing accent-soft background; ensure the visible marker distinguishes matches without colour alone. Keep long marker/name text wrapping inside the card. Avoid layout-changing borders and dimming unrelated cards.
- [x] **Step 6: Run** `npx playwright test e2e/program-overview.spec.js e2e/programs.spec.js`; expect all tests to pass.
- [x] **Step 7: Commit** Task 4 changes as `feat: highlight workouts contributing to weekly volume`.

### Task 5: Verify the complete experience and update project guidance

**Files:** Modify `AGENTS.md`, and only adjust Task 2–4 files if verification reveals a defect.

**Interfaces:** Consumes the completed overview; produces verified behavior and updated repository guidance. No API/schema changes.

- [x] **Step 1: Extend responsive verification** in `e2e/program-overview.spec.js` at 375px, 800px and 1280px, plus a 667×375 landscape viewport. Use long program/workout names, a populated weekly list and visible import errors. Assert no horizontal document overflow and no toolbar/panel overlap; at mobile widths assert the map/legend remain visible and panel precedes workouts visually. Test enlarged text manually at 200% browser zoom and inspect focus rings and goal dialog fit.
- [x] **Step 2: Perform a visual review** of the toolbar's checked/hover/focus states, icon alignment and 24px separation; body proportions and all heat colours; stable readout; clear workout highlights; narrow-screen wrapping. Use screenshots for comparison but avoid brittle pixel-perfect snapshots. Exercise normal and reduced motion. Fix only verified defects and rerun the relevant focused test.
- [x] **Step 3: Update AGENTS.md**: replace `Weekly panels use bars without the per-session heatmap or productive-set recommendations.` with a statement that weekly panels use bars and an interactive weekly heatmap with upper band limits 6, 12 and 18, independent of goals; per-session recommendations remain excluded. Link the new design and plan alongside the existing release documentation.
- [x] **Step 4: Run** `npm test`; expect exit 0 and all node:test tests passing.
- [x] **Step 5: Run** `npm run test:e2e`; expect exit 0 and all Playwright tests passing. The configured server runs in test mode with an isolated test database; do not point it at production. No migration is required for this UI-only change.
- [x] **Step 6: Run** `npm run build`; expect exit 0. Confirm generated static output remains limited to the existing approved browser assets.
- [x] **Step 7: Review** `git diff --check`, `git diff --stat` and the final diff. Confirm no package/lockfile changes from this feature, no persisted interaction properties, no session heat change and no server/database edits. Preserve the package-file modifications that predated this task.
- [x] **Step 8: Commit** the final verified changes as `docs: record weekly heatmap behavior and verification` and report actual test results and any remaining limitations. Stop before publishing; deployment is outside this plan's authorized scope.

## Execution handoff

Recommended approach: native execution in this session, because these changes share a small set of DOM/state interfaces and are easiest to validate together. Review this plan before starting implementation. Delegated execution remains an option if requested.
