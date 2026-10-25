# Compact catalog actions and disclosure motion

Implemented natively on `feat/exercise-catalog`, continuing from `4e13270`. [Approved plan](../plans/2026-10-25-catalog-compact-actions-motion.md).

## Delivered

- Direct reference actions: Add variant, Rename, Archive/Restore. Direct variant actions: Edit, Create variant, Move, Archive/Restore. All use consistent inline SVG icons with target-specific accessible names and shared hover/focus tooltips.
- Removed catalog row menus. Kept the labeled page-level creation button and dialog actions. Unavailable controls remain focusable with guarded activation and an explanation of the parent archive restriction.
- Exact invoking-action focus restoration after cancellation, stable action-key focus after mutations, and logical fallbacks when rows disappear.
- Reference bodies slide/fade and chevrons rotate over 200ms ease-out. Manual toggles preserve child nodes, reverse from the current position, and update inert/ARIA state immediately. Construction/filter/reload changes are instant; reduced motion disables transitions.
- 32px square controls only for eligible fine-pointer desktop; 44px elsewhere, with 8px gaps. Strips never stretch individual icons. At <=620px reference names span the header, followed by counts and an intact action strip.

## Verification evidence

Final pre-review checks: `npm test` 125/125 passed, `npm run test:e2e` 110/110 passed, `npm run build` passed and `git diff --check` passed. The local preview returned HTTP 200 at http://localhost:3000 and serves the changed frontend files directly.

- Direct-action test failed against two menu-era controls, then passed with explicit strips, tooltips and exact cancellation focus.
- Disclosure regression failed against immediate rebuilding, then passed with intermediate geometry, stable child identity, focus exclusion, interrupted toggles, empty groups, reduced motion, search restoration and reload during motion.
- Populated layout checks cover 1366x768, 1440x900, 1920x1080, 768x1024 and 390x844. Additional 200-character names/full muscle mappings and 200% text cover fine desktop and hybrid/touch contexts. Screenshots were inspected, including archived-parent controls and tooltips. Existing body-size and dialog-reachability checks remain.
- Layout inspection reproduced stretched 78.75px mobile controls where 44px squares were required, then verified the corrected strip. Full-width mobile heading regression reproduced 202px available name width where 358px was available, then passed after responsive wrapping.
- The pending-focus tooltip regression reproduced automatic scrolling cancelling its tooltip; the shared fix preserves the delayed tooltip until its geometry can be measured at the final position. Existing library/navigation tooltip regressions remain covered.

## Rulings

- Native PowerShell ledger and npm.cmd/npx.cmd replace Bash helpers. Cost if wrong: tooling portability, with no product behavior change.
- Pending keyboard-focus tooltips survive scrolling before opening; already visible tooltips still dismiss on scroll. This small shared-helper adjustment is necessary for icon-only controls reached outside the viewport. Cost if wrong: manual scrolling during the short pending interval can still open the focused tooltip.
- The app-screen inspector reports zero failures and one hero-void warning for whitespace between definitions and right-aligned actions in a full-width filtered list. Preserve the approved row alignment and normal scrolling rather than fill that space with decoration. Its hidden-login-heading heuristic is exempted. Cost if wrong: large-screen density may need further visual tuning.

No data schema, API, catalog semantics or portable file changes. No dependencies, remote migration, merge, push or deployment.
