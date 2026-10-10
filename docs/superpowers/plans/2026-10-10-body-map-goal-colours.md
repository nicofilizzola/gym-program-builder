# Body Map in Goal-Status Colours Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Colour the body map with the volume bars' goal-status colours, and remove the heat scale, its legend and its tokens.

**Architecture:** A new pure `bodyMapTone(volume, goal)` in `src/volume.js`, built on `goalStatus`, replaces `volumeLevel` and `LEVEL_LIMITS`. `refresh()` writes `data-tone` instead of `data-level` on every `[data-muscle]` element in the panel. CSS maps the tone to the existing status tokens. The legend markup and CSS, and the `--lvl-*` tokens, go away. The two non-body-map users of those tokens (the secondary card highlight) get named tokens.

**Tech Stack:** HTML, CSS, vanilla JS ES modules, `node:test` on Node 22. No dependencies, no build step.

**Spec:** `AGENTS.md`: requirement 15, the **Body map colours** business rule, the `bodyMapTone` implementation guideline, and the "Body map in goal-status colours" entry under "Decided".

## Global Constraints

- No dependencies; no build step.
- Tone → colour on the body map: `under` → `--under` (#fbbf24), `met` → `--met` (#4ade80), `over` → `--over` (#f87171), `trained` → `--no-goal` (#94a3b8), `untrained` → new `--untrained` (#3a4656, the old level-0 grey).
- A muscle with a goal and 0 volume is `under` (amber).
- One solid colour per muscle on the body map, with no direct/indirect split.
- Remove the heat legend on every screen size. The Direct / Indirect key stays.
- Remove `volumeLevel`, `LEVEL_LIMITS`, their test, and the `--lvl-0`…`--lvl-4` tokens. The secondary card highlight keeps its exact look: the `--lvl-2` uses become a new `--accent-deep: #c2410c`, and the `--lvl-3` use becomes `--accent` (same value, #f97316).
- Unchanged: the volume list (bars, values, status, visibility), the readout, the Direct / Indirect key, hover, focus and selection behaviour on the body map, and the session file.
- A goal row at 0 volume keeps its muted value text (`0 / 8`), which today comes from `data-level="0"`.

## Review Focus

1. **Goal set, 0 volume** (empty session, goal Calves 6): the Calves region is amber on the body map, and the `0 / 6` row value stays muted. Tested in Task 1; checked by hand in Task 2.
2. **Clearing a goal on a muscle with volume** (Chest 7 with goal 7, then the goal slider back to 0): Chest goes from green to neutral grey-blue on that edit. Checked by hand in Task 2.
3. **Selection dimming** (`.has-selection .region:not(.is-selected)` at opacity 0.4): it still works on the new fills, and the focused region still gets its white stroke. Checked by hand in Task 2.
4. **The secondary card highlight** (select a muscle that is secondary in some exercise): its dashed card border, deep-orange left edge and tag look exactly as before. Checked by hand in Task 2.
5. **Mobile (≤ 760px):** no legend gap or empty space is left where the legend was, and the pinned panel's height doesn't jump. Checked by hand in Task 2.

---

### Task 1: Pure body map tone

**Files:**
- Modify: `src/volume.js` (add `bodyMapTone`; remove `LEVEL_LIMITS` and `volumeLevel`, lines 62-75)
- Modify: `test/volume.test.js` (import line 4; replace the `volumeLevel` test at lines 55-58)
- Modify: `src/app.js` (import line 2 and line 225; `refresh()` must keep working once `volumeLevel` is gone)

**Interfaces:**
- Consumes: `goalStatus(volume, goal) → { status } | null` (existing).
- Produces: `bodyMapTone(volume: number, goal: number | undefined) → 'under' | 'met' | 'over' | 'trained' | 'untrained'`.

- [ ] **Step 1: Write the failing tests**

Replace the `volumeLevel` test and import with `bodyMapTone`:

```js
test('bodyMapTone worked example from spec', () => {
  const volume = computeVolume(WORKED_EXAMPLE);
  const tones = (goals) => Object.fromEntries(MUSCLE_GROUPS.map((m) => [m, bodyMapTone(volume[m], goals[m])]));
  assert.deepEqual(tones(GOALS), {
    Chest: 'met', Lats: 'under', 'Upper back': 'trained', Biceps: 'trained', Triceps: 'over',
    Shoulders: 'trained', Abs: 'untrained', Quads: 'under', Hamstrings: 'untrained', Calves: 'untrained',
  });
  assert.deepEqual(tones({}), {
    Chest: 'trained', Lats: 'trained', 'Upper back': 'trained', Biceps: 'trained', Triceps: 'trained',
    Shoulders: 'trained', Abs: 'untrained', Quads: 'untrained', Hamstrings: 'untrained', Calves: 'untrained',
  });
});

test('bodyMapTone: a goal at 0 volume is under, not untrained', () => {
  assert.equal(bodyMapTone(0, 6), 'under');
  assert.equal(bodyMapTone(0, undefined), 'untrained');
  assert.equal(bodyMapTone(0.5, undefined), 'trained');
});

test('volume.js no longer exports the heat scale', async () => {
  const mod = await import('../src/volume.js');
  assert.equal('volumeLevel' in mod, false);
});
```

Place these after the module-level `GOALS` constant (it is defined after the `barSegments` tests), next to the other worked-example tests.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL. `test/volume.test.js` errors with `does not provide an export named 'bodyMapTone'`.

- [ ] **Step 3: Implement**

In `src/volume.js`, add `bodyMapTone` with a JSDoc: `goalStatus(volume, goal)?.status ?? (volume > 0 ? 'trained' : 'untrained')`. Delete `LEVEL_LIMITS` and `volumeLevel`. In `src/app.js`, import `bodyMapTone` instead of `volumeLevel`. At line 225, set `el.dataset.tone = bodyMapTone(volume[muscle], session.goals[muscle])` (it replaces `el.dataset.level = …`).

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS, all tests. Also run `git grep -n "volumeLevel\|LEVEL_LIMITS" -- src test`; expected output: none.

- [ ] **Step 5: Commit**

```bash
git add src/volume.js src/app.js test/volume.test.js
git commit -m "feat: derive a goal-status tone for each body map muscle"
```

### Task 2: Body map colours, legend removal, and design system

**Files:**
- Modify: `index.html:47-53` (delete the `<ul class="legend">` block)
- Modify: `src/app.js` (`refresh()` volume-row loop: add the `is-zero` class)
- Modify: `style.css`:
  - the `:root` heat tokens (lines 14-19)
  - `.exercise[data-hit="secondary"]` (line 192) and its `.hit-tag` (lines 234-235)
  - the `.region` fills (lines 783-792)
  - the `.legend` rules (lines 817-842)
  - `.volume-row[data-level="0"] .value` (line 1003)
  - the mobile `.legend,` selector (line 1076)
- Modify: `docs/design-system/README.md` (the "Heat scale" section, "Colour never stands alone", the token table, the volume panel list item 4 and its renumbering, the mobile layout line, the typography "Captions, legend, tags" row)

**Interfaces:**
- Consumes: `data-tone` on every `.region` and `.volume-row` (Task 1).

- [ ] **Step 1: Markup and the muted zero value**

Delete the legend `<ul>` from `index.html`. In `refresh()`'s volume-row loop, add `row.classList.toggle('is-zero', sets === 0)`. It replaces the `data-level="0"` hook, which only ever affected goal rows at 0, because rows without a goal at 0 are hidden.

- [ ] **Step 2: CSS**

- `:root`: delete `--lvl-0`…`--lvl-4` and their comment. Add `--untrained: #3a4656;` next to the status tokens (comment: body map muscle with no goal and no volume), and `--accent-deep: #c2410c;` next to `--accent` (comment: secondary highlight edge).
- Secondary highlight: `var(--lvl-2)` becomes `var(--accent-deep)` (twice), and `var(--lvl-3)` becomes `var(--accent)`.
- Regions: the default fill becomes `var(--untrained)`. Replace the four `data-level` fill rules with five `data-tone` rules: `untrained`, `trained` → `--no-goal`, `under`, `met`, `over`. Keep the existing `transition: fill 250ms`.
- Delete every `.legend` rule, and drop `.legend,` from the mobile selector (keep `.split-key { display: none; }`).
- `.volume-row[data-level="0"] .value` becomes `.volume-row.is-zero .value`.

- [ ] **Step 3: Design system**

In `docs/design-system/README.md`:
- Replace the "Heat scale" section with "Body map colours". It is a five-row table (tone, rule, token): `bodyMapTone` in `src/volume.js` decides the tone, and CSS maps `data-tone` to a colour. There is no legend; the volume list and readout carry the numbers and status as text.
- Add `--untrained` and `--accent-deep` to the token table.
- Change the "One accent" and "Colour never stands alone" lines to say that body map colours pair with the volume list's numbers and status text.
- Delete volume panel item 4 (Legend) and renumber.
- Remove "the legend hidden" from the mobile layout line.
- Change the typography row "Captions, legend, tags" to "Captions, tags".
- Drop "heat fills" from the motion line if it names them, in favour of "body map fills".

- [ ] **Step 4: Verify**

Run: `npm test` (expected: PASS) and `git grep -n "lvl-\|legend\|data-level" -- index.html style.css src docs/design-system`. Expected: only the chip `<legend>` elements and `.chips legend` remain.

Then `npm start` and import the worked example with goals Chest 7, Triceps 4, Lats 6, Quads 8. Check:
- **Tones:** Chest green, Triceps red, Lats and Quads amber, Shoulders, Biceps and Upper back grey-blue, Abs, Hamstrings and Calves dark grey.
- **No legend:** the panel shows none between the readout and the key.
- **Quads row:** it reads `0 / 8` in muted text.
- **Clearing a goal:** Chest's goal slider back to 0 turns Chest grey-blue.
- **Selection:** select Shoulders. The other regions dim, Shoulders gets the white stroke, and a card where Shoulders is secondary shows the unchanged deep-orange dashed highlight.
- **Mobile:** at 360px, the pinned panel shows the figures and chips with no gap where the legend was.

- [ ] **Step 5: Commit**

```bash
git add index.html src/app.js style.css docs/design-system/README.md
git commit -m "feat: colour the body map by goal status and remove the heat legend"
```
