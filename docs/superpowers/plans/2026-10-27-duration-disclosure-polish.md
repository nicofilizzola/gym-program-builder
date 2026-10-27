# Compact Duration Disclosure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking. Implemented with the native approach on 2026-10-28.

**Goal:** Replace the editor's Estimated duration text with a clock while retaining the live estimate and chevron, and smoothly expand and collapse its details.

**Architecture:** Keep `mountDurationControls(host, {workout, onChange})` and its `{update, destroy}` interface. Reuse the catalog disclosure's persistent grid-row/opacity pattern and the shared action tooltip controller. Apply the update in the shared editor, including program workout editing; program overview metadata remains unchanged.

**Tech Stack:** Vanilla JavaScript modules, CSS, inline SVG, native range inputs, Playwright, Node.js 24.

**Spec:** The approved short design in this conversation (2026-10-27), recorded below; `docs/design-system/README.md`, especially Feature design and review checklist and Motion; existing duration behavior in `docs/superpowers/specs/2026-10-25-workout-duration-design.md`.

## Approved design and acceptance criteria

- The heading control reads `[clock] ~N min [chevron]`. Replace only the visible Estimated duration label. Keep the live total visible, tabular and unbroken. Preserve the existing heading position, secondary-button treatment, dark surfaces, Barlow type, orange focus ring and spacing tokens. Use a plain 18px currentColor outline clock, without a decorative container.
- Keep accessible names `Show duration details` / `Hide duration details`, `aria-expanded`, `aria-controls` and the total's accessible description. Both SVGs are decorative. Add a shared hover/focus tooltip with the same action wording.
- Retain the existing inline breakdown, hint and two allowance sliders behind the disclosure. Do not add cards, sections, menus, dependencies or persisted state.
- On user activation, expand/collapse grid rows from 0fr to 1fr and opacity from 0 to 1 over **200ms ease-out**, reversed on closing. Rotate only a specifically classed chevron through 180 degrees over the same duration; the clock never rotates. Neighboring editor content moves with the disclosure.
- Keep the same DOM nodes throughout. Closed content occupies no height, including padding, borders and margins. Apply spacing/surface decoration inside the clipping structure so it collapses completely. Preserve focus-ring clearance when expanded.
- Opening makes the details accessible and interactive. Closing first returns focus to the toggle if focus is inside, then immediately sets `inert` and `aria-hidden=true`. The visual region remains mounted throughout exit; do not use `hidden` to interrupt animation. A persistent zero-row, clipped, inert, aria-hidden region is the final closed state.
- Rapid reversal uses current CSS interpolation, without timers or stale completion callbacks. Initial construction is closed without entrance animation. Data refreshes and slider updates preserve open state, node identity and focus and update values immediately.
- Reduced motion disables both disclosure and chevron transitions and reaches the same final accessible state immediately. No `transition: all`, artificial delays or animation library.
- Preserve native disclosure activation with Enter/Space. Do not introduce Escape or outside-click dismissal for this inline disclosure. Tooltips retain their existing dismissal behavior.

## Global Constraints

- Compact 32px controls apply only on desktop with a fine primary pointer and no available coarse pointer.
- Touchscreens, including hybrid mouse/touch laptops, retain at least 44×44px targets.
- Native slider hit boxes remain 44px on every device.
- Both body figures retain at least 180px desktop height.
- Change authoritative CSS values in `style.css` first, then update `docs/design-system/README.md` in the same change.
- Duration calculation, defaults, saved timing, import/export and revisions retain their existing behavior. No database migration or seed is needed.

## Review Focus

1. Open → close → open during motion must finish open with the same usable sliders, without stale hiding.
2. Closing while a slider has focus must return focus to the toggle and exclude the closing content from Tab and accessibility navigation.
3. A live update during motion must preserve DOM identity, focus and the newest total without restarting the transition.
4. Reduced motion, including changing the preference while open, must leave no unfinished closing state.
5. Long names, 200% text and touch/hybrid desktops must preserve the visible estimate, target sizes, body prominence and reachable details without horizontal page overflow.

## File map

- Modify `src/duration-controls.js`: compact markup, explicit disclosure state, focus/inert/ARIA handling, tooltip ownership and cleanup.
- Modify `style.css`: clock/chevron selectors, collapsing wrappers and spacing, motion and reduced-motion rules.
- Modify `e2e/duration.spec.js`: behavior and layout regression coverage using its existing populated fixture.
- Modify `docs/design-system/README.md`: record the compact trigger and complete disclosure behavior under Workout duration.
- Read/reuse `src/action-controls.js` (`mountActionTooltips`), `src/catalog-view.js` (`setReferenceExpanded`) and `e2e/reference-exercises.spec.js` (browser motion sampling). Do not refactor these modules for this change.

### Task 1: Ship the compact, animated duration disclosure

**Interfaces:** Consume the existing `mountActionTooltips(root)` controller from `src/action-controls.js` and its existing data-action-tooltip convention. Preserve `mountDurationControls(host, {workout, onChange}) -> {update(next), destroy()}` and the existing duration total/part/allowance data attributes. No consumer changes are required in `src/session-editor.js`.

- [x] **Step 1: Add focused failing browser tests in `e2e/duration.spec.js`.**

  Extend the existing fixture tests with these named cases and assertions:

  - `compact duration trigger preserves estimate and accessible action`: visible total is `~27 min`; visible Estimated duration text is absent from the toggle; clock and chevron are separate decorative SVGs; accessible action remains Show/Hide duration details and description remains `~27 min`; hover/focus shows the shared tooltip.
  - `duration disclosure animates both directions and reverses in place`: explicitly emulate `reducedMotion: 'no-preference'` (the project default is reduce). Sample opening and closing between animation frames, as in the reference disclosure test; assert intermediate height and downstream heading/list position lie between closed and open endpoints. Assert 200ms ease-out grid/opacity transitions, chevron rotation and unchanged clock transform. Toggle open/close/open across frames; final state is open, original slider nodes remain connected and usable. Verify settled closed height is zero.
  - `closing duration details restores focus and removes hidden controls from navigation`: focus Extra time, invoke toggle programmatically to exercise focus-inside closure, assert toggle focus, immediate inert/aria-hidden state, aria-expanded=false and Tab skipping both allowance sliders even during exit. Enter/Space on the toggle opens it and restores normal Tab access.
  - `duration updates preserve disclosure motion and teardown is safe`: update the mounted view during opening and while a slider is focused; assert original nodes, open state and focus survive and total reflects new values immediately. Destroy during opening/closing and verify no tooltip remains and no page errors occur.
  - `duration disclosure respects reduced motion changes`: opening and closing under reduce have zero-duration transitions and correct accessibility state; changing no-preference to reduce during closing leaves a fully collapsed inert region. Reopening remains usable.

- [x] **Step 2: Run the focused tests and confirm the expected failures.**

  Run `npx playwright test e2e/duration.spec.js`. New tests should fail because the current trigger has no clock and `hidden` causes immediate changes. Distinguish setup failures from behavioral failures before proceeding.

- [x] **Step 3: Implement the control and CSS together.**

  In `src/duration-controls.js`, replace the label with the clock, class the chevron explicitly, and introduce persistent outer grid and inner clipping/content wrappers. Keep `.duration-details` as the region addressed by aria-controls. Maintain one transient `opened` boolean and a local `setExpanded(opened)` operation; use the approved focus and accessibility order. Gate transitions to user toggles so initial rendering stays instant. Remove the click handler's immediate hidden toggling. Keep `update(next)` independent of disclosure state.

  Mount shared action tooltips once on the host, update the trigger's tooltip action alongside its accessible name, hide it on toggle, and destroy its controller before removing host children. Follow the controller's actual lifecycle contract from `src/action-controls.js`.

  In `style.css`, replace the broad expanded-button SVG rotation selector with a chevron-only selector. Implement the persistent grid/opacity pattern, ensuring all panel decoration and vertical spacing collapse with the content. Preserve the existing allowance columns and mobile stacking. Add a reduced-motion rule after these new transition declarations so stylesheet order cannot override it. Preserve the current button's pointer-aware minimum sizes; do not make this variable-width control a square icon button.

- [x] **Step 4: Run the focused browser tests to green.**

  Run `npx playwright test e2e/duration.spec.js e2e/recovery.spec.js`. Expect all cases to pass, including existing live-value, focus, copy and file round-trip coverage. Existing exact accessible-name selectors should continue to work.

- [x] **Step 5: Update the design system.**

  In `docs/design-system/README.md` under Workout duration, replace the text-label description with clock + live estimate + chevron and document 200ms ease-out grid/opacity motion, chevron-only rotation, immediate closed accessibility state, persistent nodes, reversal and reduced motion.

- [x] **Step 6: Commit the implementation and its regression coverage.**

  Stage only `src/duration-controls.js`, `style.css`, `e2e/duration.spec.js` and `docs/design-system/README.md`; commit as `fix: compact and animate duration disclosure`.

### Task 2: Verify the populated editor and release readiness

**Interfaces:** Exercise Task 1 through the existing session template and program workout editors; no new production interfaces.

- [x] **Step 1: Extend the existing populated layout checks where necessary.**

  In `e2e/duration.spec.js`, assert trigger estimate visibility, no page overflow and fully reachable expanded controls at 1366×768, 1440×900, 1920×1080, 900×900, 760×900 and 390×844. Exercise 200% text with the existing long template name, both open and closed. Extend the existing coarse/hybrid test to check the new trigger's clock and estimate remain visible and its targets remain at least 44×44px; sliders remain at least 44px high. Desktop body figures remain at least 180px high. Use `.superpowers/sdd/2026-10-27-duration-disclosure/` for new screenshots.

- [x] **Step 2: Inspect real browser behavior with populated data.**

  In both session templates and program workout editors, open/close, rapidly reverse, operate with keyboard, edit sliders during an open disclosure and test touch activation and reduced motion. Inspect smooth downstream movement, no closed panel spacing, visible focus rings, tooltip dismissal, 200% text and all required viewports. Confirm program overview cards still show their existing Estimated duration metadata. Screenshots support layout review; inspect motion through interaction. Record actual checks and any gaps.

- [x] **Step 3: Run the required release checks.**

  Run `npm test`, `npm run test:e2e` and `npm run build` sequentially. Expect zero failures and a successful static build. If a check fails, diagnose whether it is caused by the change and resolve it before claiming completion. Do not migrate or seed a database for this UI-only change.

- [x] **Step 4: Commit verification additions and report readiness.**

  Commit any additional layout assertions as `test: verify compact duration disclosure layouts`. Report changed behavior, completed automated checks, browser inspection results and any verification gaps. Do not deploy or merge as part of this plan unless separately authorized.

## Plan self-review

The single control task covers compact presentation, both transition directions, rapid reversal, focus, accessible state, immediate data updates, tooltip lifecycle and reduced motion. The verification task covers shared-editor consistency, populated responsive layouts, touch/hybrid targets, body prominence and all required release commands. All five Review Focus conditions have explicit assertions or browser checks above. No duration-domain, persistence or unrelated layout changes are planned.

## Shipping verification (2026-10-28)

- `npm test`: 148 passed; `npm run test:e2e`: 176 passed; `npm run build`: successful. Windows invoked the equivalent npm.cmd/npx.cmd shims because npm.ps1 is blocked.
- Inspected populated screenshots at 1366�768, 1440�900, 1920�1080, tablet/mobile widths and 200% text. Playwright exercised both motion directions, reversal, focus/Tab, reduced-motion preference changes, live updates, teardown and the shared program editor. Coarse/hybrid input is browser-emulated; no physical-device verification.
- Fresh final reviewer approved with no blocking production findings. Deferred minor: strengthen the update-during-motion test to explicitly prove an active, uninterrupted animation timeline and assert settled original-slider usability after reversal.
- Execution decisions: fast-forwarded the managed worktree from its stale ancestor to source main before implementation; scoped tooltip teardown assertions to the owned tooltip; animated the heading row gap to remove closed-state spacing (wrapped desktop heading rows are also compact when closed); grouped responsive assertions with the control commit. No calculation, persistence, database or program-card metadata changes.
- Work is committed on `fix/duration-disclosure`; integration is pending. Screenshots are temporary execution artifacts.
