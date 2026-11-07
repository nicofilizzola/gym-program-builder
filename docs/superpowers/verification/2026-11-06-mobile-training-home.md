# Mobile training home verification

Date: 2026-11-07. Branch: `feat/mobile-training-home`. Implements the approved
[design](../specs/2026-11-06-mobile-training-home-design.md) and
[plan](../plans/2026-11-06-mobile-training-home.md).

## Verified local integration

On 2026-11-07, the user selected local merge into `main`. The main checkout was
clean, `git pull --ff-only` reported Already up to date, and
`git merge --ff-only feat/mobile-training-home` advanced `main` from `c3ea0ba`
to `81c8d2b` without conflicts.

Post-merge checks in the main checkout passed: `npm.cmd test` (431/431),
`npm.cmd run build`, `git diff --check`, and the focused Home, Home view,
cover and mobile-navigation Playwright suites (16/16 in 20.5 seconds).
The host-managed worktree and its feature branch remain attached for the host
to manage; no workspace-exit/removal tool is available. Nothing was pushed or
deployed, and deployment/device limitations below remain unchanged.

## Local evidence

- Baseline: `npm.cmd test`, 413 passing tests.
- Final unit/repository/API suite: `npm.cmd test`, **431 passing, zero failures** after the review fixes.
- `npm.cmd run build`: passed; all four local WebP files and CREDITS.md are in `public/src/assets/workout-covers/`.
- Focused browser regression: 57 passing across Home, mobile navigation, start sheet, offline workouts and cover selection.
- Final Home/view/layout checks before branch review: 7 passing, including 320/360/390px, 760/761px, tablet, 1366×768, 1440×900, 1920×1080, landscape and enlarged long text.
- Full browser invocation: `npm.cmd run test:e2e` exercised **475 cases**:
  456 passed, 18 failed on obsolete fixture/assertion expectations, and one
  catalog-move scenario exceeded the default 20-second timeout.
- After fixture-only corrections, `npx.cmd playwright test --last-failed --timeout=60000`
  passed **all 19 cases** in 40.9 seconds. The catalog-move case took 1.1 seconds
  in the scoped retry. No production code changed between that full run and retry.
- Every browser case therefore has a passing run; there was no single final
  combined green 475-case invocation. Do not describe this evidence as one.
- `git diff --check`: passed.

The corrected cases cover mobile exercise actions/disclosure, tooltip text safety
(scoped to the tooltip rather than legitimate cover thumbnails elsewhere), v4
export's normalized cover field, touch library actions, mobile program setup,
profile layouts, weekly touch heatmaps and phone workout notes. Their fixtures
now explicitly enter Programs where the scenario requires it, preserving strict
assertions in the dedicated mobile/desktop landing tests.

## Independent review and fixes

One independent read-only reviewer examined `c3ea0ba..cff14b7`. No critical
findings. Four important findings were reproduced and fixed in `c941353`:

1. Transitioning away from Resume with a retained recommendation could publish
   Resume with a null active log; refresh now selects its presentation explicitly.
2. An activation completing after picker close could invalidate the only refresh;
   successful activation now initiates its own guarded refresh.
3. An absolute long program name overlapped enlarged workout text; it now
   participates in layout and page growth.
4. A separate collapsed cover row displaced the compact desktop exercise list;
   the toggle now sits in the existing toolbar with a bounded collapsed width.

The reviewer marked desktop keyboard/visual nav order mismatch Minor. It was
regraded as an important regression of the unchanged desktop navigation contract
and fixed: the same link nodes are ordered for the breakpoint with focus retained.
Another browser regression reproduced picker closure returning focus to a setup
action already removed by successful activation. The sheet now accepts an optional
fallback focus target; Home supplies its surviving enabled action.

All fixes have failing-then-passing tests. The post-fix focused browser run passed
the five selected compact-layout, cover-selection, navigation, setup-focus and
long-name layout scenarios. No product findings are deferred. Deployment and the
explicitly excluded all-history/offline-cold-launch behavior remain outside this
local review.

Tests use disposable local databases and fixture data. No real workout history,
production database, migration command or deployment was used as a write target.

## Behavior exercised

Cover IDs default/validate across old templates, portable versions 1–4 and log
versions 1/2; new workouts retain their own cover snapshot. Shared templates and
program exports retain the choice. Existing repository/catalog/AI tests ran with
the new canonical field.

Pure tests cover local recommendation dates, Sunday/Monday and Paris DST,
Sequence skipping/wrapping, and year-aware timing copy. Controller tests exercise
offline Resume before delayed requests, independent failures, pending completion,
deduplication, single start, cancellation, stale-response order, scoped bar
suppression, midnight/focus refresh and destruction.

Browser checks exercise the center Home tab, separate History, unchanged desktop
default, explicit-route resize, direct Start, offline Resume, snapshot imagery,
successful active-program setup, radio autosave/focus, defensive image fallback,
safe user text, and focus recovery when a setup action disappears.

## Visual review

The 390×844 composition fits Start and Choose another workout above the tabs.
The initial enlarged-text review reproduced a secondary action covered by the
fixed tabs. A regression assertion now checks its position after scrolling;
Home grows naturally instead of overflowing a fixed-height parent. The content
gradient grows with the text to retain contrast when names wrap.

Representative images: [390px Home](assets/mobile-training-home/integrated-home-390.png),
[320px Home](assets/mobile-training-home/layout-320x740.png),
[enlarged long text](assets/mobile-training-home/layout-390-enlarged.png),
and [desktop explicit Home](assets/mobile-training-home/layout-1440x900.png).
Browser checks use Chromium; physical-device Safari/Chrome and OS text sizing
remain unverified.

A separate real-browser cover-selector interaction check exercised normal motion,
closing content becoming inert immediately, rapid reversal and live reduced-motion
switching. Open/reversed height was 296px with opacity 1; reduced-motion closure
settled to height 0 with transition duration 0s. No additional test server or
production database was used.

## Assets

Four 667×1000 WebP files: gym 186,894 bytes, dumbbells 119,062 bytes,
barbell 86,974 bytes and machines 105,716 bytes. Source pages, photographers,
download date and license are recorded in
[`CREDITS.md`](../../../src/assets/workout-covers/CREDITS.md). All images are
served locally; the app has no runtime photo-service dependency.

## Execution notes and release boundary

- Windows requires `npm.cmd`/`npx.cmd` because PowerShell blocks the .ps1 wrappers.
- Cover boundary tests share one fixture file rather than repeating the same
  assertions in every existing test file; the relevant existing suites also ran.
- One intermediate full unit run hit Windows SQLite cleanup `EBUSY` in
  `repository.test.js`; its isolated retry passed and the subsequent normal
  full run passed 429/429.
- Accept the full browser run plus scoped corrected-case retry as the final
  browser evidence. The cost is absence of a single final combined green run;
  every named case has a passing execution.
- Desktop navigation order was treated as an accessibility regression rather
  than deferred polish; a breakpoint listener reorders the same links without
  changing the route and retains focus.
- The review's unjudged all-history scheduling and offline cold-launch cases stay
  excluded by the approved design. Existing limits remain; no new guarantee is made.
- Preview/production deployment and physical-device verification remain pending.
  Deploy server validation and client together; no SQL migration is needed.
- Automatic approval review rejected removal of the plan's ignored
  `.superpowers/sdd/2026-11-06-mobile-training-home/` scratch directory with
  `blocked by policy`. It remains locally with the raw test logs and review
  package. Tracked changes are committed; no product work depends on this cleanup.
