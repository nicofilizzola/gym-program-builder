# Fluid mobile navigation verification

Branch: `fix/fluid-mobile-navigation`, based on `dfea147`. Local verification only; no deployment, production session or physical-device testing is claimed.

## Behavior

- Root swipes commit their destination shell and settle without waiting for required GETs. Heavy list updates wait until motion finishes; another destination remains available during pending loads.
- Six auth-lifetime memory resources cache actual data, with successful-empty handling, in-flight deduplication, mutation invalidation and epochs rejecting obsolete reads. No storage/API/schema change.
- Library/Catalog updates preserve focused controls and filter nodes. Catalog defers background replacement during dialogs/composition. Home and workout ownership/mirrors remain separate.
- History independently reconciles its visible extent and its first-page scheduling input. Start workout opens immediately; list results update independently and Blank works while lists are held. Unknown scheduling history suppresses recommendations.
- The cold loading placeholder reuses the destination's mobile page gutter, so the heading does not jump when content mounts. Refresh status is a pill pinned above the bottom bars.

## Timing evidence

Characterization before implementation: holding the Programs GET kept the gesture stage visible beyond 750ms; releasing the response allowed settlement. This confirms the network gate locally; it is not a production trace.

After implementation, the latency suite holds reads for at least 1,500ms and requires settlement within a 750ms allowance before release, accepts another navigation while held and rejects row mounting during settlement. Populated Catalog gesture timings (local Chromium, CDP CPU throttling):

| Run | CPU | Finger-down to dispatch | Release to settlement |
| --- | --- | --- | --- |
| Post-review focused | 1x | 166ms | 327ms |
| Post-review focused | 4x | 357ms | 250ms |
| Final full run | 1x | 176ms | 310ms |
| Final full run | 4x | 610ms | 280ms |
| Post-gutter focused | 1x | 162ms | 309ms |
| Post-gutter focused | 4x | 452ms | 241ms |

Settlement stays near the 220ms motion plus test overhead at 4x, independent of data. Dispatch under 4x varies (357–610ms) and reflects synchronous inert snapshot construction at finger-down; this is the remaining measurable cost and should only be optimized against a real-device profile.

## Independent review

One read-only whole-branch review (`dfea147..313f5b0`) found no critical issues and six important ones, each reproduced red before fixing (`ec5cfdc`):

1. Outgoing-page hydration published during a drag — publication now suspends for the whole drag/settle/rollback and applies the latest state afterwards.
2. Route commit reset the indicator before animating from the drag offset — commit no longer resets the active gesture's position.
3. Auth expiry left Catalog/History dialogs open over sign-in — modal owners are disposed on auth hiding.
4. Load more permanently suppressed a fresh History head — the fresh head reconciles with the appended tail; stale pagination cannot resurrect rows.
5. Mutation acknowledgements could repopulate a cleared auth cache — mutations are scoped to the auth lifetime that sent them.
6. Picker list updates during a failed template start were never replayed — the latest state is replayed when the sheet unlocks.

## Post-review findings

- The full browser run exposed an isolation bug in the new `workout-picker-latency` spec: an earlier test's active workout stayed in the running app after `resetWorkouts`, so Blank opened the in-progress prompt. Reproduced by running it after `workout-offline.spec.js`; fixed by reloading after the reset, the pattern existing workout specs use. Test-only.
- Screenshot inspection found the cold loading heading and Loading text flush against the screen edge (x=0), jumping to the 16px gutter when content mounted. Added a failing alignment test, then gave the placeholder and feedback the destination's mobile container padding.
- The refresh feedback (`Updating...`, `Couldn't refresh…` with Retry) was appended after the page content, so on a populated list it rendered below the fold. Following the recommended option, it is now a compact status pill pinned (sticky) above the tab bar and any active workout bar (`--workout-bar-space` from `workout-bar.js`), returning to normal flow at the list end so the last rows stay reachable. It shows and hides instantly: it reports a routine background refresh already delayed 250ms against flashing. A failing test with 10 programs, with and without an active workout, now passes.

## Test results

- Unit (final): ordinary `npm test` 455/456 — only `repository.test.js` failed deleting its temporary SQLite file (`EBUSY`), the pre-existing Windows issue that reproduces on the base revision; an earlier post-review ordinary run passed 456/456. With the temporary GC preload (ignored scratch, not shipped) 456/456. Database code unchanged.
- Build and `git diff --check`: pass.
- Full browser suite, one invocation after the review fixes: 509/512. Failures: two `profile.spec.js` touch cases that hard-code `baseURL` 127.0.0.1:3199 and therefore cannot reach the isolated server (both pass 2/2 from a port-adjusted scratch copy), and the picker isolation bug above (fixed; 11/11 with the preceding offline spec). This is full-run-plus-targeted-reruns evidence, not one green invocation.
- After the gutter fix (before pinning the status): focused latency/cache/memory, navigation, swipes, active-program, recovery, Catalog, Home, start-sheet, offline and picker suites 164/164.

- After pinning the status: the same focused suites plus `workout-bar` and `workout-start` 168/168; unit 456/456 with the GC preload; build and `git diff --check` pass.

Screenshots (390px): `assets/fluid-mobile-navigation/390-cold-loading.png` (held Programs GET), `390-cached-refreshing.png` (cached rows during a held refresh) and `390-refresh-failed.png` (503 refresh; pinned status with Retry).

## Verification environment and limits

Windows, Node 24, Playwright Chromium. Concurrent worktrees used the shared port 3199 (and later 3299), causing stale-server results and connection errors. Checks used an ignored copy of the same dev server and an ignored Playwright config with identical options on an unused port (3299, then 3417). Fixture Origin headers remain accepted by the existing configured-origin/browser-alias API policy. No tracked server or test configuration changed.

Not verified: physical iOS Safari/Android devices, real network conditions and any preview or production deployment.
