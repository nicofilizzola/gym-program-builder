# Mobile Navigation and Start-Sheet Search Implementation Plan (light)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On phones (≤760px), the header becomes one compact row plus a bottom tab bar. The Start workout sheet gets one search field that filters templates and program sessions.

**Architecture:** Client-only.

- **Tab bar:** a media-query restyle of the existing `<nav>`, with icons and short labels injected by `app.js`. The workout resume bar is repositioned through one CSS variable.
- **Search:** a pure matcher (`src/search-text.js`) and filtering inside `src/workout-start-sheet.js`, reusing the sheet's per-sheet program cache.

This plan is deliberately light: focused unit tests for the pure helper, one e2e spec per feature, then the existing suite.

**Tech Stack:** Vanilla ES modules, CSS, node:test, Playwright. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-11-05-mobile-polish-tracker-notes-design.md` §A1, §A3.

## Global Constraints

- **Breakpoint:** `max-width:760px`. Above it the header and nav are unchanged.
- **Tab bar:**
  - height `56px + env(safe-area-inset-bottom)`;
  - visible labels `Programs`, `Templates`, `Catalog`, `Workouts`, with the accessible name equal to the visible label;
  - `aria-current="page"` kept, plus accent and a 2px top indicator;
  - tabs at least 44×44px.
- **Typing:** while a text field in `#app` is focused, the tab bar and resume bar slide out over 150ms `transform` ease-out. Reserved padding is unchanged. Reduced motion: instant.
- **Search:**
  - `type="search"`, visually hidden label `Search sessions`, placeholder `Search`;
  - kept across tabs; no debounce; never auto-focused;
  - Escape clears a non-empty query without closing the sheet.
- **Copy:**
  - `Searching…`
  - `No sessions match "{query}".`
  - `No templates match "{query}".`
  - `Couldn't search {program}.` with `Retry`
- **UI rules:** follow docs/design-system/README.md and AGENTS.md (UI workflow). Change `style.css` first, then update the design-system doc in the same commit. Use icons from `src/action-controls.js` (inline SVG, `currentColor`).
- **Playwright** uses 127.0.0.1:3199. Never kill processes you didn't start.
- **Verification:** `npm test`, `npm run test:e2e`, `npm run build`. Never claim a pending deployment was verified.

## Review Focus

1. **Resume bar plus tab bar:** during an active workout on a phone, the page's last control stays reachable above both bars, and the resume bar never overlaps the tab bar. Covered by the Task 1 e2e.
2. **Text field focused in the logger:** both bars slide away and come back on blur. Range sliders and buttons never trigger it. Covered by the Task 1 e2e.
3. **Accessible names:** at ≤760px the links are named `Templates` and `Catalog`; at desktop `Session templates` and `Exercise catalog`. Existing e2e specs that look up nav links by name must keep passing at their viewport. Task 1 runs the full suite.
4. **Program search with one program failing:** the other programs' results still show; Retry reloads only the failed one. Task 2 e2e.
5. **Starting from a search result:** it goes through the same start flow (Resume/Finish/Discard prompt), and controls are disabled while starting, including the search field. Task 2 e2e.

---

### Task 1: Bottom tab bar and compact mobile header

**Files:**
- Modify: `index.html` (viewport meta gets `, viewport-fit=cover`; each nav link's text becomes `<span class="nav-label-full">Session templates</span><span class="nav-label-short">Templates</span>`, likewise `Exercise catalog`/`Catalog`; Programs and Workouts keep single labels)
- Modify: `src/action-controls.js` (add icons `calendar`, `template`, `dumbbell`; reuse `catalog`), `src/app.js` (prepend `actionIcon(...)` to each `[data-nav]` link: programs→`calendar`, templates→`template`, catalog→`catalog`, workouts→`dumbbell`)
- Modify: `src/workout-bar.js` (`reserve()` sets `paddingBottom` to `calc(var(--tab-bar-height) + {h}px)` when shown and clears it when hidden)
- Modify: `style.css`, `docs/design-system/README.md` (Navigation section)
- Test: `e2e/mobile-navigation.spec.js` (new)

**Interfaces:**
- Produces: CSS custom property `--tab-bar-height` on `:root`. It is `calc(56px + env(safe-area-inset-bottom,0px))` at ≤760px and `0px` above. `body` gets `padding-bottom:var(--tab-bar-height)`, and `.workout-bar` uses `bottom:var(--tab-bar-height)`. At ≤760px the workout bar drops its own safe-area padding.
- Typing state is CSS-only:

```css
body:has(#app :is(input:not([type=range],[type=checkbox],[type=radio],[type=button],[type=submit]),textarea,[contenteditable]):focus)
```

  At ≤760px it applies `transform:translateY(100%)` to the nav and `translateY(calc(100% + var(--tab-bar-height)))` to `.workout-bar.is-open`.

- [ ] **Step 1: Write the failing e2e** (`page.setViewportSize({width:390,height:844})`, touch context, login via `e2e/workout-helper.js`):

```js
test('tab bar navigates with short accessible names',async({page})=>{
  const nav=page.getByRole('navigation',{name:'Main'});
  for(const name of ['Programs','Templates','Catalog','Workouts'])await expect(nav.getByRole('link',{name,exact:true})).toBeVisible();
  const box=await nav.boundingBox();expect(box.y+box.height).toBeCloseTo(844,0);expect(box.height).toBeGreaterThanOrEqual(56);
  await nav.getByRole('link',{name:'Workouts'}).click();
  await expect(nav.getByRole('link',{name:'Workouts'})).toHaveAttribute('aria-current','page');
  const header=await page.locator('.app-header').boundingBox();expect(header.height).toBeLessThanOrEqual(56);
});
test('resume bar stacks above the tab bar and both hide while typing',async({page})=>{
  // start a blank workout, navigate to Programs: bar bottom == nav top (±1px)
  // back in the logger, focus the workout name input: nav and bar translated out (boundingBox y >= 844 - 1)
  // blur: both return; a range input focus (Profile page slider) does not hide them
});
test('desktop keeps the full header labels',async({page})=>{
  await page.setViewportSize({width:1366,height:768});
  await expect(page.getByRole('link',{name:'Session templates'})).toBeVisible();
});
```

- [ ] **Step 2: Run `npx playwright test e2e/mobile-navigation.spec.js`.** Expected: FAIL (port 3199 free first).
- [ ] **Step 3: Implement the markup, icons, CSS and `reserve()` change above.**
  - Tab: icon (24px) above the label (12px, 600 weight); muted, accent when current.
  - Top header at ≤760px: one row of about 48px with save controls left and Profile/Log out right. It gets `nav` out of the flow because `nav` is fixed.
  - The `.nav-label-short` / `.nav-label-full` toggle uses `display:none`.
  - Reduced motion: no transform transition.
- [ ] **Step 4: Run the spec, then `npm test` and `npm run test:e2e`.** Expected: PASS. Fix any existing spec that looked up nav links by their long name at a phone viewport by using the short name there.
- [ ] **Step 5: Browser review and commit.**
  - Inspect 360, 390 and 430px widths with populated Programs, the logger and the Workouts page, plus 200% text and reduced motion. Record what was checked in the commit body.
  - Commit with `git add index.html src/action-controls.js src/app.js src/workout-bar.js style.css docs/design-system/README.md e2e/mobile-navigation.spec.js` and `git commit -m "feat: bottom tab bar and compact header on phones"`.

### Task 2: Start-sheet search

**Files:**
- Create: `src/search-text.js`, `test/search-text.test.js`
- Modify: `src/workout-start-sheet.js`, `style.css`, `docs/design-system/README.md` (Start sheet section)
- Test: `e2e/workout-start-search.spec.js` (new)

**Interfaces:**
- Produces: `normalizeSearch(text:string) → string` (NFD, strip `\p{M}`, lowercase, trim) and `matchesQuery(text:string, query:string) → boolean` (every whitespace-separated token of the normalized query is a substring of the normalized text; a blank query matches).
- The sheet's internal `renderPrograms()` / `renderTemplates()` take the current query. A non-empty Program-tab query renders `renderProgramResults(query)` instead of the Up next slot and disclosures.

- [ ] **Step 1: Write the failing unit test**

```js
test('matchesQuery is token, case and accent insensitive',()=>{
  assert.equal(matchesQuery('Pull A — Dos','pull'),true);
  assert.equal(matchesQuery('Épaules lourdes','epaules LOURD'),true);
  assert.equal(matchesQuery('Push A','push b'),false);
  assert.equal(matchesQuery('Anything','   '),true);
});
```

- [ ] **Step 2: Run `npm test`.** Expected: FAIL (module missing).
- [ ] **Step 3: Implement `src/search-text.js`.** Run `npm test`. Expected: PASS.
- [ ] **Step 4: Write the failing e2e** (390×844 touch, plus one case at 1366×768). Seed 2 programs, the second with a session `Legs Heavy`, and templates `Push A` and `Pull B`. Cases:
  - Typing `pull` on the Template tab leaves only `Start Pull B`.
  - Switching to Program keeps `pull` in the field.
  - `heavy` lists a heading for program 2 and `Start Legs Heavy, …` only, with Up next hidden.
  - A program-name query lists all that program's sessions.
  - `zzz` shows `No sessions match "zzz".`
  - Escape clears the field and the sheet stays open; a second Escape closes it.
  - Opening the sheet focuses the Up next card, not the field.
  - Routing `**/api/documents/{p2}/bundle` to fail once shows `Couldn't search {p2 name}.`, while program 1 results remain; Retry recovers.
  - Clicking a result starts that session, and the field is disabled while starting.
- [ ] **Step 5: Run `npx playwright test e2e/workout-start-search.spec.js`.** Expected: FAIL.
- [ ] **Step 6: Implement in `src/workout-start-sheet.js`.**
  - The field sits in `.start-sheet-tabs` below the tablist and Blank, full width, with the magnifier `aria-hidden`.
  - On `input`: re-render the visible panel. The query is shared by both panels.
  - On a field `keydown` Escape with a non-empty value: `preventDefault`, `stopPropagation`, clear and re-render. The dialog `cancel` stays as is.
  - **Program results:** for each program, `getProgram(id)`, then a heading `li.start-sheet-group` with the program name, followed by `sessionButton(...)` rows for sessions where `matchesQuery(name)` or `matchesQuery(programName)` holds, in `sessionOrder`.
  - While any load is pending, show a `Searching…` status. A rejected load renders the error and a Retry that calls `getProgram` again.
  - Clearing the query re-renders the disclosure view. Remember each disclosure's `aria-expanded` in a `Map` keyed by program id.
  - `setBusy` also disables the field.
- [ ] **Step 7: Run the spec plus `e2e/workout-start-sheet.spec.js` and `e2e/workout-start.spec.js`.** Expected: PASS.
- [ ] **Step 8: Browser review, docs and commit.**
  - Check 390 touch, 1366 and reduced motion: results swap instantly and focus is unaffected.
  - Add AGENTS.md bullets under "Workout start sheet" for search, and a new "Mobile navigation (2026-11-05)" section with the Task 1 rules and links to the spec and this plan.
  - Create `docs/superpowers/verification/2026-11-05-mobile-polish-tracker-notes.md` with a "Plan 1" section: commands run with counts, viewports inspected, and gaps.
  - Run `npm test`, `npm run test:e2e` and `npm run build`. Commit everything with `git commit -m "feat: search sessions and templates in the start sheet"`.
