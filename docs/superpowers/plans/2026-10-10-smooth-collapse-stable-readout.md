# Smooth Collapse and Stable Readout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the volume panel's readout keep a constant two-line height, and animate exercise cards collapsing and expanding with a 200 ms height slide plus fade.

**Architecture:**
- **Readout:** `#readout` (the `aria-live` element the app writes to) moves inside a new `.readout` wrapper. The wrapper is a grid with `min-height: 3em` (two lines at `line-height: 1.5`) and centres the text. The text stays inline in `#readout`, so `<strong>` and the text node keep wrapping normally.
- **Collapse:** the card summary and the card body each sit in a `.collapsible` wrapper that animates `grid-template-rows` between `1fr` and `0fr` together with `opacity`. Its inner element has `min-height: 0; overflow: hidden`. A closed wrapper gets `inert`, which replaces `hidden`, so its contents are unfocusable and out of the accessibility tree.
- **No animation on new cards:** cards built by `renderExercises()` get their state in the same synchronous `refresh()`, before any style flush, so they don't animate. The global reduced-motion rule makes every change instant.

**Tech Stack:** HTML, CSS, vanilla JS ES modules, `node:test` on Node 22. No dependencies, no build step.

**Spec:** `AGENTS.md`: requirement 16, the added sentence in requirement 11, the "Smooth collapse and stable readout" entry under "Decided", and the updated out-of-scope line.

## Global Constraints

- No dependencies, and no JS animation library or Web Animations code: CSS transitions only.
- Collapse timing: `200ms ease-out` on `grid-template-rows` and `opacity`.
- A collapsed card shows its header plus the summary. An expanded card shows the header plus the fields. Spacing at rest must match today's: 12px between the header and the summary or body.
- Collapsed fields are not focusable and are hidden from screen readers (`inert`). The toggle's `aria-expanded`, `aria-controls` (still pointing at the `.card-body` id) and label behave as today.
- No animation for cards built fresh (page load, add, import, reorder, remove), nor under `prefers-reduced-motion: reduce` (the existing global rule).
- The readout reserves `min-height: 3em` of its own font size, on desktop (0.9rem) and mobile (0.85rem). The text is centred both ways. Its wording, format and `aria-live="polite"` are unchanged.
- The session, the volume, the validation and the export are untouched.

## Review Focus

1. **Hover across muscles, desktop and 360px:** the top of `#split-key` (or of `#volume-empty`), `#volume` and the panel height stay the same to the pixel while the readout switches between the hint and a two-line detail. The click that used to be "not stable" (a second click on a selected row) now succeeds. Checked by a browser script in Task 1.
2. **Collapse, then Tab:** focus skips the closed fields and lands on the next card's controls. A screen reader does not read hidden fields (`inert`). Checked by a browser script in Task 2.
3. **Import a session** (cards start collapsed), **reorder**, and **add an exercise:** no transition runs on the freshly built cards (`getAnimations()` is empty right after the change). Checked by a browser script in Task 2.
4. **Export refused while the invalid card is collapsed:** the card animates open and its first invalid field still receives focus. Checked by a browser script in Task 2.
5. **Collapse all with several cards, then Expand all:** every card animates together, and the page ends in the same layout as a non-animated state. Wrapper margins add no stray gaps, at rest or mid-way. Checked by a browser script and screenshot in Task 2.

---

### Task 1: Stable two-line readout

**Files:**
- Modify: `index.html:46`
- Modify: `style.css` (the `.readout` rule at about line 800, and the mobile `.readout` override at about line 1040)
- Modify: `docs/design-system/README.md` (the volume panel's "Readout" item)

**Interfaces:**
- Produces: `<div class="readout"><p id="readout" aria-live="polite"></p></div>`. `src/app.js` keeps writing to `#readout`, unchanged.

- [ ] **Step 1: Write the failing browser check**

Add `readout.mjs` to the session scratchpad. It follows the pattern of the earlier `bodymap.mjs`: a static server plus `playwright-core` driving Chrome at `C:/Program Files/Google/Chrome/Application/chrome.exe`. It imports the volume worked example with goals Chest 7, Triceps 4, Lats 6, Quads 8. Then, at 1200×1000 and again at 360×800:
- Record the `getBoundingClientRect().top` of `#volume` (and of `#split-key` on desktop) and the panel's height, with the pointer away from the panel.
- Hover each visible `.volume-row` in turn (`page.hover`) and re-read the same values.
- Assert every reading equals the resting one, and that at least one hover produced a readout taller than one line (`#readout` height > 1.6 × its line height), so the case is real.
- Click the Chest row twice with plain `page.click` and a 3 s timeout, and assert neither click throws.

- [ ] **Step 2: Run it to verify it fails**

Run: `node readout.mjs <project dir>`
Expected: FAIL on the desktop position checks (the list moves when the readout wraps), and the second Chest click times out with "not stable".

- [ ] **Step 3: Implement**

- `index.html`: wrap the `<p id="readout">` in `<div class="readout">`, moving `class="readout"` from the `<p>` to the div.
- `style.css` `.readout`: keep the margin, centring, colour and font size. Add `display: grid; align-items: center; min-height: 3em;`. Add `.readout p { margin: 0; }`. `.readout strong` stays as it is. The mobile override keeps only its own `margin-top` and `font-size`; the `3em` follows the font size.
- README "Readout" item: add "Always reserves two lines (`min-height: 3em`), with the text centred, so the panel never shifts on hover or selection."

- [ ] **Step 4: Run it to verify it passes**

Run: `node readout.mjs <project dir>` and `npm test`.
Expected: every check PASS, with no page errors, and 73/73 unit tests pass.

- [ ] **Step 5: Commit**

```bash
git add index.html style.css docs/design-system/README.md
git commit -m "fix: reserve two lines for the volume readout so the panel never shifts"
```

### Task 2: Animated collapse and expand

**Files:**
- Modify: `src/app.js` (`CARD_HTML` lines 71-72 and the closing `</div>` of `.card-body`; the `refresh()` card loop at lines 186-188)
- Modify: `style.css` (`.exercise > * + *` at about line 174; add `.collapsible` rules next to `.card-summary` at about line 289)
- Modify: `docs/design-system/README.md` (the exercise card component and the motion section)

**Interfaces:**
- Produces: `.collapsible` wrapper elements, `data-collapse="summary"` and `data-collapse="body"`, as direct children of `.exercise` after `.card-head`. A closed wrapper has the class `is-closed` and the `inert` attribute. `.card-summary` (`data-summary`) and `.card-body` (with its id) are their only children.

- [ ] **Step 1: Write the failing browser check**

Add `collapse.mjs` to the scratchpad, with the same harness. Add three exercises: name each, with Chest primary.

- **Mid-animation:** click the first card's toggle. 100 ms later, its body wrapper's height is strictly between its expanded height and 0. After 400 ms, the summary is visible and the body wrapper's height is 0.
- **Animations:** right after the click, `getAnimations().length > 0` on the body wrapper.
- **Tab order:** with card 1 collapsed, focus card 1's toggle, then press Tab twice (remove button, then the next card's drag handle). The focused element is card 2's `.drag-handle`, not an input of card 1.
- **Card spacing:** for card 1 at rest, both collapsed and expanded, the distance from the bottom of `.card-head` to the top of the visible content (the summary or the name label) is 12 ± 1 px.
- **Bulk buttons:** click "Collapse all". 100 ms later, every body wrapper is mid-height. After 400 ms they are all at 0, and "Expand all" restores them.
- **No animation on rebuild:** import the worked example (cards start collapsed), then move a card down with the drag handle and ArrowDown, then click "Add exercise". After each, check `getAnimations().length === 0` on every wrapper of every card, synchronously in the same `evaluate`.
- **Refused export:** clear card 1's name and collapse it, then click "Export". The card opens (`is-closed` is gone), and `document.activeElement` is its name input.
- **Reduced motion:** with `page.emulateMedia({ reducedMotion: 'reduce' })`, a toggle reaches its final height with no intermediate state.

- [ ] **Step 2: Run it to verify it fails**

Run: `node collapse.mjs <project dir>`
Expected: FAIL on the mid-animation height (the change is instant today) and on `getAnimations().length > 0`.

- [ ] **Step 3: Implement**

- `CARD_HTML`: wrap `<p class="card-summary" data-summary>` (drop its `hidden`) in `<div class="collapsible" data-collapse="summary">`, and wrap the whole `<div class="card-body">…</div>` in `<div class="collapsible" data-collapse="body">`.
- In `refresh()`, replace the two `hidden` assignments: for each wrapper, `classList.toggle('is-closed', closed)` and `toggleAttribute('inert', closed)`, where the body is closed when `isCollapsed` and the summary when `!isCollapsed`.
- CSS:

```css
.collapsible {
  display: grid;
  grid-template-rows: 1fr;
  opacity: 1;
  transition: grid-template-rows 200ms ease-out, opacity 200ms ease-out;
}

.collapsible.is-closed {
  grid-template-rows: 0fr;
  opacity: 0;
}

/* The 12px gap below the header lives inside, so it collapses with the content. */
.collapsible > * {
  min-height: 0;
  overflow: hidden;
  margin: 0;
  padding-top: 12px;
}
```

  Exclude the wrappers from `.exercise > * + *` (for example `.exercise > .collapsible { margin-top: 0; }`), so neither wrapper adds 12px when closed. If the focus rings of inputs inside `.card-body` get clipped by `overflow: hidden`, give the inner element a small inline padding and an equal negative inline margin (about 4px) so the rings show. Check the focus screenshot.
- README: in the exercise card section, describe the `.collapsible` slide (200 ms ease-out, `inert` when closed, no animation on rebuild or reduced motion). In the motion section, add "200ms for card collapse/expand".

- [ ] **Step 4: Run it to verify it passes**

Run: `node collapse.mjs <project dir>`, `node readout.mjs <project dir>`, and `npm test`. Also re-run the earlier `sliders.mjs` (card sliders still work inside the wrapper).
Expected: every check PASS, with no page errors, and 73/73 unit tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/app.js style.css docs/design-system/README.md
git commit -m "feat: animate exercise cards collapsing and expanding"
```
