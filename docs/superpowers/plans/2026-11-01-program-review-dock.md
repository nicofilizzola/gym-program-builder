# Program Review Dock Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Present program AI reviews in a right-side dock that the page makes room for, switch Week to a single-column agenda, and replace Analyze program with a distinctive "AI review" toggle.

**Architecture:** `mountAnalysisPanel` gains a `dock` presentation. When given a dock element, it keeps the existing controller, renderer, lifecycle and full-screen modal, but uses the dock as its wide host instead of the anchored popover, and switches to the modal below 1280px. The program route's view host becomes a two-column grid (content | dock). CSS `:has()` widens the dock column when the dock is open. The Week agenda is a markup-class and CSS change in `program-view.js`/`style.css`. Session analysis keeps its current popover path untouched.

**Tech Stack:** Vanilla ES modules, hand-written CSS in `style.css`, native `<dialog>`/popover, Node test runner (`npm test`), Playwright (`npm run test:e2e`).

**Spec:** `docs/superpowers/specs/2026-10-31-program-review-dock-design.md` (mockup screenshots in `docs/superpowers/specs/2026-10-31-program-review-dock/`). Also read the "UI, motion and accessibility" and "Report lifecycle" sections of `docs/superpowers/specs/2026-10-31-program-analysis-design.md`, which still apply.

## Global Constraints

- No new dependencies, frameworks, icon fonts or animation libraries. Inline SVG with `currentColor`.
- Read `docs/design-system/README.md` (including the Feature design and review checklist) before UI work. Change values in `style.css` first, then update `docs/design-system/README.md` in the same change set.
- Dock width: `340px`, or `360px` at `min-width:1600px`. The dock applies at `min-width:1280px`. Below that, the program review is a full-screen native modal.
- Volume panel width stays `--panel-width` (460px, 520px at ≥1600px). Body figures stay ≥180px (200px at ≥1600px). Never shrink, crop or hide them.
- Report typography in the program review: heading 16px (`1rem`), body 14px (`.875rem`) with line-height 1.45, opening paragraph not enlarged, 12–16px above section headings. Use relative units.
- Motion: dock open/close 180ms `ease-out` on explicit properties (grid column width, dock `transform`, `opacity`). Never `transition: all`. Reduced motion: instant. No animation on initial render or routine rerenders.
- Toggle: label always "AI review". Fine-pointer hover gives one 450ms sweep. While generating, only the icon breathes (1600ms cycle). No idle animation. Reduced motion disables both. Use only the orange accent family, no second accent colour.
- Controls are 32px only on `(min-width:1100px) and (pointer:fine) and (not (any-pointer:coarse))`. Touch/hybrid targets are ≥44px.
- Analysis input, `POST /api/analysis/program`, limits, prompt, provider settings, report lifecycle and program context storage are unchanged. Standalone session analysis keeps its current anchored popover and ≤760px modal.
- Playwright runs with `reducedMotion:'reduce'` by default (`playwright.config.js`). Motion tests must opt out with `test.use({reducedMotion:'no-preference'})`.
- Verification commands: `npm test`, `npm run test:e2e`, `npm run build`. Never claim a check ran unless it did.

## Review Focus

1. **Resizing across 1280px while the review is open** (window snapping, devtools). The report text, scroll position and focus should survive the move between dock and full-screen modal, and the layout column should not be left open. Test in Task 2.
2. **Opening the dock while scrolled far down a long program.** The dock should sit fully in the viewport with its footer visible, and stay so when scrolling back to the top under the app navigation. Test in Task 3.
3. **Program context opened while the dock is open on desktop.** The dock should stay open with its report intact. Escape in the context dialog should close only the dialog, and focus should return to Program context. Test in Task 3.
4. **Leaving the program (opening a session or another route) while a review streams in the dock.** The request should abort. On return, the toggle should be closed and no empty dock column should remain. Test in Task 3.
5. **Long unbroken names and 200% text with the dock open at 1366×768.** There should be no horizontal page overflow and all actions should stay reachable. Test in Task 3.

---

### Task 1: Single-column Week agenda

**Files:**
- Modify: `src/program-view.js:84` (`renderWorkouts`: container class)
- Modify: `style.css` (replace the `.schedule-grid` rules at `style.css:1561-1587`, plus the base `.workout-item` agenda rules)
- Test: `e2e/compact-desktop.spec.js:129-143` (replace `schedule uses responsive day columns`), `e2e/program-overview.spec.js`, `e2e/program-sequence.spec.js` (update any `.schedule-grid` selectors)

**Interfaces:**
- Produces: the Week container has class `week-agenda` (replacing `schedule-grid`). Each weekday/Unscheduled group stays `section.day-section` with `h2` (day label) and `.workout-list[data-sort-group]`. No DOM structure change beyond the class name. `.schedule-grid` no longer exists anywhere.

- [ ] **Step 1: Write the failing test** `week uses a single-column day agenda` in `e2e/compact-desktop.spec.js`, replacing `schedule uses responsive day columns`. Use the existing `fixture(page,'program')` and `sizes`. For each size, assert:

```js
const sections=page.locator('.week-agenda > .day-section');await expect(sections).toHaveCount(8);
const boxes=await sections.evaluateAll(els=>els.map(el=>{const r=el.getBoundingClientRect(),h=el.querySelector('h2').getBoundingClientRect(),l=el.querySelector('.workout-list').getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,labelRight:h.right,labelY:h.y,listX:l.x,listY:l.y};}));
expect(new Set(boxes.map(b=>Math.round(b.x))).size).toBe(1);               // one column
for(let i=1;i<8;i++)expect(boxes[i].y).toBeGreaterThan(boxes[i-1].y);       // Monday..Sunday, Unscheduled in order
for(const b of boxes){expect(b.listX).toBeGreaterThanOrEqual(b.labelRight);expect(Math.abs(b.listY-b.labelY)).toBeLessThan(12);} // label left of sessions, same row
await expect(sections.first().locator('.workout-item')).toHaveCount(2);await noOverflow(page);
```

Also add `week agenda cards keep name, metadata and actions on one row` at 1440×900. For the first `.workout-item`, assert that the vertical centres of `h3`, `.workout-metadata` and `.item-actions` differ by < 8px, and that the card height is ≤ 64px.

- [ ] **Step 2: Run to verify failure**

Run: `npx playwright test e2e/compact-desktop.spec.js -g "agenda"`
Expected: FAIL (`.week-agenda` count 0).

- [ ] **Step 3: Implement**

In `renderWorkouts`, toggle `week-agenda` instead of `schedule-grid`. In `style.css`, remove the two/three-column `.schedule-grid` grid and write agenda rules that apply at every width:
- `.week-agenda` is a single column.
- `.day-section` is `container: day / inline-size`, with a top border (`var(--border)`) and tight vertical padding (about 4px).
- When the day container is at least `30rem`, the section is a two-column grid: day label column `4.875rem` (`6rem` at ≥1600px), sessions `minmax(0,1fr)`, gap 12px. The `h2` uses `--font-body`, weight 500, `.8125rem`, `var(--muted)`, `min-height:44px`, vertically centred. Below `30rem`, the label stacks above its sessions.
- `.week-agenda .workout-item` is a wrapping flex row: `h3` and `.workout-metadata` share the line, and `.item-actions` sits at the end (`margin-left:auto`). Use a 6px gap between cards and smaller padding than today.
- Empty-day `.empty` keeps `min-height:44px` and gets a dashed `var(--border)` outline (the "Rest day" placeholder in the mockup). `.week-agenda .workout-list` keeps `min-height:44px` so empty days remain drop targets.
- Unscheduled gets about 8px extra top margin.

Keep the existing fine-pointer 32px action sizing and the touch 44px sizing. Do not change Sequence (`value.mode==='simple'`) styling.

- [ ] **Step 4: Update the remaining tests**

Replace any `.schedule-grid` selector in `e2e/*.js` with `.week-agenda`. In `e2e/compact-desktop.spec.js`, rename `schedule grid preserves actions and cross-column drag order` to `week agenda preserves actions and cross-day drag order` and keep its assertions. Day-section counts (8 / 1) in `program-overview.spec.js` and `program-sequence.spec.js` stay valid.

- [ ] **Step 5: Run to verify pass**

Run: `npx playwright test e2e/compact-desktop.spec.js e2e/program-overview.spec.js e2e/program-sequence.spec.js e2e/drag-reorder.spec.js e2e/reorder-regressions.spec.js`
Expected: PASS. Drag between days, keyboard Up/Down and Alt+Up/Down, Reorder menus and muscle highlighting stay green.

- [ ] **Step 6: Commit**

```bash
git add src/program-view.js style.css e2e/
git commit -m "feat: show Week as a compact single-column agenda"
```

---

### Task 2: Dock presentation in the analysis panel

**Files:**
- Modify: `src/analysis-panel.js`
- Modify: `style.css` (analysis section near `style.css:1806-1866`: dock internals and review typography)
- Test: `e2e/program-analysis-panel.spec.js` (rewrite the fixture and program-scope tests), `e2e/session-analysis.spec.js` (must pass unchanged)

**Interfaces:**
- Consumes: existing `createAnalysisController`, `mountAnalysisReport`, `mountActionTooltips`.
- Produces: `mountAnalysisPanel({anchor,getWorkout,getSnapshot,scope,onValidationError,request,enabled,dock})`, where `dock?: HTMLElement`. With `dock`:
  - Wide host (`matchMedia('(min-width: 1280px)')`) is `dock`. Otherwise it is the full-screen `dialog.analysis-panel.analysis-modal`. The popover `section.analysis-panel` is used only as the existing modal exit surface, never as an open host.
  - `dock.id` is assigned if empty. `anchor` always has `aria-controls` pointing to the current host's id and `aria-expanded` reflecting open state.
  - Copy: heading `AI review`, caption `Hypertrophy · AI-generated`, close button `Close AI review`, stale text `Program changed`. The anchor's text is never changed. The anchor toggles class `is-generating` while phase is `connecting`/`streaming`, instead of the `Analyzing`/`View analysis` labels.
  - Content element gets class `analysis-content--review` (dense typography in both dock and modal).
  - Open: `dock.classList.add('is-open')`, focus heading. Close: remove `is-open`, restore focus to anchor, then set `dock.inert=true` and `aria-hidden="true"`. No timers needed for teardown of the dock itself.
  - Escape closes the dock only when `content.contains(document.activeElement)` and no other `dialog[open]` exists. Modal Escape is unchanged.
  - Keeps `--review-dock-top` on the dock equal to `Math.max(0, dock.parentElement.getBoundingClientRect().top)` px. Update it on open, window scroll (rAF-throttled) and resize.
  - Returned object adds `dismissModal(): void`. It closes without restoring focus only when the current host is the modal dialog. Otherwise it does nothing.
  - `destroy()` also empties the dock and removes `is-open`, `inert`, `aria-hidden` and the custom property.
  - Program scope without `dock` is no longer supported. Remove the popover-only program copy (`Program analysis · Hypertrophy`, `Close program analysis`, `Analyze program`). Session scope (no `dock`) behaves exactly as today.

- [ ] **Step 1: Write the failing tests** in `e2e/program-analysis-panel.spec.js`

Change the fixture. Set `body.innerHTML` to `<div class="program-route"><div><button class="secondary-btn review-toggle" data-review><span>AI review</span></button><p class="after">x</p></div><aside class="review-dock"></aside></div>`, then mount with `scope:'program', dock:document.querySelector('.review-dock')` and keep the deferred `request` mock. Set the viewport to 1440×900 unless stated. Tests:

```js
test('dock opens with focus, generates once and keeps the report on close',async({page})=>{
 // click AI review → heading "AI review" focused, aria-expanded=true, aria-controls=dock id, .review-dock.is-open
 // requests.length===1; toggle has class is-generating; toggle text stays "AI review"
 // deliver a delta containing '<img src=x>' → no img in .analysis-report
 // click "Close AI review" → toggle focused, aria-expanded=false, dock inert and aria-hidden="true", request not aborted
 // reopen → same report text, requests.length still 1; context change marks 'Program changed', revert clears it
});
test('escape closes the dock only from inside it',async({page})=>{
 // open; focus p.after (outside) and press Escape → still open; focus heading, Escape → closed, toggle focused
});
test('dock keeps report scroll and survives rapid reversal',async({page})=>{
 // stream 80 lines; set .analysis-scroll scrollTop=200; close then reopen immediately twice (no await between) 
 // → is-open, not inert, scrollTop still 200, heading focused
});
test('below 1280px the program review is a full-screen modal and adapts across the breakpoint',async({page})=>{
 // viewport 1279×800: open → dialog.analysis-modal visible, covers 0,0,1279,800; aria-controls points to the dialog id
 // stream long report, focus Stop; resize to 1440×900 → content inside .review-dock, Stop still focused, report text kept
 // resize to 1279×800 → dialog visible again, .review-dock not .is-open
});
test('dismissModal only closes the full-screen review',async({page})=>{
 // 1440: open, panel.dismissModal() → dock still open; 1000×800: open, dismissModal() → dialog closed
});
test('program panel validates the whole program before a request',async({page})=>{
 // keep the existing sets=0 assertion: requests.length 0 and validation {occurrenceIndex:0,exerciseIndex:0}
});
```

Add a typography check to the first test: `getComputedStyle(.analysis-report).fontSize==='14px'`, its line-height ≈ 20.3px (±0.5), `.analysis-title` 16px, and the first paragraph after the first `h3` 14px.

- [ ] **Step 2: Run to verify failure**

Run: `npx playwright test e2e/program-analysis-panel.spec.js`
Expected: FAIL (no `AI review` heading, dock never `is-open`).

- [ ] **Step 3: Implement the dock branch in `src/analysis-panel.js`**

Introduce `const wide=dock??desktop` and `const fullscreen=matchMedia(dock?'(max-width: 1279px)':'(max-width: 760px)')`. Then route every "desktop host" decision through `wide`:
- `visible()` for the dock is `dock.classList.contains('is-open')`.
- `position()` returns early when `dock` is set.
- `open`/`adapt` add `is-open` to the dock instead of calling `showPopover`.
- In the dock branch, `finishClose` only hides the exit popover.

Keep the modal-exit transfer into the `desktop` popover exactly as today. Keep all existing listeners, and remove the added ones in `destroy`.

- [ ] **Step 4: Add the dock and review CSS in `style.css`**, next to the analysis rules

Dock internals:
- `.review-dock` clips its contents (`overflow:hidden`, `min-width:0`).
- `.review-dock > .analysis-content` is `width:var(--review-width)`, `height:100%`, a flex column, background `var(--surface)`, `border-left:1px solid var(--border)`, no shadow or radius.
- When the dock is not `.is-open`, the content is at `opacity:0; transform:translateX(12px)`. When open, it is at `opacity:1; transform:none`. Transition those two over 180ms ease-out.
- When closed, the dock uses `visibility:hidden` with `transition:visibility 0s 180ms`. When open, it is visible with no delay.
- The header and footer are fixed (non-shrinking) with a `var(--border)` separator. `.analysis-scroll` flexes and scrolls.

Typography under `.analysis-content--review`:
- `.analysis-title`: `600 1rem/1.4 var(--font-body)`.
- `.analysis-report`: `400 .875rem/1.45`.
- `h3`: `margin:16px 0 6px`.
- `h3:first-child + p`: inherits the body size.
- `p`: `margin:0 0 8px`.

Add the dock selectors to the existing reduced-motion block. Below 1280px, set `.review-dock{display:none}`.

- [ ] **Step 5: Run to verify pass**

Run: `npx playwright test e2e/program-analysis-panel.spec.js e2e/session-analysis.spec.js e2e/session-analysis-review.spec.js`
Expected: PASS. Session analysis is unchanged (`Analyze`, `View analysis`, popover and ≤760px modal).

- [ ] **Step 6: Commit**

```bash
git add src/analysis-panel.js style.css e2e/program-analysis-panel.spec.js
git commit -m "feat: add docked presentation for program reviews"
```

---

### Task 3: Program page integration and layout

**Files:**
- Modify: `src/app.js:189-201` (program branch of the record view)
- Modify: `src/program-view.js:24` (options), `:220-244` (toolbar markup, panel and context wiring)
- Modify: `style.css` (program route grid and toolbar placement)
- Test: create `e2e/program-review-dock.spec.js`; update `e2e/program-analysis.spec.js`

**Interfaces:**
- Consumes: Task 2's `mountAnalysisPanel({...,dock})`, `.dismissModal()`, `.review-dock.is-open`, `--review-dock-top`. Task 1's `.week-agenda`.
- Produces: `mountProgramView(root,{...,reviewDock})`, where `reviewDock?: HTMLElement`. When omitted (direct test mounts), `buildOverview` appends its own `aside.review-dock` to `root` after setting `innerHTML`. In app.js, the program route's view host gets class `program-route` and a trailing `aside.review-dock`, passed as `reviewDock`. The toggle is `button.secondary-btn.review-toggle[data-program-review]` with a sparkle SVG and `<span>AI review</span>`.

- [ ] **Step 1: Write the failing tests** in `e2e/program-review-dock.spec.js`

Use `programFixture`, `frames` and `report` from `e2e/program-analysis-helper.js`, and route `**/api/analysis/program`. Reuse the populated six-occurrence program setup from `program-analysis.spec.js` ("populated program analysis…"): long template name, `[0,1,3,4,6,null]` days.

```js
test('AI review sits at the far right of the program header',async({page})=>{
 // 1440×900: toggle is the last button in .program-file-actions; gap to Export program ≥ 16px (±1)
 // toggle name "AI review"; no button named "Analyze program"
});
test('dock opens beside the program at desktop sizes',async({page})=>{
 for(const [w,h] of [[1280,800],[1366,768],[1440,900],[1920,1080]]){
  // open (if closed): wait 'Analysis complete'
  // dock box: right edge == w (±1), width == (w>=1600?360:340) (±1), bottom ≤ h+1, top ≥ app-header bottom at scrollY 0
  // .panel right edge ≤ dock left; no horizontal overflow; every .body-map svg height ≥ 180
  // .analysis-footer bottom ≤ h+1
  // close: .panel right edge == w-24 (±1)
 }
});
test('dock stays within the viewport while the page scrolls',async({page})=>{
 // 1366×768, make the program long (add 6 more occurrences via api.update, reload); scroll to bottom; open
 // dock top ≥ 0 and footer bottom ≤ 769; scroll to top → dock top ≥ header bottom and footer bottom ≤ 769
});
test('program context opens over the open dock without closing it',async({page})=>{
 // 1440: open dock, wait complete; click Program context → context dialog open; type into Goals and priorities
 // → .analysis-stale visible inside the still-open dock; Escape → context dialog closed, dock still .is-open,
 // report text unchanged, Program context focused
 // (Below 1280px the full-screen review covers the page, so Program context cannot be reached while it is open;
 //  Task 2's dismissModal test covers that path.)
});
test('leaving the program discards a streaming review and its column',async({page})=>{
 // route returns a never-ending stream (route.fulfill not called until test end; use a held promise)
 // open dock (status 'Preparing analysis' or streaming); click the first workout title link → session editor route
 // assert request aborted (page.on('requestfailed') for /api/analysis/program) and no .review-dock in DOM
 // breadcrumb back → toggle aria-expanded=false, .review-dock not .is-open, .panel right edge == viewport-24
});
test('dock layout survives long names and 200% text',async({page})=>{
 // 1366×768: rename template to 'Supercalifragilisticexpialidocious'.repeat(4); root font-size 200%; open dock
 // no horizontal document overflow; AI review, Close AI review and Analyze again are in viewport after scrollIntoViewIfNeeded
});
test.describe('motion',()=>{
 test.use({reducedMotion:'no-preference'});
 test('dock column animates open and closed without animating the first render',async({page})=>{
  // 1440: right after load, document.getAnimations() has no entry whose effect.target is .program-route or inside .review-dock
  // click open → document.getAnimations() includes a CSSTransition on .program-route with transitionProperty 'grid-template-columns'
  //   and duration 180ms (effect.getTiming().duration === 180), and one on .review-dock > .analysis-content for 'opacity'
  // await expect.poll(dock width) → 340; click open toggle again (close) during that poll's first frame → poll width → 0,
  //   dock inert, toggle focused (rapid reversal, no stale reopen)
 });
});
test.describe('hybrid input',()=>{
 test.use({hasTouch:true,viewport:{width:1366,height:768}});
 test('AI review and dock controls keep 44px targets',async({page})=>{
  // toggle box ≥44×44; open; Close AI review and Analyze again boxes ≥44 high
 });
});
```

In `e2e/program-analysis.spec.js`, replace `'Analyze program'` and `'View analysis'` with `'AI review'`, and `/^(Analyze program|View analysis)$/` with `'AI review'`. In the populated layout test, use the dock box (`.review-dock`) at widths ≥1280 and `dialog.analysis-modal` below. Where a test reopens after Escape, keep the Escape press (focus is on the heading inside the dock). In the hybrid test, replace `'Analyze program'` with `'AI review'`.

- [ ] **Step 2: Run to verify failure**

Run: `npx playwright test e2e/program-review-dock.spec.js e2e/program-analysis.spec.js`
Expected: FAIL (no `AI review` button).

- [ ] **Step 3: Implement the route host in `src/app.js`**

In the program branch only (not `record.kind==='template'`):
- add `program-route` to `host`'s classes;
- append `const reviewDock=document.createElement('aside');reviewDock.className='review-dock';` to `host` after `contentHost`;
- pass `reviewDock` to `mountProgramView`.

`clearView` already removes it with `app.replaceChildren()`.

- [ ] **Step 4: Implement the toolbar and wiring in `src/program-view.js`**

- Remove the `analysis-trigger` button. Append the toggle as the last element of `.program-file-actions`, after the hidden file input, with this SVG (from the mockup):

```html
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" aria-hidden="true"><path d="m10 3 2.1 6.9L19 12l-6.9 2.1L10 21l-2.1-6.9L1 12l6.9-2.1L10 3Z"/><path d="m19 2 .9 3.1L23 6l-3.1.9L19 10l-.9-3.1L15 6l3.1-.9L19 2Z"/></svg>
```

- Mount the panel with `anchor:root.querySelector('[data-program-review]')` and `dock:reviewDock??root.appendChild(Object.assign(document.createElement('aside'),{className:'review-dock'}))`.
- Change the context dialog's `onBeforeOpen` to `()=>analysisPanel.dismissModal()`.

- [ ] **Step 5: Implement the layout CSS in `style.css`**

In `@media (min-width:1280px)`:
- `.program-route` is a grid with `grid-template-columns:minmax(0,1fr) 0px` and `transition:grid-template-columns 180ms ease-out`.
- `.program-route:has(> .review-dock.is-open)` uses `minmax(0,1fr) var(--review-width)`.
- `.program-route > :not(.review-dock)` sits in `grid-column:1`.
- `.program-route > .review-dock` sits in `grid-column:2`, `grid-row:1 / span 2`, with `align-self:start`, `position:sticky`, `top:0` and `height:calc(100dvh - var(--review-dock-top,0px))`.

Define `--review-width:340px` on `:root`, overridden to `360px` in the existing `@media (min-width:1600px)` `:root` rule. Give `.program-file-actions .review-toggle` `margin-left:8px` (with the 8px gap, that makes 16px). Add `.program-route` to the reduced-motion block.

- [ ] **Step 6: Run to verify pass**

Run: `npx playwright test e2e/program-review-dock.spec.js e2e/program-analysis.spec.js e2e/program-context-dialog.spec.js e2e/program-context.spec.js e2e/compact-desktop.spec.js e2e/breadcrumbs.spec.js`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/app.js src/program-view.js style.css e2e/program-review-dock.spec.js e2e/program-analysis.spec.js
git commit -m "feat: dock program reviews beside the program page"
```

---

### Task 4: AI review toggle identity and motion

**Files:**
- Modify: `style.css` (new `.review-toggle` rules; remove the now-unused `.analysis-trigger` program rules only if nothing else uses them, since session analysis still uses `.analysis-trigger`)
- Test: `e2e/program-review-dock.spec.js` (add tests)

**Interfaces:**
- Consumes: `button.review-toggle[data-program-review]` with the `is-generating` class and `aria-expanded` from Tasks 2–3.
- Produces: CSS keyframes `ai-light-sweep` (450ms, single pass on `::before`) and `ai-sparkle-breathe` (1600ms, infinite, on `> svg`).

- [ ] **Step 1: Write the failing tests** in the `motion` describe block (`reducedMotion:'no-preference'`)

```js
test('AI review has a warm identity, a hover sweep and a generating breath',async({page})=>{
 // closed: computed background-image of toggle contains 'linear-gradient'
 // aria-expanded=true after click: background-image differs from closed value
 // hover (mouse) → getComputedStyle(toggle,'::before').animationName === 'ai-light-sweep', animationIterationCount '1', duration '0.45s'
 // before hover and while idle: svg animationName === 'none'
 // during a held stream (is-generating): svg animationName === 'ai-sparkle-breathe', duration '1.6s'; after completion 'none'
 // keyboard focus (Tab to it with no hover): outline-style 'solid'; ::before animationName 'none'
});
```

Outside the motion block, under the default `reducedMotion:'reduce'`, add `AI review motion is disabled with reduced motion`. Hover and generating both give `animationName==='none'` for `::before` and `svg`, while the gradient background is still present.

- [ ] **Step 2: Run to verify failure**

Run: `npx playwright test e2e/program-review-dock.spec.js -g "identity|reduced motion"`
Expected: FAIL.

- [ ] **Step 3: Implement `.review-toggle` in `style.css`**

Port `.superpowers/brainstorm/2916-1793475062/content/ai-button.css` (the approved study) into `style.css`:
- Keep its gradient values and keyframes, but use `var(--accent)` for the focus outline and `var(--text)` for the base text colour.
- Drop the mockup's own `min-height`/`min-width` media rule. Size the toggle like the other `.program-file-actions .secondary-btn` controls (44px default, `var(--control-compact)` under the fine-pointer desktop query).
- Gate the sweep with `@media (hover:hover) and (pointer:fine)`.
- In the reduced-motion block, disable both animations and hide `::before`.

- [ ] **Step 4: Run to verify pass**

Run: `npx playwright test e2e/program-review-dock.spec.js e2e/program-analysis.spec.js e2e/session-analysis.spec.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add style.css e2e/program-review-dock.spec.js
git commit -m "feat: give the AI review toggle a distinct identity"
```

---

### Task 5: Documentation, full verification and browser inspection

**Files:**
- Modify: `docs/design-system/README.md` ("Session analysis overlay" section near line 9, plus a new "Program review dock and Week agenda" section)
- Modify: `AGENTS.md` (new dated section at the top)
- Modify: `docs/superpowers/specs/2026-10-31-program-review-dock-design.md` (Status line only)
- Create: `docs/superpowers/verification/2026-11-01-program-review-dock.md`

**Interfaces:**
- Consumes: everything above.

- [ ] **Step 1: Update `docs/design-system/README.md`**

- Make "Session analysis overlay" describe session reports only.
- Add a section documenting:
  - dock widths and breakpoint (1280px; 340/360px);
  - sticky full-height behavior and `--review-dock-top`;
  - fixed header/footer;
  - review typography values;
  - 180ms column/translate/opacity motion and reduced motion;
  - focus and Escape rules;
  - the AI review toggle (gradient, 450ms fine-pointer sweep, 1600ms generating breath, no idle motion, accent-family only);
  - Week agenda layout (label column 4.875rem/6rem, 30rem container stack point, compact cards, dashed empty days).

  Values must match `style.css`.

- [ ] **Step 2: Add the AGENTS.md section**

Add `## Program review dock and Week agenda (2026-11-01)` at the top of `AGENTS.md`, linking the spec and this plan. Write 4–6 bullets in the style of the existing sections:
- dock at ≥1280px, full-screen below;
- the program route grid;
- the always-agenda Week layout;
- the AI review toggle rules;
- session analysis unchanged;
- the verification record path.

- [ ] **Step 3: Run the full suites**

Run: `npm test`, then `npm run test:e2e`, then `npm run build`
Expected: all pass. Record the actual counts. If anything fails, fix it (or report it) before continuing; never record a pass that did not happen.

- [ ] **Step 4: Inspect in a real browser**

Use `npm run dev` with a populated program: six occurrences, a long name, Unscheduled, goals. Inspect:
- 1366×768, 1440×900 and 1920×1080, dock open and closed;
- 1280×800 and 1279×800;
- 768×1024 and 390×844;
- 200% text;
- touch/hybrid emulation.

Play:
- open/close and rapid toggles;
- Escape inside and outside the dock;
- breakpoint changes while open;
- scrolling long pages;
- editing and drag-reordering while the dock is open (the report goes stale);
- Program context over the dock;
- the hover sweep, generating breath and reduced motion.

Compare against the spec screenshots. Fix abrupt transitions, spacing or stacking issues you find, with a test where practical.

- [ ] **Step 5: Write `docs/superpowers/verification/2026-11-01-program-review-dock.md`**

Follow the format of `docs/superpowers/verification/2026-10-31-program-analysis.md`:
- branch/base;
- automated evidence with real counts;
- browser interaction and layout evidence (what was inspected at which sizes);
- screenshots saved under `docs/superpowers/verification/2026-11-01-program-review-dock/`;
- explicit gaps, e.g. no real-provider run is required, because analysis behavior is unchanged.

Set the spec's Status line to "implementation and local verification complete; deployment pending".

- [ ] **Step 6: Commit**

```bash
git add docs/ AGENTS.md
git commit -m "docs: record program review dock design system and verification"
```
