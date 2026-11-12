# Focus Set Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make weight and reps comfortable to enter on the mobile Focus card, show variant tags in the tracker, and fix the RIR control (`5+`, none on warm-ups, consistent border) and the note icon and placement.

**Architecture:** Three independently shippable parts: small fixes, input, tags. Everything stays a presentation over `mountWorkoutLogger`'s port: the ruler change is internal to `src/workout-ruler.js`, the weight step moves into the existing Workout actions menu, and tags are two optional snapshot fields on log exercises that `validateWorkoutLog` defaults (no migration). Card fit keeps using `focusCardFit` unchanged; only the measured sections change.

**Tech Stack:** Vanilla ES modules, plain CSS (container queries), `node:test`, Playwright.

**Spec:** docs/superpowers/specs/2026-11-12-focus-set-page-design.md (approved 2026-11-12). Read it with this plan; section numbers below (§1–§7) refer to it.

## Measured fit per stage (Playwright emulation, 2026-11-12, seeded Last time + Best)

`peek` = next set's whole header shows; `peekless` = card fills the feed; `sticky` = card taller than the feed, Complete pinned. Complete stayed inside the feed in every cell.

| Stage | 360×660, 393×659 (feed ~419) | 393×750 (509) | 412×760 (519) | 412×839 (598) | 430×932 (691) |
|---|---|---|---|---|---|
| Today | peekless | peek | peek | peek (<1px slack) | peek |
| Header row 44px (Task 3) | peekless | peekless | peek | **peekless** | peek |
| Rulers 56/48/44 with the help row still present | **sticky (424 > 419)** | peekless | peekless | peekless | peek |
| Help row removed (Task 6) | peek | peek | peek | peek | peek |
| + rulers (Task 7, Part 2 complete) | peek | peek | peek | peek | peek |
| + one line of tags (24px) | peekless, fits | peek | peek | peek | peek |
| + two lines of tags (48px) | sticky (422 > 419) | peekless, fits | peekless, fits | peek | peek |

## Decisions

- Part 2 order is fixed by the table: weight steps move to the menu (Task 5), then the help row goes (Task 6), then the rulers grow (Task 7). Growing rulers first breaks the 660px fit rule.
- Part 1 alone costs the peek at 412×839-class heights (the 43px header becomes 44px and today's slack is under 1px). Task 3 relaxes that one matrix row to `null`; Task 6 restores it to `false`. Shipping Part 1 without Part 2 is still correct (clean peekless card), only less informative.
- One formatter, `formatRir`, owns `5+`. One normalizer, `logTags`, owns tag trimming, deduplication and the cap. One stepper, `step(direction)` in the ruler, serves keys and taps.
- The weight-steps submenu reuses `mountReorderMenu`: an item's handler runs after the menu closed, so calling `menu.toggle(more, steps)` from it reopens the same menu with the step choices (instant swap, focus handled by the menu).

## Global Constraints

- Focus stays a presentation over the logger's port: borrow nodes, never clone, never mount a second logger, never change `workout-sync`. Preserve node identity, focus, caret, composition and invalid drafts.
- Rulers never round a typed value. Numeric inputs ≥16px. Touch targets ≥44px. Density tiers only through `@container focus-feed`, never device media queries.
- Fit rule: at default text the viewed card shows through Complete from a 660px visible viewport, with one line of tags. Wrapped tags drop the peek first, then Complete becomes sticky.
- No new animation, dependency, migration, schema, export or analytics change. Tags and RIR formatting stay out of exports, AI review and volume.
- Stored RIR stays an integer 0–5; log version stays 2.
- Change values in `style.css` first, then `docs/design-system/README.md`, and update `AGENTS.md` in the same part.
- Never claim physical-device or production verification from localhost or emulation. Never claim a pending deployment was verified. Phone checks are recorded as user-confirmed or pending.
- Commit on `main` after each task; messages end with `Co-Authored-By: Claude <noreply@anthropic.com>`.
- Each part ends green on `npm test`, `npm run test:e2e` and `npm run build`.

## Review Focus

1. A vertical swipe that starts on a ruler: the feed must not scroll and the gesture must not be released mid-swipe; the same swipe starting on the title still scrolls the feed. (Task 7)
2. A tap at a limit (0 kg, 999.75 kg, 1 rep, 100 reps) or from an off-grid typed value (24.25 kg with 2.5 kg steps): no write at a limit, and the same result as ArrowRight (26.75) off-grid. (Task 7)
3. An old warm-up set that already stores an RIR: the log stays valid, the value is kept, never shown, and never copied to a new warm-up. (Task 2)
4. A mirrored or queued log without tag fields, and a catalog variant with more than 20 focus tags or names differing only by case: defaults apply, the first 20 unique names are kept, nothing rejects. (Task 8)
5. A long brand or tag name, or two lines of tags, at a 660px viewport: pills ellipsize, the card never overflows horizontally, Complete stays reachable. (Task 9)

---

# Part 1 — Small fixes

### Task 1: RIR `5+`

**Files:**
- Modify: `src/workout-sets.js` (`formatLastTime`, new `formatRir`), `src/workout-set-row.js:23-24`, `src/workout-overview.js:45`
- Test: `test/workout-sets.test.js`, `e2e/workout-set-row.spec.js`, `e2e/workout-overview.spec.js`

**Interfaces:**
- Produces: `formatRir(value: number): string` exported from `src/workout-sets.js` — `'5+'` for `WORKOUT_LIMITS.rirMax`, otherwise `String(value)`.

- [ ] **Step 1: Failing unit test** in `test/workout-sets.test.js`, `'formatRir marks the top value as five or more'`:

```js
assert.deepEqual([0,4,5].map(formatRir),['0','4','5+']);
assert.equal(formatLastTime([{kind:'working',weightKg:80,reps:8,rir:5,done:true}]),'80×8 @5+');
```

- [ ] **Step 2:** Run `node --test test/workout-sets.test.js`. Expected: FAIL, `formatRir` is not exported.
- [ ] **Step 3:** Implement `formatRir` and use it in `formatLastTime`, in the set-row button text (the sixth button also gets `aria-label="5 or more"`), and in the overview summary (`· 5+ RIR`).
- [ ] **Step 4: e2e** in `e2e/workout-set-row.spec.js`, `'the sixth RIR option reads 5+ and stores 5'`: the first working row's RIR group has `getByRole('button',{name:'5 or more',exact:true})` with text `5+`; after a click it has `aria-pressed="true"` and still has it after `page.reload()`. A second test, `'last time RIR 5 suggests 5+'`: with a finished log (`saveFinishedLog`) whose first set has `rir:5`, the new log's `5 or more` button has class `is-placeholder` and the Last time line contains `@5+`. In `e2e/workout-overview.spec.js`, extend the first test with a set of RIR 5 and expect its summary to end with `· 5+ RIR`.
- [ ] **Step 5:** Run `npm test` and `npx playwright test e2e/workout-set-row.spec.js e2e/workout-overview.spec.js`. Expected: PASS.
- [ ] **Step 6:** Commit `feat(tracker): show the top RIR option as 5+`.

### Task 2: No RIR on warm-up sets

**Files:**
- Modify: `src/workout-edit.js:81` (`toggleSetDone`), `src/workout-logger-view.js:300-305` (`inheritedValues`), `src/workout-set-row.js` (render), `src/workout-focus-view.js` (update), `src/workout-overview.js:45`
- Test: `test/workout-edit.test.js`, `test/workout-log.test.js`, `e2e/workout-warmups.spec.js`, `e2e/workout-focus-view.spec.js`

**Interfaces:**
- Consumes: `formatRir` (Task 1).

- [ ] **Step 1: Failing unit tests.** `test/workout-edit.test.js`, `'completing a warm-up never fills RIR'`: `toggleSetDone` on a warm-up with empty fields and placeholder `{weightKg:40,reps:8,rir:2}` yields `{weightKg:40,reps:8,rir:null,done:true}`; the same call on a working set yields `rir:2`; a warm-up already holding `rir:3` keeps `3`. `test/workout-log.test.js`, `'a stored warm-up RIR stays valid'`: `validateWorkoutLog` of a log whose warm-up has `rir:3` returns no error and keeps `3`.
- [ ] **Step 2:** Run `node --test test/workout-edit.test.js test/workout-log.test.js`. Expected: the first test FAILS (`rir` is 2); the second passes already and stays as the guard.
- [ ] **Step 3:** Implement: `toggleSetDone` skips the placeholder RIR when `current.kind==='warmup'`; `inheritedValues(exerciseId,'warmup')` returns `rir:null`; the set row sets `rir.hidden` and its caption's `hidden` from `set.kind==='warmup'` on every render (the menu keeps its grid column); Focus sets `rirStrip.hidden=item.kind==='warmup'` in `update`; the overview omits the RIR part for warm-up items.
- [ ] **Step 4: e2e.** `e2e/workout-warmups.spec.js`, `'warm-up rows have no RIR control and never inherit one'` (Review Focus 3): PUT a log whose first warm-up stores `rir:3`; on the page every warm-up row's `.log-rir` and `.log-rir-label` are hidden while its set menu is visible, and working rows show both; click Add warm-up; the server log (`(await (await page.request.get('/api/workouts/'+id)).json()).record.log`) has the new warm-up with `rir:null` and the old one still `3`. Run the same row assertions on a finished log in a read-only state reached as the existing finished-log test does. `e2e/workout-focus-view.spec.js`: in the warm-up test, the warm-up card's `.focus-rir-strip` is hidden and the first working card's is visible.
- [ ] **Step 5:** Run `npm test` and `npx playwright test e2e/workout-warmups.spec.js e2e/workout-focus-view.spec.js e2e/workout-set-row.spec.js`. Expected: PASS, including the existing one-line fine-pointer row layout test.
- [ ] **Step 6:** Commit `feat(tracker): remove the RIR control from warm-up sets`.

### Task 3: Note icon and set-note placement

**Files:**
- Modify: `src/action-controls.js` (`paths.note`), `src/workout-focus-view.js` (`noteIcon`, `context.append`, `borrowAll`), `src/workout-logger-view.js:44,124,150`, `src/workout-overview.js:40`, `src/workout-set-row.js:78`, `style.css` (`.focus-context` 2513, `.focus-rir-strip` 2554, tiers 2584 and 2586)
- Test: `e2e/workout-focus-view.spec.js:48`, `e2e/workout-notes.spec.js`, `e2e/workout-focus-fit.spec.js`

**Interfaces:**
- Produces: `actionIcon('note')`; the set-note button `.focus-set-note` is a child of `.focus-context`, between the context text and `.focus-complete-marker`.

- [ ] **Step 1: Rewrite the failing e2e.** `e2e/workout-focus-view.spec.js:48` becomes `'card puts the set note on the header row and the RIR row holds only RIR'`: `card.locator('.focus-context').getByRole('button',{name:'Add set note, Set 1, Bench press',exact:true})` is ≥44×44 and sits left of `.focus-complete-marker`; `.focus-rir-strip button` count is 6; `.focus-context` height is 44; the same button exists on the warm-up card. In `e2e/workout-notes.spec.js`, replace every `✎ ` text expectation (lines 50, 61, 68, 127, 149, 152, 206, 244, 266) with the plain text (`Add note`, `Seat 4`, …) plus one assertion that the Add note button contains an `svg[aria-hidden="true"]`.
- [ ] **Step 2:** Run `npx playwright test e2e/workout-focus-view.spec.js e2e/workout-notes.spec.js`. Expected: FAIL (button still in the RIR strip, text still starts with `✎`).
- [ ] **Step 3:** Add `note` to `paths` — a sheet of paper with a pencil, drawn like the others (24×24, stroke). Start from `<path d="M13 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-6"/><path d="M8 8h4M8 12h3"/><path d="m18.5 3.5 2 2L14 12l-3 1 1-3 6.5-6.5Z"/>` and adjust until it reads clearly at 15px and 20px; `edit` stays for every non-note use.
- [ ] **Step 4:** Use it: `noteIcon=()=>actionIcon('note')`; the logger's workout-note indicator and the overview note action; the three `✎` sites become an `aria-hidden` icon followed by the text. Move the set-note button: `context.append(contextText,action,marker)` and drop it from the RIR strip (same accessible name, same hide-while-a-note-exists rule, editor stays in the note area).
- [ ] **Step 5: CSS.** `.workout-focus .focus-context {min-height:44px;padding:0}` at every tier (delete the 36px override at 2584); `.focus-rir-strip {grid-template-columns:36px minmax(0,1fr)}`, narrow tier `minmax(0,1fr)`; the set-note button stays borderless with a 44px target.
- [ ] **Step 6: Fit matrix.** In `e2e/workout-focus-fit.spec.js` change `[412,839,false]` to `[412,839,null]` with a comment `// header 44px costs the <1px of peek slack until the help row goes (Task 6)`.
- [ ] **Step 7:** Run `npx playwright test e2e/workout-focus-view.spec.js e2e/workout-notes.spec.js e2e/workout-focus-fit.spec.js e2e/workout-overview.spec.js`. Expected: PASS.
- [ ] **Step 8:** Commit `feat(focus): one note icon and the set note on the header row`.

### Task 4: RIR border, and Part 1 docs

**Files:**
- Modify: `style.css:2276,2291` (hover and focus rules of `.log-rir-option`), `AGENTS.md`, `docs/design-system/README.md` (~431–437, ~442–449)
- Create: `docs/superpowers/verification/2026-11-12-focus-set-page.md`
- Test: `e2e/workout-set-row.spec.js`

- [ ] **Step 1: Failing e2e**, `'a deselected RIR option returns to the plain border on touch'`, in a context with `{viewport:{width:390,height:844},hasTouch:true,isMobile:true}`: `tap()` option `2`, `tap()` it again; its computed `border-top-color` equals the document's `--border` (`rgb(44, 55, 70)`) and `aria-pressed` is `false`; a pressed option's border equals `--accent`; a dashed suggestion's border colour is not `--accent`.
- [ ] **Step 2:** Run `npx playwright test e2e/workout-set-row.spec.js -g "plain border"`. Expected: FAIL with the `--muted` colour `rgb(148, 163, 184)` (sticky `:hover` at specificity 0,3,0 beats the Focus rule). If it passes, emulation does not reproduce the report: keep the test as a guard, say so in the verification file, and still apply Step 3, which the spec fixes regardless (§4).
- [ ] **Step 3:** Wrap `.log-rir-option:hover:not(:disabled)` in `@media (hover:hover) and (pointer:fine)`. Give `.log-rir-option:focus-visible` a ring that cannot be read as selection: `outline:2px solid var(--text);outline-offset:1px`. Nothing but `[aria-pressed="true"]` may use the accent border.
- [ ] **Step 4:** Run the whole spec file. Expected: PASS.
- [ ] **Step 5: Docs.** `AGENTS.md`: add a top section `## Focus set page (2026-11-12)` naming the spec, this plan and the verification file, with Part 1's rules (`5+` stored as 5 through `formatRir`; warm-ups have no RIR control and never fill one, old values kept and hidden; `note` icon for every note scope; set note on the Focus header row; accent border only on the selected RIR option, hover only for fine hover pointers). Correct the phrases that are now false: "set note is an icon in the RIR row" (card-fit bullet), the `✎`-less note buttons, and "fields and actions match working rows" for warm-ups (add "except RIR"). Update the design system's set row, notes, RIR and Focus card entries the same way, including the focus-ring colour.
- [ ] **Step 6: Verify and record.** Run `npm test`, `npm run test:e2e`, `npm run build`. Inspect a populated workout at 360, 390 and 412px widths and at 1366×768, 1440×900 and 1920×1080, plus 200% text and reduced motion. Write the verification file: commands and results, what was inspected, and a "Phone checks" list where the RIR border reproduction is `pending (user)` until the user confirms it.
- [ ] **Step 7:** Commit `fix(tracker): accent border only on the selected RIR option; document part 1`.

---

# Part 2 — Input

### Task 5: Weight steps in Workout actions

**Files:**
- Modify: `src/reorder-menu.js` (choice `current`), `src/workout-focus-view.js` (returned API), `src/workout-logger-view.js:434`
- Test: `e2e/workout-focus-integration.spec.js`

**Interfaces:**
- Produces: `focusView.setWeightIncrement(n: 0.25|1|2.5|5): void` — sets the view's increment, emits `onInteraction({type:'preference',patch:{weightIncrement:n}})` (the logger already forwards it to `focusSession.patch`) and re-renders. `mountReorderMenu` choices accept `current?: boolean`: the button gets `aria-current="true"`, an `aria-hidden` ` ✓` after its label, and the initial focus.

- [ ] **Step 1: Failing e2e**, `'Workout actions sets the weight step for every ruler'`: open Workout actions; the item after the workout-note item is named `Weight steps · 2.5 kg`; clicking it leaves the menu open with exactly `0.25 kg`, `1 kg`, `2.5 kg`, `5 kg`, where `2.5 kg` has `aria-current="true"` and focus; choosing `5 kg` closes the menu and focuses Workout actions; ArrowRight on the viewed card's weight ruler from placeholder 80 writes 85; reopening shows `Weight steps · 5 kg`. At a desktop viewport and on a finished log the item is absent.
- [ ] **Step 2:** Run `npx playwright test e2e/workout-focus-integration.spec.js -g "weight step"`. Expected: FAIL, no such menu item.
- [ ] **Step 3:** Implement the `current` choice in `mountReorderMenu`, `setWeightIncrement` on the Focus view, and the menu item, shown only when `focusChrome&&editable&&active`, reading the current value from `focusSession.read(log.id).weightIncrement`. Its `run` calls `menu.toggle(more,[.25,1,2.5,5].map(step=>({label:`${step} kg`,current:step===n,run:()=>focusView.setWeightIncrement(step)})))`. The card's `kg steps` select stays until Task 6.
- [ ] **Step 4:** Run `npx playwright test e2e/workout-focus-integration.spec.js e2e/workout-overview.spec.js e2e/drag-reorder.spec.js`. Expected: PASS (the other reorder menus are unchanged).
- [ ] **Step 5:** Commit `feat(focus): weight steps in Workout actions`.

### Task 6: Reps caption, help row removed

**Files:**
- Modify: `src/workout-focus-model.js` (new `repsCaption`), `src/workout-ruler.js` (option `caption`, guide class), `src/workout-focus-view.js` (remove `help`, the `increment` select, their `observed`/`destroy`/update references), `style.css` (delete `.focus-input-help` 2551, `.focus-increment` 2553, the visible `.workout-rep-guidance` rules 2480–2482 and 2552; add `.focus-control-label.is-outside`)
- Test: `test/workout-focus-model.test.js`, `test/workout-focus-fit.test.js`, `e2e/workout-ruler.spec.js`, `e2e/workout-focus-fit.spec.js`

**Interfaces:**
- Consumes: `repRangeHint` (existing), `focusView.setWeightIncrement` (Task 5).
- Produces: `repsCaption({kind,reps,range,invalid=false}): {text:string,outside:boolean}`. `mountWorkoutRuler(host,{input,kind,caption,onAdjust,onInteraction})` — for `kind:'reps'` with a `caption` element, the ruler owns its text and its `is-outside` class.

- [ ] **Step 1: Failing unit test**, `'repsCaption folds the target into the Reps label'`:

```js
const range={min:8,max:12},c=(reps,extra={})=>repsCaption({kind:'working',reps,range,...extra});
assert.deepEqual(c(null),{text:'Reps · 8–12',outside:false});
assert.deepEqual(c(10),{text:'Reps · 8–12',outside:false});
assert.deepEqual(c(6),{text:'Reps · 2 below 8–12',outside:true});
assert.deepEqual(c(13),{text:'Reps · 1 above 8–12',outside:true});
assert.deepEqual(c(8,{invalid:true}),{text:'Reps',outside:false});
assert.deepEqual(repsCaption({kind:'warmup',reps:8,range}),{text:'Reps',outside:false});
assert.deepEqual(repsCaption({kind:'working',reps:8,range:null}),{text:'Reps',outside:false});
assert.equal(repsCaption({kind:'working',reps:8,range:{min:8,max:8}}).text,'Reps · 8');
```

- [ ] **Step 2:** Run `node --test test/workout-focus-model.test.js`. Expected: FAIL, `repsCaption` is not exported.
- [ ] **Step 3:** Implement `repsCaption` on top of `repRangeHint`'s `state` and `delta` (en dash; a single number when min = max).
- [ ] **Step 4: Ruler.** Accept `caption`; update it in `update()` before the not-enabled early return and on the input's `input` event. The guide `p.workout-rep-guidance` keeps its text, its `hidden` logic and its `aria-describedby` role, and gains class `visually-hidden`. In the Focus view pass the Reps `label` as `caption`, then delete `help` and the select.
- [ ] **Step 5: CSS.** `.focus-control-label.is-outside {color:var(--under)}`; the label may wrap (`white-space:normal`), never truncate.
- [ ] **Step 6: e2e.** `e2e/workout-ruler.spec.js`: the range test also mounts a caption element and expects `Reps · 2 below 8–10` with class `is-outside` at 6 reps, `Reps · 8–10` without it at 8, and `Reps` for `101` and for no range; its existing guide-text assertions stay. `e2e/workout-focus-fit.spec.js`: the matrix rows become `[360,660,false]`, `[393,659,false]`, `[412,839,false]`; `rhythm` drops `.focus-input-help` and returns `controlsToRir` (assert `rirToDone>=controlsToRir`); a new test `'an out-of-target caption still fits at 360x660'` types reps 2 below the target and expects `doneInside` and no horizontal overflow; `.focus-input-help` and `.focus-increment` have count 0. `test/workout-focus-fit.test.js`: one `stackHeight` case with seven sections.
- [ ] **Step 7:** Run `npm test` and `npx playwright test e2e/workout-ruler.spec.js e2e/workout-focus-fit.spec.js e2e/workout-focus-view.spec.js e2e/workout-focus-integration.spec.js`. Expected: PASS.
- [ ] **Step 8:** Commit `feat(focus): fold rep guidance into the Reps caption and drop the help row`.

### Task 7: Rulers that hold the gesture and nudge on tap, and Part 2 docs

**Files:**
- Modify: `src/workout-ruler.js` (pointer handlers, `step`, chevrons), `style.css` (2471–2475 base ruler, 2546–2549 Focus ruler, tiers 2582–2584), `AGENTS.md`, `docs/design-system/README.md`, `docs/superpowers/verification/2026-11-12-focus-set-page.md`
- Test: `e2e/workout-ruler.spec.js`, `e2e/workout-focus-integration.spec.js`, `e2e/workout-focus-fit.spec.js`

**Interfaces:**
- Produces (internal): `step(direction: -1|1)` — `stepWeight(state.value,state.placeholder,direction*state.increment)` or `stepReps(state.value,state.placeholder,direction)`, then `adjust` and `syncPosition`. ArrowLeft/ArrowRight and taps both call it. Two `span.workout-ruler-nudge` children (`‹`, `›`, `aria-hidden`), class `is-limit` when the effective value is at that end.

- [ ] **Step 1: Failing e2e** in `e2e/workout-ruler.spec.js`:
  - `'a drag that drifts vertically keeps adjusting'`: mouse down at the strip's x+180, move 40px down and 10px left, then to x+116 → the patch is `{weightKg:85}` (today the gesture is dropped).
  - `'tapping left or right of centre steps once'`: a click at the left quarter from placeholder 80 writes 77.5, a click at the right quarter writes 80; on reps, a right click from placeholder 8 writes 9.
  - `'taps respect limits and off-grid values'` (Review Focus 2): typed `999.75`, right click → no patch and the `›` chevron has `is-limit`; typed `0`, left click → no patch, `‹` has `is-limit`; reps `100` right and `1` left → no patch; typed `24.25` with 2.5 steps, right click → 26.75.
  - `'a cancelled press writes nothing and a cancelled drag settles on a step'`: synthetic `pointerdown` + `pointercancel` → no patch; `pointerdown`, `pointermove` −70px, `pointercancel` → the value is a multiple of the increment and equals what `pointerup` would give.
  - The strip's computed `touch-action` is `none`; `role="slider"` and its value text are unchanged.
- [ ] **Step 2:** Run `npx playwright test e2e/workout-ruler.spec.js`. Expected: the new tests FAIL; the existing `'horizontal drag adjusts while vertical intent and cancellation do not write'` still describes valid behaviour (a sub-slop cancel) and keeps passing after Step 3.
- [ ] **Step 3:** Rewrite the pointer handling: `setPointerCapture` at `pointerdown` (keep the `try/catch`); drag state `{id,x,offset,moved:false}`; movement counts once `|dx|` passes 8px, vertical movement is ignored; `pointerup` without movement is a tap → `step(e.clientX<centre?-1:1)`; `pointercancel` and `lostpointercapture` only settle. `onInteraction()` still fires at `pointerdown`, which cancels Auto-next. Add the chevrons (`pointer-events:none`, muted, dimmed with `is-limit`, about 20px end caps). No new animation.
- [ ] **Step 4: CSS.** `.workout-ruler {touch-action:none}`. Focus heights (strip and track together): fallback 48px (tick top 26px), feed ≥560px 56px (tick top 30px), <560px 48px (26px), <460px 44px (22px).
- [ ] **Step 5: Touch and fit e2e.** `e2e/workout-focus-integration.spec.js`, `'a swipe that starts on a ruler never scrolls the feed'` (Review Focus 1): through `page.context().newCDPSession(page)`, `Input.synthesizeScrollGesture` with `gestureSourceType:'touch'` and `yDistance:-200` at the weight ruler's centre leaves `.focus-feed` `scrollTop` unchanged; the same gesture at the exercise title changes it. `e2e/workout-focus-fit.spec.js`: ruler height is 56px at 412×839, 48px at 412×760 and 44px at 360×660; the full matrix still passes.
- [ ] **Step 6:** Run `npm test`, `npm run test:e2e`, `npm run build`. Expected: PASS.
- [ ] **Step 7: Docs and evidence.** `AGENTS.md` section from Task 4 gains Part 2's rules (ruler heights per tier, pointer captured at press, `touch-action:none`, tap nudges equal arrow keys, Weight steps in Workout actions, Reps caption wording, no help row) and the rulers bullet under "Mobile workout Focus" is corrected (no `kg steps` on the card). Mirror in the design system. Repeat the viewport, 200% text and reduced-motion inspection and add it to the verification file, with phone checks `pending (user)`: grabbing the ruler, a full swipe without release, tap nudges, and no accidental feed scroll.
- [ ] **Step 8:** Commit `feat(focus): rulers hold the gesture and nudge on tap; document part 2`.

---

# Part 3 — Tags

### Task 8: Tag fields on log exercises

**Files:**
- Modify: `src/workout-log.js` (`WORKOUT_LIMITS`, new `logTags`, `createWorkoutLog`, `logExerciseFromEntry`, `validateExercise`), `src/workout-edit.js` (`swapExercise`)
- Test: `test/workout-log.test.js`, `test/workout-edit.test.js`

**Interfaces:**
- Produces: `WORKOUT_LIMITS.tagMax = 80`, `WORKOUT_LIMITS.focusTagsMax = 20`. `logTags({brand,focusTags}={}): {brand:string, focusTags:string[]}` exported from `src/workout-log.js` — accepts strings or `{name}` objects (and `null` brand), trims, drops blanks and case-insensitive duplicates, keeps the first 20 in the given order. Log exercises carry `brand: string` (default `''`) and `focusTags: string[]` (default `[]`).

- [ ] **Step 1: Failing unit tests** in `test/workout-log.test.js`:
  - `'logTags snapshots catalog and template tags'`: `logTags({brand:{id:'t1',name:' Hammer '},focusTags:[{name:'Stretch'},{name:'stretch'},{name:' '},{name:'Upper chest'}]})` → `{brand:'Hammer',focusTags:['Stretch','Upper chest']}`; 25 distinct names → the first 20; `logTags()` → `{brand:'',focusTags:[]}` (Review Focus 4).
  - `'log exercises carry tags from their source'`: a template exercise with `brand:'Hammer'`, `focusTags:['Stretch']` starts with them through `createWorkoutLog`; `logExerciseFromEntry` copies an entry's tag objects by name, archived ones included; an unlinked template exercise gets the defaults.
  - `'tag fields default and validate'`: `upgradeLog` of a version 1 log and of a version 2 log without the fields gives every exercise `brand:''`, `focusTags:[]`; `validateWorkoutLog` returns `Exercise 1: Invalid tags.` for a non-string brand, an 81-unit brand, a non-array `focusTags`, 21 tags, an empty or 81-unit tag and a case-insensitive duplicate; a valid value comes back trimmed.
  - Update `'limits are frozen'` with the two new limits.
  - In `test/workout-edit.test.js`: `swapExercise` to an entry with other tags replaces the previous ones; to an entry without tags clears them; `addExercise` copies them.
- [ ] **Step 2:** Run `node --test test/workout-log.test.js test/workout-edit.test.js`. Expected: FAIL, `logTags` is not exported.
- [ ] **Step 3:** Implement. `validateExercise` treats a missing field as its default, checks the trimmed values against the limits, and emits the canonical trimmed values, so stored, mirrored and queued logs normalize on read without a migration.
- [ ] **Step 4:** Run `npm test`, then `npx playwright test e2e/workout-warmups.spec.js e2e/workout-logger.spec.js e2e/workout-history-edit.spec.js`. Expected: PASS — in particular `'a dirty version 1 mirror resumes with numbered working rows and syncs'`, which proves old mirrors still sync with the new defaults.
- [ ] **Step 5:** Commit `feat(tracker): snapshot variant brand and focus tags into log exercises`.

### Task 9: Tags on the Focus card and the tracker card, and Part 3 docs

**Files:**
- Modify: `src/workout-focus-view.js` (tag list in `identity`, `destroy`), `src/workout-logger-view.js:176` (`renderVariantMetadata`), `style.css` (new `.focus-tags`, `.focus-tag`), `AGENTS.md`, `docs/design-system/README.md`, `docs/superpowers/verification/2026-11-12-focus-set-page.md`
- Test: `e2e/workout-focus-view.spec.js`, `e2e/workout-focus-fit.spec.js`, `e2e/workout-logger.spec.js`

**Interfaces:**
- Consumes: exercise `brand` and `focusTags` (Task 8); `renderVariantMetadata(root,{equipment,brand,focusTags})` from `src/catalog-metadata.js`.

- [ ] **Step 1: Failing e2e.**
  - `e2e/workout-focus-view.spec.js`, `'the card lists the variant tags under the title'`: with `brand:'Hammer Strength'` and `focusTags:['Upper chest','Stretch']` on the fixture's first exercise, `card.getByRole('list',{name:'Tags, Bench press'})` has three items whose text is `Brand: Hammer Strength`, `Focus: Upper chest`, `Focus: Stretch`; the prefixes are in `.visually-hidden` spans; the list holds no button or link; an exercise without tags renders no list.
  - `e2e/workout-focus-fit.spec.js`: `open()` gains a `tags` option that sets the first exercise's `brand`/`focusTags` before the PUT. `'one line of tags fits at 360x660'`: `doneInside`, `cardH<=feedH+1`, no horizontal overflow. `'two lines of tags drop the peek, then pin Complete'` (Review Focus 5): eight tags including one 80-character name → at 393×750 `peekless` and `cardH<=feedH+1`; at 360×660 `peekless`, `doneInside`, no horizontal overflow, the list is at most 44px tall, and the long pill's `scrollWidth>clientWidth` (ellipsis).
  - `e2e/workout-logger.spec.js`, `'tracker cards show variant tags, also read-only'`: at 1366×768 an exercise card's `.log-equipment` contains the equipment, `Brand: Hammer Strength` and `Focus: Upper chest`; the same on a finished log and at 390px wide outside Focus (finished record).
- [ ] **Step 2:** Run those three files. Expected: the new tests FAIL (no list, no tags).
- [ ] **Step 3: Focus.** In `identity`, under the title row, render `ul.focus-tags` with `aria-label="Tags, {exercise}"`: the brand first as `li.focus-tag.is-brand`, then one `li.focus-tag` per focus tag, each starting with a `visually-hidden` `Brand: ` / `Focus: ` span. Rebuild it only when the exercise's tags change; remove the list when there are none and in `destroy`.
- [ ] **Step 4: CSS.** `.focus-tags {display:flex;flex-wrap:wrap;gap:4px 6px;margin:4px 0 0;padding:0;list-style:none;max-height:44px;overflow:hidden}` with the comment `/* shortcut: tags past two lines are clipped, revisit with a +N pill when a variant needs more */`. `.focus-tag {height:20px;max-width:100%;padding:0 8px;border-radius:999px;font-size:.6875rem;line-height:20px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;border:1px solid var(--muted);color:var(--muted)}`; `.focus-tag.is-brand {background:var(--text);border-color:var(--text);color:var(--bg)}`.
- [ ] **Step 5: Tracker.** Replace the three `card.equipment` lines at `workout-logger-view.js:176` with `renderVariantMetadata(card.equipment,{equipment:ex.equipment,brand:ex.brand,focusTags:ex.focusTags})` (it already hides an empty root).
- [ ] **Step 6:** Run `npm test`, `npm run test:e2e`, `npm run build`. Expected: PASS.
- [ ] **Step 7: Docs and evidence.** `AGENTS.md` section gains Part 3's rules (fields, limits, `Exercise N: Invalid tags.`, copy at start/add/swap, no backfill, Focus pills, tracker metadata line, not in overview, history, Home, exports, AI or analytics) and "Tracker V1" keeps "logs are snapshots" with tags named. Mirror in the design system. Inspect populated cards with zero, one line and two lines of tags at 360, 390 and 412px and the desktop sizes, 200% text included; record it, with the phone check `pending (user)`.
- [ ] **Step 8:** Commit `feat(focus): show variant tags on the set card and tracker cards; document part 3`.

---

## Self-review

- **Spec coverage:** §1 → Tasks 3 (header 44px), 5, 6; §2 → Task 7; §3 → Tasks 8, 9; §4 → Tasks 1, 2, 4; §5 → Task 3; §6 → the three parts; §7 → each task's tests plus the verification file. Out-of-scope items (hold-to-repeat, haptics, per-exercise steps, tag editing, backfill, tags outside the tracker) have no task by design.
- **Names:** `formatRir`, `repsCaption`, `setWeightIncrement`, `logTags`, menu choice `current`, ruler option `caption` and internal `step` are used with one spelling and one signature throughout.
- **Known gaps:** the ruler release and the RIR border are unreproduced on a physical phone; both fixes follow the spec's rules and wait for the user's phone check. The fit numbers come from Playwright emulation. The `note` icon path is a starting point, to be judged when rendered.
