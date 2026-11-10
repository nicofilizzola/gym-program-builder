# Focus card fit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On every phone whose visible viewport is ≥660px tall (default text size), the viewed Focus set card shows everything through **Complete** plus a preview of the next card without scrolling; below that, Complete stays reachable.

**Architecture:** Three independent levers plus a fallback. (1) Reclaim fixed chrome around the feed (workout note moves to the ⋯ menu, gaps removed). (2) Densify the card (context + title merged, set note becomes an icon in the RIR row, completion feedback moves into the Complete button and a hidden live region). (3) Replace the single `max-height:780px` media query with container-query density tiers keyed on the feed's measured height/width. (4) Sticky Complete on the viewed card when it is still taller than the feed.

**Tech Stack:** Vanilla ES modules, CSS container queries, Playwright e2e, `node --test`.

**Spec:** `docs/superpowers/specs/2026-11-08-mobile-workout-focus-design.md` §1 (Layout and set feed), amended by the **Decisions (2026-11-10)** below.

## Root cause (for the record)

Measured in the real app shell (template with 2 exercises, no history):

| Viewport | Feed | Card content | Complete visible | Preview |
|---|---|---|---|---|
| 412×760 (≈ Pixel 8 Chrome visible area) | 439 | 532 | no (cut at Add set note) | none |
| 390×844 | 523 | 554 | no (−3px) | none |
| 412×915 (DevTools Pixel preset) | 594 | 554 | yes | 39 |

Card content is a fixed ~530–555px; the only height adaptation is `@media(max-height:780px)` (−22px). The feed receives the viewport minus ~320px of chrome (page pad 8, header 84 + 12, workout "Add note" row 52 + 12, progress 26 + 8; toolbar 50, extra 12px reserve in `measureFocus`, tab bar 56). `.focus-card` sets only `min-height: feed − 60px`, so taller content overflows the feed. DevTools presets use full screen heights without browser UI, which is why emulation and the physical Pixel 8 disagree. Existing tests only checked feed/toolbar/nav stacking, never that Complete is inside the feed.

## Decisions (2026-11-10, user-approved)

- Minimum supported visible viewport height for "whole card + preview" at default text: **660px**. Below that (or at enlarged text) the sticky Complete fallback applies.
- In Focus, the workout note is reached from the header **⋯ Workout actions** menu (`Add workout note` / `Edit workout note`); a saved note shows a header icon button `Edit workout note` that opens the editor. Desktop/finished/recap keep the existing inline note row.
- Sticky Complete: on the **viewed** card only, Complete pins to the feed bottom while that card is taller than the feed.
- Card compaction: context + title merged; set note as a 44px icon at the end of the RIR row; the separate feedback line is removed (milestone text goes into the Complete label and a visually hidden `role=status`); smaller numbers/rulers only on short feeds.

## Global Constraints

- Focus applies at ≤760px for editable active logs only; desktop tracker, finished logs and recap layouts are unchanged.
- Touch targets ≥44px (RIR options, icon buttons, increment select); numeric inputs ≥16px font.
- Never truncate labels, benchmarks, errors or notes; long content may make a card taller (then the sticky fallback applies).
- Focus borrows canonical logger nodes and never clones them; preserve node identity, focus, caret, composition and drafts across breakpoint changes (existing integration tests must stay green).
- No change to log schema, mirror, sync, exports or `workout-sync`.
- Reduced motion stays instant; no new animation except reusing the existing 200ms note collapse.
- Change authoritative values in `style.css` first, then `docs/design-system/README.md` in the same change.
- Never claim physical-device verification from Playwright results.

## Review Focus

1. **Card with Last time, previous note and Best** (the real-use case, ~40px taller than the fixture) at 412×760 — Complete must still be inside the feed. Test in Task 3.
2. **Enlarged text (200% root font) at 390×664** — Complete fully visible inside the feed via sticky. Test in Task 4.
3. **Keyboard open / short feed while typing reps** — the focused input must not end up hidden under the sticky Complete. Test in Task 4.
4. **Next card's Complete never pins** into the preview area (only the viewed card is sticky). Test in Task 4.
5. **Workout note editing in Focus** — opening from the menu focuses the textarea, closing animates and returns focus to the header indicator/menu button, and breakpoint round trips keep a composing note. Test in Task 1.

---

### Task 1: Move the workout note into the header in Focus and remove dead chrome

**Files:**
- Modify: `src/workout-note.js` (whole module, ~60 lines)
- Modify: `src/workout-logger-view.js:44` (header markup), `:48` (mount), `:229` (update), `:425-433` (menu), `:484-503` (`measureFocus`/`responsive`)
- Modify: `style.css:2466` area (Focus-only rules near `.workout-logger.is-focus`, ~2496)
- Test: `e2e/workout-focus-integration.spec.js`, `test/workout-note.test.js` (create if absent; otherwise extend the existing note unit tests — check `ls test | grep note`)

**Interfaces:**
- Produces: `mountWorkoutNote(host,{note,readOnly,collapsed=false,onInput,onBlur}) → {update({note,readOnly,collapsed}),open(),isEditing():boolean,destroy()}`.
  - `collapsed:true` renders `'none'` unless editing (and also when `readOnly`).
  - `open()` = same path as clicking the Add/Edit button: `editing=true; render(true)`, focus textarea, caret at end. No-op when `readOnly` or destroyed.
  - `host.hidden` becomes true for `'none'` only after every closing part has been removed (so the 200ms collapse plays); set it in `remove()` when `kind==='none'&&parts.size===0`.
  - Toggle `host.classList` `is-editing` with `editing`.
- Produces in logger: `setFocusChrome(on:boolean)` (local function) called from `responsive()` with `mobile.matches` (and `false` when the recap shows or Focus is torn down).

- [ ] **Step 1: Write failing tests** in `e2e/workout-focus-integration.spec.js` (390×844, existing `start(page)`):

```js
test('Focus moves the workout note into the header menu',async({page})=>{
 await start(page);
 await expect(page.locator('.logger-note')).toBeHidden();
 await page.getByRole('button',{name:'Workout actions',exact:true}).click();
 await page.getByRole('button',{name:'Add workout note',exact:true}).click();
 const note=page.getByRole('textbox',{name:'Workout note',exact:true});
 await expect(note).toBeFocused();await note.fill('Felt strong');await note.blur();
 await expect(note).toHaveCount(0);
 const indicator=page.getByRole('button',{name:'Edit workout note',exact:true});
 await expect(indicator).toBeVisible();await indicator.click();
 await expect(note).toHaveValue('Felt strong');
 await page.setViewportSize({width:761,height:844});
 await expect(page.locator('.logger-note')).toBeVisible();          // desktop keeps the inline row
 await expect(page.getByRole('button',{name:'Edit workout note',exact:true}).first()).toBeVisible();
});
test('Focus chrome leaves no reserve gap and no note row above the feed',async({page})=>{
 await start(page);
 const header=await page.locator('.logger-header').boundingBox(),progress=await page.locator('.focus-progress').boundingBox();
 expect(progress.y-(header.y+header.height)).toBeLessThanOrEqual(9);
 const toolbar=await page.locator('.focus-toolbar').boundingBox(),nav=await page.getByRole('link',{name:'History',exact:true}).boundingBox();
 expect(nav.y-(toolbar.y+toolbar.height)).toBeLessThanOrEqual(2);
});
```

Update the existing tests that relied on the inline row at ≤760px:
- `breakpoint retains a composing exercise note and shared workout note`: replace the final `Add workout note` visibility check with: open **Workout actions** and expect a `button` named `Add workout note`.
- `a long workout note leaves the feed the space under the sticky header`: open the editor via the menu, fill the 45-line note and **keep it focused** while asserting the feed/header/toolbar geometry; then blur and assert `(await feed.boundingBox()).height` returns to its pre-note value (poll).

- [ ] **Step 2: Run to verify failure**

Run: `npx playwright test e2e/workout-focus-integration.spec.js`
Expected: the two new tests fail (`.logger-note` visible; gap > 9px / toolbar gap 13px).

- [ ] **Step 3: Implement `collapsed`, `open()`, `isEditing()` in `src/workout-note.js`** as described in Interfaces.

- [ ] **Step 4: Wire the logger** (`src/workout-logger-view.js`)
  - Header row markup: insert before `.logger-finish`: `<button type="button" class="action-button logger-note-indicator" aria-label="Edit workout note" data-action-tooltip="Workout note" hidden>${actionIcon('edit')}</button>`; click → `workoutNote.open()`.
  - `let focusChrome=false;` `setFocusChrome(on)`: sets `focusChrome`, calls `workoutNote.update({note:log.note??'',readOnly:!editable,collapsed:on})`, then `syncNoteIndicator()`.
  - `syncNoteIndicator()`: `indicator.hidden=!(focusChrome&&editable&&(log.note??'')!==''&&!workoutNote.isEditing())`. Call it from `render()` (line 229, also pass `collapsed:focusChrome` there) and from the note's `onBlur`.
  - Menu (line 425): when `focusChrome&&editable`, prepend `{label:log.note?'Edit workout note':'Add workout note',run:()=>workoutNote.open()}` before Discard.
  - `responsive()`: call `setFocusChrome(mobile.matches)` before `measureFocus()`; when `recap` is shown, call `setFocusChrome(false)`.
  - `measureFocus()`: drop the `+12` from `reserved`.
- [ ] **Step 5: CSS** — `.workout-logger.is-focus>.logger-header {margin-bottom:8px}`; `.logger-note-indicator[hidden]{display:none}`. `.workout-logger.is-focus>.logger-note` keeps `margin:0 0 8px` (only shown while editing).

- [ ] **Step 6: Run tests**

Run: `npx playwright test e2e/workout-focus-integration.spec.js e2e/workout-notes.spec.js e2e/workout-best.spec.js e2e/workout-recap.spec.js && npm test`
Expected: PASS. Any remaining failure that clicks `Add workout note` on an **active log at ≤760px** must open **Workout actions** first; do not change desktop or finished-log expectations.

- [ ] **Step 7: Commit**

```bash
git add src/workout-note.js src/workout-logger-view.js style.css e2e test
git commit -m "fix(focus): move workout note into the header menu on phones"
```

---

### Task 2: Densify the Focus card

**Files:**
- Modify: `src/workout-focus-view.js:31-90` (`createCard`, `card.update`, `celebrate`, subscribe handler at ~118-124)
- Modify: `style.css:2510-2561` (Focus card rules)
- Test: `e2e/workout-focus-view.spec.js`, `e2e/workout-focus-motion.spec.js`

**Interfaces:**
- Consumes: `completionMilestone(before,after,ref) → {kind,text}` (`src/workout-focus-model.js`, unchanged).
- Produces: card DOM used by Tasks 3–4:
  - `.focus-context` (one row, min-height 40px): `.focus-context-text` holding `.focus-set-label` (e.g. `Working set 1 of 3`) then `.focus-eyebrow` (muted, wraps: `Warm-up` | `Superset A1` | `First working set` | `Next set`, joined with ` · ` to the rest/pair text formerly in `rest`), plus `.focus-complete-marker` at the right. The exercise name is no longer repeated in the eyebrow (the title shows it); keep `contextText` `aria-label` `${label}, ${exercise}`.
  - `.focus-identity`: one flex row `.focus-exercise-title` (flex 1) + `.focus-exercise-note` as a 44×44 icon button (`aria-label` unchanged: `Add exercise note, {name}` / `Edit exercise note, {name}`, `title` = note). A saved exercise note renders below the row as muted wrapped text `.focus-exercise-note-text` (full text, not clamped); tapping it does the same as the icon. Editor host `.focus-exercise-editor` stays below.
  - Set note: `.focus-set-note` icon button (44×44, accessible name unchanged `Add set note, {Set|Warm-up set} {n}, {exercise}`, visible text in `.visually-hidden`) appended as the **last child of `.focus-rir-strip`**; strip grid becomes `36px minmax(0,1fr) 44px`. `.focus-note-area` keeps `b.noteHost` (saved note/editor) and has `min-height:0`.
  - Feedback: `.focus-feedback` gets class `visually-hidden` (still `role=status`), initial text empty (drop "Swipe up when you’re ready."). Add `card.milestone` (string|null). On a fresh completion (`celebrate`), set `card.milestone=completionMilestone(...).text`; on reopen set it to `null`. `b.done.dataset.label` = done ? `${card.milestone??'Set complete'} · Tap to undo` : (`Complete warm-up` | `Complete set`). `.log-done` allows wrapping (`white-space:normal`, `text-align:center`).

- [ ] **Step 1: Write failing tests** in `e2e/workout-focus-view.spec.js` (390×844, fixture):

```js
test('card puts set note in the RIR row and has no visible feedback line',async({page})=>{
 await mountFocusFixture(page);const card=page.locator('.focus-card[data-set-id="s1"]');
 const strip=card.locator('.focus-rir-strip');
 await expect(strip.getByRole('button',{name:'Add set note, Set 1, Bench press',exact:true})).toBeVisible();
 const box=await strip.getByRole('button',{name:'Add set note, Set 1, Bench press',exact:true}).boundingBox();
 expect(box.width).toBeGreaterThanOrEqual(44);expect(box.height).toBeGreaterThanOrEqual(44);
 await expect(card.locator('.focus-feedback')).toHaveClass(/visually-hidden/);
 await expect(card.locator('.focus-identity .focus-exercise-note')).toHaveAttribute('aria-label','Add exercise note, Bench press');
 const ctx=await card.locator('.focus-context').boundingBox();expect(ctx.height).toBeLessThanOrEqual(44);
});
test('completion milestone reads in the Complete button',async({page})=>{
 await mountFocusFixture(page);const done=page.locator('.focus-card[data-set-id="s1"] .log-done');
 await done.click();
 await expect(done).toHaveAttribute('data-label',/ · Tap to undo$/);
 await expect(done).not.toHaveAttribute('data-label','Set complete · Tap to undo'); // milestone text, not the generic label
 await expect(page.locator('.focus-card[data-set-id="s1"] .focus-feedback')).not.toHaveText('');
});
```

Adjust the existing `Add set note` test (line ~25) to locate the button inside `.focus-rir-strip`; keep its click/open/caret assertions. If any motion test reads `.focus-feedback` visible text, read it via `toHaveText` (still in DOM, hidden visually).

- [ ] **Step 2: Run to verify failure**

Run: `npx playwright test e2e/workout-focus-view.spec.js`
Expected: FAIL (set note not in strip; feedback visible).

- [ ] **Step 3: Implement the DOM changes in `createCard`/`update`/`celebrate`** per Interfaces. `destroy()` must still remove every node it created (including `.focus-exercise-note-text`); `restore()` must still return borrowed nodes via markers — the set-note button is Focus-owned, not borrowed.

- [ ] **Step 4: CSS** — `.focus-context {min-height:40px;padding:4px 0}`; `.focus-identity {display:flex;align-items:center;gap:8px;margin:0 0 6px}` (title flex:1, min-width:0); `.focus-exercise-note {flex:none;min-width:44px;min-height:44px}`; `.focus-rir-strip {grid-template-columns:36px minmax(0,1fr) 44px}`; `.focus-note-area {min-height:0}`; remove the visible `.focus-feedback` rule; `.workout-focus .log-done::after` wraps. Keep `@media(max-width:350px)` behaviour by moving it to Task 3's width container query.

- [ ] **Step 5: Run tests**

Run: `npx playwright test e2e/workout-focus-view.spec.js e2e/workout-focus-motion.spec.js e2e/workout-overview.spec.js e2e/workout-focus-integration.spec.js`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/workout-focus-view.js style.css e2e
git commit -m "fix(focus): compact set card (merged context, RIR-row set note, in-button feedback)"
```

---

### Task 3: Height/width density tiers and the fit matrix

**Files:**
- Modify: `style.css:2504` (`.focus-feed`), `:2571-2572` (replace both media queries)
- Create: `e2e/workout-focus-fit.spec.js`

**Interfaces:**
- Consumes: Task 1 chrome, Task 2 card DOM.
- Produces: container `focus-feed` on `.focus-feed` (`container:focus-feed / size`), used by Task 4.

Tier values (authoritative; copy into the design system in Task 5):

| Container condition | Number input | Ruler/track | Tick top | Title | History margin |
|---|---|---|---|---|---|
| default | 2.75rem / min-height 46px | 42px | 22px | current | 12px |
| `height < 560px` | 2.4rem / 40px | 36px | 20px | 1.75rem | 8px |
| `height < 460px` | 2.2rem / 36px | 32px | 18px | 1.5rem | 6px |
| `width < 362px` | — | — | — | — | RIR strip `grid-template-columns:minmax(0,1fr) 44px`; `.log-rir-label` visually hidden (accessible name retained) |

- [ ] **Step 1: Write the fit matrix** `e2e/workout-focus-fit.spec.js` — reuse the `start(page)` pattern from `workout-focus-integration.spec.js` (copy it; it creates a linked template log and opens `#/workouts/{id}`).

```js
const fits=async page=>page.evaluate(()=>{const f=document.querySelector('.focus-feed'),card=f.querySelector(':scope>.log-set'),done=card.querySelector('.log-done');
 const fb=f.getBoundingClientRect(),cb=card.getBoundingClientRect(),db=done.getBoundingClientRect();
 return {doneInside:db.top>=fb.top&&db.bottom<=fb.bottom+0.5,preview:Math.round(fb.bottom-cb.bottom),overflowX:document.documentElement.scrollWidth>innerWidth};});
for(const [w,h,minPreview] of [[360,660,24],[390,664,24],[412,660,24],[412,760,48],[390,844,48],[430,932,48]])
 test(`whole card and preview fit at ${w}x${h}`,async({browser})=>{/* new context {viewport:{width:w,height:h},hasTouch:true,isMobile:true}; start(page) */
  const r=await fits(page);expect(r.doneInside).toBe(true);expect(r.preview).toBeGreaterThanOrEqual(minPreview);expect(r.overflowX).toBe(false);});
test('card with Last time, previous note and Best still fits at 412x760',async({browser})=>{
 /* saveFinishedLog(page,{name:...}) for the template's first exercise variant with a set note/exercise note so Last time + Last time note + Best render; then start(page) */
 await expect(page.locator('.focus-card .log-last-time').first()).toBeVisible();
 const r=await fits(page);expect(r.doneInside).toBe(true);expect(r.preview).toBeGreaterThanOrEqual(0);});
```

(`saveFinishedLog` in `e2e/workout-helper.js:41` creates finished logs; give the first exercise a note so the Last-time note renders.)

- [ ] **Step 2: Run to verify failure**

Run: `npx playwright test e2e/workout-focus-fit.spec.js`
Expected: the 660-height cases FAIL (`doneInside:false`); larger ones may already pass after Tasks 1–2.

- [ ] **Step 3: Implement the tiers** in `style.css`: add `container:focus-feed / size` to `.focus-feed`; delete `@media(max-height:780px){…}` and `@media(max-width:350px){…}` for Focus and replace them with the `@container focus-feed` rules in the table.

- [ ] **Step 4: Run tests**

Run: `npx playwright test e2e/workout-focus-fit.spec.js e2e/workout-focus-view.spec.js e2e/workout-focus-integration.spec.js`
Expected: PASS. If a 660 case is still short by a few px, tighten only the `height < 460px` tier (never below 16px input font, 44px targets) and record the measured preview in the verification doc.

- [ ] **Step 5: Commit**

```bash
git add style.css e2e/workout-focus-fit.spec.js
git commit -m "fix(focus): height-tiered density so the whole set fits from 660px"
```

---

### Task 4: Sticky Complete fallback on the viewed card

**Files:**
- Modify: `src/workout-focus-view.js` (`createCard`: where `complete` is appended; `renderCursor`)
- Modify: `style.css:2509` (`.log-set-clip` overflow), `:2555` (`.focus-complete`)
- Test: `e2e/workout-focus-fit.spec.js`

**Interfaces:**
- Consumes: `focus-feed` container (Task 3).
- Produces: class `is-viewed` on exactly the viewed card's row (`renderCursor` toggles `card.row.classList.toggle('is-viewed',same(card.ref,viewed))` for every card; review card none).

- [ ] **Step 1: Write failing tests** (append to `e2e/workout-focus-fit.spec.js`):

```js
test('200% text keeps Complete inside the feed',async({browser})=>{ /* 390x664, start(page) */
 await page.addStyleTag({content:'html{font-size:200%}'});await page.evaluate(()=>window.dispatchEvent(new Event('resize')));
 await expect.poll(async()=>(await fits(page)).doneInside).toBe(true);});
test('only the viewed card pins Complete',async({browser})=>{ /* 390x664 + 200% text */
 const pinned=await page.evaluate(()=>[...document.querySelectorAll('.focus-feed>.log-set')].filter(r=>getComputedStyle(r.querySelector('.focus-complete')).position==='sticky').length);
 expect(pinned).toBe(1);});
test('a focused reps input is not hidden under the pinned Complete',async({browser})=>{ /* 390x664 + 200% text */
 const reps=page.locator('.focus-card.is-viewed [data-field="reps"]');await reps.focus();
 const [i,c]=await Promise.all([reps.boundingBox(),page.locator('.focus-card.is-viewed .focus-complete').boundingBox()]);
 expect(i.y+i.height).toBeLessThanOrEqual(c.y+1);});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx playwright test e2e/workout-focus-fit.spec.js -g "200%|pins|focused reps"`
Expected: FAIL.

- [ ] **Step 3: Implement**
  - Append `complete` to the card's `.log-set-clip` (after `.log-set-row`) instead of the grid, so its sticky range is the whole card. `destroy()` still removes it.
  - `.workout-logger .workout-focus .focus-card>.log-set-clip {overflow:clip}` (`overflow:hidden` makes the clip a scroll container and disables sticky against the feed; `clip` keeps the collapse animation clipping).
  - `.workout-focus .focus-card.is-viewed .focus-complete {position:sticky;bottom:0;z-index:1;background:var(--bg);padding-top:6px}`.
  - `.workout-focus .focus-card.is-viewed :is(input,button,select):focus {scroll-margin-bottom:64px}`.
  - `renderCursor()` toggles `is-viewed` as in Interfaces.

- [ ] **Step 4: Run tests**

Run: `npx playwright test e2e/workout-focus-fit.spec.js e2e/workout-focus-motion.spec.js e2e/workout-focus-view.spec.js`
Expected: PASS (motion tests confirm the collapse/celebration still clip and animate).

- [ ] **Step 5: Commit**

```bash
git add src/workout-focus-view.js style.css e2e/workout-focus-fit.spec.js
git commit -m "fix(focus): pin Complete on the viewed card when it outgrows the feed"
```

---

### Task 5: Full verification and documentation

**Files:**
- Modify: `AGENTS.md` (Mobile workout Focus section), `docs/superpowers/specs/2026-11-08-mobile-workout-focus-design.md` §1 (append "Amendment 2026-11-10"), `docs/design-system/README.md` (Focus tiers table, sticky Complete), `docs/superpowers/verification/2026-11-08-mobile-workout-focus.md` (new "Card fit (2026-11-10)" section)

- [ ] **Step 1: Run the full suite**

Run: `npm test && npm run test:e2e && npm run build`
Expected: all pass. Fix only regressions caused by Tasks 1–4.

- [ ] **Step 2: Browser review (design-system checklist).** With populated data at 360×660, 390×664, 412×760, 390×844, 200% text and reduced motion: open/close the workout note from the menu and the indicator (rapid toggle), set note open/close from the RIR icon, complete/undo (label + live region), scroll between cards (preview visible, snap intact), keyboard focus order (context → title note → inputs → RIR → set note → Complete). Save screenshots to `docs/superpowers/verification/assets/mobile-workout-focus/fit-*.png`.

- [ ] **Step 3: Docs.** AGENTS.md Focus bullets: add "Every viewed card fits through Complete plus a next-card preview at ≥660px visible height (default text); density tiers come from `@container focus-feed`; beyond that the viewed card's Complete is sticky. In Focus the workout note lives in Workout actions with a header indicator." Record the measured table (before/after) and state explicitly that physical Pixel 8 verification is pending until the user confirms on device.

- [ ] **Step 4: Commit**

```bash
git add AGENTS.md docs
git commit -m "docs(focus): record card-fit decisions and verification"
```
