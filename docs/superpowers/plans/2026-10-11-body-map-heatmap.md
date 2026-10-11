# Body Map Volume Heatmap Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Colour the body map by absolute volume in five levels (0, 0.5–3, 3.5–6, 6.5–9, 9.5+), with an orange-to-red ramp peaking in orange at the ideal 4–6, and a legend under the figures. Goals no longer colour the body map.

**Architecture:**
- **Rule:** a new pure `heatLevel(volume)` in `src/volume.js` replaces `bodyMapTone`. The band limits are defined once beside it as `HEAT_BANDS`.
- **Rendering:** `refresh()` (`src/app.js:317-322`) writes `data-heat="0…4"` on each body map region instead of `data-tone`.
- **Colours:** CSS maps `data-heat` to five colours defined once as tokens on `:root`.
- **Legend:** a static `aria-hidden` list in `index.html`, under `#body-map`, uses the same tokens.

**Tech Stack:** HTML, CSS, vanilla JS ES modules, `node:test` on Node 22 (`npm test`). No dependencies, no build step. Browser checks use `playwright-core` installed in the session scratchpad (never in the project), driving Chrome at `C:/Program Files/Google/Chrome/Application/chrome.exe`, with the app served by `npx --yes serve . -l 5173`.

**Spec:** `AGENTS.md`: requirement 15 (Body map as an absolute volume heatmap); the edits to requirements 7 and 13; the **Body map heat levels** rule and its worked example; the heat-level implementation guideline; the 2026-10-11 "Body map volume heatmap" Decided entry.

## Global Constraints

- Levels: `0` if volume = 0; `1` if 0 < v ≤ 3; `2` if 3 < v ≤ 6; `3` if 6 < v ≤ 9; `4` if v > 9. These hold no matter the goals. The limits are `[3, 6, 9]`, defined once.
- Colours:

  | Level | Token | Value | Computed `rgb` |
  |---|---|---|---|
  | 0 | `--untrained` (existing) | `#3a4656` | `rgb(58, 70, 86)` |
  | 1 | `--heat-1` | `#9a4a1f` | `rgb(154, 74, 31)` |
  | 2 | `--heat-2` | `var(--accent)`, `#f97316` | `rgb(249, 115, 22)` |
  | 3 | `--heat-3` | `#f0522d` | `rgb(240, 82, 45)` |
  | 4 | `--heat-4` | `#dc2626` | `rgb(220, 38, 38)` |

- Legend copy, in order: `0`, `1–3`, `4–6`, `7–9`, `10+` (en dashes). It is `aria-hidden="true"`, under the two figures, and shown on desktop and mobile.
- Unchanged: the volume-list bar colours (goal status), the checkmark, the readout, hover, focus and selection on the body map, the goals dialog and the session file.

## Review Focus

1. **Half-set values at band edges** (3 / 3.5, 6 / 6.5, 9 / 9.5) land in the right level. Pinned in Task 1's boundary test.
2. **Volume above 12** (for example 13 or 15) stays in level 4 and never produces an empty or unknown colour. Pinned in Task 1's boundary test and Task 2's live browser step (Bench press sets → 10, so Chest reaches 13).
3. **A goal at 0 volume** (Quads `0 / 8`) is grey on the body map while its list row stays under. The body map and bars no longer agree, and that's intended. Pinned in Task 2's browser check.
4. **Mobile pinned panel:** the legend fits on one line at 360px, the page doesn't scroll horizontally, and the volume chip row is still on screen. Pinned in Task 2's mobile check.
5. **Focus and selection on an accent-orange fill:** the white focus stroke and the 0.4 dimming of unselected regions still apply. Pinned in Task 2's browser check.

---

### Task 1: `heatLevel` rule

**Files:**
- Modify: `src/volume.js` (add `HEAT_BANDS` and `heatLevel` next to `bodyMapTone`; leave `bodyMapTone` for Task 2 to remove)
- Test: `test/volume.test.js`

**Interfaces:**
- Produces: `HEAT_BANDS: readonly number[]`, with the value `Object.freeze([3, 6, 9])`, and `heatLevel(volume: number) → 0 | 1 | 2 | 3 | 4`.

- [ ] **Step 1: Write the failing tests** in `test/volume.test.js`, adding `heatLevel` and `HEAT_BANDS` to the import:

```js
test('heatLevel worked example from spec (goals make no difference)', () => {
  const volume = computeVolume(WORKED_EXAMPLE);
  assert.deepEqual(Object.fromEntries(MUSCLE_GROUPS.map((m) => [m, heatLevel(volume[m])])), {
    Chest: 3, Lats: 1, 'Upper back': 1, Biceps: 1, Triceps: 2, 'Front delts': 2,
    'Side delts': 0, 'Rear delts': 0, Abs: 0, Quads: 0, Hamstrings: 0, Calves: 0,
  });
});

test('heatLevel band boundaries, including volume above 12', () => {
  const cases = [[0, 0], [0.5, 1], [3, 1], [3.5, 2], [6, 2], [6.5, 3], [9, 3], [9.5, 4], [12, 4], [15, 4]];
  for (const [v, level] of cases) assert.equal(heatLevel(v), level, `volume ${v}`);
});

test('HEAT_BANDS holds the spec limits, frozen', () => {
  assert.deepEqual([...HEAT_BANDS], [3, 6, 9]);
  assert.ok(Object.isFrozen(HEAT_BANDS));
});
```

- [ ] **Step 2: Run `npm test`.** Expected: FAIL. `heatLevel` is not a function, or the import is undefined.

- [ ] **Step 3: Implement `HEAT_BANDS` and `heatLevel`** in `src/volume.js`, with JSDoc in the file's style. The level is 0 at volume 0; otherwise it is 1 plus the number of bands strictly below the volume.

- [ ] **Step 4: Run `npm test`.** Expected: all pass. The count goes up by 3.

- [ ] **Step 5: Commit.**

```bash
git add src/volume.js test/volume.test.js
git commit -m "feat: add body map heat level rule"
```

---

### Task 2: Heatmap colours and legend on the body map

**Files:**
- Modify:
  - `src/volume.js`: delete `bodyMapTone`.
  - `src/app.js:2`: in the import, swap `bodyMapTone` for `heatLevel`.
  - `src/app.js:320`: write `data-heat`.
  - `index.html:59`: add the legend after `#body-map`.
  - `style.css:15-24`: add the tokens.
  - `style.css:924-928`: map `data-heat` to colours.
  - `style.css`: add the `.heat-key` rules next to `.split-key` (around line 1107), and update the `.split-key` margin comment.
  - `docs/design-system/README.md`: the principles (lines 9-11), the token table (lines 30-34), "Body map colours" (lines 38-46), and the volume list's body map bullet (line 143).
- Test: `test/volume.test.js` (delete the two `bodyMapTone` tests and the `volume.js no longer exports the heat scale` test).

**Interfaces:**
- Consumes: `heatLevel(volume) → 0…4`, from Task 1.

- [ ] **Step 1: Write the failing browser check `heat.mjs` in the scratchpad.** Load the app and import the volume worked example (Bench press 4 Chest / Triceps, Front delts; Dips 3 Chest, Triceps / Front delts; Pull-ups 3 Lats / Biceps, Upper back) with goals `{ Chest: 7, Triceps: 4, Lats: 6, Quads: 8 }`, by calling `setInputFiles('#import-file', …)` with a JSON buffer. Then, at 1200×900:
  - **Region levels:** each `.region[data-muscle=M]` in `#body-map` has `data-heat` equal to the spec worked example (Chest 3, Lats 1, Upper back 1, Biceps 1, Triceps 2, Front delts 2, the rest 0), and no region has `data-tone`.
  - **Region colours:** the computed `fill` of a region's first `path` is the level's `rgb` from Global Constraints. Check Chest (3), Triceps (2), Lats (1), and Quads (0, despite its goal of 8).
  - **Bars unchanged:** the Chest row's `.bar-direct` background is still `rgb(74, 222, 128)` (met), and the Quads row still has `data-status="under"`.
  - **Legend:**
    - `#heat-key` exists, has `aria-hidden="true"`, and its top is ≥ `#body-map`'s bottom.
    - Its `li` texts are exactly `['0', '1–3', '4–6', '7–9', '10+']`.
    - Each `li::before` background is the matching level `rgb`.
  - **Focus and selection:** click the Chest region. Chest's path has a computed `stroke` of `rgb(255, 255, 255)`, and the Triceps region's path has a computed `opacity` of `0.4`. Click Chest again to deselect.
  - **Live, above 12:** click "Expand all", then focus the first card's sets slider (`[data-field="sets"]`) and press End (10 sets). Chest volume becomes 13: `data-heat="4"`, with fill `rgb(220, 38, 38)`.
  - **Mobile, 360×740, same import:**
    - `#heat-key` is visible inside the viewport, and its height is < 24 (one line).
    - `document.documentElement.scrollWidth` is ≤ 360.
    - The first `.volume-row` chip's bottom is ≤ 740.
  - **Console:** no console errors, ignoring Chrome's automatic `favicon.ico` 404.

- [ ] **Step 2: Run it.** Expected: FAIL. There is no `data-heat`, no `#heat-key`, and Chest is filled green.

- [ ] **Step 3: Switch the rendering to heat levels.**
  - In `refresh()`, replace the `dataset.tone` line with `el.dataset.heat = heatLevel(volume[muscle]);` and update the import.
  - Delete `bodyMapTone` and its JSDoc from `src/volume.js`, and delete its two tests and the old "no longer exports the heat scale" test.
  - Run `grep -rn "bodyMapTone\|data-tone\|dataset.tone" src style.css test`. Expected: no output.

- [ ] **Step 4: Add the tokens and the region colours.**
  - On `:root`, add `--heat-1` to `--heat-4` from Global Constraints, under a comment `/* Body map volume heatmap: builds to the accent at the ideal 4–6 sets, then leans red. */`. `--heat-2` is `var(--accent)`.
  - Fix the stale comment above the goal status tokens to read "volume-list bars and the met checkmark".
  - Replace the four `data-tone` rules with `.region[data-heat="1"] path { fill: var(--heat-1); }` through `"4"`, with the comment `/* Absolute volume heat level from heatLevel(); level 0 keeps the untrained fill. */`.

- [ ] **Step 5: Add the legend.**
  - **Markup**, after `#body-map` in `index.html`: `<ul id="heat-key" class="heat-key" aria-hidden="true">` with five `<li data-heat="0…4">`, holding the legend copy.
  - **CSS for `.heat-key`:** the same look as `.split-key` (flex row, 0.75rem `--muted`, 10px rounded swatch via `li::before`, `vertical-align: -1px`). Use `justify-content: center`, `gap: 10px`, `margin: 8px 0 0`, `flex-wrap: nowrap`.
  - **Swatches:** set each swatch with `.heat-key [data-heat="0"]::before { background: var(--untrained); }` through `"4"` with `var(--heat-4)`.
  - **`.split-key` comment:** drop the "removed heat legend" wording, and keep its margin.

- [ ] **Step 6: Update the design system README.**
  - **Principles:** name the heat ramp as the only other colour use besides the status colours.
  - **Tokens:** add `--heat-1` to `--heat-4` rows to the table. Change `--no-goal` to "Volume bar without a goal; split key swatches" and `--untrained` to "Body map muscle with 0 volume; heat legend `0`".
  - **"Body map colours":** rewrite it as "Body map heatmap", with a level table (level, volume, token, legend label). Say that `heatLevel(volume)` in `src/volume.js` (unit-tested) picks the level, CSS maps `data-heat` to a token, goals are ignored, and the legend sits under the figures.
  - **Line 143:** replace "Goals colour the body map the same way as the bars" with "The body map shows volume heat, not goal status (see Body map heatmap)".

- [ ] **Step 7: Verify.** Run `npm test`. Expected: all pass, with the count 3 lower than after Task 1 (the three removed tests). Then run the browser check. Expected: every assertion in `heat.mjs` passes.

- [ ] **Step 8: Commit.**

```bash
git add src/volume.js src/app.js index.html style.css test/volume.test.js docs/design-system/README.md
git commit -m "feat: colour the body map as an absolute volume heatmap with a legend"
```
