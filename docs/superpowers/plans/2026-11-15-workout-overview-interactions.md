# Workout Overview Interactions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make overview dragging visible above its modal, put accessible movement actions in the existing exercise menu, and compact secondary controls while preserving set targets.

**Architecture:** Correct the shared sortable preview's top-layer ownership and its actual scrolling bounds without replacing the engine. The overview owns one exercise-actions popup, resolves movement against current blocks, and sends existing logger commands; storage and Focus's exact-ref jump contract remain unchanged. Scope popup motion and icon treatment to the overview.

**Tech Stack:** Plain JavaScript ES modules, CSS, native dialog/popover, existing Node 24 test runner and Playwright; no dependency.

**Spec:** `docs/superpowers/specs/2026-11-15-workout-overview-interactions-design.md`. Read the design map `docs/superpowers/specs/2026-11-15-mobile-tracker-refinements-design.md` and the exact-ref compatibility sections of `docs/superpowers/specs/2026-11-15-focus-rounds-and-presentation-design.md` before execution.

## Global Constraints

- No endpoint, schema, migration, export, stored execution order or new dependency.
- Keep one logger, controller and workout sync owner; previews never create live controls or another logger.
- Preserve mouse/pen threshold (5px), touch hold (350ms), pre-hold movement cancellation (over 8px), placeholder movement, 180ms sibling repositioning and reduced-motion behavior.
- Preserve 12px body padding, row separators, superset rail, wrapping names, one-line tag text and six-exercise/four-set density at 390×844.
- Keep all action limits/confirmations, set-chip borders/surfaces, done tint/check, viewed ring, next dot, warm-up labels, exact values and accessible names.
- `Close overview` and secondary controls retain at least 44×44px touch targets; use `--muted` at rest, `--text` on fine-pointer hover and an immediate visible focus ring.
- Preserve existing 200ms sheet/dialog motion; exercise-actions popup fades opacity 150ms both ways, closes inert immediately, and is instant with reduced motion.
- A chip closes the sheet before `onJump({exerciseId,setId})`; two partner chips may address the same future Focus page while retaining different exact refs.
- Keep program/session/regular-logger menu presentation unchanged. Physical-device and deployment verification remain pending.

## Review Focus

1. A visible-geometry preview can still paint behind a native modal: prove actual painted pixels change (Task 1).
2. Long sheets expose off-screen list rectangles: reject clipped drops while scrolling to every destination remains possible (Task 1).
3. A menu left open through reorder/removal must resolve the current containing block and make stale removed targets harmless (Task 2).
4. Rapid close/reopen and removal of the invoking control must preserve usable focus and prevent old exits from disabling a new popup (Task 2).
5. Repeated variants and opposite partners share names/pages but must retain separate exact-ref jumps and completion states at enlarged text sizes (Task 3).

---

## File map and shared interfaces

| File | Responsibility |
|---|---|
| `src/sortable.js` | Existing preview host, clipping/drop bounds, scroll owner and cancellation; unchanged exported interface |
| `src/reorder-menu.js` | Optional initial-choice focus, immediate inert closure and existing focus restoration |
| `src/workout-overview.js` | One actions menu, current block movement, announcements, compact close, early drag cancellation |
| `src/action-controls.js` | Add the shared `close` icon path to the existing map |
| `style.css` | Popover reset, opaque overview copies, overview-only popup fade and borderless icons |
| `e2e/workout-overview.spec.js` | Modal drag, actions, focus, target, motion and layout regressions; reuse its local `mount` and `act` |
| `e2e/drag-reorder.spec.js`, `e2e/reorder-regressions.spec.js` | Preserve all shared caller behavior, capture and non-modal copy fidelity |
| `e2e/workout-supersets.spec.js` | Regular logger copy-fidelity coverage using its existing active-workout setup |
| `AGENTS.md`, `docs/design-system/README.md`, `docs/superpowers/verification/2026-11-15-workout-overview-interactions.md` | Final implemented rules and honestly scoped evidence, updated only during implementation |

Read-only connected code: `src/program-view.js`, `src/session-editor.js`, `src/workout-logger-view.js`, `src/workout-edit.js`, `src/superset.js`, `src/dialog-motion.js`, `src/workout-focus-model.js`, `e2e/workout-focus-helper.js`, `test/fixtures/workout-focus.js`, `e2e/supersets.spec.js`, `e2e/workout-logger.spec.js`, `playwright.config.js`.

The four sortable callers are program view, session editor, regular logger and overview. Preserve `mountSortable(root,{itemSelector,reorderSelector,getGroups,getKey,onCommit}) -> {cancel,destroy}` and the single `onCommit({key,groupKey,beforeKey})` event on a valid drop.

Preserve `mountWorkoutOverview({port,onJump,onActivity,onClose}) -> {open,update,close,destroy}` and `port.command({type:'move-block',exerciseId,toBlockIndex}) -> Promise<{accepted:boolean}>`. `supersetBlocks(log.exercises)` and `moveLogBlock(log,fromBlock,toBlock)` already own block semantics. Do not introduce a movement port API or remove the logger's existing `reorder` command; overview simply stops invoking its separate popup.

Shared-menu coordination: retain `mountReorderMenu({label='Reorder options'})`; extend `toggle(button,choices,{initialIndex}={})`. Existing `{label,disabled?,current?,run()}` button choices stay valid. The independently implemented Focus plan adds `{label,checked:boolean,disabled?,run(checked:boolean)}` native checkbox choices; initial-index/current/first-enabled focus must include both native buttons and checkbox inputs. Do not implement that checkbox feature in this plan. Apply overview fade using `.workout-overview .reorder-menu`, since `toggle` already reparents the popup into its closest dialog; no constructor styling option is needed.

### Task 1: Fix shared drag ownership, reachability and cleanup

**Files:** Modify `src/sortable.js` (`dragHost`, `begin`, `targetAt`, `tick`, `finish`, resize listeners), `src/workout-overview.js` (`close`), `style.css` (`.sort-drag-host`, overview copy surface). Test `e2e/workout-overview.spec.js`, `e2e/drag-reorder.spec.js`, `e2e/reorder-regressions.spec.js`, `e2e/workout-supersets.spec.js`.

**Interfaces:** Keep the sortable export/event contract above. Keep the original item as pointer-capture owner; only its inert sanitized copy enters the preview host. `close()` cancels the overview's sortable immediately, before its 200ms sheet exit.

- [ ] **Step 1: Add failing drag regressions using the real overview fixture.** Name the principal tests `modal drag paints above the overview and commits once` and `scrolling overview drag reaches every block and rejects clipped drops`; parameterize single/pair and cancellation cases. Cover a single block and the whole pair at 390×844. Record source/descendant rectangles before dragging; compare copy-relative positions for names, tags, chips and actions within 1px. Use `saved` from `mountFocusFixture`, resetting it before each drag. Assert no saves before release, then exactly one accepted canonical reorder and unchanged exercise/set IDs. Verify pointer movement translates the copy by the same delta without waiting for a smoothing transition.

  Test painted visibility with reduced motion and a stable crop inside the copied name/chip area, entirely inside the modal and viewport. With the pointer held still, capture with and without the copy; this fails on the current body-level host even though `toBeVisible()` passes:

  ```js
  const copy = page.locator('.sort-drag-copy');
  const box = await copy.locator('.overview-name').first().boundingBox();
  const clip = {x:Math.ceil(box.x),y:Math.ceil(box.y),width:Math.floor(box.width)-2,height:Math.floor(box.height)-2};
  const painted = await page.screenshot({clip,animations:'disabled'});
  await copy.evaluate(el => el.style.visibility = 'hidden');
  const hidden = await page.screenshot({clip,animations:'disabled'});
  expect(painted.equals(hidden)).toBe(false);
  await copy.evaluate(el => el.style.removeProperty('visibility'));
  expect(await page.evaluate(() => saved.length)).toBe(0);
  ```

  After promotion assert `.sort-drag-host:popover-open` exists, the host/copy are inert and aria-hidden, no duplicate IDs or copied ID-reference attributes survive, and the source retains capture until finish. Copy sanitization includes `for`, `list`, `form`, `headers`, `aria-labelledby`, `aria-describedby`, `aria-controls`, `aria-details`, `aria-errormessage`, `aria-owns`, `aria-activedescendant` and `aria-flowto`; preserve ordinary descriptive labels.

  Add a long overview fixture by cloning exercises with unique occurrence/set IDs. Drag at the dialog's bottom/top visible edge and assert dialog `scrollTop` changes, background `scrollY` does not, and first/last blocks can each be reached. Release below the dialog but inside the full list's rectangle and assert zero saves. Keep existing document-edge scrolling tests for non-modal callers.

  Parameterize Escape, pointercancel, lost capture, outside drop, blur, close-while-dragging, resize, source removal and teardown. After release assert `.sort-drag-host,.sort-drag-copy,.sort-placeholder,.sort-source,.is-hold-armed` count is zero, original order/no save survives cancellation, and a subsequent independent click works. Include touch hold/cancel with the suites' existing CDP touch pattern and both motion preferences. Extend regular logger coverage to compare single/pair copy descendant geometry; retain existing program/session/superset fidelity tests.

- [ ] **Step 2: Run the new modal regressions and record their pre-fix failures.** Run `npx playwright test e2e/workout-overview.spec.js --grep "drag|scrolling overview"`; expect the painted screenshot inequality to fail and clipped-drop/close cancellation regressions to expose their respective defects. Separate any fixture/setup failure from the intended failures before changing source.

- [ ] **Step 3: Correct the existing shared implementation.** Promote the existing host with `popover="manual"`/`showPopover()` after append; reset UA inset/margin/padding/border/background and size constraints so fixed `left:0;top:0` plus existing transform retain exact geometry. Preserve ancestor classes/widths/container styling and make overview single/pair copies opaque with `background:var(--bg);opacity:1`, retaining invalid-drop feedback. Mark host and copy inert/aria-hidden and sanitize ID/reference attributes before connection. Hide/remove the host during every finish; never replace or move the capture owner.

  Keep clipping/scroll logic private to `src/sortable.js`: intersect candidate group bounds with viewport and clipping ancestors; use the nearest actual vertical scroll container (the modal here, document scrolling otherwise) for 48px edge bands and the existing maximum 12px/frame scroll. Restrict targeting to visible bounds even when the list is much taller. Preserve pointer tracking, placeholder movement and 180ms sibling animation. Cancel on resize, disconnected/removed source, explicit overview close and destroy; validate the live source/target before committing. Do not expand this into a scrolling framework or change other menus.

- [ ] **Step 4: Verify shared callers.** Run `npx playwright test e2e/workout-overview.spec.js e2e/drag-reorder.spec.js e2e/reorder-regressions.spec.js e2e/supersets.spec.js e2e/workout-supersets.spec.js`; expect all tests to pass, including existing document auto-scroll and non-modal copy geometry. Inspect screenshots from the real fixture for single/pair legibility above the native modal; a popover selector or bounding box alone is insufficient evidence.

- [ ] **Step 5: Commit.** Run `git add src/sortable.js src/workout-overview.js style.css e2e/workout-overview.spec.js e2e/drag-reorder.spec.js e2e/reorder-regressions.spec.js e2e/workout-supersets.spec.js`, then `git commit -m "fix: keep sortable previews above modal overviews"`.

### Task 2: Unify movement actions, focus and popup motion

**Files:** Modify `src/workout-overview.js` (`makeBlock`, `makeMember`, `menuItems`, dialog status), `src/reorder-menu.js` (`toggle`, `close`), `style.css` (overview popup only). Test `e2e/workout-overview.spec.js`, `e2e/reorder-regressions.spec.js`.

**Interfaces:** Add optional `toggle(button,choices,{initialIndex}={})`; invalid/disabled initial indexes fall back to existing current/first-enabled control. Internally centralize overview opening as `openActions(exerciseId,trigger,movement=false)` and movement as `async moveBlock(exerciseId,step,trigger)` with `step` -1/+1. Both obtain current data from `port.read()`; `moveBlock` uses existing `move-block`, awaits acceptance and restores the original connected invoking control. No new public port command.

- [ ] **Step 1: Add failing action/focus/motion assertions.** Name the new tests `movement handles share the exercise actions menu`, `movement resolves live blocks and ignores removed targets` and `overview popup fade restores focus and survives rapid reopening`. Update only overview-specific old-menu expectations. The ordinary menu order is pinned by:

  ```js
  await d.getByRole('button',{name:'Actions, Bench press',exact:true}).click();
  const g = page.getByRole('group',{name:'Exercise actions',exact:true});
  await expect(g.getByRole('button')).toHaveText([
    'Add set','Add warm-up','Exercise note','Swap exercise','Move up','Move down',
    'Remove last set','Remove last warm-up','Remove exercise'
  ]);
  await expect(g.getByRole('button',{name:'Move up',exact:true})).toBeDisabled();
  ```

  Assert the reorder icon opens that same group, initially focuses `Move down` at the first block and `Move up` otherwise, and exposes all existing actions rather than a second two-item popup. Enter/Space and ArrowUp/ArrowDown work; no enabled movement in a one-block list. Either member's menu offers `Move superset up/down`, moves `['a','b']` intact and never unlinks/swaps. The pair header invokes its first member's same menu and retains its current accessible handle name.

  Keep a menu open, externally reorder through the fixture's `logger.setLog`, then activate an originally enabled move: assert the latest containing block position determines the result. Repeat after unlinking/removing the target: current pair status/position governs movement, and a removed exercise produces no write. Confirm invoker identity/focus survives moves from both `...` and handle, removal still chooses next/previous/Add exercise, and each accepted menu/keyboard move makes one position announcement. No duplicate announcement on drag.

  With motion enabled, assert opening/closing opacity transitions have duration 150ms, closing popup is inert synchronously and focus is restored before dismissal; immediately reopen from another invoker and assert live focus/options survive past the old exit. Escape closes only the popup, outside dismissal works, actual anchor scroll dismisses, queued unchanged-anchor scroll does not, and destroyed/closing sheets have no orphan menu. Reduced motion has no transition. Run existing program/session/logger menu tests unchanged to protect default presentation.

- [ ] **Step 2: Run the new assertions and observe intended failures.** Run `npx playwright test e2e/workout-overview.spec.js --grep "actions|menu|reorder|movement|popup"`; expect missing movement actions, old handle group/focus and absent fade to fail before implementation.

- [ ] **Step 3: Implement one actions surface and scoped motion.** Add Move up/down after Swap; pair labels use the spec's explicit superset wording. Derive disabled endpoints by block, resolve `from` again at action time and safely return on missing targets/boundaries. Use the member's current editor/picker hosts, retain command limits/confirmations and existing `menuTrigger` removal fallback, and stop overview handles from calling `port.command({type:'reorder',...})`. Ordinary `...` keeps normal first-action focus; handles request the first enabled movement index. Arrow keys use the same live-block movement helper without opening a popup.

  Add one hidden `.overview-order-status[role=status][aria-live=polite]` inside the dialog. After an accepted menu/key movement announce `Bench press moved to position 2 of 3.` or `Superset moved to position 2 of 3.` using actual block counts; drag keeps its existing commit path without calling this helper. Do not publish through the logger's alert/error node or a background inert live region.

  In the shared menu set inert before dismissal and restore requested focus before `hidePopover()`; clear inert before reopening. Scope opacity/`display`/`overlay` discrete transitions and `@starting-style` to `.workout-overview .reorder-menu`, reusing `.action-tooltip`'s established pattern with 150ms and no slide. Keep flex column layout throughout the discrete exit, so rows do not jump into a different display mode. Let native transition reversal handle rapid reopening rather than adding a competing delayed-removal timer. Respect reduced motion. Preserve default consumers and the coordinated Focus checkbox choice interface if already landed.

- [ ] **Step 4: Verify focused and shared suites.** Run `npx playwright test e2e/workout-overview.spec.js e2e/reorder-regressions.spec.js e2e/drag-reorder.spec.js e2e/exercise-actions.spec.js e2e/workout-logger.spec.js e2e/workout-supersets.spec.js`; expect all pass with no change to non-overview popup contents/presentation. Use the browser fixture to inspect open, fading-out and reopened menu focus states.

- [ ] **Step 5: Commit.** Run `git add src/workout-overview.js src/reorder-menu.js style.css e2e/workout-overview.spec.js e2e/reorder-regressions.spec.js`, then `git commit -m "feat: place overview movement in exercise actions"`.

### Task 3: Compact controls and verify exact targets and layout

**Files:** Modify `src/action-controls.js` (existing `paths` map), `src/workout-overview.js` (header close), `style.css` (overview icon selectors). Test `e2e/workout-overview.spec.js`; update `AGENTS.md`, `docs/design-system/README.md`; create `docs/superpowers/verification/2026-11-15-workout-overview-interactions.md`.

**Interfaces:** `actionIcon('close') -> string` uses the existing SVG renderer, with a cross path in its existing 24×24 viewBox. `Close overview` keeps its accessible name, existing dialog close/opener restoration and 200ms motion. Chip addressing and close-then-`onJump(ref)` remain unchanged; Focus owns resolving refs into future paired pages.

- [ ] **Step 1: Add failing compact-control checks and retain exact-ref checks.** Name the new tests `compact overview controls preserve framed chips and touch targets` and `partner chips jump by exact ref only after sheet closure`. Assert Close overview has one SVG cross and no visible `Close` text; close/reorder/more/unlink buttons have transparent backgrounds, no persistent border and touch rectangles at least 44×44px. Assert set chips retain nonzero borders/surfaces, 44×56px touch bounds, done check/tint, viewed ring, next dot and warm-up values/names. Check immediate keyboard focus ring and fine-pointer hover separately from touch/hybrid.

  Add an `onJump` spy to the existing local overview mount fixture, without changing the product contract. With motion enabled, click a chip and assert zero calls while the 200ms dialog exit is in progress; after closure assert the exact ref once. Pair chips must stay distinct:

  ```js
  expect(await page.evaluate(() => window.jumps)).toEqual([{exerciseId:'b',setId:'b1'}]);
  // In a fresh open, the partner chip targets a1, never a round-only address.
  expect(await page.evaluate(() => window.jumps)).toEqual([{exerciseId:'a',setId:'a1'}]);
  ```

  Preserve the existing repeated-variant `empty/repeat` exact target, viewed-chip-only-closes, zero-set management, note/swap canonical identity, limits, confirmations and six-exercises/four-sets fit assertions. At 360/390/412px, desktop fine pointer, touch/hybrid and 200% text, populate long names/tags and verify wrapping, no horizontal document overflow and reachable last chip/Close/actions. Enlarged text may scroll; it must not reduce targets or hide controls. If Focus rounds already landed, additionally assert opposite partner chips select their distinct refs on the same derived page; otherwise record that integration as pending rather than changing the projection here.

- [ ] **Step 2: Run the focused tests before styling.** Run `npx playwright test e2e/workout-overview.spec.js --grep "compact|control|chip|variants|six exercises"`; expect the new cross/borderless checks to fail while existing target/identity checks pass. Do not rewrite existing correct data assertions to fit a visual change.

- [ ] **Step 3: Apply the smallest icon/CSS changes.** Add `close:'<path d="m6 6 12 12M18 6 6 18"/>'` to the existing action map. Build header Close overview as an existing `action-button` with `actionIcon('close')` and an overview-scoped class; preserve the close callback. Scope borderless transparent styling to overview close/reorder/more/unlink, including cloned overview rows, without matching `.overview-chip`. Retain visible focus/pressed states, tooltips, current sizes and all section geometry. Do not redesign chips or create an icon renderer.

- [ ] **Step 4: Verify and record evidence.** Run `npm test`, `npm run build`, and `npx playwright test e2e/workout-overview.spec.js e2e/drag-reorder.spec.js e2e/reorder-regressions.spec.js e2e/supersets.spec.js e2e/workout-supersets.spec.js e2e/exercise-actions.spec.js e2e/workout-logger.spec.js e2e/workout-focus-integration.spec.js e2e/workout-focus-progress.spec.js`. Expected: all pass; build succeeds. Capture/inspect populated layouts for the viewport/input/text matrix above and painted previews, keeping actual screenshots under the existing ignored evidence-artifact convention. Investigate any failure rather than recording a pass from a different suite or a stale run.

  Update AGENTS/design-system rules only after implementation verifies: shared top-layer preview, unified overview actions, compact icons, preserved chip refs, 150ms popup/200ms sheet. In the verification document link commands, actual outcomes, screenshots and any integration gaps; leave phone touch/momentum/scroll-edge feel and deployment `pending (user)` until actually checked. The reproduced design probe is evidence of the old defect, not a passing implementation test.

- [ ] **Step 5: Commit.** Run `git add src/action-controls.js src/workout-overview.js style.css e2e/workout-overview.spec.js AGENTS.md docs/design-system/README.md docs/superpowers/verification/2026-11-15-workout-overview-interactions.md`, then `git commit -m "feat: compact overview controls while preserving set targets"`.

## Plan self-review and handoff

Spec coverage: missing preview/opaque geometry/sanitization/all cancellation and scrolling paths → Task 1; existing-menu movement/live blocks/focus/announcements/fade → Task 2; cross/quiet secondary icons/chip meaning/exact refs/density/docs → Task 3. The five Review Focus cases each have explicit owning tests. Shared port and sortable signatures remain unchanged; the optional menu argument is coordinated with Focus's separate checkbox extension. No spec gap found in self-review.

This document is planning only: no app implementation, test execution, browser verification, commit or deployment is claimed. Execute after the approved planning handoff; record evidence from the implementation runs. No destination picker, permanent Move buttons, new reorder engine, round-only chips or unrelated menu redesign is included.
