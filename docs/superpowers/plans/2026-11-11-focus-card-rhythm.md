# Focus Card Rhythm and Clean Peek Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the mobile Focus set card use one consistent vertical rhythm, stop wasting height between Best and the inputs, and show only the next set's full header (never a cropped title) or no peek at all.

**Architecture:** CSS gives the card clip one fluid `--focus-gap` (container-query height units on the existing `focus-feed` container) and spreads any residual with `justify-content: space-between`, replacing `margin-top:auto`. A pure `focusCardFit` decides each card's min-height (feed minus the next card's header, or the whole feed when that header cannot fit), and `workout-focus-view.js` applies it from one `ResizeObserver`, preserving the viewed set's scroll position.

**Tech Stack:** Vanilla ES modules, plain CSS (container queries, `cqh`), `node:test`, Playwright.

**Spec:** In-chat design approved 2026-11-11 (reproduced under "Decisions"); builds on docs/superpowers/plans/2026-11-10-focus-card-fit.md and the Focus rules in AGENTS.md / docs/design-system/README.md ("Card" and "Fit" bullets, around lines 447–448).

## Root cause (measured 2026-11-11, seeded Last time + Best)

| Visible viewport | Feed | Next title visible | History→inputs | RIR→Complete |
|---|---|---|---|---|
| Pixel 7 412×839 | 598 | 17 of 44px | 126px | 4px |
| Pixel 8/9 412×850 | 609 | 17 of 44px | 137px | 4px |
| iPhone 16, toolbar collapsed 393×750 | 509 | 17 of 44px | 50px | 4px |
| Pro Max 440×770 | 529 | 17 of 44px | 70px | 4px |
| iPhone 16 Safari 393×659 / 360×660 | 418 | 0 (next header cut mid-row, marker clipped) | 6px | 4px |

1. `.focus-card {min-height: calc(var(--focus-feed-height) - 60px)}` (style.css:2510) always reveals 60px; the next header is ~43px, so ~17px of the 2rem title shows. On short feeds the leftover is <43px and the header itself is cut.
2. `.log-set-row {margin-top:auto}` (style.css:2537) dumps all spare height between history and the inputs.
3. Section spacing is ad hoc (0/1/3/4/6px: identity margin 6px, RIR strip margin 1px, Complete margin-top 3px); height tiers shrink fonts only, never spacing. Off the design-system scale (4/6/8/12/16/20/24px).

## Decisions (user-approved 2026-11-11)

- The peek shows exactly the next set's header (`.focus-context`: set label, eyebrow, number marker) and nothing of its title.
- All or nothing: when the viewed card's content plus that header does not fit the feed, there is no peek; the card fills the feed exactly. The last set (next item is the review) never peeks.
- One `--focus-gap` between every card section, fluid with the feed's container height, on the 6–20px range. RIR→Complete uses it.
- No `margin-top:auto`; residual height is spread across the card's section gaps; feeds ≥560px also get larger inputs/rulers. Complete is the last thing in the card, one gap above the separator.
- Unchanged: 44px targets, ≥16px inputs, sticky-Complete fallback (viewed card only), 64px focused scroll margin, keyboard re-anchoring, motion, data, exports.

## Global Constraints

- Phones only (Focus is ≤760px); desktop tracker and finished logs untouched.
- Density comes from `@container focus-feed` (height/width), never device media queries.
- Spacing values on the design-system scale: 4 / 6 / 8 / 12 / 16 / 20 / 24px (fluid `--focus-gap` clamps to 6–20px).
- Never clone or remount logger nodes; Focus still borrows canonical nodes (AGENTS.md "Mobile workout Focus").
- RIR and icon targets ≥44px; numeric inputs ≥16px; 200% text keeps Complete reachable (sticky fallback).
- No new dependency; no change to `workout-sync`, the log, mirror or exports.
- Never claim physical-device or deployment verification from localhost/Playwright results.

## Review Focus

1. Opening a long exercise note on the viewed card (200ms collapse) — the card turns peekless mid-animation; expected: the viewed set stays anchored, no jump, no cropped title. Test in Task 3.
2. A superset eyebrow that wraps to two lines makes the next header taller — expected: the peek uses that next card's own header height, still no title pixels. Test in Task 3.
3. The last set before the review — expected: no peek, card fills the feed. Test in Task 3.
4. Min-height changes on cards above the viewed one while the user is typing (keyboard open) — expected: focused field does not move. Covered by the existing integration test "a height change while typing re-anchors…" (must stay green, Task 3 Step 6).
5. 200% text — expected: peekless, viewed Complete still sticky and focused reps above it. Covered by existing fit-spec tests (must stay green).

---

### Task 1: Pure card-fit rule

**Files:**
- Create: `src/workout-focus-fit.js`
- Test: `test/workout-focus-fit.test.js`

**Interfaces:**
- Produces:
  - `focusCardFit({feedHeight:number, contentHeight:number, peekHeight:number}) → {minHeight:number, peekless:boolean}`
  - `stackHeight(childHeights:number[], gap:number, paddingBlock:number) → number` — sum of heights + `gap × (n − 1)` (0 gaps when n ≤ 1) + `paddingBlock`.

- [ ] **Step 1: Write the failing tests** (`node:test` + `assert/strict`, same style as `test/workout-focus-model.test.js`)

```js
test('peeks the full next header when content and header fit',()=>{
 assert.deepEqual(focusCardFit({feedHeight:598,contentHeight:500,peekHeight:43}),{minHeight:555,peekless:false});
});
test('exact fit still peeks',()=>{
 assert.deepEqual(focusCardFit({feedHeight:598,contentHeight:555,peekHeight:43}),{minHeight:555,peekless:false});
});
test('no partial peek: one pixel too tall fills the feed',()=>{
 assert.deepEqual(focusCardFit({feedHeight:598,contentHeight:556,peekHeight:43}),{minHeight:598,peekless:true});
});
test('no next set never peeks',()=>{
 assert.deepEqual(focusCardFit({feedHeight:598,contentHeight:300,peekHeight:0}),{minHeight:598,peekless:true});
});
test('fractional header rounds the min-height',()=>{
 assert.equal(focusCardFit({feedHeight:598,contentHeight:400,peekHeight:42.6}).minHeight,555);
});
test('content taller than the feed stays peekless',()=>{
 assert.deepEqual(focusCardFit({feedHeight:418,contentHeight:600,peekHeight:43}),{minHeight:418,peekless:true});
});
test('stackHeight adds gaps between items and padding',()=>{
 assert.equal(stackHeight([40,50,60],10,12),40+50+60+20+12);
 assert.equal(stackHeight([40],10,0),40);
 assert.equal(stackHeight([],10,8),8);
});
```

- [ ] **Step 2: Run to verify failure** — `node --test test/workout-focus-fit.test.js` → FAIL (module not found).
- [ ] **Step 3: Implement both exports in `src/workout-focus-fit.js`.** Peek when `peekHeight > 0 && contentHeight + peekHeight <= feedHeight` → `minHeight: Math.round(feedHeight - peekHeight)`; otherwise `{minHeight: feedHeight, peekless: true}`.
- [ ] **Step 4: Run** `node --test test/workout-focus-fit.test.js` → PASS.
- [ ] **Step 5: Commit** — `git add src/workout-focus-fit.js test/workout-focus-fit.test.js && git commit -m "feat(focus): pure card-fit rule for an all-or-nothing peek"`

---

### Task 2: One vertical rhythm (CSS)

**Files:**
- Modify: `style.css:2510-2583` (Focus block and its `@container focus-feed` tiers)
- Test: `e2e/workout-focus-fit.spec.js`

**Interfaces:**
- Produces: CSS custom property `--focus-gap` on `.workout-focus .focus-card`; `.log-set-clip` in Focus is a flex column with `gap: var(--focus-gap)`, `justify-content: space-between`, `padding-bottom: var(--focus-gap)`. Task 3 reads these via `getComputedStyle(clip).rowGap` / `paddingBottom`.

- [ ] **Step 1: Add the rhythm test helper and failing test** to `e2e/workout-focus-fit.spec.js`. Helper `rhythm(page)` evaluates the first `.focus-feed>.log-set` and returns rounded vertical gaps between consecutive boxes: `.focus-context`→`.focus-identity`, `.focus-identity`→`.focus-history`, `.focus-history`→`.focus-number-controls`, `.focus-number-controls`→`.focus-input-help`, `.focus-input-help`→`.focus-rir-strip`, `.focus-rir-strip`→`.log-done`, and `.log-done`→card bottom. Test `consistent rhythm at ${width}x${height}` for the existing viewport list plus `[412,839]`, `[412,850]`, `[393,750]`, `[440,770]`, all with `history:true`:

```js
const g=Object.values(await rhythm(page));
expect(Math.min(...g)).toBeGreaterThanOrEqual(6);
expect(Math.max(...g)-Math.min(...g)).toBeLessThanOrEqual(16); // was 122+ on Pixel 7
const r=await rhythm(page);expect(r.rirToDone).toBeGreaterThanOrEqual(r.controlsToHelp); // RIR→Complete never tighter than the inner gap
```

- [ ] **Step 2: Run** `npx playwright test e2e/workout-focus-fit.spec.js -g "consistent rhythm"` → FAIL (Pixel 7 spread ≈126px, RIR→Complete 4px).
- [ ] **Step 3: Implement in `style.css`:**
  - `.workout-focus .focus-card`: declare `--focus-gap: clamp(6px, calc((100cqh - 400px) / 10), 20px)` (starting point: 6px at ≤460px feed, 20px at ≥600px; tune only the 400px/10 constants if Step 4 fails).
  - Focus clip (`.workout-logger .workout-focus .focus-card>.log-set-clip`): add `gap:var(--focus-gap);justify-content:space-between;padding-bottom:var(--focus-gap)`.
  - `.workout-logger .workout-focus .log-set-row`: drop `margin-top:auto`, add `gap:var(--focus-gap)`; hide empty in-flow items so they add no gap: `.workout-focus .log-set-row>.log-set-error:empty`, `.workout-focus .focus-note-area:not(:has(.log-set-note-part))` → `display:none`.
  - Remove ad hoc spacing now owned by the gap: `.focus-identity` margin-bottom, `.focus-history` margin-bottom (base and both tier overrides), `.focus-rir-strip` margin, `.focus-complete` margin-top.
  - Sticky viewed Complete keeps its background band without changing layout: `.focus-card.is-viewed .focus-complete {margin-top:calc(-1 * var(--focus-gap));padding-top:var(--focus-gap)}` (replaces `margin-top:0;padding-top:3px`).
  - New tier `@container focus-feed (height >= 560px)`: stepper input `font-size:3.25rem;min-height:54px`, ruler and track `48px`, tick `top:26px`.
- [ ] **Step 4: Run** the rhythm tests → PASS, then the whole file `npx playwright test e2e/workout-focus-fit.spec.js`. The existing `preview >= minPreview` assertions may now fail; that is expected and is replaced in Task 3 — every other existing test in the file must pass.
- [ ] **Step 5: Commit** — `git add style.css e2e/workout-focus-fit.spec.js && git commit -m "fix(focus): one fluid section rhythm instead of a dead band above the inputs"`

---

### Task 3: All-or-nothing peek (JS wiring)

**Files:**
- Modify: `src/workout-focus-view.js` (createCard, update, setFeedHeight, card.destroy, root destroy)
- Modify: `style.css:2510` (`.workout-focus .focus-card` min-height)
- Test: `e2e/workout-focus-fit.spec.js`, `e2e/workout-focus-view.spec.js`

**Interfaces:**
- Consumes: `focusCardFit`, `stackHeight` (Task 1); `--focus-gap`, clip `rowGap`/`paddingBottom` (Task 2).
- Produces: each `.focus-card` row gets inline `--focus-card-min: <px>` and class `is-peekless` when peekless; both removed in `card.destroy()`.

- [ ] **Step 1: Write failing tests.**
  In `e2e/workout-focus-fit.spec.js` replace the `preview>=minPreview` check with helper `peek(page)` returning, for the first card, `{titlePx, headerPx, headerH, peekless}` where `titlePx`/`headerPx` are the visible pixels of the second card's `.focus-exercise-title` / `.focus-context` inside the feed rect and `peekless` is `card.classList.contains('is-peekless')`. For every viewport in the matrix:

```js
const p=await peek(page);
expect(p.titlePx).toBeLessThanOrEqual(1);
expect(p.headerPx===0||Math.abs(p.headerPx-p.headerH)<=1).toBe(true); // whole header or none
```
  Plus explicit cases: `[412,839]` and `[412,850]` → `peekless:false` (Pixels show the header); `[393,659]` and `[360,660]` → `peekless:true` and the first card's `.log-done` bottom ≤ feed bottom + 0.5 **and** card height ≤ feed height + 1 (fits without relying on sticky; if this fails, tighten the `<460px` tier sizes, not the gap floor).
  In `e2e/workout-focus-view.spec.js` (fixture via `mountFocusFixture`, 360×740):
  - `last set before review never peeks`: jump to the last projected set (`a2`); its card has `is-peekless` and the review heading has 0 visible px inside the feed.
  - `a two-line superset eyebrow sets the peek height`: jump to the card before a paired set; assert the next card's `.focus-context` is fully visible and its title has ≤1px visible.
  - `opening a long exercise note keeps the viewed set anchored`: jump to `s1`, record `offsetTop−scrollTop` of the viewed row, open the exercise note and fill `'Note '.repeat(80)`, wait 400ms; the same delta is within 2px, and the next title has ≤1px visible.
- [ ] **Step 2: Run** `npx playwright test e2e/workout-focus-fit.spec.js e2e/workout-focus-view.spec.js` → new tests FAIL (Pixel title shows 17px).
- [ ] **Step 3: CSS** — `.workout-focus .focus-card` min-height becomes `var(--focus-card-min, var(--focus-feed-height))` (no 60px constant; before the first fit the card simply fills the feed).
- [ ] **Step 4: Implement `fitCards()` in `src/workout-focus-view.js`.**
  - Reads first, then writes. For each card in feed order: `clip = row.querySelector('.log-set-clip')`, `cs = getComputedStyle(clip)`; in-flow children = `clip.children` with `getClientRects().length > 0` and `cs.position !== 'absolute'`; `contentHeight = stackHeight(heights, parseFloat(cs.rowGap), parseFloat(cs.paddingTop)+parseFloat(cs.paddingBottom)) + row border-bottom width`; `peekHeight` = next sibling `.log-set`'s `.focus-context` `getBoundingClientRect().height`, or 0 when the next sibling is the review; `feedHeight = feed.clientHeight`.
  - Before writing, record the viewed row's `offsetTop − feed.scrollTop`; after writing `--focus-card-min` and toggling `is-peekless` (only when changed), restore that delta with `programmatic=true` around the scroll so the scroll listener does not change `viewed`.
  - Call sites: end of `update()`; inside `setFeedHeight()` right after the custom property is set and before its existing re-anchor; and from one `ResizeObserver` (callback coalesced to one `requestAnimationFrame`) that observes each card's `.focus-context`, `.focus-identity`, `.focus-history`, `.log-set-row` and `.focus-complete` (observe in `createCard`, unobserve in `card.destroy`, `disconnect()` in the view's `destroy`). Skip when `!enabled || destroyed`.
  - `card.destroy()` also removes `--focus-card-min` and `is-peekless`.
- [ ] **Step 5: Run** `node --test test/workout-focus-fit.test.js` and `npx playwright test e2e/workout-focus-fit.spec.js e2e/workout-focus-view.spec.js` → PASS.
- [ ] **Step 6: Run all Focus suites** `npx playwright test e2e/workout-focus-integration.spec.js e2e/workout-focus-motion.spec.js e2e/workout-overview.spec.js e2e/workout-logger.spec.js` → PASS (re-anchoring while typing, overview insertions, motion and desktop tracker unchanged).
- [ ] **Step 7: Commit** — `git add src/workout-focus-view.js style.css e2e/workout-focus-fit.spec.js e2e/workout-focus-view.spec.js && git commit -m "fix(focus): peek the whole next-set header or nothing"`

---

### Task 4: Browser review, docs and full verification

**Files:**
- Modify: `AGENTS.md` (Mobile workout Focus → "Card fit" bullet)
- Modify: `docs/design-system/README.md:447-448` ("Card" and "Fit" bullets)
- Modify: `docs/superpowers/verification/2026-11-08-mobile-workout-focus.md` (append a 2026-11-11 section)

- [ ] **Step 1: Inspect populated screens** (seeded Last time + Best, Playwright with touch) at 412×839, 412×850, 393×659, 393×750, 440×770, 360×660 and 390×664 with 200% text; capture screenshots. Check: next header crisp or absent, no title sliver, even gaps, Complete one gap above the separator, no horizontal overflow. Play: swipe between sets, complete a set (Auto-next), open/close exercise and set notes, open the keyboard on reps, reduced motion. Fix anything abrupt before continuing.
- [ ] **Step 2: Update docs.**
  - AGENTS.md "Card fit" bullet: replace "plus a next-card preview" with "the next set's full header peeks only when it fits whole (otherwise no peek; the last set never peeks); one fluid `--focus-gap` (6–20px from feed height) separates every section, residual spread evenly; a ≥560px tier enlarges inputs and rulers". Keep the rest.
  - Design system "Card": "feed height minus 60px so the next card's header peeks" → "feed height minus the next card's header (`focusCardFit`, `src/workout-focus-fit.js`), or the whole feed when it cannot fit whole". "Fit": add the `--focus-gap` formula, `space-between`, the ≥560px tier values, and remove the "plus a next-card preview from a 660px visible viewport" wording.
  - Verification doc: the before/after table from "Root cause" with the new measurements, the viewports and interactions actually exercised, and gaps (no physical devices; Safari engine not run — Chromium only).
- [ ] **Step 3: Full verification** — `npm test`, `npm run test:e2e`, `npm run build` → all pass; paste the summary lines into the verification doc.
- [ ] **Step 4: Commit** — `git add AGENTS.md docs/design-system/README.md docs/superpowers/verification/2026-11-08-mobile-workout-focus.md && git commit -m "docs(focus): record card rhythm and clean peek"`
