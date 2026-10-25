# Compact Catalog Actions and Disclosure Motion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans for native implementation, preserving the user's selected execution method. Implement task-by-task; steps use checkbox (`- [ ]`) syntax. This plan does not authorize implementation before user review.

**Goal:** Make the exercise catalog more compact with direct inline icon actions and smooth reference exercise expand/collapse transitions.

**Architecture:** Keep the existing catalog repository, grouping and dialog contracts. Replace catalog row popover menus with explicit icon controls using the shared action icon/tooltip utilities; update disclosure state in place rather than rebuilding the list on each toggle. Reuse the existing grid-row collapse technique with catalog-specific spacing and accessibility state.

**Tech Stack:** Existing plain JavaScript/CSS, native buttons/dialogs/popovers for tooltips, Playwright and node:test. No new dependencies.

**Spec:** The approved bounded design is recorded below; it extends docs/superpowers/specs/2026-10-25-reference-exercises-design.md. The user chose option 1: every reference/variant action directly visible as an inline icon button, with row menus removed. The user explicitly requested a written implementation plan for this bounded change.

## Approved design and scope

- Reference row actions, in order: Add variant (plus), Rename reference exercise (pencil), Archive/Restore reference exercise (archive/restore).
- Variant row actions, in order: Edit variant (pencil), Create variant (duplicate), Move to reference exercise (move), Archive/Restore variant (archive/restore).
- Keep the disclosure chevron and reference name together; clicking actions never toggles the reference. Counts and archive-origin text remain legible. Keep the page-level New reference exercise button labeled; the requested icon conversion applies to reference/variant row actions. Dialog Save/Cancel labels remain visible.
- Reuse inline currentColor stroke SVGs, 20px icons, existing action-button styling and shared hover/focus tooltips. Every button has an action-and-target accessible name; short tooltips name the action. Archive is reversible and must not use a delete/trash icon.
- Reference bodies slide and fade over 200ms ease-out; the chevron rotates over the same duration. Reduced motion is instant. Initial load, filtering and mutation-driven list construction show their final state immediately. Manual toggles alone animate. Multiple references can remain expanded.
- Normal desktop rows keep title/definition and the action strip inline. Reference counts occupy the header's secondary metadata line if needed. Variant equipment and muscle details stay readable underneath the name. Long names wrap without ellipsis-only disclosure.
- At narrow widths or enlarged text, retain one horizontal action strip per item; allow that strip to flow onto the next row when content cannot fit. Never force horizontal page scrolling, shrink hit targets or stretch each icon into a full-width button.
- Preserve all data, archive/move rules, draft recovery, search expansion and clearing-search restoration behavior. No API, database, persistence, autocomplete or session-editor behavior changes are intended.

## Global Constraints

- Follow docs/design-system/README.md and the approved compact desktop direction: dark palette, orange accent and Barlow type.
- Icon controls are 32x32px only at min-width 1100px with a fine primary pointer and no available coarse pointer. All other inputs retain at least 44x44px targets. Keep 8px action gaps.
- Both desktop body figures remain at least 180px tall; native slider hit boxes remain 44px.
- Every action is keyboard reachable, has visible focus and an accessible name. Decorative SVGs are aria-hidden and focusable=false.
- Collapsed content is inert and aria-hidden immediately, including during closing motion. Focus returns to the disclosure before collapsing if a child currently owns focus.
- Authoritative CSS changes precede matching design-system documentation changes in the same task.
- No new dependencies, external APIs, remote changes, database migration, merge, push or deployment.

## Review Focus

1. Reversing a disclosure mid-transition must finish in the most recently requested state without stale timers hiding its children (task 2).
2. Filtering, archived visibility and async reload during motion must preserve search/browse expansion rules and avoid replaying entry animations (task 2).
3. Dialog cancel/save and archive/move rerenders must return focus to the correct surviving direct action, or a documented fallback when that item disappears (task 1).
4. Archived-parent restrictions must remain enforced for pointer and keyboard activation, with an understandable explanation despite icon-only controls (task 1).
5. Four inline variant actions with long names, 200% text and hybrid input must remain reachable without clipped focus rings or overflow (task 3).

## File responsibilities

| File | Responsibility |
| --- | --- |
| src/catalog-view.js | Direct action rendering, target-specific focus restoration, tooltip lifecycle and in-place disclosure changes |
| src/action-controls.js | Add pencil, archive, restore and move SVG paths to existing actionIcon(name); retain shared tooltip behavior |
| style.css | Compact action strips, responsive row layouts, disclosure grid/opacity and chevron transitions |
| docs/design-system/README.md | Document the authoritative catalog layout and motion values |
| e2e/catalog.spec.js, e2e/reference-exercises.spec.js | Adapt menu interactions and assert direct actions, focus, archive restrictions and motion behavior |
| e2e/catalog-layout.spec.js | Populated responsive, enlarged-text, pointer-size and tooltip checks/screenshots |
| docs/superpowers/reports/2026-10-25-catalog-compact-actions-motion.md | Final verification and review evidence |

## Task 1: Replace row menus with compact direct icon actions

**Files:** Modify src/catalog-view.js, src/action-controls.js, style.css, docs/design-system/README.md, e2e/catalog.spec.js, e2e/reference-exercises.spec.js and e2e/catalog-layout.spec.js.

**Interfaces:** Keep mountCatalog(root,{api}) -> {destroy()}, actionIcon(name) -> SVG string and mountActionTooltips(root) -> {hide(),destroy()}. Add icon names edit, archive, restore and move; reuse plus and duplicate. Within catalog-view.js, use a local iconAction({action,label,tooltip,icon,onActivate,disabledReason}) -> HTMLButtonElement with data-catalog-action as its stable action key. Focus helpers take item ID and action key, never the first arbitrary button.

- [ ] Write browser assertions for reference actions [add,rename,archive] and variant actions [edit,create,move,archive], each with SVG and no visible text label. Assert no Reference actions/Variant actions menu trigger remains. Use scoped getByRole('button',{name: action + target,exact:true}) selectors so duplicate item names across groups cannot select another row. Run the new direct-actions case: `npx.cmd playwright test e2e/reference-exercises.spec.js --grep "direct icon actions"`. Expected: FAIL because direct action buttons are absent.
- [ ] Add target-specific accessible names: `Add variant to <reference>`, `Rename reference exercise <reference>`, `Archive reference exercise <reference>`/`Restore reference exercise <reference>`, `Edit variant <variant>`, `Create variant from <variant>`, `Move variant <variant> to reference exercise`, `Archive variant <variant>`/`Restore variant <variant>`. Scope locators to reference identity when names collide. Add visual tooltips using data-action-tooltip; include restriction text when unavailable.
- [ ] Implement iconAction and replace the two menu triggers with the approved ordered strips. Remove catalog-only menu creation/listeners/positioning; retain session exercise menus. Mount shared action tooltips once, hide before rerenders/dialog opening/collapse, destroy on view teardown. Add four matching icons to action-controls.js without changing existing icons.
- [ ] Preserve unavailable controls as focusable `aria-disabled=true` buttons with explicit guarded handlers, so keyboard users can read the tooltip. Parent archive disables Add variant and Create variant; parent-inherited archive disables the individual archive/restore control exactly as today. Keep existing visible parent-archive explanation. Test click, Enter and Space produce no request for unavailable controls. Do not change backend rules.
- [ ] Track each invoking action by reference/variant ID plus action key. Cancel returns to that exact control; successful edits/renames return there after reload. Create focuses the new variant's Edit control; move focuses its destination variant's Move control; missing/filtered results focus Search catalog. Archive/restore focuses the same action key when it survives, otherwise the containing reference disclosure, then Search catalog. Update dialog callbacks locally without changing shared dialog contracts.
- [ ] Apply compact action strips in CSS using existing action-button tokens. Retain 32px eligible desktop / 44px other targets and 8px gaps. Remove old mobile full-width reference action buttons; keep metadata wrapping independently. Update design-system catalog guidance in the same change.
- [ ] Adapt existing catalog tests and layout flows from menu-open/menu-item sequences to direct buttons. Add tooltip hover/focus/Escape checks, exact cancel-focus checks, and archive/move/retry regressions. Run `npx.cmd playwright test e2e/catalog.spec.js e2e/reference-exercises.spec.js e2e/catalog-layout.spec.js` and `npm.cmd test`. Expected: zero failures; existing draft recovery and library tooltip behavior preserved. Commit `feat: expose compact inline catalog actions`.

## Task 2: Animate reference disclosures without rebuilding rows

**Files:** Modify src/catalog-view.js, style.css, docs/design-system/README.md and e2e/reference-exercises.spec.js.

**Interfaces:** Add local setReferenceExpanded(section,opened,{animate=false}={}) -> void. It updates the existing toggle, body grid wrapper, aria-expanded/label, aria-hidden and inert state without changing variant node identity. Stable reference IDs connect heading/body/controls; render still owns construction, filtering and async reload. Task 1 action keys/focus helpers remain intact.

- [ ] Add `manual reference disclosure animates in place` browser coverage: save a child DOM node identity, toggle closed/open, assert the node is unchanged, aria-expanded tracks the last input, closing content becomes inert/aria-hidden immediately, and the following group changes vertical position through an intermediate value before settling. Under normal motion assert grid/opacity transitions are 200ms ease-out. Run `npx.cmd playwright test e2e/reference-exercises.spec.js --grep "disclosure"`. Expected: FAIL against immediate hidden/rebuild behavior.
- [ ] Replace body.hidden with a grid transition wrapper and shrinkable inner content. Use grid-template-rows 0fr/1fr and opacity 0/1, overflow clipping with room for action focus rings, and catalog-specific padding so the generic card-collapse selector cannot add unwanted gaps. Closed wrappers occupy zero height; no fixed maximum height. Animate the chevron's rotation over 200ms ease-out. Turn all new transitions off under prefers-reduced-motion:reduce.
- [ ] Change the disclosure handler to update the appropriate expanded/searchExpanded set and call setReferenceExpanded on the existing section. Restore focus only when needed; clicking the toggle keeps its DOM identity and focus. Before closing, move any descendant focus to the toggle and hide tooltips. Avoid completion timers and transitionend-driven visibility: CSS reverses from its current position, while the latest expanded state owns semantics immediately.
- [ ] Initialize rebuilt sections in their final open/closed state before enabling transitions, without forced entry animations. Preserve independent manual expansion during search, query-driven default expansion and clearing-search restoration. Loading/filtering rerenders cancel obsolete motion by replacing nodes; destroy leaves no tooltip or scheduled work.
- [ ] Add rapid open-close-open, reduced-motion, empty-reference, filter-clear and async-reload-during-motion regressions. Verify keyboard Tab skips closing/closed children; reopening restores their normal order. For reduced motion assert zero-duration transitions and immediate final geometry; use animation frames/condition polling rather than brittle exact sleeps. Update design-system motion documentation.
- [ ] Run `npx.cmd playwright test e2e/reference-exercises.spec.js e2e/catalog.spec.js` and `npm.cmd test`. Expected: zero failures, including search expansion, stable focus and dialog recovery. Commit `feat: animate reference exercise disclosures`.

## Task 3: Verify compact layouts and complete the release evidence

**Files:** Extend e2e/catalog-layout.spec.js; update docs/design-system/README.md only if verification changes authoritative CSS; create docs/superpowers/reports/2026-10-25-catalog-compact-actions-motion.md.

**Interfaces:** Consume task 1's data-catalog-action keys and task 2's disclosure wrapper/state. Continue existing test server authentication and seeded catalog fixtures. Save this plan's screenshots under .superpowers/sdd/2026-10-25-catalog-compact-actions-motion/screens.

- [ ] Add populated layout assertions at 1366x768, 1440x900, 1920x1080, 768x1024 and 390x844: reference/variant action strips remain horizontal, actions do not overlap names/counts, no page overflow, focus outlines are not clipped, and all actions/dialog Save/Cancel remain reachable. At desktop assert the strip shares the title/definition row; at constrained sizes allow a complete strip to wrap below. Use long 200-character names and full muscle mappings. Run the targeted layout suite before CSS corrections; expected failures, if any, must identify actual overlap/overflow/target-size defects rather than test renamed selectors.
- [ ] Check every action's width AND height: 32px on eligible fine-pointer desktop, at least 44px on touch, hybrid and narrower screens. At 200% text, check name wrapping and complete action strips with no truncation or offscreen controls. Keep body-figure >=180px assertions in populated session screens and slider hit-box checks unchanged.
- [ ] Capture and inspect collapsed/expanded catalog screenshots, hovered/focused action tooltip, archived reference with restricted actions, and normal/reduced-motion toggle behavior. Correct genuine issues with a reproducing regression; keep CSS and design-system values aligned. Run `npx.cmd playwright test e2e/catalog-layout.spec.js`. Expected: all cases pass.
- [ ] Run `npm.cmd test`, `npm.cmd run test:e2e`, `npm.cmd run build` and `git diff --check`. Expected: all green. No database migration is needed for this UI-only change. Record actual counts, screenshots reviewed and any limitations in the report.
- [ ] Obtain one independent whole-change review under the native executing-plans workflow. Cover the five Review Focus conditions and approved design constraints. Fix Important/Critical findings with failing-then-passing regressions and rerun the required suites; record genuine minors. No implementer agents or per-task reviewers.
- [ ] Mark the plan complete, commit `test: verify compact catalog actions and disclosure motion`, preserve the worktree and local preview for user validation. Restart the preview only if necessary; no merge/push/deployment.

## Planning self-review and handoff

All requested behaviors map to tasks 1 and 2; responsive/accessibility constraints and final evidence map to task 3. Review Focus cases have explicit regression ownership. Existing data semantics and grouped autocomplete remain outside this UI change. Shared action keys, helper signatures and tooltip lifecycle are consistent across tasks. Native execution remains the user's preferred method. Implementation has not started.
