# Workout Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show each exercise's block once while its sets snap underneath, turn the workout overview into a dense chip list with one actions menu per exercise, and make every explicit jump travel through the feed, including from the progress row.

**Architecture:** Three independently shippable parts: grouped feed, compact overview, moving around. Focus stays one scroll container: each run of sets of one exercise becomes an `li.focus-group` whose name row and details are sticky siblings above the canonical set rows. A pure `fitGroup` decides every row's snap offset, min-height and peek. The overview keeps its dialog, commands and sortable; only its body changes. Travel wraps the existing smooth `scrollTo` with arrival detection and cancellation. Scrubbing lives in one new module.

**Tech Stack:** Vanilla ES modules, plain CSS (sticky, scroll snap, container queries, popover), `node:test`, Playwright.

**Spec:** docs/superpowers/specs/2026-11-12-workout-flow-design.md. Read it with this plan; §1–§5 refer to it. **Prerequisite:** plan 1 (docs/superpowers/plans/2026-11-12-focus-set-page.md) is implemented first. This plan uses its `formatRir`, `actionIcon('note')`, the set-note button on `.focus-context`, `ul.focus-tags`, and the exercise fields `brand` and `focusTags`.

## Decisions

- **Group identity:** groups take their key from shared set keys (`focusGroups(items, previous)`). Adding or removing sets, adding a warm-up to one member of a superset, or unlinking a pair keeps the group element, its title ticker, its history and any borrowed note editor.
- **Two sticky siblings:** the name row (`top:0`, z-index 3) and the details (`top:var(--focus-name-h)`, z-index 2) are separate siblings. The name-only fallback is then one class, `.is-name-only`, which makes the details static. When a group leaves, its details slide under the name row before the name row is pushed out.
- **One position rule:** each row's inline `scroll-margin-top` holds its `fitGroup` offset. `snapTop(el) = el.offsetTop − (parseFloat(el.style.scrollMarginTop) || 0)` drives snapping, `jump`, `inView`, re-anchoring and the tests. The first row of a group snaps to the group's top, so the whole block shows there in either mode.
- **Rhythm:** the block's sections keep fixed `--focus-gap` spacing; the residual height spreads only over the set page's gaps. The block sits outside the card's flex column, so no shared residual is possible. The rhythm test is adjusted to match.
- **Travel:** focus moves to the target's context when the travel starts, as Auto-next already does. `viewed`, the progress text, rulers and the ticker update on arrival. Arrival is detected in the raw scroll listener (within 1px of the target), on `scrollend`, or after 150ms without scroll events. The raw listener runs outside the rAF throttle, so it also works under Playwright's fake clock.
- **Overview budget at 390×844:** the sheet is 742px (88dvh). 12px padding + 44px header + 8px + 6 × (44px line + 4px + 44px chips) + 5 × 17px separators = 701px. Add exercise may fall below the fold. Chips start at the body's left edge (not indented under the name) so four chips fit on one line.

## Global Constraints

- Focus stays a presentation over the logger's port: borrow nodes, never clone, never mount a second logger, never change `workout-sync`. Preserve node identity, focus, caret, composition and invalid drafts through regrouping, refits, saves and the 760/761px breakpoint.
- No data, schema, sync, export, persistence, migration or dependency change. Execution order, set-page components, `--focus-gap` (`clamp(6px, (100cqh − 400px) / 10, 20px)`), density tiers (`@container focus-feed`, never device queries), completion timings and Auto-next 650ms are unchanged.
- Pinned block: opaque `var(--bg)`, 1px `var(--border)` bottom edge. Pinning is scroll-driven and adds no animation. Fit rule: at default text with one line of tags, the viewed set shows through Complete from a 660px visible viewport.
- Touch targets ≥44px; fine-pointer controls 32px only under the design system's existing fine-pointer query. Status never by colour alone.
- Motion: chip fade 200ms ease-out, sheet 200ms, bubble 150ms fade with a 4px slide; reduced motion makes all of them, and every travel, instant.
- Copy is fixed by the spec: `Actions, {exercise}`, `Exercise actions`, `Add set`, `Add warm-up`, `Exercise note`, `Swap exercise`, `Remove last set`, `Remove last warm-up`, `Remove exercise`, `Unlink superset`, `No sets`, `up next`, `no partner set this round`, `Workout overview, exercise {n} of {m}, {done} of {total} working sets`.
- Test at real browser heights (Playwright viewports), never DevTools device presets.
- Change values in `style.css` first, then `docs/design-system/README.md`, and update `AGENTS.md` in the same part.
- Never claim physical-device or production verification from localhost or emulation. Never claim a pending deployment was verified. Phone checks are recorded as user-confirmed or `pending (user)`.
- Commit on `main` after each task; messages end with the session's `Co-Authored-By` attribution line.
- Each part ends green on `npm test`, `npm run test:e2e` and `npm run build`.

## Review Focus

1. A logger render (every save, RIR tap or hydration) while rows sit inside groups: the rows stay in their group and the scroll position holds. Today's `place()` re-parents any row whose parent is not the feed. (Task 2)
2. A structure change that alters runs while a set is viewed, such as a warm-up added to the other member of a superset or a pair unlinked from the overview: the viewed row keeps its node and stays in view, and the group keeps its element. (Task 3)
3. Removing an exercise from its actions menu: focus moves to the next block's actions button, else the previous one, else Add exercise; it never falls to `body`. (Task 5)
4. A travel cut short by a dialog, a resize or the target's removal: tracking resumes and the next user scroll updates the viewed set; the feed never stays in a travelling state. (Task 6)
5. A scrub that loses pointer capture (`lostpointercapture`, which an iOS system gesture causes): the bubble hides, nothing jumps, and the next tap still opens the overview. (Task 8)

---

# Part 1 — Grouped feed

### Task 1: Exercise groups and pinned-block fit (pure)

**Files:**
- Modify: `src/workout-focus-model.js` (new `focusGroups`), `src/workout-focus-fit.js` (new `fitGroup`)
- Test: `test/workout-focus-model.test.js`, `test/workout-focus-fit.test.js`

**Interfaces:**
- Produces: `focusGroups(items, previous = []): Array<{key: string, exerciseId: string, exerciseIndex: number, keys: string[]}>`. A group is a maximal run of consecutive `items` with the same `ref.exerciseId`. `keys` are the run's item keys in order. `key` comes from the first previous group, in order, that shares any item key and has not already been used. Otherwise it is the run's first item key.
- Produces: `fitGroup({feedHeight, nameHeight, detailsHeight, contentHeights: number[], peekHeights: number[], editing = false}): {nameOnly: boolean, pinned: number, rows: Array<{offset: number, minHeight: number, peekless: boolean}>}`.
  - `nameOnly = !editing && nameHeight + detailsHeight + max(contentHeights) > feedHeight`.
  - `pinned` is `nameHeight` in name-only mode, otherwise `nameHeight + detailsHeight`.
  - Row 0 has `offset = nameHeight + detailsHeight`; every later row has `offset = pinned`.
  - Each row is `focusCardFit({feedHeight: feedHeight − offset, contentHeight, peekHeight})` plus its `offset`.

- [ ] **Step 1: Failing unit tests.** `test/workout-focus-model.test.js`, `'focusGroups follows runs of one exercise and keeps keys through changes'`:

```js
const k=(e,s)=>setKey({exerciseId:e,setId:s}),groups=focusGroups(projectWorkout(focusFixture()).items);
assert.deepEqual(groups.map(g=>[g.exerciseId,g.keys]),[['straight',[k('straight','sw'),k('straight','s1'),k('straight','s2')]],['a',[k('a','aw')]],['b',[k('b','bw')]],['a',[k('a','a1')]],['b',[k('b','b1')]],['a',[k('a','a2')]]]);
assert.deepEqual(groups.map(g=>g.key),groups.map(g=>g.keys[0]));
assert.equal(groups[3].exerciseIndex,1);
const noWarmup=focusFixture();noWarmup.exercises[0].sets.shift();
assert.equal(focusGroups(projectWorkout(noWarmup).items,groups)[0].key,groups[0].key);
const unlinked=focusFixture();delete unlinked.exercises[1].superset;
const after=focusGroups(projectWorkout(unlinked).items,groups);
assert.deepEqual(after.map(g=>g.key),[groups[0].key,groups[1].key,groups[2].key]);
assert.equal(new Set(after.map(g=>g.key)).size,after.length);
```

`test/workout-focus-fit.test.js`, `'fitGroup pins the block, peeks whole rows and falls back to the name'`:

```js
const base={feedHeight:600,nameHeight:50,detailsHeight:70};
assert.deepEqual(fitGroup({...base,contentHeights:[300,350],peekHeights:[44,50]}),{nameOnly:false,pinned:120,rows:[{offset:120,minHeight:436,peekless:false},{offset:120,minHeight:430,peekless:false}]});
assert.deepEqual(fitGroup({...base,contentHeights:[450],peekHeights:[44]}).rows[0],{offset:120,minHeight:480,peekless:true});
assert.deepEqual(fitGroup({...base,contentHeights:[300],peekHeights:[0]}).rows[0],{offset:120,minHeight:480,peekless:true});
const tight={feedHeight:420,nameHeight:50,detailsHeight:120,contentHeights:[200,300],peekHeights:[44,0]};
assert.deepEqual(fitGroup(tight),{nameOnly:true,pinned:50,rows:[{offset:170,minHeight:206,peekless:false},{offset:50,minHeight:370,peekless:true}]});
assert.deepEqual(fitGroup({...tight,editing:true}).rows[1],{offset:170,minHeight:250,peekless:true});
assert.equal(fitGroup({feedHeight:420,nameHeight:50,detailsHeight:70,contentHeights:[300],peekHeights:[0]}).nameOnly,false);
```

- [ ] **Step 2:** Run `node --test test/workout-focus-model.test.js test/workout-focus-fit.test.js`. Expected: FAIL, `focusGroups` and `fitGroup` are not exported.
- [ ] **Step 3:** Implement both. `fitGroup` reuses `focusCardFit`; `focusGroups` keeps a `Set` of used previous keys.
- [ ] **Step 4:** Run the same command. Expected: PASS.
- [ ] **Step 5:** Commit `feat(focus): pure exercise groups and pinned-block fit`.

### Task 2: Pin each exercise block while its sets snap underneath

**Files:**
- Modify: `src/workout-focus-view.js`: split `createCard` into a group part and a card part, new `createGroup`, `update` placement, `place`, `fitCards`, `inView`, `jump`, `setFeedHeight`, `setEnabled` (note host), `restore`, `destroy`. Modify `style.css` (Focus rules ~2510–2535, plus plan 1's tag rules).
- Test: `e2e/workout-focus-view.spec.js`, `e2e/workout-focus-fit.spec.js`, `e2e/workout-focus-integration.spec.js`, `e2e/workout-focus-motion.spec.js:26`, `e2e/workout-overview.spec.js:16`, `e2e/workout-logger.spec.js:271`

**Interfaces:**
- Consumes: `focusGroups`, `fitGroup` (Task 1).
- Produces (DOM contract used by every later test):
  - `ol.focus-feed` holds one `li.focus-group[data-exercise-id]` per group, then the review card.
  - A group holds `div.focus-group-name` (`h2.focus-exercise-title` with the ticker, `button.focus-exercise-note`) and `div.focus-group-details` (`ul.focus-tags`, `button.focus-exercise-note-text`, `div.focus-exercise-editor`, `div.focus-history`), then `ol.focus-group-sets` with the canonical rows (`li.log-set.focus-card`).
  - The group carries `.is-name-only` and inline `--focus-name-h` and `--focus-pin` (px). Each row carries its offset as inline `scroll-margin-top`.
  - `.focus-identity` no longer exists. A row keeps `.focus-context` and every set-page section.

- [ ] **Step 1: Failing e2e** in `e2e/workout-focus-view.spec.js` (fixture, 390×844). Define `snapTop` inside each `evaluate` as `r=>r.offsetTop-(parseFloat(r.style.scrollMarginTop)||0)`.
  - `'the exercise block stays pinned while its sets snap under it'`: for `sw`, `s1`, `s2` in turn, `focusView.jump(...)`. At each, the straight group's `.focus-group-name` top equals the feed top ±1, and the viewed row's top equals the details' bottom ±1. After jumping to `aw`, the straight group's name row bottom is ≤ the feed top.
  - `'each exercise shows its title, tags, note and history once'`: the straight group has exactly one `.focus-exercise-title`, one `.focus-history` and one `Add exercise note, Bench press` button. No `.focus-card` contains `.focus-exercise-title`. The feed has 6 `.focus-group`s.
  - `'each superset round set brings its own block'`: jumping to `a1`, `b1` and `a2` shows a pinned title of `Single-arm incline dumbbell chest press`, then `Chest-supported row`, then the first name again.
  - `'the next exercise peeks its whole name row, never its details'` (replaces the two-line eyebrow test) at 360×900: at `s2` the `a` group's `.focus-group-name` shows 0px or its full height ±1. Its `.focus-group-details` and `aw`'s `.focus-context` show 0px.
  - `'a logger save keeps rows in their groups'` (Review Focus 1): at `s2`, tap RIR `2`. After the next save the `s2` row's parent is still the straight group's `.focus-group-sets`, and `snapTop(s2) − scrollTop` stays within 2.
  - Keep `'last set before review never peeks'`.
- [ ] **Step 2:** Run `npx playwright test e2e/workout-focus-view.spec.js`. Expected: the new tests FAIL (no `.focus-group`).
- [ ] **Step 3: View.** Implement `createGroup(key)` with the DOM contract above. It moves `mountWorkoutTitle`, `mountWorkoutHistory`, plan 1's tag list and the exercise-note button, text and editor host out of `createCard`, along with their update code. The title is active only when the viewed ref is in the group. The note button sends `{type:'exercise-note', exerciseId, host: group.editor}`. `destroy` runs `port.restoreExerciseNotes(group.li)`, destroys the ticker and history, and removes the element.
- [ ] **Step 4: Placement.** In `update`, store the last groups array and call `focusGroups(projection.items, last)`. Place group `i` at `feed.children[i]` (before the review card) and each row at `list.children[j]`, both through `port.relocate`. Remove stale cards first, then place, then destroy groups whose key vanished, by which point they are empty. `place({ref,row})` adds a row before the review card only when `!feed.contains(row)`; `update` then moves it into its group. This is the Review Focus 1 fix. `setEnabled` opens a focused exercise note in the editor host of the viewed set's group.
- [ ] **Step 5: Fit.** `fitCards` measures, per group, the name height, the details height (including border), each row's content height (unchanged code) and each row's peek. The peek is the next row's `.focus-context` height inside the group, the next group's `.focus-group-name` height at a group boundary, and 0 before the review card. It calls `fitGroup` with `editing: details.querySelector('.focus-exercise-editor').hasChildNodes()`. Write `--focus-card-min`, `.is-peekless`, the row's `scroll-margin-top`, and the group's `.is-name-only`, `--focus-name-h` and `--focus-pin`; skip writes when unchanged. The ResizeObserver also observes each group's name and details. `inView`, `jump`, the re-anchor in `fitCards` and the anchor in `setFeedHeight` use `snapTop` instead of `offsetTop`.
- [ ] **Step 6: CSS.**
  - `.workout-focus .focus-group {--focus-gap:clamp(6px,calc((100cqh - 400px) / 10),20px)}` (moved from `.focus-card`). The group and its list are `position: static`, so `offsetTop` stays relative to the feed.
  - `.focus-group-name {position:sticky;top:0;z-index:3;display:flex;align-items:center;gap:8px;min-height:44px;background:var(--bg)}`.
  - `.focus-group-details {position:sticky;top:var(--focus-name-h);z-index:2;background:var(--bg);border-bottom:1px solid var(--border);padding-bottom:var(--focus-gap)}`. Inside it, tags, note text and editor follow the title as they did under it, the history keeps its top rule `--focus-gap` below them, and an empty part adds no space.
  - `.focus-group.is-name-only .focus-group-details {position:static}` and `.focus-group.is-name-only .focus-group-name {border-bottom:1px solid var(--border)}`.
  - `.focus-group-sets {list-style:none;margin:0;padding:0}`. The `.focus-identity-row` rules (including `>:first-child {flex:1;min-width:0}`) move to `.focus-group-name`. Delete the other `.focus-identity` rules and keep the title sizes per tier.
- [ ] **Step 7: Move the existing tests to the grouped structure.**
  - Selectors `.focus-feed>.log-set`, `:scope>.log-set`, `.focus-feed>.focus-card` and `.focus-feed > li` become `.focus-feed .focus-card`. In `e2e/workout-logger.spec.js:271`, `focusRow` filters `.focus-group`, since Last time now lives on the group.
  - Every `r.offsetTop` that is compared with `scrollTop` becomes `snapTop(r)`.
  - Title, tag, note and history reads go through the row's group.
  - The two refit-race tests pad the straight group's history by 120px instead of two cards by 60px.
  - In the fit spec, `peek` asserts that the next row has no `.focus-exercise-title` instead of `titlePx ≤ 1`.
  - `rhythm` returns `{ctxToControls, controlsToRir, rirToDone, doneToEnd, historyToEdge}`, where `historyToEdge` is the details' bottom − 1 − the history's bottom. It asserts all ≥6, the first four spread ≤16 and `historyToEdge ≤ 20`.
  - Add `'the last set of an exercise peeks the next name row whole or not at all'` for `[390,844]` and `[412,760]` (template exercise 1, set 3).
- [ ] **Step 8:** Run `npm test` and `npx playwright test e2e/workout-focus-view.spec.js e2e/workout-focus-fit.spec.js e2e/workout-focus-integration.spec.js e2e/workout-focus-motion.spec.js e2e/workout-overview.spec.js e2e/workout-logger.spec.js e2e/workout-recap.spec.js`. Expected: PASS, including the whole fit matrix unchanged.
- [ ] **Step 9:** Commit `feat(focus): pin each exercise block while its sets snap underneath`.

### Task 3: Note editor, focused fields and the name-only fallback, and Part 1 docs

**Files:**
- Modify: `src/workout-focus-view.js` (`setFeedHeight` typing branch), `style.css` (editor cap, focus scroll margin), `AGENTS.md`, `docs/design-system/README.md` (Feed, Card, Fit entries ~446–448)
- Create: `docs/superpowers/verification/2026-11-12-workout-flow.md`
- Test: `e2e/workout-focus-view.spec.js`, `e2e/workout-focus-fit.spec.js`

**Interfaces:**
- Consumes: the Task 2 DOM contract and `--focus-pin`.

- [ ] **Step 1: Failing e2e.**
  - `e2e/workout-focus-view.spec.js`, `'an open exercise note stays pinned and capped'`: at `s2`, open `Add exercise note, Bench press` and fill `'Note '.repeat(200)`. The group is not `.is-name-only`. The textarea's height is ≤ 0.4 × the feed's `clientHeight` + 1. The details' top equals the feed top + the name height ±1. `snapTop(s2) − scrollTop` stays within 2 of its value before the note opened.
  - `'tight screens pin only the name row'` at 360×740: the straight exercise has a 1,000-character note. The group has `.is-name-only`. At `s2` the name row's top equals the feed top ±1, the details show 0px inside the feed below the name row, and `s2`'s Complete is inside the feed. Jumping to `sw` shows the details again.
  - `'a focused field clears the pinned block'`: at 390×844, add `is-unsnapped` to the feed (typing keeps it there), set its `scrollTop` so that `s2`'s reps input lies under the pinned block, then call `reps.focus()` without `preventScroll`. The input's top is ≥ the details' bottom − 1.
  - `'structure changes keep the group and the viewed set'` (Review Focus 2): at `a1`, keep `window.row = port.row({exerciseId:'a',setId:'a1'})` and the `a1` group element. Run `port.command({type:'add-warmup',exerciseId:'b'})`. `visibleRef` is still `a1`, the row and group nodes are the same, and `snapTop(a1) − scrollTop` stays within 2. Then unlink the pair with `{type:'unlink',exerciseId:'a'}`: the `a1` row node is the same and still viewed.
  - `e2e/workout-focus-fit.spec.js`, `'200% text pins only the name row and keeps Complete reachable at the second set'`: `enlarged`, then scroll the feed to `snapTop` of the template's set 2. The group is `.is-name-only` and `doneInside` holds for that row. A set-2 copy of the keyboard test clicks that row's reps and shrinks to 390×380. The input's top is ≥ the pinned bottom − 1 (the details' bottom, or the name row's bottom under `.is-name-only`).
- [ ] **Step 2:** Run `npx playwright test e2e/workout-focus-view.spec.js e2e/workout-focus-fit.spec.js`. Expected: the cap, focus-margin and keyboard tests FAIL. The structure test is a guard, and Task 2's key inheritance should already pass it.
- [ ] **Step 3: Implement.**
  - `.focus-group-details .focus-exercise-editor textarea {max-height:calc(var(--focus-feed-height) * .4);overflow-y:auto}`.
  - `.workout-focus .focus-card :is(input,button,select,textarea):focus {scroll-margin-top:var(--focus-pin,0px)}`, next to the existing 64px bottom margin.
  - In `setFeedHeight`'s typing branch, limit the upward shift to `f.top − box.top − pin`, where `pin` is the row's group `--focus-pin`. The top edge wins over the Complete margin when both cannot hold.
- [ ] **Step 4:** Run `npm test`, `npm run test:e2e` and `npm run build`. Expected: PASS.
- [ ] **Step 5: Docs.**
  - `AGENTS.md`: add a top section `## Workout flow (2026-11-12)` naming the spec, this plan and the verification file, with Part 1's rules: groups as runs of one exercise; the pinned name row and details; the boundary name-row peek; the name-only fallback; the editor pinned and capped at 40%; focus margins; the review card never peeked.
  - Correct the Focus section, naming this section: "one snapping set-by-set feed", "otherwise, and always for the last set, there is no peek and never any title pixels", and "beyond that only the viewed card's Complete is sticky".
  - Mirror the changes in the design system's Feed, Card and Fit entries, including the rhythm change.
- [ ] **Step 6: Verify and record.** Inspect a populated workout (straight exercises, a superset, a long name, tags, a long note) at 360, 390 and 412px widths, at the short density tiers, at 200% text and with reduced motion. Confirm that 1366×768, 1440×900 and 1920×1080 still show the regular tracker. Create the verification file with the commands and results, what was inspected, and `Phone checks` with pinning under momentum scrolling marked `pending (user)`.
- [ ] **Step 7:** Commit `feat(focus): keep the note editor and focused fields clear of the pinned block; document part 1`.

---

# Part 2 — Compact overview

### Task 4: One chip per set

**Files:**
- Modify: `src/workout-sets.js` (new `setChip`); `src/workout-overview.js` (replace the set lines and round groups with keyed chips; open focus); `style.css` (overview rules 2592–2616)
- Test: `test/workout-sets.test.js`, `e2e/workout-overview.spec.js`

**Interfaces:**
- Consumes: `formatRir` (plan 1).
- Produces: `setChip(set: {kind, weightKg, reps, rir, done}, {kindIndex: number, exercise: string}): {text: string, label: string}`.
- Produces (DOM): per exercise, `div.overview-chips[role=group][aria-label="Sets, {exercise}"]` of `button.overview-chip` in stored set order. Classes are `.is-warmup`, `.is-done` (plus a check `svg`) and `.is-next`; the viewed chip has `aria-current="step"`. A zero-set exercise shows `p.focus-muted` `No sets`.

- [ ] **Step 1: Failing unit test**, `'setChip names values, bodyweight, warm-ups and completion'`:

```js
const c=(set,kindIndex=1,exercise='Bench press')=>setChip({kind:'working',weightKg:null,reps:null,rir:null,done:false,...set},{kindIndex,exercise});
assert.deepEqual(c({weightKg:80,reps:8,rir:2,done:true},2),{text:'80×8',label:'Working set 2, Bench press, 80 kg × 8, 2 RIR, complete'});
assert.deepEqual(c({reps:8}),{text:'BW×8',label:'Working set 1, Bench press, bodyweight × 8'});
assert.equal(c({weightKg:0,reps:8}).text,'BW×8');
assert.deepEqual(c({weightKg:80},3),{text:'—',label:'Working set 3, Bench press'});
assert.deepEqual(c({kind:'warmup',weightKg:40,reps:10,rir:3,done:true}),{text:'W 40×10',label:'Warm-up 1, Bench press, 40 kg × 10, complete'});
assert.equal(c({weightKg:82.5,reps:8,rir:5}).label,'Working set 1, Bench press, 82.5 kg × 8, 5+ RIR');
```

- [ ] **Step 2:** Run `node --test test/workout-sets.test.js`. Expected: FAIL, `setChip` is not exported.
- [ ] **Step 3:** Implement `setChip`; a warm-up's RIR never appears.
- [ ] **Step 4: Failing e2e** in `e2e/workout-overview.spec.js`. The spec's `mount(page, {viewed} = {})` jumps to `viewed` when given and calls `overview.update(port.read(), focusView.visibleRef())` before `open`, as the logger does. Replace the first test with `'each exercise shows one chip per set with its state'`, mounted with `s1` done at 80×8 RIR 2 and viewed at `s2`.
  - The Bench press chip texts are `['W —','80×8','—']`.
  - The chip `Working set 1, Bench press, 80 kg × 8, 2 RIR, complete` has `.is-done` and an `svg`.
  - The `s2` chip has `aria-current="step"` and is focused.
  - The `sw` chip's accessible name ends with `, up next`.
  - The `a2` chip's name ends with `, no partner set this round`.
  - There is no heading `Round 1`, `Warm-ups` or `Working sets`, and no button named `/^Remove (Working set|Warm-up)/` or `/^Set note,/`.
  - Every chip is ≥44 tall and ≥56 wide.
  - The screenshot path becomes `.superpowers/sdd/2026-11-12-workout-flow/overview-390.png`.

  Add `'a chip jumps to its set and the viewed chip only closes'`: with `s1` viewed, clicking `Working set 2, Bench press` closes the dialog and `visibleRef` becomes `s2`. Reopen, then click the viewed chip: the dialog closes, `visibleRef` is still `s2`, and `.focus-overview` is focused.

  In a `reducedMotion:'no-preference'` describe, add `'added and removed chips fade'`. Right after `await port.command({type:'add-set',exerciseId:'straight'})` (in the same `evaluate`), the new chip has `.is-entering`, and it loses that class within two frames. Right after `remove-set` of `s2`, its chip is `.is-removing` and `inert`, and it is gone after 250ms. Under `emulateMedia({reducedMotion:'reduce'})` it is gone immediately.

  Update `'repeated variants jump by exercise and set IDs'` and `'zero-set exercise remains manageable…'`, which also expects `No sets`, to the chip names.
- [ ] **Step 5:** Run `npx playwright test e2e/workout-overview.spec.js`. Expected: FAIL.
- [ ] **Step 6: Overview.**
  - Replace `fillBlock`'s set lines and round groups with persistent members keyed by exercise ID. Each member owns a `Map(setKey → chip)` and is reconciled on every `update`. Chips built on the sheet's first render or a member's first render never fade.
  - Chips use `setChip` with the projection item's `kindIndex`. `.is-next` goes on `projectWorkout(log).current`. Suffixes `, up next` and `, no partner set this round` (when the item's `preview.label` includes `No partner`) are appended to `aria-label`.
  - A chip click sets `selected = ref` unless it is the viewed ref, then calls `close()`.
  - On open, after `motion.open()`, call `scrollIntoView({block:'nearest'})` and focus the `[aria-current="step"]` chip, else Close.
  - Keep each member's existing action strip unchanged for now.
- [ ] **Step 7: CSS.**
  - `.overview-chips {display:flex;flex-wrap:wrap;gap:6px;margin-top:4px}`.
  - `.overview-chip {display:inline-flex;align-items:center;gap:4px;min-height:44px;min-width:56px;padding:0 8px;border:1px solid var(--border);border-radius:6px;background:var(--surface);color:var(--text);font-size:.8125rem;font-weight:600;font-variant-numeric:tabular-nums;transition:opacity 200ms ease-out}`; fine pointer: `min-height:32px`.
  - `.is-warmup` uses `color:var(--muted)`. `.is-done` uses `background:var(--accent-soft);color:var(--accent)`, with a 14px check.
  - `[aria-current=step]` gets `outline:2px solid var(--accent);outline-offset:1px`. `.is-next::before` is a 6px `--accent` dot.
  - `.is-entering,.is-removing {opacity:0}`. Reduced motion: `transition:none`.
  - Delete the `.overview-set-line`, `.overview-set-group`, `.overview-rounds` and `.overview-set-summary` rules.
- [ ] **Step 8:** Run `npm test` and `npx playwright test e2e/workout-overview.spec.js e2e/workout-focus-integration.spec.js e2e/workout-logger.spec.js`. Expected: PASS.
- [ ] **Step 9:** Commit `feat(overview): one chip per set`.

### Task 5: Compact exercise rows with one actions menu, and Part 2 docs

**Files:**
- Modify: `src/workout-overview.js` (exercise line, pair header, menu, focus on removal, tooltips), `style.css` (overview header/body/blocks), `AGENTS.md`, `docs/design-system/README.md` (~450), `docs/superpowers/verification/2026-11-12-workout-flow.md`
- Test: `e2e/workout-overview.spec.js`, `e2e/workout-logger.spec.js:311-323`, `e2e/workout-focus-integration.spec.js:99-108`

**Interfaces:**
- Consumes: `mountReorderMenu({label:'Exercise actions'})`, `supersetSummary` (`src/superset-frame.js`), `actionIcon('reorder'|'more'|'unlink')`, `mountActionTooltips(dialog)` with `data-action-tooltip`, and the exercise fields `brand` and `focusTags`.

- [ ] **Step 1: Failing e2e.**
  - `'the actions menu holds every exercise command'`: `Actions, Bench press` opens a group named `Exercise actions` with exactly `Add set`, `Add warm-up`, `Exercise note`, `Swap exercise`, `Remove last set`, `Remove last warm-up`, `Remove exercise`. `Remove last set` leaves Bench press with sets `['sw','s1']`; `Remove last warm-up` leaves `['s1']`, and then that item is absent. `Cable raise` offers no Remove-last item. At 20 sets both Add items are disabled.
  - `'rows show reorder, name, tags and actions; pairs show one header'`: Bench press has `brand:'Hammer'` and `focusTags:['Upper chest']`. Its line shows `Reorder Bench press`, the name, the text `Hammer · Upper chest` with a `.visually-hidden` `Tags:` prefix, and `Actions, Bench press`. An exercise without tags has no `.overview-tags`. The pair has one `Reorder superset Single-arm incline dumbbell chest press + Chest-supported row`, the text `30 sec between · 1 min 30 sec after round` (per `supersetSummary`), one `Unlink superset` icon button, member labels `A1` and `A2`, and no member Reorder. Icon buttons show their tooltip on focus.
  - `'six exercises with four sets fit without scrolling at 390x844'`: six straight exercises `Row 1`–`Row 6`, each with a done 40×10 warm-up, two done 80×8 sets and one empty set. The dialog's `scrollTop` is 0, the sixth `.overview-chips` bottom is ≤ the dialog's bottom, and every `.overview-chips` is one line (height ≤ 45).
  - `'removing an exercise from its menu keeps focus in the sheet'` (Review Focus 3): `Actions, Cable raise` → `Remove exercise`. After 250ms, `Actions, Single-arm incline dumbbell chest press` is focused.
  - Move the other overview tests and `e2e/workout-logger.spec.js:316` (`Swap exercise`), `e2e/workout-focus-integration.spec.js:104` (`Add warm-up`) to open `Actions, {name}` first. `'reorder moves pairs…'` now expects 4 `Actions, …` buttons and 1 `Unlink superset`.
- [ ] **Step 2:** Run `npx playwright test e2e/workout-overview.spec.js`. Expected: FAIL.
- [ ] **Step 3: Rows.**
  - A single block is one `div.overview-line`: the Reorder handle (icon, `.reorder-action`, the same aria-label and keys), `p.overview-name` (name, then `span.overview-tags`) and `button.overview-more`. Below it come the chips, then `div.overview-editor` and `div.overview-picker`.
  - A pair block gets `.is-pair` and a `div.overview-pair-head`: the pair's handle, `Superset`, `supersetSummary(block.superset)` and the Unlink icon. Each member has a line with `span.overview-member` (`A1`/`A2`, letters by pair order like `projectWorkout`), the name, tags and the actions button.
  - Delete `commands()` and the `:has(...)` pair selector.
- [ ] **Step 4: Menu.** Create one menu per open sheet and destroy it on close. `toggle(more, choices)` builds the seven items in the order above, filtering the Remove-last items by the exercise's last `working` and `warmup` sets and disabling Add at `WORKOUT_LIMITS.sets`. Each item sends today's command (`add-set`, `add-warmup`, `exercise-note` with the member's editor host, `swap` with its picker host, `remove-set` with `{exerciseId, setId}`, `remove-exercise`).
- [ ] **Step 5: Focus on removal.** When `update` retires a block that contains `document.activeElement` (or the menu's trigger), focus moves to the next block's first `.overview-more`, else the previous one, else Add exercise, with `preventScroll`.
- [ ] **Step 6: CSS.**
  - `.overview-body {padding:12px 12px max(12px,env(safe-area-inset-bottom));gap:8px}`.
  - `.overview-blocks {gap:0}`; `.overview-block {border-top:0;padding:8px 0}`, plus `border-bottom:1px solid var(--border)` on all but the last.
  - `.overview-line {display:flex;align-items:center;gap:4px;min-height:44px}`; `.overview-name {flex:1;min-width:0;margin:0;overflow-wrap:anywhere}`.
  - `.overview-tags {display:inline-block;max-width:100%;margin-left:6px;color:var(--muted);font-size:.75rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;vertical-align:bottom}`.
  - `.overview-block.is-pair {border-left:3px solid var(--accent);padding-left:12px}`.
  - Icon buttons are 44px on touch and 32px on a fine pointer.
- [ ] **Step 7:** Run `npm test`, `npm run test:e2e` and `npm run build`. Expected: PASS.
- [ ] **Step 8: Docs and evidence.**
  - `AGENTS.md` (Workout flow section) gains Part 2's rules: chips, their text and accessible names, viewed ring and up-next dot, stored order, the actions menu items, Remove last instead of per-set remove, no set notes in the overview, tags as muted text, the density target and focus on removal.
  - Mirror them in the design system's Overview entry.
  - Inspect the sheet populated at 360/390/412px, 200% text, a fine pointer (1366×768) and reduced motion. Record it, with the phone check `pending (user)`: chip tapping accuracy and reading the sheet at a glance.
- [ ] **Step 9:** Commit `feat(overview): compact exercise rows with one actions menu; document part 2`.

---

# Part 3 — Moving around

### Task 6: Explicit jumps travel through the feed

**Files:**
- Modify: `src/workout-focus-view.js` (`jump`, scroll listener, cancellation, `suspend`, `setFeedHeight`, `update`, Back to current), `src/workout-logger-view.js:507` (`onJump` animates)
- Test: `e2e/workout-focus-motion.spec.js`, `e2e/workout-overview.spec.js` (mount's `onJump`)

**Interfaces:**
- Produces: `jump(ref, {animate = false, focus = false})`, same signature. With `animate` and no reduced motion it starts a travel; otherwise it stays instant as today. Internal state `travel = {ref, top, timer} | null`; `cancelTravel()`.

- [ ] **Step 1: Failing e2e** in `e2e/workout-focus-motion.spec.js` (motion on). A page-side scroll listener, added after mount, records `{top, viewed}` samples.
  - `'an overview chip travels through the sets in between'`: viewed `sw`, open the overview and click `Working set 1, Single-arm incline dumbbell chest press`. Poll until `visibleRef` is `a1`. Then `scrollTop` equals `snapTop(a1)` ±1, at least three samples lie strictly between the start and end tops, every sample more than 1px from the end still has viewed `sw`, and `a1`'s `.focus-context-text` is focused.
  - `'Back to current travels too'`: with `sw` and `s1` done and viewed `a2`, click Back to current. Samples lie in between, and the travel ends on `s2`.
  - `'a touch during travel stops at a set'`: start a travel to `a2` and, on the first sample, dispatch a bubbling `pointerdown` on the feed. Poll until `scrollTop` equals `snapTop` of `visibleRef`'s row ±1; `visibleRef` is not `a2`.
  - `'an interrupted travel never sticks'` (Review Focus 4): start a travel to `a2`, then call `focusView.suspend(true)` and `focusView.suspend(false)`. A user `scrollTo` to `snapTop(s2)` makes `visibleRef` `s2`. Repeat with `remove-set` of the target mid-travel.
  - `'reduced motion jumps at once'`: `emulateMedia({reducedMotion:'reduce'})`, then `jump(a2,{animate:true})`. In the same `evaluate`, `scrollTop` equals `snapTop(a2)` and `visibleRef` is `a2`.
  - Change `'warmup completion advances…'` to poll `visibleRef`.
- [ ] **Step 2:** Run `npx playwright test e2e/workout-focus-motion.spec.js`. Expected: FAIL (the viewed set updates at the start, and Back to current is instant). If headless Chromium shows no intermediate samples for programmatic smooth scrolls, say so in the verification file. Then keep only the arrival, start-viewed, focus and cancellation assertions; the travel itself waits for the phone check.
- [ ] **Step 3: Implement.**
  - `startTravel(ref, {focus})`:
    - `cancelTravel()`.
    - `travel = {ref, top: snapTop(target)}`.
    - `feed.scrollTo({top, behavior:'smooth'})`.
    - If `focus`, call `focusContext(ref)`.
    - Arm a 150ms settle timer that each scroll event re-arms.
  - The raw scroll listener checks `travel` before the rAF throttle: within 1px of `top`, call `arrive()`; otherwise re-arm the timer. `scrollend` also calls `arrive()`.
  - `arrive()`: set `viewed = travel.ref` and clear `travel`; if the position is off by more than 1px, correct it instantly with `programmatic`; then `renderCursor()` and `syncActive()`.
  - `cancelTravel()`: clear the timer, set `travel = null` and call `feed.scrollTo({top: feed.scrollTop, behavior:'instant'})`. Snapping and `track()` then pick the set.
  - Call `cancelTravel()` on document `pointerdown` (capture), document `keydown` (capture), feed `wheel`, `suspend(true)`, window `resize`, the start of `setFeedHeight`, any instant `jump`, and in `update` when the target left the projection.
  - While travelling, `fitCards` skips its re-anchor.
  - Back to current uses `{animate:true, focus:true}`; so does the logger's `onJump`, along with the overview test mount's `onJump`.
- [ ] **Step 4:** Run `npx playwright test e2e/workout-focus-motion.spec.js e2e/workout-overview.spec.js e2e/workout-focus-view.spec.js e2e/workout-focus-integration.spec.js`. Expected: PASS.
- [ ] **Step 5:** Commit `feat(focus): explicit jumps travel through the feed`.

### Task 7: The progress row opens the overview

**Files:**
- Modify: `src/workout-focus-model.js` (new `progressClusters`), `src/workout-focus-view.js` (progress button, clusters, accessible name, celebrate lookup), `style.css` (2501–2506)
- Create: `e2e/workout-focus-progress.spec.js`
- Test: `test/workout-focus-model.test.js`, `e2e/workout-focus-motion.spec.js` (celebration selector)

**Interfaces:**
- Produces: `progressClusters(items): Array<{key: string, keys: string[]}>`, built from working items in execution order with `key = item.pairId ?? item.ref.exerciseId`.
- Produces (DOM): `button.focus-progress[type=button][aria-haspopup=dialog]` containing `span.focus-progress-meta` and `span.focus-progress-segments`, which holds one `span.focus-progress-cluster[data-key]` (style `flex-grow: n`) per cluster of `span.focus-progress-segment[data-key]`.

- [ ] **Step 1: Failing tests.** In `test/workout-focus-model.test.js`, `'progressClusters groups working sets by exercise and superset'`: the fixture gives `[{key:'straight',keys:[k('straight','s1'),k('straight','s2')]},{key:'a',keys:[k('a','a1'),k('b','b1'),k('a','a2')]}]`. A log with only warm-ups gives `[]`.

  In `e2e/workout-focus-progress.spec.js` (fixture, 390×844, `hasTouch`), `'the progress row is the overview button'`:
  - At `sw`, the row is `getByRole('button',{name:'Workout overview, exercise 1 of 4, 0 of 5 working sets'})`.
  - Click → dialog visible; Escape → the row is focused.
  - Enter → dialog.
  - The row has 2 clusters; the gap between clusters is 8 ±0.5 and within a cluster 3 ±0.5.
  - `::after` is 44px tall, and `document.elementFromPoint` at the row's centre x and centre y ±18 lies inside the row. The row's own box is <44px tall.
  - At the review card the name reads `Workout overview, workout review, 0 of 5 working sets`.
- [ ] **Step 2:** Run `node --test test/workout-focus-model.test.js` and `npx playwright test e2e/workout-focus-progress.spec.js`. Expected: FAIL.
- [ ] **Step 3: Implement.**
  - The row becomes the button; its click does what the toolbar's Workout overview button does (`advance.cancel()`, `onInteraction({type:'overview', opener: progress})`).
  - Reconcile segments by key inside their clusters.
  - Set the accessible name in `update` and `renderCursor`.
  - `celebrate` finds its segment with `querySelectorAll('.focus-progress-segment')`.
  - The toolbar button stays.
- [ ] **Step 4: CSS.**
  - `.focus-progress {position:relative;display:block;width:100%;margin:0 0 8px;padding:0;border:0;background:none;color:inherit;font:inherit;text-align:inherit;cursor:pointer;touch-action:none}`.
  - `.focus-progress::after {content:'';position:absolute;inset:50% 0 auto;height:44px;transform:translateY(-50%)}`.
  - `.focus-progress-segments {display:flex;gap:8px;height:4px}`; `.focus-progress-cluster {display:flex;gap:3px;flex-basis:0;min-width:0}`.
  - Focus-visible ring per the design system. The feed and header paint above the hit area where they overlap.
- [ ] **Step 5:** Run `npm test` and `npx playwright test e2e/workout-focus-progress.spec.js e2e/workout-focus-motion.spec.js e2e/workout-focus-integration.spec.js`. Expected: PASS, including `'Focus chrome leaves no reserve gap…'`.
- [ ] **Step 6:** Commit `feat(focus): the progress row opens the overview`.

### Task 8: Scrub the progress row, and Part 3 docs

**Files:**
- Create: `src/workout-progress-scrub.js`
- Modify: `src/workout-focus-model.js` (new `nearestIndex`), `src/workout-focus-view.js` (mount the scrub, click guard), `style.css` (bubble), `AGENTS.md`, `docs/design-system/README.md`, `docs/superpowers/verification/2026-11-12-workout-flow.md`
- Test: `test/workout-focus-model.test.js`, `e2e/workout-focus-progress.spec.js`

**Interfaces:**
- Produces: `nearestIndex(centers: number[], x: number): number`. It returns the index of the centre closest to `x`, the lower index on a tie, and −1 for an empty list.
- Produces: `mountProgressScrub(button, {strip, targets, describe, onStart, onRelease}): {consumeClick(): boolean, destroy(): void}`.
  - `strip` is the segments element.
  - `targets()` returns `[{ref, el}]` for working segments in order.
  - `describe(ref)` returns `{exercise, set}`.
  - `onStart()` fires once when movement passes 8px.
  - `onRelease(ref)` fires for a release within 48px above or below `strip`.
  - `consumeClick()` returns `true` once after a scrub.

- [ ] **Step 1: Failing tests.** Unit, `'nearestIndex clamps to the ends'`: `nearestIndex([10,30,50],-100)===0`, `nearestIndex([10,30,50],41)===2`, `nearestIndex([10,30,50],20)===0`, `nearestIndex([10],500)===0` and `nearestIndex([],5)===-1`.

  In `e2e/workout-focus-progress.spec.js` (mouse pointer):
  - `'dragging scrubs with a bubble and the release travels there'`:
    - Press on the first segment's centre and move in 4px steps to the third segment's centre (`a1`).
    - The bubble (`.focus-scrub-bubble:popover-open`) reads `Single-arm incline dumbbell chest press` in `.focus-scrub-name` and `A1 · Round 1` in `.focus-scrub-set`, and the feed's `scrollTop` is unchanged.
    - Release: the bubble closes, no dialog opens, and `visibleRef` becomes `a1`.
  - `'a scrub clamps at both ends and stays inside the viewport'`: dragging to x = 0 reads `Working set 1 of 2` with the bubble's left ≥ 8; dragging to `innerWidth` reads `A1 · Round 2 · No partner set this round` with the bubble's right ≤ `innerWidth − 8`.
  - `'a far release or a cancel changes nothing'`: release 60px below the strip, then repeat with a synthetic `pointercancel`. Each time `visibleRef`, `scrollTop` and the dialog count are unchanged and the bubble is closed.
  - `'a scrub cancels a pending Auto-next'`: with `page.clock`, complete `s1`, scrub before 650ms and release far away; after 1,000ms `visibleRef` is still `s1`.
  - `'lost capture hides the bubble and the next tap still opens the overview'` (Review Focus 5): mid-scrub, call `releasePointerCapture` on the row. The bubble closes and nothing jumps; a following click opens the overview.
  - `'the row does not scroll the page'`: the row's computed `touch-action` is `none`. A keyboard user still opens the overview, and the row has no slider role.
- [ ] **Step 2:** Run `node --test test/workout-focus-model.test.js` and `npx playwright test e2e/workout-focus-progress.spec.js`. Expected: FAIL.
- [ ] **Step 3: Module.**
  - `pointerdown`: primary pointer only; `setPointerCapture` in `try/catch`; store `{id, x}`.
  - `pointermove`: past 8px of |dx|, start the scrub (`onStart`, show the bubble, read each target's centre once). Then on every move: `nearestIndex`, bubble text, `left = clamp(x − w/2, 8, innerWidth − 8 − w)`, `top = max(8, strip.top − h − 8)`.
  - `pointerup`: if scrubbing, mark the click consumed, hide the bubble, and call `onRelease` when `strip.top − 48 ≤ y ≤ strip.bottom + 48`.
  - `pointercancel`, `lostpointercapture` before `pointerup`, and `visibilitychange` to hidden: hide and reset.
  - The bubble is one `div.focus-scrub-bubble[popover=manual][aria-hidden=true]` on `document.body` holding `span.focus-scrub-name` and `span.focus-scrub-set`, removed by `destroy`.
- [ ] **Step 4: Wire.**
  - `onStart` calls `advance.cancel()` and `cancelTravel()`.
  - `onRelease(ref)` calls `jump(ref, {animate:true, focus:true})` unless `ref` is the viewed set.
  - `describe` uses the exercise name and the item's `preview.label`.
  - The progress click starts with `if (scrub.consumeClick()) return;`.
  - `destroy` destroys the scrub.
- [ ] **Step 5: CSS.**
  - `.focus-scrub-bubble {position:fixed;inset:auto;margin:0;display:flex;gap:4px;max-width:calc(100vw - 16px);padding:6px 10px;border:1px solid var(--border);border-radius:6px;background:var(--surface-2);color:var(--text);font-size:.8125rem;line-height:1.3;white-space:nowrap;pointer-events:none;box-shadow:0 4px 16px #0006;opacity:0;transform:translateY(4px);transition:opacity 150ms ease-out,transform 150ms ease-out,display 150ms allow-discrete,overlay 150ms allow-discrete}`.
  - `:popover-open {opacity:1;transform:none}`, with `@starting-style` mirroring `.action-tooltip`.
  - `.focus-scrub-name {min-width:0;overflow:hidden;text-overflow:ellipsis}`; `.focus-scrub-set {flex:none}`, with `· ` before it.
  - Reduced motion: `transition:none`.
- [ ] **Step 6:** Run `npm test`, `npm run test:e2e` and `npm run build`. Expected: PASS.
- [ ] **Step 7: Docs and evidence.**
  - `AGENTS.md` (Workout flow) gains Part 3's rules: travel and its cancellation, arrival updates, the progress button and its name, clusters, the 44px hit area, the scrub's 8px and 48px rules and its bubble, working sets only, pointer only.
  - Mirror them in the design system's Feed entry, replacing "segmented progress strip … one segment per working set, 3px gaps" with the button and clusters.
  - Inspect at 360/390/412px with reduced motion and record it.
  - Phone checks `pending (user)`: long travels against snapping, the scrub's comfort, and that a drag on the row never scrolls the page.
- [ ] **Step 8:** Commit `feat(focus): scrub the progress row to travel to a set; document part 3`.

### Task 9 (only if the phone check fails): tween long travels

Run this task only when the user reports, during Task 8's phone check, that long travels crawl or stall against snapping.

**Files:**
- Modify: `src/workout-focus-view.js` (`startTravel`)
- Test: `e2e/workout-focus-motion.spec.js`

- [ ] **Step 1: Failing e2e**, `'a long travel lasts at most 700ms'`: travelling from `sw` to `a2` (seven sets) arrives within 750ms of the click.
- [ ] **Step 2:** Run it. Expected: FAIL, or PASS on desktop; the device is what decides.
- [ ] **Step 3:** Replace the smooth `scrollTo` inside `startTravel` with an rAF tween: duration `min(700, 200 + 60 × |toIndex − fromIndex|)` ms, ease-in-out cubic, and `.is-unsnapped` on the feed while it runs. Arrival and cancellation keep the same `arrive`/`cancelTravel` paths; the settle timer is no longer needed.
- [ ] **Step 4:** Run `npx playwright test e2e/workout-focus-motion.spec.js e2e/workout-focus-progress.spec.js`. Expected: PASS. Ask the user to repeat the phone check.
- [ ] **Step 5:** Commit `fix(focus): tween long travels` and note the outcome in the verification file.

---

## Self-review

- **Spec coverage:**
  - §1 groups, the block, the set page at rest, peeks, the fit rule, the fallback and the ticker → Tasks 1–2. Note editor, accessibility margins and preservation → Tasks 2–3. Completion/Auto-next unchanged → existing motion tests.
  - §2 rows, tags, chips, pairs, menu, removed actions, `No sets`, opening focus, density and motion → Tasks 4–5.
  - §3 travel → Task 6 (tween → Task 9); progress row → Task 7; scrub → Task 8.
  - §4 delivery → the three parts. §5 → each task's tests plus the verification file.
  - Out-of-scope items have no task by design.
- **Names:** `focusGroups`, `fitGroup`, `snapTop`, `setChip`, `progressClusters`, `nearestIndex`, `mountProgressScrub`, `startTravel`/`arrive`/`cancelTravel`, `.focus-group`, `.focus-group-name`, `.focus-group-details`, `.focus-group-sets`, `.is-name-only`, `--focus-name-h`, `--focus-pin`, `.overview-chip` and `.focus-progress-cluster` keep one spelling and one signature throughout.
- **Known gaps:**
  - Nothing in this plan was measured: the overview budget is arithmetic, and the fit matrix is expected to hold because the block plus a set page equals today's card.
  - Whether headless Chromium animates programmatic smooth scrolls is unverified (Task 6, Step 2 has the fallback).
  - Pinning under momentum scrolling, long travels with snapping on iOS and the scrub's comfort can only be confirmed on the user's phone.
