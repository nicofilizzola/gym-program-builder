# Compact desktop redesign verification

Plan: `docs/superpowers/plans/2026-10-24-compact-desktop.md`.

Baseline unit suite: 101 passed. Before/after screenshots and metrics use the same deterministic six-exercise, twelve-muscle, twelve-library-row and scheduled-week fixtures in `e2e/compact-desktop.spec.js`.

Artifacts: `.superpowers/compact-desktop/before/` and `.superpowers/compact-desktop/after/`, including `metrics.json` and screenshots at 1366×768, 1440×900 and 1920×1080. These are local, ignored review artifacts.

## Measured results

The fixture deliberately expands all six exercises and gives all twelve muscles a goal. Counts below are complete cards visible without scrolling, including the real application shell.

| Viewport | Expanded exercises before → after | First exercise top before → after | Session panel height before → after | Figure height after |
|---|---|---|---|---|
| 1366×768 | 0 → 2 | 358 → 184px | 925 → 533px | 180px |
| 1440×900 | 0 → 2 | 358 → 184px | 925 → 533px | 180px |
| 1920×1080 | 1 → 3 | 358 → 184px | 925 → 533px | 200px |

Short-name library rows decreased from 78 to 54px. The weekly panel now ends at about y=681 with all twelve rows, compared with y=1322 before. Schedule uses two/two/three columns; the full program canvas reaches the 24px right gutter. A nine-workout week, including a double-workout Monday and Unscheduled, fits entirely on the 1920×1080 fixture.

## Verification

- Node.js 24.22.1: `npm test` — 101 passed, zero failures.
- `npm run test:e2e` — 79 passed, zero failures, including fourteen new density/layout tests.
- `npm run build` — successful; static output contains browser assets only, covered by existing build tests.
- `git diff --check` — clean.
- Browser design inspector: session and weekly program snapshots at 1366, 1440 and 1920px — zero FAIL findings. Each retains one existing `micro-label` warning for the 12px Front/Back captions; these meaningful view labels are deliberately kept. A 3.5:1 secondary-muscle hint warning was fixed by using the existing muted-text token; reinspection confirms it is gone.

Behavior coverage includes rep-thumb pushing, error focus after refused export, collapse inertness, coarse-pointer targets, 200% text, oversized-panel flow fallback, observer teardown, save recovery, library links/actions, cross-column drag, empty-day/Unscheduled drops, keyboard reorder, duplicate focus, mode switching, imports, independent copies, persistence and conflicts. Existing 320/375px, tablet, fallback-font, landscape and reduced-motion checks pass.

Visual review used all three screen widths, comparing identical full populated fixtures. It caught malformed header nesting that left a blank strip on the program screen; a new right-gutter/DOM-parent regression reproduced and verified the fix. Enlarged-value overflow also received a dedicated regression. The bodies retain full aspect ratio and all muscle regions, including Side delts; there is no internal panel scroller or hidden map.

## Decisions and limits

- Native managed worktree on `compact-desktop`; no per-task agents. A fresh whole-branch reviewer follows implementation, as required by executing-plans.
- Windows blocks `npm.ps1`; commands use `npm.cmd`/`npx.cmd` with the installed Node 24 on PATH. No system policy changes or dependency additions.
- Existing tests that required 44px on every desktop were updated to the approved 32px fine-pointer minimum at ≥1100px; touch and smaller viewports retain 44px coverage. The smaller desktop targets are intentional.
- Wide fine-pointer day cards share an actions/day-assignment row above a 27rem container threshold. Narrow, touch and enlarged-text cards retain stacked controls to avoid crowding.
- The chosen app-screen direction is true-black-flat (seed 2128894905), interpreted through the approved existing palette/type. Retaining existing brand colors, borders and selection semantics takes priority over the sheet's alternate colors. The visual signature remains the bodies and volume heatmap. All screenshots use deterministic sample training data, not production data.
- Long documents and enlarged/short windows can still require normal document scrolling. No database migration, deployment, merge or push was performed.

## Independent final review

One fresh reviewer inspected the whole branch, checked expanded editing and both program modes at 1100/1200/1366/1600/1920px with normal and 200% text, and found no overflow or additional interaction/cleanup regressions. No behaviors were declined as out of scope.

The review found undersized targets on hybrid touch laptops and a 1.2px readout growth when text wraps. Both received real Chromium regressions that failed before the fix and passed afterward. Hybrid testing uses `availablePointerTypes=6,primaryPointerType=4` and asserts both fine-primary and coarse-available media states. Compact controls now explicitly exclude any coarse pointer; readout height includes both line boxes and padding/border. The small readout fix is included because stable readout geometry is an explicit preservation requirement. No findings are deferred. Final unit, browser and build verification is rerun after these fixes.
