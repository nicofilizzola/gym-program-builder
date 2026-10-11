# Met Checkmark Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** In the volume list, replace the visible `under` / `met` / `over` words with a green checkmark shown only when a goal is met, keeping the status word as visually hidden text for screen readers.

**Architecture:** This is view-only. `goalStatus` and every pure function stay as they are. In `renderPanel()`'s row template (`src/app.js:116-122`), the `.status` span becomes an `aria-hidden` wrapper around an inline check SVG, and a new `.status-text visually-hidden` span holds the word. `refresh()` (`src/app.js:337`) writes the word into `.status-text`. The existing `data-status` attribute drives CSS, which shows `.status` only for `[data-status="met"]`.

**Tech Stack:** HTML, CSS, vanilla JS ES modules, `node:test` on Node 22 (`npm test`). No dependencies, no build step. Browser checks use `playwright-core` installed in the session scratchpad (never in the project), driving Chrome at `C:/Program Files/Google/Chrome/Application/chrome.exe`, with the app served by `npx --yes serve . -l 5173`.

**Spec:** `AGENTS.md`: requirement 21 (Met checkmark instead of status words), plus the edits to requirements 7 and 13, the **Goal status** rule's last bullet, and the 2026-10-11 "Met checkmark" Decided entry.

## Global Constraints

- Only `met` shows a visible mark: a checkmark SVG, `aria-hidden="true"`, `fill: none`, `stroke: currentColor` with stroke width 2.5, round caps and joins, 16×16, coloured `var(--met)` (`rgb(74, 222, 128)`). Path: `<path d="M5 12.5l4.5 4.5L19 7.5"/>` in a `0 0 24 24` viewBox.
- `under` and `over` show no visible mark and no text in the status spot. The red outline pill for `over` is removed.
- Each row with a goal has its status word (`under`, `met` or `over`) in visually hidden text inside the row button. Rows without a goal have none.
- Once any goal is set (`.has-goals`), the status spot keeps a fixed `20px` column (it was `44px`), so bars stay aligned whether or not a row shows the checkmark.
- Mobile chips (≤ 760px) show the checkmark only when met, and an under, over or no-goal chip gets no extra column or gap.
- Unchanged: the readout text (it still names the status word), `goalStatus`, bar colours, the goal marker, the body map, the goals dialog and the session file.

## Review Focus

1. **A goal slid across the volume** (for example Chest volume 7: goal 6.5 → 7 → 7.5) flips over → met → under live, and the checkmark appears and disappears with no stale icon or stale hidden word. Pinned in Task 1's browser check (live slider step).
2. **Bars stay aligned** across met, under, over and no-goal rows once any goal is set: every visible `.bar` shares the same left and right edges. Pinned in Task 1's browser check.
3. **Screen readers still get the status:** each row button's accessible name contains its word, and no-goal rows contain none. Pinned in Task 1's browser check (`getByRole` name patterns).
4. **Mobile chips for under and over** must not keep an empty gap where the old word was, and the page must not scroll horizontally. Pinned in Task 1's mobile check (chip width compared with a no-goal chip of the same value length, plus page `scrollWidth`).
5. **A goal with 0 volume** (Quads `0 / 8`) shows only the grey track, no mark, and the hidden word `under`. Pinned in Task 1's browser check.

---

### Task 1: Met checkmark in the volume list

**Files:**
- Modify: `src/app.js:116-122` (row template in `renderPanel`), `src/app.js:337` (status write in `refresh`); `style.css:1153-1156` (`.has-goals` columns), `style.css:1162-1179` (`.status` rules), `style.css:1234-1240` (mobile chip comment and columns, if needed); `docs/design-system/README.md:140-141` (volume list "With a goal" and column bullets)

**Interfaces:**
- Consumes: `goalStatus(volume, goal) → { status: 'under' | 'met' | 'over' } | null` (existing, unchanged). The row's `data-status` attribute (existing, set in `refresh`).

- [ ] **Step 1: Write the failing browser check `status.mjs` in the scratchpad.** Load the app and import a session through `#import-file` with `setInputFiles`, using a JSON buffer. Use the AGENTS.md volume worked example (Bench press 4 Chest / Triceps, Front delts; Dips 3 Chest, Triceps / Front delts; Pull-ups 3 Lats / Biceps, Upper back) with goals `{ Chest: 7, Triceps: 4, Lats: 6, Quads: 8 }`. The page starts empty, so no confirm appears. Then, at 1200×900:
  - **Chest (met):** `.status` is displayed and holds an `svg`. Its computed `color` is `rgb(74, 222, 128)`, its `textContent.trim()` is `''`, and its width is ≤ 20.
  - **Triceps (over), Lats and Quads (under):** `.status` computes to `display: none`.
  - **No visible words:** no `.status` in the list has non-empty `textContent`.
  - **Accessible names:** `getByRole('button', { name: /^Chest .*\bmet\b/ })`, `/^Triceps .*\bover\b/`, `/^Lats .*\bunder\b/` and `/^Quads .*\bunder\b/` each match exactly 1. The Biceps button's name contains none of `under`, `met` or `over`.
  - **Alignment:** every visible `.volume-row .bar` has the same `left` and `right` (±0.5 px).
  - **Readout:** hover the Triceps row and the readout contains `· over ·`.
  - **Live:** open "Set goals" and focus the Chest slider (`[data-goal="Chest"]`). Then:
    - Press Home and ArrowRight ×13, so the goal is 6.5: Chest's `.status` is hidden and its name matches `over`.
    - Press ArrowRight once, so the goal is 7: shown, and the name matches `met`.
    - Press ArrowRight once, so the goal is 7.5: hidden, and the name matches `under`.

    Close the dialog with Escape.
  - **Mobile, 360×740, same import:**
    - The Chest chip shows the `svg`, and the Triceps chip's `.status` is `display: none`.
    - The Triceps chip's width is no more than its `.name` plus `.value` widths plus 32 px of padding plus 6 px of gap (+1 px tolerance).
    - `document.documentElement.scrollWidth` is ≤ 360.
  - **Console:** no console errors, ignoring Chrome's automatic `favicon.ico` 404.

- [ ] **Step 2: Run it.** Expected: FAIL. The Chest `.status` holds the text `met` and no `svg`, and the Triceps `.status` is displayed.

- [ ] **Step 3: Update the row template in `renderPanel()`.** Replace `<span class="status"></span>` with these two spans, in this order and in the same position:
  - `<span class="status" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></span>`
  - `<span class="status-text visually-hidden"></span>`

  Like `.split`, `.status-text` must not take a grid cell. `.visually-hidden` is absolutely positioned and `.volume-row` is `position: relative`, so it doesn't.

- [ ] **Step 4: Update `refresh()`.** Replace the `.status` text write with `row.querySelector('.status-text').textContent = result?.status ?? '';`. `data-status` is already set lower in the loop, and CSS reads it.

- [ ] **Step 5: Update the CSS.**
  - `.volume-list.has-goals .volume-row`: change the last column to `20px` (`76px 1fr 72px 20px`).
  - Replace the `.volume-row .status`, `.status:empty` and `[data-status="over"] .status` rules with:
    - `.volume-row .status { display: none; }`
    - `.volume-row[data-status="met"] .status { display: grid; place-items: center; color: var(--met); }`
    - `.volume-row .status svg`: 16×16, `fill: none`, `stroke: currentColor`, stroke width 2.5, round caps and joins.
  - On mobile, keep the implicit-column chip layout. Update its comment so it mentions the checkmark rather than the status text.

- [ ] **Step 6: Update the design system README.**
  - Rewrite the "With a goal" bullet: the value reads `volume / goal`, the bar shows the marker, and a met goal adds a 16px `--met` checkmark (`aria-hidden`). Under and over show no mark, because the bar colour and the value carry them. The status word is visually hidden in the row for screen readers.
  - Change the column bullet's widths to `76px 1fr 72px 20px`.
  - In the "Colour never stands alone" principle (line 11), replace "status text" with "the `volume / goal` value, the met checkmark and the hidden status word".

- [ ] **Step 7: Verify.** Run `npm test`. Expected: all pass, with an unchanged count. Then run the browser check. Expected: every assertion in `status.mjs` passes.

- [ ] **Step 8: Commit.**

```bash
git add src/app.js style.css docs/design-system/README.md
git commit -m "feat: show a checkmark for met goals instead of status words"
```
