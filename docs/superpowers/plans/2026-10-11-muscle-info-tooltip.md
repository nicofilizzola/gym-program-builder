# Muscle Info Tooltip Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the goals dialog's inline info panel into an animated overlay tooltip (hover peeks, click pins), move the info buttons into an aligned right-hand column, and remove the recommended ranges and their warnings entirely.

**Architecture:**
- **Data and rules:** `MUSCLE_INFO` (`src/muscles.js`) drops `recommended`, leaving `{ sets, notes }`. `goalRangeCheck` (`src/volume.js`) and its tests are deleted.
- **Placement math:** a new pure `tooltipPosition()` in a new `src/tooltip.js` decides the tooltip's top/left and whether it sits below or above the button. It is unit-tested with `node:test`.
- **UI:** `renderGoalFields()` (`src/app.js:131-157`) builds a 4-column row: name, slider, value, info button. Each row gets one `popover="manual"` tooltip element. This puts the tooltip in the top layer, so it never shifts the layout and the dialog's `overflow-y: auto` never clips it. A small controller in `src/app.js` holds the single shown tooltip (`{ button, pinned }`) and handles hover, focus, click, outside press, Escape, scroll and resize. The fade and slide are CSS transitions with `@starting-style`, and the existing global reduced-motion rule (`style.css:1280`) makes them instant.

**Tech Stack:** HTML, CSS, vanilla JS ES modules, `node:test` on Node 22 (`npm test`). No dependencies, no build step. Browser checks use `playwright-core` installed in the session scratchpad (never in the project), driving Chrome at `C:/Program Files/Google/Chrome/Application/chrome.exe`, with the app served by `npx --yes serve .`.

**Spec:** `AGENTS.md`: requirements 6 and 19 (Muscle info tooltip); the **Muscle info (content)** section; the implementation guidelines on `MUSCLE_INFO` and the tooltip; the 2026-10-11 "Muscle info tooltip" Decided entry; and the out-of-scope line.

## Global Constraints

- Info button: accessible name `About <Muscle>`, the existing "i" SVG (`<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>`), 28×28, in its own last grid column, after the value, on desktop and mobile.
- Tooltip content: exactly two lines, a bold `Productive sets` followed by `MUSCLE_INFO[m].sets`, and a bold `Programming` followed by `MUSCLE_INFO[m].notes`. No recommended range anywhere in the dialog.
- Hover grace is `150` ms. Gap between the button and the tooltip is `6` px. The tooltip keeps at least an `8` px margin from the window edges. Width is `min(280px, calc(100vw - 16px))`.
- Animation: opacity 0→1 and translate 4 px → 0 (from above when placed below, from below when placed above), `150ms ease-out`, in and out. Reduced motion: instant, through the existing global rule.
- Only one tooltip is shown at a time. Button state: `aria-expanded="true"` while shown, `aria-controls` and `aria-describedby` set to the tooltip's id.
- Native `popover` and `<dialog>` only, with no library. The session, goals, goal limits, volume list, body map and session file are unchanged.

## Review Focus

1. **A short window (phone landscape, or a row near the dialog's bottom edge):** the tooltip flips above, or is clamped inside the window when neither side fits. It is never cut off. Pinned in Task 2 (the "neither side fits" test) and in Task 3's browser check (the flip at 1200×600).
2. **Escape with a tooltip shown** hides only the tooltip, and the dialog stays open. A second Escape closes the dialog. Pinned in Task 3's browser check.
3. **A backdrop click while a tooltip is pinned** closes the dialog, and reopening it shows no tooltip. A tooltip left in the top layer would float over the page. Pinned in Task 3's browser check.
4. **Scrolling the dialog list while a tooltip is pinned** must not leave the tooltip floating detached from its button: it hides. Pinned in Task 3's browser check.
5. **Touch:** a tap pins the tooltip with no hover. Tapping a slider elsewhere hides it, and the slider still moves on that tap. Pinned in Task 3's mobile browser check.

---

### Task 1: Remove the recommended ranges and range warnings

**Files:**
- Modify: `src/muscles.js:17-43` (the `info` helper and `MUSCLE_INFO`), `src/volume.js:74-85` (delete `goalRangeCheck`), `src/app.js:2` (import), `src/app.js:142` (`.goal-hint` markup), `src/app.js:159-186` (delete `goalHint`, trim `showGoal`), `style.css:844-854` (`.goal-hint`), `style.css:1270-1273` (mobile `.goal-hint`), `docs/design-system/README.md:148` (the range hint bullet)
- Test: `test/volume.test.js:228-249`

**Interfaces:**
- Produces: `MUSCLE_INFO: Readonly<Record<MuscleGroup, Readonly<{ sets: string, notes: string }>>>`. `goalRangeCheck` no longer exists.

- [ ] **Step 1: Update the tests.** Rename the test to `'MUSCLE_INFO has one entry per muscle with info text'` and remove the `ranges` block. Add `for (const m of MUSCLE_GROUPS) assert.deepEqual(Object.keys(MUSCLE_INFO[m]), ['sets', 'notes'], m);`. Keep the `sets`/`notes` presence check, the Side delts notes check and the frozen check. Delete the `goalRangeCheck worked example from spec` test, and remove `goalRangeCheck` from the import on line 4.

- [ ] **Step 2: Run `npm test`.** Expected: FAIL. `Object.keys(MUSCLE_INFO.Chest)` is `['recommended', 'sets', 'notes']`.

- [ ] **Step 3: Remove the range data and check.** In `src/muscles.js`, change the helper to `info(sets, notes)` and drop the two numbers from every call. Update the JSDoc to "the info text shown in the goals dialog". Delete `goalRangeCheck` and its JSDoc from `src/volume.js`.

- [ ] **Step 4: Remove the hint from the UI.** In `src/app.js`, remove `goalRangeCheck` from the import, the `<p class="goal-hint" …>` line, the `goalHint` function, and the hint block at the end of `showGoal`, and update `showGoal`'s JSDoc ("value text and fill"). Delete the `.goal-hint` and `.goal-hint.is-warning` rules and the mobile `.goal-hint` rule, and renumber the mobile `.goal-info` rule to `grid-row: 3`. In the design system README, delete the "Range hint" bullet.

- [ ] **Step 5: Verify.** Run `npm test`. Expected: all pass. Then run `grep -rn "goalRangeCheck\|goal-hint\|recommended" src style.css test docs/design-system`. Expected: no output.

- [ ] **Step 6: Commit.**

```bash
git add src/muscles.js src/volume.js src/app.js style.css test/volume.test.js docs/design-system/README.md
git commit -m "feat: remove recommended goal ranges and warnings"
```

---

### Task 2: Tooltip placement function

**Files:**
- Create: `src/tooltip.js`
- Test: `test/tooltip.test.js`

**Interfaces:**
- Produces: `tooltipPosition(anchor, tip, viewport) → { top: number, left: number, placement: 'below' | 'above' }`. Here `anchor` is `{ top, right, bottom }` (a `DOMRect` works), `tip` is `{ width, height }`, and `viewport` is `{ width, height }`. The module exports `TOOLTIP_GAP = 6` and `TOOLTIP_MARGIN = 8`.

- [ ] **Step 1: Write the failing tests in `test/tooltip.test.js`.**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { tooltipPosition } from '../src/tooltip.js';

const tip = { width: 280, height: 120 };
const vp = { width: 1200, height: 1000 };

test('sits below the button, right edges aligned', () => {
  assert.deepEqual(tooltipPosition({ top: 100, right: 400, bottom: 128 }, tip, vp),
    { top: 134, left: 120, placement: 'below' });
});

test('flips above when there is no room below', () => {
  assert.deepEqual(tooltipPosition({ top: 900, right: 400, bottom: 928 }, tip, vp),
    { top: 774, left: 120, placement: 'above' });
});

test('keeps the left edge inside the window', () => {
  assert.equal(tooltipPosition({ top: 100, right: 200, bottom: 128 }, tip, { width: 360, height: 740 }).left, 8);
});

test('keeps the right edge inside the window', () => {
  assert.equal(tooltipPosition({ top: 100, right: 400, bottom: 128 }, tip, { width: 360, height: 740 }).left, 72);
});

test('neither side fits: takes the roomier side, clamped inside the window', () => {
  // Room below 78 px, room above 66 px, so below; top is clamped to 200 − 8 − 150.
  assert.deepEqual(tooltipPosition({ top: 80, right: 300, bottom: 108 }, { width: 280, height: 150 }, { width: 360, height: 200 }),
    { top: 42, left: 20, placement: 'below' });
});
```

- [ ] **Step 2: Run `npm test`.** Expected: FAIL (cannot find `../src/tooltip.js`).

- [ ] **Step 3: Implement `tooltipPosition` in `src/tooltip.js`.** Rules:
  - `left = clamp(anchor.right − tip.width, MARGIN, viewport.width − MARGIN − tip.width)`.
  - Room below is `viewport.height − MARGIN − (anchor.bottom + GAP)`. Room above is `anchor.top − GAP − MARGIN`.
  - Place it below when the tip fits below. Otherwise place it above when it fits above. Otherwise use the side with more room (below on a tie).
  - Below: `top = anchor.bottom + GAP`. Above: `top = anchor.top − GAP − tip.height`. Then clamp `top` to `[MARGIN, viewport.height − MARGIN − tip.height]`, with `MARGIN` winning if the tip is taller than the window.

  Add a one-line JSDoc, like the other pure modules.

- [ ] **Step 4: Run `npm test`.** Expected: all pass.

- [ ] **Step 5: Commit.**

```bash
git add src/tooltip.js test/tooltip.test.js
git commit -m "feat: add tooltip placement function"
```

---

### Task 3: Info tooltip in the goals dialog

**Files:**
- Modify: `src/app.js:131-157` (`renderGoalFields`), `src/app.js:187-191` (replace `setInfoOpen`), `src/app.js:566-575` (the open-goals and `goalFields` click handlers), plus new listeners next to the dialog's backdrop handler (`src/app.js:589`); `style.css:783-880` (goal row, info button, `.goal-info` → `.info-tip`), `style.css:1251-1278` (mobile goal row); `docs/design-system/README.md:146,149` (goals dialog row layout and the info button bullet)

**Interfaces:**
- Consumes: `tooltipPosition`, from Task 2. `MUSCLE_INFO[m].sets` / `.notes`, from Task 1.

- [ ] **Step 1: Write the failing browser check `tooltip.mjs` in the scratchpad.** Serve the app. Use a 1200×1000 desktop context, then open "Set goals". Check:
  - **Layout:** all 12 `.info-btn` share one `right` (±0.5 px), and each is to the right of its row's `.slider-value`. The dialog's text contains no `Recommended`.
  - **Peek:** record the dialog's `scrollHeight` and the Lats row's rect. Hover `[aria-label="About Chest"]`. The element named by its `aria-controls` matches `:popover-open`, the button has `aria-expanded="true"` and an `aria-describedby` equal to that id, and the tooltip contains `Productive sets` and `Combine pressing and flyes`. The dialog's `scrollHeight` and the Lats rect are unchanged. The tooltip's top is ≥ the button's bottom, and its right edge is within 1 px of the button's right edge.
  - **Animation:** right after hovering, `tip.getAnimations().length > 0`.
  - **Grace:** move the mouse onto the tooltip's centre and wait 300 ms: still open. Move it to the dialog heading and wait 300 ms: hidden, with `aria-expanded="false"`.
  - **Pin:** click Chest, move to the heading, and wait 300 ms: still open. Hover the Lats button: Lats is shown and Chest is hidden. Click the Lats button twice: hidden.
  - **Outside press:** pin Chest, then click the heading: hidden, and the dialog is still open.
  - **Escape:** pin Chest and press Escape: the tooltip is hidden and `dialog.open` is `true`. Press Escape again: `dialog.open` is `false`.
  - **Backdrop:** reopen the dialog, pin Chest and click the backdrop at (5, 5): the dialog is closed and no element matches `.info-tip:popover-open`. Reopen it: still none.
  - **Keyboard:** focus the Chest slider and press Tab: the Chest tooltip is shown. Press Tab again: it is hidden.
  - **Scroll:** pin Chest, then set the dialog's `scrollTop` to 200 and dispatch `scroll`: hidden.
  - **Flip:** at 1200×600, scroll the dialog to the bottom and hover the Calves button. The tooltip's bottom is ≤ the button's top, and the whole tooltip is inside the viewport.
  - **Reduced motion:** in a new context with `reducedMotion: 'reduce'`, hover Chest. `getAnimations().length === 0`, and the computed opacity is `1`.
  - **Mobile:** use a 360×740 context with `hasTouch: true, isMobile: true`. Tap the Chest info button: shown, inside the viewport (`left ≥ 8`, `right ≤ 352`), and the dialog has no horizontal overflow. The 12 buttons share one `right`. In the Front delts row, the name, value and button rects don't overlap. Tap the Lats slider's middle: the tooltip is hidden, and the Lats value is no longer `No goal`.

- [ ] **Step 2: Run it.** Expected: FAIL (no `:popover-open` tooltip, buttons not aligned).

- [ ] **Step 3: Rebuild the row in `renderGoalFields()`.** In DOM order:
  - `<span class="goal-name">`, with no `.goal-label` wrapper.
  - The existing `.slider`.
  - `.slider-value`.
  - `<button type="button" class="info-btn" aria-expanded="false" aria-controls="goal-info-<i>" aria-describedby="goal-info-<i>">`, with the SVG and `aria-label` as now.
  - `<div class="info-tip" id="goal-info-<i>" popover="manual">`, with the same two `<p><strong>…</strong> <span>…</span></p>` lines as today.

  Set the text with `textContent`, as now.

- [ ] **Step 4: Add the tooltip controller in `src/app.js`**, replacing `setInfoOpen`. State: `let shownTip = null; // { button, pinned }` and one hide timer.
  - `showTip(button, pinned)`: hides any other tip and clears the timer. Calls `showPopover()` if not already open. Measures the tip, sets `style.top`/`style.left` and `dataset.placement` from `tooltipPosition(button.getBoundingClientRect(), { width, height }, { width: innerWidth, height: innerHeight })`, and sets `aria-expanded="true"`.
  - `hideTip()`: `hidePopover()`, sets `aria-expanded="false"`, clears the timer, and sets `shownTip = null`.
  - **Listeners:**
    - `goalFields`: `pointerover` on `.info-btn` or `.info-tip` with `pointerType === 'mouse'` → show that row's tip (keep `pinned` if it is the same one), or cancel the timer when hovering the shown tip.
    - `goalFields`: `pointerout` with `pointerType === 'mouse'` to outside both the button and the tip, when not pinned → hide after 150 ms.
    - `goalFields`: `focusin` on an `.info-btn` that `matches(':focus-visible')` → peek. `focusout` from it, when not pinned → hide.
    - `goalFields`: a click on `.info-btn` → if it is the shown and pinned one, hide it; otherwise `showTip(button, true)`.
    - `goalsDialog`: `pointerdown` (capture) outside the shown button and its tip → hide.
    - `goalsDialog`: `keydown` Escape with a tip shown → `preventDefault()` and hide (this stops the dialog's cancel).
    - `goalsDialog`: `scroll`, and `close` → hide.
    - `window`: `resize` → hide.
    - Replace the `#open-goals` reset with `hideTip()` when a tip is shown.

- [ ] **Step 5: Style it.**
  - `.goal-row`: `grid-template-columns: 120px minmax(0, 1fr) 56px 28px`. Delete `.goal-label` and `.goal-info*`.
  - Mobile (≤ 760px): `minmax(0, 1fr) auto 28px`, with name, value and button on row 1 (columns 1, 2 and 3) and the slider on row 2 (`1 / -1`). Delete the mobile `.goal-hint`/`.goal-info` rules.
  - `.info-tip`:
    - Box: `position: fixed; inset: auto; margin: 0; width: min(280px, calc(100vw - 16px)); padding: 10px 12px`.
    - Look: `--surface-2` background, a `--border` border, 8px radius, a soft shadow, `0.75rem` text in `--text`, and paragraph spacing as the old `.goal-info`.
    - Hidden state: `opacity: 0; translate: 0 -4px`, and `translate: 0 4px` when `[data-placement="above"]`.
    - Transition: `opacity 150ms ease-out, translate 150ms ease-out, overlay 150ms ease-out allow-discrete, display 150ms ease-out allow-discrete`.
    - Shown state: `:popover-open` sets `opacity: 1; translate: 0 0`, with an `@starting-style` block that restores the hidden opacity and translate.
  - `.info-btn[aria-expanded="true"]` keeps the `--accent` colour.

- [ ] **Step 6: Update the design system README.** Change the goals dialog row description to "name, slider, `56px` value, `28px` info button". On phones, the name, value and info button share line 1. Rewrite the info button bullet to cover:
  - the popover tooltip (top layer, `--surface-2`, `min(280px, 100vw − 16px)`),
  - the hover/focus peek with its 150 ms grace, and click to pin,
  - one tooltip shown at a time,
  - what hides it (Escape, outside press, scroll, resize),
  - its placement (below, right-aligned, flipped above or clamped by `tooltipPosition`),
  - the 150 ms fade plus 4 px slide.

- [ ] **Step 7: Run `npm test` and the browser check.** Expected: all unit tests pass, and every assertion in `tooltip.mjs` passes, with no console errors.

- [ ] **Step 8: Commit.**

```bash
git add src/app.js style.css docs/design-system/README.md
git commit -m "feat: show muscle info in an animated tooltip with aligned info buttons"
```
