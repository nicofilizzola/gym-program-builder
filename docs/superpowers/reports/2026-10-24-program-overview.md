# Program overview implementation report

Implemented the approved [design](../specs/2026-10-24-program-overview-design.md) and [plan](../plans/2026-10-24-program-overview.md) on `feat/program-overview`.

## Delivered behavior

- Native Sequence / Monday–Sunday segmented control, preserving workout order and day assignments.
- Grouped Import program and Export program actions with matching SVG icons, responsive wrapping and explicit spacing above content.
- Front/back weekly body map with heat bands 0, 0.5–6, 6.5–12, 12.5–18 and 18.5+, independent of weekly goals. Session heat thresholds remain unchanged.
- Shared body/row hover, keyboard preview and click/tap selection, readout fading, hover grace and timer cleanup.
- Visible `Trains {muscle}` highlights on contributing workouts without filtering or autosave. Highlights reapply after workout mutations and reset when replacing the program or returning from its editor.
- Responsive weekly panel header and template picker, including long unselected template names, enlarged text and unavailable web fonts.
- Updated project guidance to include the approved weekly heatmap.

## Verification

Final checks used Node.js 24.22.1:

| Command | Result |
| --- | --- |
| `npm.cmd test` | 99 tests passed, 0 failed |
| `npm.cmd run test:e2e` | 33 tests passed, 0 failed |
| `npm.cmd run build` | Exit 0; output contains index.html, style.css and src assets |
| `git diff --check` | Passed |

Browser checks include 320px, 375px, 800px, 1280px and 667×375 landscape; doubled computed text sizes; loaded/fallback fonts; normal/reduced motion; mouse, keyboard and touch input. Desktop and mobile screenshots were visually reviewed.

## Independent review and corrections

One fresh reviewer inspected the completed branch. It found two Important issues, no Critical issues and no Minor issues:

1. Mouse focus kept deselected muscles highlighted after hover ended. A regression test reproduced this before the fix; persistent focus preview now applies to keyboard-visible focus. The keyboard test uses actual Tab navigation.
2. Enlarged text squeezed the weekly heading into an unreadable narrow column. Geometry assertions reproduced this before the fix; the title and unit now stay grouped while the goals button wraps below them. Extending the check to 320px also reproduced a small segmented-control overflow, fixed by allowing its options to wrap.

Both corrections passed their targeted tests and the final full suite. No findings were deferred and the reviewer declined no behaviors for judgment.

## Execution decisions

- Worked in the existing checkout on a new feature branch, preserving pre-existing package.json and package-lock.json edits. Isolation is by branch rather than by a separate worktree directory.
- Used Windows `npm.cmd`/`npx.cmd` equivalents because PowerShell blocks the npm.ps1 wrapper. Execution policy and project dependencies were not changed.
- Updated two additional existing browser tests after the full suite found references to the removed schedule checkbox. Their import/export and persistence assertions remain intact.
- Automated enlarged-text checks use doubled computed font sizes rather than browser-chrome zoom. Real browser zoom was not manually verified; this is the remaining verification limitation.

The implementation is committed locally on the feature branch. Database schema, persistence format and server code are unchanged.
