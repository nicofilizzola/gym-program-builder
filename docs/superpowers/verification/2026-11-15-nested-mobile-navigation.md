# Nested mobile navigation verification

Design: [2026-11-15-nested-mobile-navigation-design.md](../specs/2026-11-15-nested-mobile-navigation-design.md).

Status: Implemented, not deployed. Tasks 1-5 pass locally: full unit and browser suites, build and diff check. Physical-phone checks and deployment remain pending (user).

## Task 1 — immediate-parent metadata

- Added `mobileParentFor(hash, {program, reference})` using existing parsed views and `isSwipeRoot`.
- Unit matrix covers mobile roots, all nested route types, owning-root fallbacks, resolved canonical parent IDs, Home History queries, both tag kinds/query replacements, empty/unknown queries, malformed IDs and unrelated paths.
- Existing destination ownership, page memory, entry replacement and explicit mobile/desktop route behavior remain covered.
- RED: `node --test test/mobile-navigation-state.test.js test/router.test.js` exited 1: missing `mobileParentFor` export; 5 parser tests passed, 1 file failed.
- GREEN: same command exited 0: 10 tests passed, 0 failed.
- Regression: `npm.cmd test` exited 0: 519 tests passed, 0 failed.
- `git diff --check` exited 0.

## Task 2 — stable compact breadcrumbs

- `mountBreadcrumbs` retains links by href, patches labels and preserves the immediate-parent anchor/focus across current-record edits, save acknowledgements and responsive changes. Omitted update metadata retains the previous mobile parent; empty desktop items can show mobile-only parent chrome.
- At ≤760px only the immediate parent is visible/accessible, with a decorative currentColor left arrow, full `Back to {parent label}` name, one-line ellipsis and a ≥44×44px target. At 761px the existing desktop trail/current-page semantics return. A focused desktop-only crumb transfers to the surviving parent; a mobile-only link hiding on desktop transfers to the heading. Focus is captured before the compact display class changes.
- App callers consume resolved program/reference parent metadata. Templates/Exercises use compact aliases; Profile returns to User. Moved/archived variants use their canonical reference href. Missing variants keep an available reference parent; missing references fall back to Exercises. Existing desktop error trails remain unchanged.
- Browser coverage exercises held template PUT acknowledgement focus/identity, current-record and parent-label updates, HTML-like/long labels, exact 760/761 boundaries, native modified clicks and ordinary Enter/click callbacks, program return-to-occurrence focus/scroll, variant → reference → Exercises, tags, Profile and root-no-trail behavior. Existing desktop/shared-template trails remain covered.
- RED: `npx.cmd playwright test e2e/breadcrumbs.spec.js e2e/mobile-library-navigation.spec.js` exited 1: 3 failed, 5 passed (39.8s). Expected missing compact links: Back to Programs, Back to Strength and Back to User.
- Additional RED: `npx.cmd playwright test e2e/breadcrumbs.spec.js -g "moved archived variant"` exited 1: 1 failed (test 20.1s); missing variant did not yet retain its available reference parent.
- Final GREEN: `npx.cmd playwright test e2e/breadcrumbs.spec.js e2e/mobile-library-navigation.spec.js` exited 0: 8 passed (10.8s). The pre-existing NO_COLOR/FORCE_COLOR warning remains.
- Regression: `npm.cmd test` exited 0: 519 passed, 0 failed (10977.0828ms).
- Visually inspected generated screenshots at 390×844 (one compact parent link) and 761×844 (full desktop trail). Screenshots are local Playwright artifacts, not physical-device evidence. Tabs remain visible in this Task 2 snapshot; route visibility belongs to the next integration task.
- `git diff --check` exited 0. No deployment performed.

## Task 3 — committed route visibility and recovery

- `mobileNav.commit` applies the parsed root/nested classification at the existing route swap, retains it through desktop resize and updates the optional synchronous, argument-free geometry callback. Hidden navigation is not measured for its indicator; visible width/height changes notify once. Full mobile height remains separate from effective reservation, which is zero on nested routes and desktop. No effective-height animation was added.
- Initial mount skips entrance motion; ordinary nested transitions retain 75ms outgoing/100ms incoming ease-out content fades. The motion test records the outgoing animation with source chrome, the incoming animation with destination chrome and no Main animation at the swap. Reduced motion records no content animation.
- Workout Home links mount outside the logger subtree and survive Focus recap. Unknown/missing workout errors gain mobile-only Home parents without adding desktop trails. Initial required-load errors keep the requested nested treatment, available parent and Retry; missing occurrences retain the loaded program parent. Resolved catalog missing-target errors can commit, while thrown required-load failures preserve the mounted source URL, nodes, focus and chrome.
- Actual-app matrix covers Home/Programs/Templates/Exercises/User roots, all eight nested route types, active and finished workouts, tag queries, parent hrefs and return destinations. Every nested type also uses a fresh document deep link (`?nested-entry=…`) so direct-entry behavior is not confused with same-document hash navigation. Catalog reference/variant entry uses the existing guarded hash route from its parent because catalog expand/edit controls do not navigate; no new UI was invented. Roots retain exactly Home/Library/User with equal ≥44px targets and Library section links.
- Lifecycle coverage holds a required nested GET, checks unchanged source parent identity and zero reservation, fulfills 503 and checks source URL/controller node/focus. Profile PUT failure plus denied Back keeps the exact field value; finished-log incomplete reps plus denied Back keeps its draft and Home link. A held destination across browser Back/Forward cannot publish stale chrome. Root cold errors keep tabs and Retry.
- Auth coverage uses a real logout, a required Profile GET that triggers the existing 401 sign-in path and source URL restoration, then successful sign-in. A separately held template GET is released only after sign-in has restored the Templates source; its stale completion cannot publish nested chrome. This is a held stale-success request spanning an actual 401/sign-in, not a claim that the held request itself returned 401. The existing authentication-expiry swipe test also remains passing.
- Resize checks retain the explicit route at 760/761px, transfer focus from newly hidden Main to the compact parent, and cover 375×700 portrait and 700×375 landscape. Existing desktop full trails and labels, desktop Workouts resize, mobile Workouts history replacement, root typing/script focus, 200% root labels, root swipes, cache latency and 220/180ms settlement/cancellation assertions remain passing. Tests using formerly visible nested tabs now activate their visible parent; original guard/stale/auth/desktop assertions remain.

Commands and actual results (Windows, workspace `C:/Users/NicoF/.codex/worktrees/eb87/gym-program-builder`):

- RED: `npx.cmd playwright test e2e/nested-mobile-navigation.spec.js e2e/mobile-navigation.spec.js e2e/mobile-destination-swipes.spec.js --max-failures=3` exited 1: 22 passed, 3 failed, 1 not run (46.9s). All three failures reported visible Main navigation on nested program/template/missing routes. The max-failures stop also produced the runner's final stop error.
- First complete focused GREEN: `npx.cmd playwright test e2e/nested-mobile-navigation.spec.js` exited 0: 9 passed (23.5s).
- Final required browser regression: `npx.cmd playwright test e2e/nested-mobile-navigation.spec.js e2e/mobile-navigation.spec.js e2e/mobile-destination-swipes.spec.js e2e/breadcrumbs.spec.js e2e/mobile-library-navigation.spec.js e2e/mobile-navigation-latency.spec.js e2e/mobile-page-transition.spec.js` exited 0: 45 passed (1.1m).
- Regression: `npm.cmd test` exited 0: 519 passed, 0 failed (12943.9882ms).
- `git diff --check` exited 0. The pre-existing NO_COLOR/FORCE_COLOR runner warning remains unchanged.
- Visually inspected the 375×700 nested Profile screenshot: one compact User parent, current heading/save controls and no bottom tabs. Local artifact: `test-results/nested-mobile-navigation-c-dbbbc--navigation-transfers-focus/nested-mobile-profile.png`. This is browser evidence, not a phone/device claim.

## Pending verification

- Workout lifecycle/restoration: Task 5 focused coverage below now covers ordinary Back, explicit exits, cancellation, pending finish and acknowledgement ownership. The final full suite, build and diff check passed locally (see the results table).
- Geometry/accessibility: browser arithmetic covers 0px/20px simulated bottom insets, Resume/body/panel/status reservations, typing restore, 200% text and Focus at 660px. Actual phone keyboard and inset behavior remain pending; see Task 4 evidence below.
- Physical phone: safe areas, keyboard transitions and momentum remain pending (user). Browser simulation is not physical-device evidence.
- Deployment verification remains pending (user); no deployment performed.



## Task 4 - bottom geometry, inset ownership and typing

- Added `workoutBar.refreshGeometry()` using its existing reservation calculation, and logger `refreshGeometry()` using the existing frame-scheduled Focus measurement. The mounted workout adapter forwards it; mobile navigation's synchronous geometry callback refreshes both. Disabled/desktop/destroyed/recap logger states do not schedule new measurements. No event bus, additional observer, controller or persistence was introduced.
- Nested Resume owns `8px + safe-area-inset-bottom`; roots retain 8px because tabs own their inset. The pinned nested editor panel owns `12px + inset`. Existing effective-height consumers (body padding, app minimum height, Home cover/history, Resume offset, panel, root feedback) keep their shared variable. Focus uses rendered nav height only at the mobile breakpoint and only when nav has a rendered box; hidden navigation and suppressed Resume add nothing. The existing toolbar is measured once. The separate Focus footer/rounds design remains unimplemented.
- Actual stylesheet interception replaces only `env(safe-area-inset-bottom[,0px])` with 0px/20px, leaving selectors/declarations intact. At 390x844 root tabs measure 56px/76px and Resume's bottom equals their top. Nested Resume's bottom equals 844px, its inset increases height by exactly 20px, and body padding equals the effective tabs plus measured Resume in both directions (unchanged bar content, including unchanged bar height at inset zero). No-Resume nested views reserve the bottom inset only (0px at inset 0, 20px at 20px; superseded the earlier zero in Final review fixes) and `#app` minimum height is 844 minus the inset. Panel reaches the effective bottom and its padding includes the inset. Root refresh failure stays above both bars; Home History feedback remains static inside its section. At 200% text tab height grows, survives nested entry/return, and restores after resetting text size.
- Root script focus keeps bars visible; user press/key enters typing without changing reservation. A real touch at a catalog control near y820 activates before tabs return. Nested typing/blur and the 700ms pending click-grace return never reveal tabs, change effective zero or steal the parent link. Profile slider/script focus asserts absence, not translated hidden boxes. `typing-state.js` remains unchanged.
- At 390x660 with Last time, Best and tags, Complete remains inside the feed, toolbar ends within 2px of the actual viewport bottom, and Main has no accessible links. Exact canonical invalid reps node/value/caret, composing state and viewed set survive viewport/visualViewport resize and 760 -> 761 -> 760 in both motion settings, without saves or completion. Integration tests retain long-note, ownership, reanchor and draft assertions while using the actual viewport and Back to Home. A two-line-tags constrained fixture moved from 750px to 694px (56px reclaimed); all peekless and Complete reachability assertions remain.
- Visually inspected the generated local 390x844 active Focus screenshot: compact Home parent, full working card through Complete, next whole header, toolbar and no bottom tabs. Regenerated older evidence PNGs were restored; Task 5 owns the final screenshot matrix. This is browser evidence only.

Commands/results:

- Initial focused run: `npx.cmd playwright test e2e/nested-mobile-navigation.spec.js --grep "bottom reservations|typing restore|hidden-tab geometry"` exited 1: 1 passed, 4 failed (23.3s). Initial tests were corrected for reduced-motion transform `none`, unique template names and 1px viewport rounding.
- Corrected RED, same command: exited 1: 2 passed, 3 failed (21.2s). Production defect: 20px nested Resume padding expected 28px, actual 8px. Two remaining Focus failures were corrected to locate the canonical accessible input while it moves outside the feed on desktop.
- First GREEN, same command: exited 0: 5 passed (10.4s).
- First six-file required browser command (nested-mobile-navigation, mobile-navigation, mobile-navigation-layout, workout-focus-integration, workout-focus-fit, mobile-save-controls): exited 1: 87 passed, 1 failed (2.0m). The two-line-tags fixture still expected peekless at the old 750px viewport after reclaiming 56px.
- `npx.cmd playwright test e2e/nested-mobile-navigation.spec.js e2e/workout-focus-fit.spec.js --grep "bottom reservations|typing restore|hidden-tab geometry|two lines of tags"` exited 0: 6 passed (12.4s), including extended feedback/no-Resume assertions and the corrected 694px fixture.
- First `npm.cmd test`: exited 1: 518 passed, 1 failed (79167.6913ms). `test/repository.test.js:30` (`SQLite records persist, enforce revisions and safely retry lost acknowledgements`) hit Windows `EBUSY` unlinking its temporary `test.db`; no repository/cleanup code changed.
- Full rerun `npm.cmd test > .superpowers/sdd/2026-11-15-nested-mobile-navigation/task-4-unit.log 2>&1`: exited 0: 519 passed, 0 failed (11837.0339ms).
- Final required regression: `npx.cmd playwright test e2e/nested-mobile-navigation.spec.js e2e/mobile-navigation.spec.js e2e/mobile-navigation-layout.spec.js e2e/workout-focus-integration.spec.js e2e/workout-focus-fit.spec.js e2e/mobile-save-controls.spec.js` exited 0: **88 passed (1.8m)**.
- `git diff --check` exited 0. The pre-existing NO_COLOR/FORCE_COLOR warning remains. No deployment or physical-device verification performed.

## Task 5 - workout lifecycle, restoration and final verification

### Automated integration evidence

- `parent Home return retains workout and remembered History` seeds 52 real finished logs, loads the older page and remembers row 40's nonzero document scroll. It opens an active log, travels to working set 2 and holds a reps PUT while returning through `Back to Home`. The Home extent and scroll return, its own Resume suppresses the floating bar, the mirror keeps the same active ID/status, the background save is acknowledged, no DELETE or finish write occurs, and Resume returns to the same viewed set. The nested route crosses 761/390 without clearing Home memory; User → Home also retains the extent/scroll.
- Saved scroll instrumentation checks the rendered History count at every nonzero Home `scrollTo`. RED observed `[0,52]`: the generic route commit attempted saved scroll before the cached History extent rendered, even though final scroll was already correct. The narrow fix in `src/app.js:renderRoute` defers saved mobile Home restoration to the existing History callback after `historyView.setState`, at both generic commit and root settlement. It retains the callback's current-route/user-interaction guards, immediate no-memory top reset, explicit History-heading targeting, desktop and other roots. GREEN requires every observed nested and root-return restoration to have all 52 rows first.
- Discard and finished-log Delete start from an older-page extent with 52+ rows. Cancel retains the source parent and record; accepting removes the fixture, clears the active mirror where applicable, returns Home at zero with tabs and resets the visible extent to its 30-row first page. Another User/Home return retains that reset. Done now starts from 52 loaded rows and checks the same cleared extent/top plus the newest finished row. Original desktop Finish continues to Workouts without recap.
- Pending recap keeps `Back to Home` before and after a held finish acknowledgement. Pending/offline status is local and read-only; acknowledgement clears the mirror and enables the existing finished-log note autosave. The held test observes one finish PUT and one note PUT, then one History row and no active log after ordinary Home return. Existing retry/conflict, snapshot-cover, offline pending-row/deduplication and finished-log autosave assertions remain. Offline phone Done explicitly checks Home at zero with visible tabs despite its History load error.
- Responsive assertions cover populated program workout, reference/variant, active log and recap at 360×800, 390×844, 760×1024, 761×1024, 1366×768, 1440×900 and 1920×1080, plus 390px with 200% root text. They retain explicit hashes, canonical field identity/value and visible focus, reject horizontal overflow and route-data reloads from resize, check compact parent size/ellipsis and desktop header/full contextual trails, and retain an exact unsaved variant name node/value/caret/focus through 761/390. The existing 660px Focus test adds durable images in both motion settings before its invalid-draft/composition/viewed-ref checks.
- Additional affected callers were repaired only after the first full run demonstrated their obsolete nested-tab assumptions: `workout-home.spec.js` uses `Back to Home` from the active logger; `profile.spec.js` measures the visible `Back to User` link instead of the hidden User tab; `root-cache-refresh.spec.js` returns via `Back to Home` before Library. Existing target-size, overflow, feedback/reservation, navigation and snapshot/offline assertions remain. No assertion in `workout-logger.spec.js` was removed or weakened.

### Commands and actual results

Workspace: `C:/Users/NicoF/.codex/worktrees/eb87/gym-program-builder`, Windows PowerShell; npm/npx use `.cmd`. Required completion commands explicitly return native `$LASTEXITCODE`.

| Command | Actual result |
|---|---|
| `npx.cmd playwright test e2e/nested-mobile-navigation.spec.js --grep 'parent Home return'` before the owning fix | RED: 1 failed; actual restoration counts `[0,52]`, expected all 52 |
| `npx.cmd playwright test e2e/nested-mobile-navigation.spec.js e2e/workout-home.spec.js e2e/workout-recap.spec.js e2e/workout-offline.spec.js e2e/workout-logger.spec.js e2e/mobile-page-memory.spec.js` | GREEN: 63 passed, 3 existing skips (2.2m) |
| `npm.cmd test` | Exit 0: 519 passed, 0 failed, 0 skipped (11607.1104ms); Task 4's temporary SQLite EBUSY cleanup did not recur |
| First `npm.cmd run test:e2e` | Exit 1: 811 passed, 7 existing skips, 2 failed (18.8m); Profile hidden-tab measurement and root-cache-refresh hidden Library activation, both callers corrected as above |
| `npx.cmd playwright test e2e/profile.spec.js e2e/root-cache-refresh.spec.js --grep 'profile touch layout|refresh failure on a long list'` | Exit 0: 2 passed (7.1s) |
| Final `npm.cmd run test:e2e` | Exit 0: 813 passed, 7 existing skips, 0 failed (16.4m); log `task-5-e2e-final.log` |
| `npm.cmd run build` | Exit 0: `Built public assets.` |
| `git diff --check` | Exit 0, no output |

Logs are preserved in `.superpowers/sdd/2026-11-15-nested-mobile-navigation/`: `task-5-restore-red.log`, `task-5-integration-green.log`, `task-5-unit.log`, `task-5-e2e.log`, `task-5-callers-green.log` and `task-5-e2e-final.log`. Earlier new-test runs had setup/locator failures (a blank chip's exact name, scrolling before first-page load, a variant deep link's Edit button, the permitted heading focus fallback and a reference revision bumped by variant creation); they are recorded in the task report, with no artificial product changes inferred from them.

Seven pre-existing full-suite skips remain; no skips were added. Active phone workouts use Focus, whose input/action/note and long-note suites cover those presentations. The skipped regular-tracker cases are:

- `workout-logger.spec.js`, `logger at 390px`: `placeholders and ✓ log a set in one tap`; `inputs, steppers and RIR`; `swap, add, remove and reorder exercises`.
- `workout-notes.spec.js`, `390 touch`: `exercise notes open, save, reopen, clear and carry over as last time`; `set notes save on input, finish on Enter, reopen and clear in the aligned note slot`; `warm-up notes use distinct labels and resume as saved text`; `removing a set with an open note restores the next menu and leaves no orphan input`.

The pre-existing `NO_COLOR`/`FORCE_COLOR` runner warning remains. Early redirected npx runs also returned PowerShell wrapper exit 1 with a `NativeCommandError` stderr record despite a passing Playwright summary; required completion commands explicitly preserve the native exit status. No warning suppression or related product change was added.

### Browser layout and motion inspection

Durable evidence directory: [assets/nested-mobile-navigation](assets/nested-mobile-navigation). It contains 34 intentional PNGs. Each screen prefix `program-workout`, `reference-variant`, `active-log`, `recap` has suffixes `360x800`, `390x844`, `760x1024`, `761x1024`, `1366x768`, `1440x900`, `1920x1080` and `390-enlarged`. The additional two files are `focus-390x660-reduce.png` and `focus-390x660-no-preference.png`.

All populated responsive renders were inspected through per-screen contact sheets, then representative full-size images. Phone parent links stay quiet, visible and one-line; the long program parent ellipsizes with its complete accessible name. Desktop retains its original header and full trail. Reference/variant captures filter to the unique fixture and start at document top so the chrome and populated variant appear together. Recap retains Home and truthful saved state without reviving active controls. At enlarged text the page grows vertically without horizontal overflow; later content remains reachable by scrolling.

The [660px reduced-motion Focus image](assets/nested-mobile-navigation/focus-390x660-reduce.png) and its normal-motion counterpart show Home, tags, Last time, Best, Complete inside the feed and the existing toolbar ending at the viewport bottom without tabs or a stale gap. The controller independently inspected that 660px render and the [desktop reference/variant render](assets/nested-mobile-navigation/reference-variant-1440x900.png), confirming those visible conditions. Existing normal/reduced-motion automated checks retain the 75/100ms nested fade, 220/180ms root movement and immediate final-state behavior; screenshots alone do not establish motion timing.

The approved spec and existing product styles controlled the UI review; no new art direction was introduced. Historical `assets/mobile-library-navigation` PNGs regenerated by tests are restored individually before commit; only the new nested evidence is intentional.

### Final review fixes

- Focus toolbar: nested routes give `.focus-toolbar` `padding-bottom:env(safe-area-inset-bottom)`; `measureFocus` already reads the toolbar border box, so the inset is reserved once. New 660px test at a simulated 20px inset: border box ends at 660, content box at 640, Complete visible.
- Deferred Home scroll: commit and pager restore now scroll to 0 when saved Home memory exists; the History callback still restores the saved Y. New test (cold History failure, return from User) fails without the change and passes with it.
- Nested `.panel` inset padding excludes `.panel--flow` and `.program-grid .panel`.
- Nested non-Focus pages keep the bottom inset in body padding and `#app` minimum height (Resume's inline padding overrides it, no double count); tests updated to 0/20.
- The no-reload request filter also matches a bare `/api/catalog` GET.
- Commands: focused Playwright set (nested, mobile-navigation, layout, focus-fit, focus-integration, save-controls, page-memory, workout-home, recap) 113 passed; padding-related specs (disclosure, profile-hints, reorder-regressions, logger, set-row, start) 57 passed, 3 skipped; `npm test` 519 pass; build and `git diff --check` clean. Inset values are simulated arithmetic, not device evidence.

### Remaining limits

- Physical-phone safe areas, keyboard transitions and momentum remain **pending (user)**. Viewport/inset simulation, touch-capable Chromium and hybrid browser checks are not physical-device evidence.
- Deployment verification remains **pending (user)**; nothing was deployed and no migration or seed command was run.
- The separate Focus direct-footer/round-page design is not integrated here. The actual-app 660px evidence covers the existing overview toolbar and surviving viewed ref.
