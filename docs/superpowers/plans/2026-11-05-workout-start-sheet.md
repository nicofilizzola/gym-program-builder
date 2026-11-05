# Workout Start Sheet Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Start a workout from a program occurrence, a session template or blank directly on `#/workouts`, through one Start workout sheet that suggests the next session.

**Architecture:** A pure module (`src/workout-up-next.js`) decides the suggestion from the program and the first history page. A view module (`src/workout-start-sheet.js`) renders a native `<dialog>` (bottom sheet ≤760px, dialog above) and talks to the app only through loader/callback parameters. `src/app.js` feeds it the lists the Workouts route already loads and routes starts into the existing `startWorkout`. No server, API or schema change.

**Tech Stack:** Vanilla ES modules, native `<dialog>`, pointer events, CSS transitions; `node:test` unit tests; Playwright e2e (`reducedMotion:'reduce'` by default, test server on 127.0.0.1:3199).

**Spec:** docs/superpowers/specs/2026-11-05-workout-start-sheet-design.md

## Global Constraints

- No new dependencies, frameworks or icon libraries; icons via `actionIcon(name)` (`src/action-controls.js`, `start` exists) or inline SVG.
- Change authoritative values in `style.css` first, then `docs/design-system/README.md` in the same commit.
- Targets: 44px minimum on touch/hybrid; 32px (`--control-compact`) only inside `@media (min-width:1100px) and (pointer:fine) and (not (any-pointer:coarse))`.
- Breakpoint: bottom sheet at `max-width:760px`, dialog at ≥761px (`min(480px, 100vw − 32px)` wide, `max-height:min(640px, 100dvh − 32px)`); bottom sheet `max-height:85dvh`.
- Motion: bottom sheet 200ms ease-out translateY + backdrop; dialog 150ms catalog modal motion; disclosures 200ms `.collapsible`/`.is-closed`; tabs instant; all instant with `prefers-reduced-motion: reduce`. No `transition: all`.
- Copy (exact): `Start workout`, `Blank workout`, `Program`, `Template`, `Up next · <program>`, `Finding your next session…`, `Loading…`, `No sessions in this program.`, `No programs yet.`, `Go to Programs`, `No session templates yet.`, `Go to Session templates`, `Couldn't load programs.`, `Couldn't load session templates.`, `Couldn't load this template. Try again.`, `Retry`, `Unscheduled`, `Close`, empty history `No workouts yet. Start one from a program, a session template or a blank workout.`
- Accessible names (exact): Up next card `Up next: <session>, <program>`; session row `Start <session>, <program>, <Monday…Sunday|Day N|Unscheduled>`; template row `Start <template>`.
- Week label short form `Mon`…`Sun` (visible), long form `Monday`…`Sunday` (accessible names); Sequence `Day N` counts workout entries only.

## Review Focus

1. A program whose bundle references a deleted/missing template (`resolveProgram` throws `Session template not found.`) must show the row error with Retry, not break the sheet — Task 2 test `loader rejection shows row error and retry`.
2. Opening a collapsed program while its bundle is already in flight (the Up next request) must not fetch twice — Task 2 test `loadProgram is called once per program`.
3. Rapid Start → Escape → Start must leave one interactive sheet with no stale close timer removing it — Task 2 test `rapid reopen keeps one open sheet`.
4. Long program/session/template names (120 characters) must wrap with no horizontal scroll at 320px — Task 2 test `long names wrap at 320px`.
5. A log whose `startedAt` offset differs from the device's current offset (logged before a DST change or while travelling) must count by absolute time — Task 1 test `offset in startedAt counts by absolute time`.

---

### Task 1: Up next rules

**Files:**
- Create: `src/workout-up-next.js`
- Test: `test/workout-up-next.test.js`

**Interfaces:**
- Consumes: `getSequence(program)` from `src/program-sequence.js`.
- Produces:
  - `weekStart(now: Date) → Date` — local Monday 00:00 of `now`'s week.
  - `upNextProgram(programs: {id}[], logs: {source}[]) → string|null`.
  - `upNextOccurrence(program: {mode, workouts:{id,day}[], sequence?}, logs: {source,startedAt}[], now: Date) → {occurrenceId:string, label:string}|null`.
  - `occurrenceLabels(program) → Map<occurrenceId, {short:string, long:string}>` — Week `{short:'Mon', long:'Monday'}` … or `{short:'Unscheduled', long:'Unscheduled'}`; Sequence `{short:'Day N', long:'Day N'}` (N = 1-based position among workout entries).
  - `sessionOrder(program) → occurrenceId[]` — Week: days Monday→Sunday in program order, then Unscheduled in program order; Sequence: workout entries in sequence order.

- [ ] **Step 1: Write the failing tests** in `test/workout-up-next.test.js` (`node:test`, `assert/strict`). Fixtures: PPL Week `{mode:'schedule',workouts:[{id:'push',day:0},{id:'pull',day:1},{id:'legs',day:3},{id:'arms',day:null}]}`; Cycle Sequence `{mode:'simple',workouts:[{id:'a'},{id:'b'},{id:'c'}],sequence:[{type:'workout',workoutId:'a'},{type:'rest',id:'r'},{type:'workout',workoutId:'b'},{type:'workout',workoutId:'c'}]}`; helper `log(occurrenceId, iso, programId='p')` → `{source:{kind:'program',programId,occurrenceId,templateId:'t',programName:'',templateName:''},startedAt:iso}`. Build ISO strings from local `Date`s (`toLocalIso` from `src/workout-log.js`) so tests pass in any timezone. Tests and expected values:
  - `weekStart` for Wed 2026-11-04 10:00 and for Mon 2026-11-02 00:00 → Mon 2026-11-02 00:00 local; Sun 2026-11-08 23:59 → same Monday.
  - `week: nothing logged suggests today or later, never missed days` — now Wed 11-04 → `{occurrenceId:'legs',label:'Thu'}`.
  - `week: earlier days logged` — logs push Mon, pull Tue → legs.
  - `week: today pending` — now Thu 11-05, no logs → legs.
  - `week: week done wraps to next Monday` — now Thu, legs logged Thu → push (`Mon`); now Wed, legs logged Wed → push.
  - `week: same-day program order` — workouts push day 0, push2 day 0; now Mon, push logged Mon → push2.
  - `week: Sunday with all logged wraps` — now Sun 11-08, logs push/pull/legs this week → push.
  - `week: last week's log does not count` — legs logged Thu 10-29, now Wed 11-04 → legs.
  - `week: log at exactly Monday 00:00 counts this week` — push logged Mon 11-02 00:00, now Mon 11-02 09:00 → pull.
  - `week: unscheduled only → null`; `empty program → null` (both modes).
  - `week: other programs' logs ignored` — legs logged Wed with `programId:'other'`, now Wed → legs.
  - `offset in startedAt counts by absolute time` — legs log ISO with `+14:00` offset whose instant falls Wed 11-04 local → treated as this week → push.
  - `sequence: no logs → a, Day 1`; `last b → c, Day 3`; `last c → a`; `newest log removed from sequence, previous b → c` (logs newest first: `x`, then `b`).
  - `upNextProgram`: newest program log X exists → `'x'`; newest program log's program missing, older log Y → `'y'`; template/blank logs skipped; no program logs → first program id; no programs → `null`.
  - `occurrenceLabels` and `sessionOrder` for PPL (`['push','pull','legs','arms']`, arms → Unscheduled) and Cycle (`['a','b','c']`, c → `Day 3`).

- [ ] **Step 2: Run to verify failure**

Run: `node --test test/workout-up-next.test.js`
Expected: FAIL — cannot find module `src/workout-up-next.js`.

- [ ] **Step 3: Implement `src/workout-up-next.js`** with the signatures above. Week rule (spec "Up next rules"): this-week = `weekStart(now) ≤ new Date(startedAt) < weekStart(now)+7 days`; today's index `(now.getDay()+6)%7`; first candidate with `day ≥ today` (ascending day, program order within day) whose id has no this-week log for the program; else the first scheduled occurrence by ascending day then program order. Sequence: workout entries of `getSequence(program)`; newest matching log whose `occurrenceId` is in the entries → next entry (wrap), else first. Labels use the module's own `['Mon',…,'Sun']`/`['Monday',…,'Sunday']` arrays. Pure: no DOM, no `Date.now()`.

- [ ] **Step 4: Run to verify pass**

Run: `node --test test/workout-up-next.test.js` → all pass; `npm test` → all pass.

- [ ] **Step 5: Commit**

```bash
git add src/workout-up-next.js test/workout-up-next.test.js
git commit -m "feat: decide the next workout session from program and history"
```

---

### Task 2: Start sheet view

**Files:**
- Create: `src/workout-start-sheet.js`
- Modify: `src/dialog-motion.js` (add a `duration` option)
- Modify: `style.css` (new `.start-sheet` block near the catalog modal rules ~line 1753, plus the compact desktop media block and the reduced-motion rule ~line 1789)
- Modify: `docs/design-system/README.md` (new "Workout start sheet" entry next to the workout logger entries ~line 392)
- Test: `e2e/workout-start-sheet.spec.js` (fixture tests: mount the view via `import('/src/workout-start-sheet.js')` into a page whose body is replaced, as `e2e/session-editor.spec.js` does; no sign-in)

**Interfaces:**
- Consumes: Task 1's `upNextOccurrence`, `upNextProgram`, `occurrenceLabels`, `sessionOrder`; `mountDialogMotion` from `src/dialog-motion.js`; `actionIcon` from `src/action-controls.js`; `durationLabel` from `src/duration.js`.
- Produces:
  - `mountDialogMotion(dialog, {onClosed, duration=150})` — `duration` is a number or `() => number`, read at each `close()`; existing callers unchanged.
  - `openWorkoutStartSheet({programs, templates, logs, loadProgram, loadTemplate, onStart, onNavigate, onRetryList, now=new Date()}) → {close():void, closed:Promise<void>}`
    - `programs`/`templates`: arrays of `{id,name}` in list order, or `null` when that list failed.
    - `logs`: history summaries, newest first (`[]` allowed).
    - `loadProgram(id) → Promise<resolvedProgram>` (`{name, mode, workouts:[{id,day,name,exercises,…timing}], sequence?}`).
    - `loadTemplate(id) → Promise<{id, document}>`.
    - `onStart(options)` called after the sheet finished closing with `{template:{id,document}, program:{id,name}, occurrenceId}`, `{template:{id,document}}` or `{}`.
    - `onNavigate(hash)` for empty-state links (sheet closes first).
    - `onRetryList(kind:'program'|'template') → Promise<array>` resolving the refetched list.
    - Focus returns to `document.activeElement` at open time after close.

- [ ] **Step 1: Write the failing fixture tests** in `e2e/workout-start-sheet.spec.js`. A shared `mountSheet(page, overrides)` helper evaluates in the page: replaces `document.body` with a `<button id="opener">Start workout</button>`, records calls in `window.calls` (`starts`, `loads`, `navigations`), and opens the sheet on opener click with fixtures — programs `[{id:'ppl',name:'PPL'},{id:'cycle',name:'Cycle'}]`, PPL resolved as Task 1's Week fixture with names `Push A`/`Pull A`/`Legs A`/`Arms`, `templateId` `t-<occurrence id>`, each with 2 exercises; Cycle as Task 1's Sequence fixture; templates `[{id:'t1',name:'Upper'}]`; logs with one PPL `push` log this week; `now` fixed to Wed 2026-11-04 10:00 local. Tests:
  - `up next starts in one tap` — open; card named `Up next: Legs A, PPL` is focused and shows `Thu · 2 exercises · ~N min`; click → exactly one start with `template.id === 't-legs'`, `template.document.name === 'Legs A'`, `program` deep-equal `{id:'ppl',name:'PPL'}` and `occurrenceId === 'legs'`; dialog gone; focus on `#opener`.
  - `program list expands and starts any session` — PPL expanded (`aria-expanded="true"`), Cycle collapsed; expand Cycle → `Loading…` then rows `Day 1`, `Day 3` for `c`; click `Start C, Cycle, Day 3` → start with `occurrenceId:'c'`.
  - `week list order and unscheduled` — PPL rows in order Push A, Pull A, Legs A, then label `Unscheduled` and Arms.
  - `template tab and blank` — tab `Template` (`aria-selected`), arrow-key navigation between tabs; `Start Upper` → `loadTemplate('t1')` then start `{template:{id:'t1',…}}`; reopen, `Blank workout` → start `{}`.
  - `template load failure keeps sheet open` — `loadTemplate` rejects → row shows `Couldn't load this template. Try again.`, buttons re-enabled, no start.
  - `double tap starts once` — two quick clicks on the card → `starts.length === 1`.
  - `Escape, backdrop and Close return focus` — each closes and focuses `#opener`.
  - `empty states` — `programs:[]` opens on Template tab; Program tab shows `No programs yet.`; `Go to Programs` → `navigations` `['#/programs']`; `templates:[]` shows `No session templates yet.`.
  - `list failure retry` — `programs:null` → `Couldn't load programs.` + `Retry`; `onRetryList('program')` resolves the fixture list → programs render.
  - `loader rejection shows row error and retry` (Review Focus 1) — `loadProgram('cycle')` rejects once with `Session template not found.` → error + Retry inside Cycle; Retry succeeds → rows.
  - `loadProgram is called once per program` (Review Focus 2) — delay PPL's load; expand/collapse/expand PPL during the delay → `loads` contains `'ppl'` once.
  - `rapid reopen keeps one open sheet` (Review Focus 3) — with `reducedMotion:'no-preference'`: open, Escape, immediately click opener → after 400ms exactly one `dialog[open].start-sheet`, interactive.
  - `long names wrap at 320px` (Review Focus 4) — viewport 320×700, 120-character program/session/template names → `document.documentElement.scrollWidth <= 320` and the dialog's `scrollWidth <= clientWidth`.
  - `bottom sheet layout and swipe close` — viewport 390×844, `reducedMotion:'no-preference'`: dialog bottom edge at viewport bottom; dragging the handle down 120px closes; dragging 30px springs back (still open).
  - `desktop dialog layout` — viewport 1366×768: dialog width ≤ 480 and centered.
  - `reduced motion` — default config: open/close leaves no `is-entering`/`is-closing` class pending after one frame.

- [ ] **Step 2: Run to verify failure**

Run: `npx playwright test e2e/workout-start-sheet.spec.js`
Expected: FAIL — module `/src/workout-start-sheet.js` not found.

- [ ] **Step 3: Add the `duration` option to `mountDialogMotion`** (`src/dialog-motion.js`): replace the fixed `150` in `close()` with `typeof duration==='function'?duration():duration`. Run `npx playwright test e2e/confirm-dialog.spec.js` → still passes.

- [ ] **Step 4: Implement `src/workout-start-sheet.js`** per the spec's "Sheet layout", "Starting", "Closing", "Accessibility" sections and the Interfaces above:
  - Dialog `class="catalog-dialog start-sheet"`, `aria-labelledby` the title; motion via `mountDialogMotion(dialog,{duration:()=>matchMedia('(max-width:760px)').matches?200:150})`.
  - Up next: `upNextProgram(programs, logs)` → request that program at open, render the skeleton until it resolves, then `upNextOccurrence`; no card when it returns `null` or the load fails.
  - Program cache: `Map<id, Promise>` storing the promise (Review Focus 2); a rejected promise is deleted so Retry refetches.
  - Disclosures reuse `.collapsible`/`.is-closed`; rows rendered in `sessionOrder` with `occurrenceLabels`.
  - Busy: one `starting` flag; set before any await, cleared on template-load failure.
  - Swipe: pointer events on `.start-sheet-handle` and the header, only when `matchMedia('(max-width:760px)')` matches; set `style.transform` while dragging; on release `dy > 80` or velocity `> 0.5px/ms` → `close()`, else clear the transform (CSS transition returns it).
  - Start: close, await `closed`, then `onStart(options)`.

- [ ] **Step 5: Style it** in `style.css` (tokens only): `.start-sheet` dialog sizing per Global Constraints, ≤760px bottom anchoring (`margin:auto 0 0`, `width:100%`, `max-width:none`, rounded top corners, grab handle, `transform:translateY(100%)` for `.is-entering`/`.is-closing`, 200ms), header/tab row (fixed) and scrolling body; tab buttons (selected = accent border + `--accent-soft`); `.start-sheet-next` card (accent border, play icon); program disclosure rows and session rows (min-height 44px; 32px in the compact desktop block); long-name wrapping (`overflow-wrap:anywhere`); add `.start-sheet` to the reduced-motion rule. Then document the component (layout, sizes, motion table, copy) in `docs/design-system/README.md`.

- [ ] **Step 6: Run to verify pass**

Run: `npx playwright test e2e/workout-start-sheet.spec.js` → all pass; `npm test` → all pass.

- [ ] **Step 7: Commit**

```bash
git add src/workout-start-sheet.js src/dialog-motion.js style.css docs/design-system/README.md e2e/workout-start-sheet.spec.js
git commit -m "feat: add the workout start sheet"
```

---

### Task 3: Wire the sheet into Workouts

**Files:**
- Modify: `src/workout-history-view.js:23-25,60` (button, callback, empty text)
- Modify: `src/app.js` Workouts route (~lines 341-347)
- Modify: `e2e/workouts.spec.js`, `e2e/workout-start.spec.js:74`, `e2e/workout-offline.spec.js:58,123`
- Test: `e2e/workout-start-sheet.spec.js` (append app-level tests)

**Interfaces:**
- Consumes: Task 2's `openWorkoutStartSheet`; existing `api.list(kind)`, `api.programBundle(id)`, `api.get(id)`, `resolveProgram`, `startWorkout(options)`, `navigate(hash)`; e2e helpers `login`, `resetWorkouts`, `createLinkedTemplate`, `saveFinishedLog`, `headers` from `e2e/workout-helper.js`.
- Produces: `mountWorkoutHistory(root, {…, onStart})` — `onStartBlank` renamed to `onStart`; the header button `Start workout` with `actionIcon('start')`.

- [ ] **Step 1: Write the failing app-level tests** (appended to `e2e/workout-start-sheet.spec.js`, using the `setup` pattern from `e2e/workout-start.spec.js`: login, reset, linked template, program `PPL` posted via `/api/documents`):
  - `start from the sheet lands in the logger` — `#/workouts` → `Start workout` → Up next card for the program's only occurrence → URL `#/workouts/<id>`, `Workout name` value is the template name.
  - `up next advances after a finished session` — Week program with Monday and Thursday occurrences; `saveFinishedLog` with a program source for the occurrence the card currently suggests, dated now; reload `#/workouts`, open the sheet → card suggests the other occurrence. (Choose occurrence days relative to `new Date()` so the assertion holds on any weekday.)
  - `template and blank from the sheet` — Template tab → `Start <template>` → logger with that name; discard; `Blank workout` → logger named `Workout`.
  - `active workout prompts before a second start` — start blank, go back to `#/workouts`, sheet → template → dialog `Workout in progress` with Resume/Finish/Discard (existing copy).
  - `offline lists show retry` — block `**/api/documents?kind=program*` with `route.abort('internetdisconnected')`, load `#/workouts` (history still renders), open sheet → `Couldn't load programs.`; unblock, `Retry` → `PPL` listed.

- [ ] **Step 2: Run to verify failure**

Run: `npx playwright test e2e/workout-start-sheet.spec.js -g "start from the sheet|advances|template and blank|active workout|offline lists"`
Expected: FAIL — no `Start workout` button on `#/workouts`.

- [ ] **Step 3: Update `src/workout-history-view.js`**: button text `Start workout` with `actionIcon('start')` before it, `onStart` callback, empty text per Global Constraints.

- [ ] **Step 4: Wire `src/app.js`** Workouts route: fetch `api.list('program')` and `api.list('template')` in parallel with `api.listWorkouts()`, each failure caught separately (non-network errors still throw, like the history fetch) to `null`; `onStart: action(() => openWorkoutStartSheet({programs, templates, logs: page.records, loadProgram: async id => { const b = await api.programBundle(id); return resolveProgram(b.record.document, b.templates); }, loadTemplate: id => api.get(id), onStart: options => startWorkout(options), onNavigate: hash => action(() => navigate(hash))(), onRetryList: kind => api.list(kind)}))`. Program starts pass `program:{id, name: name.trim()||'Untitled program'}` and the resolved occurrence as `template:{id: occurrence.templateId, document: occurrence}`, matching the program view's existing start call (`src/app.js` `onStartWorkout` in `mountProgramView`) — build that object in the sheet from the loaded program, not in app.js.

- [ ] **Step 5: Update existing e2e** — replace `Start blank workout` clicks with `Start workout` → `Blank workout` in `e2e/workout-start.spec.js` and `e2e/workout-offline.spec.js`; `e2e/workouts.spec.js` asserts the `Start workout` button and the new empty text.

- [ ] **Step 6: Run to verify pass**

Run: `npx playwright test e2e/workout-start-sheet.spec.js e2e/workouts.spec.js e2e/workout-start.spec.js e2e/workout-offline.spec.js` → all pass; `npm test` → pass.

- [ ] **Step 7: Commit**

```bash
git add src/workout-history-view.js src/app.js e2e/workout-start-sheet.spec.js e2e/workouts.spec.js e2e/workout-start.spec.js e2e/workout-offline.spec.js
git commit -m "feat: start workouts from programs and templates on the Workouts page"
```

---

### Task 4: Requirements, browser review and verification record

**Files:**
- Modify: `AGENTS.md` (new top section "Workout start sheet (2026-11-05)")
- Create: `docs/superpowers/verification/2026-11-05-workout-start-sheet.md`

- [ ] **Step 1: Add the AGENTS.md section** (5–7 bullets, above "Warm-ups, supersets and training profile"): links to the spec and this plan; one Start workout sheet (bottom sheet ≤760px, dialog above) with Program/Template tabs and Blank workout; Up next rules (program last logged from, else most recently edited; Week: first unlogged session today→Sunday, no catch-up, then next week's first; Sequence: after the newest logged occurrence still in the sequence); computed client-side from the first history page, never stored; starts reuse the existing start flow; motion values; verification doc link.

- [ ] **Step 2: Browser review** on the test server with populated data (several programs incl. Week and Sequence, unscheduled sessions, long names, templates, history): 390×844, 768×1024, 1366×768, 1440×900, 1920×1080, 200% text, touch emulation and fine pointer. Exercise open/close, rapid open/close, swipe close and spring-back, swipe reversal, tab keyboard navigation, program expand/collapse, reduced motion, offline Retry. Fix abrupt transitions, overflow or excessive spacing found.

- [ ] **Step 3: Run full verification**

Run: `npm test` → all pass; `npm run test:e2e` → all pass; `npm run build` → `Built public assets.`

- [ ] **Step 4: Write the verification record** listing what was inspected (viewports, inputs, interactions), the command results, and gaps (e.g. real device touch not tested; Preview/Production not deployed). Never claim a pending deployment was verified.

- [ ] **Step 5: Commit**

```bash
git add AGENTS.md docs/superpowers/verification/2026-11-05-workout-start-sheet.md
git commit -m "docs: record workout start sheet requirements and verification"
```
