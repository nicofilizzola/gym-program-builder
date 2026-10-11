# Smooth Readout and Steady Hover Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop the volume panel's readout from flashing the hint while the mouse moves between muscles, and crossfade the readout when its subject changes.

**Architecture:**
- **Root cause:** `panel`'s `pointerover` handler (`src/app.js:516`) sets `hoveredMuscle = null` as soon as the pointer is over anything without `data-muscle`. That includes the 2px `gap` between `.volume-row`s (`style.css:868`), the 6px gap between mobile chips, and the space between body map regions. Every change is written to `#readout` at once.
- **No dead zones:** the `.volume-row` button becomes the whole hit area and the list `gap` becomes 0. The row's visible box (background, border, radius) moves to a `::before` layer inset by half the old gap, so the rows look exactly as they do today.
- **Hover grace:** a single `setHover(muscle | null)` function owns `hoveredMuscle`. A muscle applies at once. `null` applies only after `HOVER_GRACE_MS = 150`, and it is cancelled if a muscle arrives first.
- **Crossfade:** `refresh()` passes the readout's subject (`focus`, a muscle or `null`) and a `write()` callback to `showReadout(subject, write)`. Same subject: write now. New subject: fade `#readout` out (75 ms), write the newest pending content, then fade in (75 ms). It is CSS opacity plus one `setTimeout`, and instant under reduced motion.

**Tech Stack:** HTML, CSS, vanilla JS ES modules, `node:test` on Node 22. No dependencies, no build step. Browser checks use `playwright-core` installed in the session scratchpad (never in the project), driving Chrome at `C:/Program Files/Google/Chrome/Application/chrome.exe`, with the app served by `npx --yes serve .`.

**Spec:** `AGENTS.md`: requirement 17, the "Smooth readout and steady hover" entry under "Decided", and the updated out-of-scope line.

## Global Constraints

- No dependencies and no Web Animations or JS animation code: CSS `opacity` transition plus `setTimeout` only.
- Crossfade: about 150 ms in total, `ease-out` (75 ms out, 75 ms in). Hover grace: about 150 ms. Define each once as a constant in `src/app.js` (`READOUT_FADE_MS = 75`, `HOVER_GRACE_MS = 150`), with the CSS duration matching `READOUT_FADE_MS`.
- Fade only when the subject changes (hint ↔ muscle, muscle A → B). Same-subject live updates are written at once.
- The readout never ends up showing a stale subject. `#readout` is written once per subject change, after the fade-out, so the `aria-live` region announces only the final text.
- `prefers-reduced-motion: reduce`: write the readout at once, with no opacity change. The hover grace still applies (it is not an animation).
- Readout wording, the two-line `min-height`, selection (click/tap/keyboard), `is-focus` highlighting, and everything in the session are unchanged. Hover never changes `selectedMuscle`.
- Volume rows look the same at rest, on hover, when selected, and with a focus ring, on desktop and at 360px.

## Review Focus

1. **Sweeping the mouse down the whole volume list, slowly and quickly:** the readout never shows the hint between two rows. Pinned by the 1px-step sweep in Task 1.
2. **Moving between two body map regions across empty space** (for example from Chest to Abs on the front figure): no hint in between, as long as the crossing takes under 150 ms. Pinned in Task 1.
3. **Leaving the panel, or resting on the gap between body figures:** the readout falls back to the selected muscle or the hint after about 150 ms, and never stays stuck on the last hovered muscle. Pinned in Task 1.
4. **Hovering A → B → C faster than one fade:** the readout settles on C (never on A or B), and the live region gets one final write. Pinned in Task 2.
5. **Moving a sets slider while a muscle is selected:** the numbers update with no flicker (opacity stays 1). Pinned in Task 2.

---

### Task 1: Steady hover (no dead zones and a hover grace)

**Files:**
- Modify: `style.css` (`.volume-list` at about line 863, the `.volume-row` rules at about lines 878–903, and the mobile `.volume-list` / `.volume-row` overrides at about lines 1098–1122)
- Modify: `src/app.js` (state at about line 16, the `pointerover` / `pointerleave` handlers at about lines 515–526)
- Modify: `docs/design-system/README.md` (the hover line of the interaction table, about line 162)

**Interfaces:**
- Produces: `setHover(muscle: string | null): void` in `src/app.js`, the only writer of `hoveredMuscle`. `HOVER_GRACE_MS = 150`.

- [ ] **Step 1: Write the failing browser check `hover.mjs` in the scratchpad**

Import the volume worked example (Bench press 4 Chest / Triceps, Shoulders; Dips 3 Chest, Triceps / Shoulders; Pull-ups 3 Lats / Biceps, Upper back) with goal Quads 8, using the import button's file input. Before the sweep, install a `MutationObserver` on `#readout` that records every text it receives into `window.readoutLog`. Then, at 1200×1000:
- **Sweep:** move the mouse from the centre of the first visible row to the centre of the last one in 1px steps (`page.mouse.move` per step). Assert `readoutLog` never contains `Tap a muscle to highlight its exercises.` during the sweep.
- **Body map:** move from the Chest region's centre straight to the Abs region's centre in 10 steps, within 100 ms. Assert no hint in the log.
- **Fallback:** move the mouse outside the panel, wait 400 ms, and assert that `#readout` reads the hint and that no `.is-focus` element remains.
- **Look unchanged:** take a screenshot of `#volume` with the Chest row hovered and Lats selected, and save it for comparison with a screenshot taken on `main` before the change (same script, `--baseline` flag).

At 360×800, assert that adjacent `.volume-row` boxes touch: for each pair, `next.left - prev.right` is 0 within 0.5px.

- [ ] **Step 2: Run it to verify it fails**

Run: `node hover.mjs <project dir> --baseline`, then `node hover.mjs <project dir>`
Expected: FAIL. The sweep logs the hint between rows, and the mobile chips are 6px apart.

- [ ] **Step 3: Remove the dead zones in `style.css`**

- `.volume-list { gap: 0 }`. `.volume-row` gets `isolation: isolate` and loses its own `background`, `border-color` and `border-radius` styling. Its vertical padding grows by 1px (`5px 8px`) and `min-height` becomes `38px`, so each row keeps its content box and the rows still sit 2px apart visually.
- `.volume-row::before { content: ''; position: absolute; inset: 1px 0; z-index: -1; border: 1px solid transparent; border-radius: 8px; transition: background-color 150ms ease, border-color 150ms ease; }`. Move the hover/`.is-focus` background and the `[aria-pressed="true"]` border and background onto `::before`.
- Keep the focus ring on the button itself (the global `:focus-visible` outline). Check that it still looks the same in the screenshot.
- Mobile: `.volume-list { gap: 0 }`, `::before { inset: 0 3px; border-color: var(--border); border-radius: 999px }`, and the row's horizontal padding grows by 3px (`4px 15px`), so the chips look as they do today.

- [ ] **Step 4: Add the hover grace in `src/app.js`**

Add `const HOVER_GRACE_MS = 150;` and a `hoverTimer` next to `hoveredMuscle` (view state, with a comment). `setHover(muscle)` clears any pending timer. With a muscle, it sets `hoveredMuscle` and calls `refresh()` only if the muscle changed. With `null` while `hoveredMuscle` is set, it starts a timer that clears `hoveredMuscle` and calls `refresh()`. The `pointerover` handler (mouse only, as today) calls `setHover(muscle ?? null)`, and `pointerleave` calls `setHover(null)`.

- [ ] **Step 5: Run the checks**

Run: `node hover.mjs <project dir>` and `npm test`
Expected: all browser assertions PASS, and the screenshot matches the baseline by eye (row spacing, hover fill, selected border). `npm test` passes unchanged.

- [ ] **Step 6: Update the design system and commit**

In `docs/design-system/README.md`, add to the hover row: hover keeps the last muscle for 150 ms when the pointer crosses a gap, and volume rows have touching hit areas.

```bash
git add style.css src/app.js docs/design-system/README.md
git commit -m "fix: keep the hovered muscle while crossing gaps in the volume panel"
```

---

### Task 2: Readout crossfade

**Files:**
- Modify: `src/app.js` (the readout block at the end of `refresh()`, about lines 281–292)
- Modify: `style.css` (`.readout p` at about line 854)
- Modify: `docs/design-system/README.md` (the Readout item, about line 133)

**Interfaces:**
- Consumes: `setHover` from Task 1 (unchanged; it calls `refresh()`).
- Produces: `showReadout(subject: string | null, write: () => void): void` in `src/app.js`, and `READOUT_FADE_MS = 75`. CSS class `is-fading` on `#readout`.

- [ ] **Step 1: Write the failing browser check `fade.mjs` in the scratchpad**

Same setup as `hover.mjs` (worked example plus goal Quads 8, and the `readoutLog` observer). At 1200×1000:
- **Fades on a change:** hover the Chest row. Within 40 ms, `getComputedStyle(#readout).opacity` is below 1 and `#readout` still shows the hint. After 300 ms, the opacity is 1 and the text starts with `Chest 7 sets`.
- **Settles on the newest:** hover Chest, Lats and then Biceps rows 20 ms apart. After 400 ms, the text starts with `Biceps`, and `readoutLog` holds at most one entry after the Chest one, and that entry is the Biceps text.
- **Same subject is instant:** click the Chest row (selected), move the mouse out of the panel, wait 400 ms, then set the first exercise's sets slider to 5 (`fill` / keyboard). In the same frame, the opacity is 1 and the text starts with `Chest 8 sets`.
- **Reduced motion:** `page.emulateMedia({ reducedMotion: 'reduce' })`, hover Lats, and in the same task assert that the text starts with `Lats` and the opacity is 1.
- **Mobile:** at 360×800, tap the Chest chip. Within 40 ms the opacity is below 1, and after 300 ms the text starts with `Chest`.

- [ ] **Step 2: Run it to verify it fails**

Run: `node fade.mjs <project dir>`
Expected: FAIL on "Fades on a change" (the text switches at once and the opacity stays 1).

- [ ] **Step 3: Add the fade style in `style.css`**

`.readout p { transition: opacity 75ms ease-out; }` and `.readout p.is-fading { opacity: 0; }`. The existing global reduced-motion rule removes the transition.

- [ ] **Step 4: Implement `showReadout` in `src/app.js`**

Move the readout block of `refresh()` into a `write` closure, then call `showReadout(focus, write)`. View state next to `hoveredMuscle`: `readoutSubject` (what the readout shows now, starting `undefined` so the first `refresh()` writes at once), `pendingReadout` (the newest `{ subject, write }` during a fade, or `null`), and the fade timer. Rules:
- No fade in progress and `subject === readoutSubject`, or the first render, or `matchMedia('(prefers-reduced-motion: reduce)').matches`: cancel any fade, call `write()`, set `readoutSubject`, and remove `is-fading`.
- Otherwise, store `{ subject, write }` as pending. If no fade is running, add `is-fading` and start a `READOUT_FADE_MS` timer. When it fires, run the pending `write`, set `readoutSubject` to its subject, clear pending, and remove `is-fading` (CSS fades it back in).
- A fade in progress whose newest subject equals `readoutSubject` still finishes by writing the newest content, so the text is never stale.

- [ ] **Step 5: Run the checks**

Run: `node fade.mjs <project dir>`, `node hover.mjs <project dir>` and `npm test`
Expected: all PASS.

- [ ] **Step 6: Update the design system and commit**

In the Readout item, add: crossfades (75 ms out, 75 ms in, ease-out) when the subject changes; same-subject updates are instant; instant with reduced motion.

```bash
git add style.css src/app.js docs/design-system/README.md
git commit -m "feat: crossfade the volume readout when its muscle changes"
```
