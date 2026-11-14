# Home and history verification

Spec: [Home and history](../specs/2026-11-12-home-history-design.md). Plan: [Implementation plan](../plans/2026-11-12-home-history.md).

Implemented and verified locally on 2026-11-14. Not deployed. All browser checks use Chromium emulation, not a physical phone.

## Behavior covered

- The shared History loader distinguishes refresh errors from older-page errors, publishes in-flight paging, prevents concurrent pages, preserves appended rows across refresh races, and clears a page error after a successful retry or refresh.
- Home reuses the desktop History rows with nested History/day/workout headings, pending finishes first, independent load/refresh errors, accessible Retry/Load more, focus retention, automatic paging and continued loading when a short page still fits a tall viewport.
- The cover and History share the first-page cache while retaining independent error and Retry behavior. Auth changes clear rows, extent and scroll. Returning from a workout restores the loaded extent before scroll without overriding interaction.
- Three mobile tabs and swipes use Home ↔ Library ↔ User. Workouts select Home; mobile `#/workouts` opens and focuses History with a single history entry and canonical `#/home`. Explicit desktop routes survive resize. Home re-taps retain the view and tab focus, make no API requests, and scroll smoothly or instantly with reduced motion.
- Finish/Discard/saved-copy-gone use the controller's `onExit`; recap Done and Delete use the same app exit. Mobile forgets Home memory and returns at the top; desktop keeps Workouts. An offline phone finish shows its pending row and the section error while the cover remains usable; reconnect removes the pending tag.

## Commands and results

- Loader unit tests: 8 passed, including observed failures before implementation.
- History view unit test: passed after its observed missing-module failure.
- History view plus desktop History browser checks: 9 passed at Task 2.
- Home integration, view, page-memory and swipe browser checks: 29 passed at Task 3.
- Navigation/router unit checks: 8 passed after three observed failures; Task 4's complete unit gate: 502 passed.
- Navigation, resize, smooth/reduced-motion Home re-tap and desktop browser checks passed. The save-control group passed all 9 checks across three repeated runs after its helper was updated for the changing Choose action.
- Exit/memory/controller unit checks: 33 passed after observed missing `forget`/`onExit` failures. The recap return test first reproduced `scrollY:696` instead of `0`, then passed after the shared exit was implemented.
- Finished-edit, offline and recap browser checks: 20 passed, covering phone and desktop Delete and desktop Finish.
- `npm run build`: passed.
- `npm test -- --test-concurrency=1`: **504 passed**, 0 failed. The standard parallel run passed 503 and failed only the unchanged Windows database cleanup test; isolated `node --test test/repository.test.js` passed all 3. No test was skipped and no runner configuration changed.
- Initial complete `npm run test:e2e`: **698 passed, 7 existing skips, 2 failed**. Both failures were older phone tests expecting `#/workouts` after Finish/Done. After migrating those assertions (desktop unchanged), `npx playwright test --last-failed`: **2 passed**.
- After the review fixes, `npm test -- --test-concurrency=1`: **504 passed**, 0 failed; `npm run build`: **passed**.
- Final complete `npm run test:e2e -- --retries=1`: **703 passed, 7 existing skips**, exit 0, **no retry used** (13.1 minutes).

The unchanged SQLite repository test intermittently fails during Windows temporary-database cleanup (`EBUSY`, after a concurrent write timeout). This also occurred in the clean baseline; passing reruns and any final occurrence are recorded with the final gates. No database or server changes were made for this feature.

The post-review broad browser run also hit the unchanged Catalog mutation-focus test once; that case passed the earlier full run and all **3/3** isolated repeats. The interrupted run had no Home/History regression. The final complete browser gate therefore permits one CLI retry (`npm run test:e2e -- --retries=1`), with no Catalog code, test or runner-configuration change. Any retries are reported in the final result.

## Final review

One fresh-context, read-only review found three Important issues and no Critical or Minor issues. All four regression cases first failed and then passed: Retry focus through loading/failure; Load more focus through updates and the final-page handoff; fast-page loading stopping outside the near-end zone; and desktop page-error feedback/Retry. The corrected History view and desktop History group passed **14/14** browser tests, followed by the successful complete regression gate above. No review findings remain open.

The controls now retain their nodes and focus while loading (`aria-disabled` with a guarded action). Removing the final Load more deliberately focuses the first new row only when that control owned focus. Automatic paging measures the current list end after each render rather than trusting the previous observer delivery. Desktop maps `error || moreError` to both its existing surface and inline message. No dependencies or abstractions were added. The reviewer set aside only the unchanged Windows SQLite cleanup issue, retained with the documented serial-test workaround.

## Visual inspection

Used the real Home and History view modules and bundled CSS/photos in a browser fixture, with touch enabled and reduced motion, for a recommendation, Resume, an empty history and 45 workouts at 360×660, 390×844 and 412×915. Also checked doubled text at 360, 390 and 412px, including the bottom of the 45-row list. No horizontal overflow was measured. Existing app browser checks exercise the recommendation, Resume, short viewport, enlarged text, actual navigation and returned workout paths.

The measured token is **`--home-history-peek:112px`**, adjusted from the plan's initial 72px. At 390×844, default text, with a recommendation or Resume:

| Element | Top | Bottom | Height |
| --- | ---: | ---: | ---: |
| Cover | 71.39px | 620px | 548.61px |
| History heading | 696px | 720px | 24px |
| First workout row | 769px | 847px | 78px |
| Bottom tabs | 788px | 844px | 56px |

The heading is whole and the first row crosses the tab edge. The cover retains its 340px minimum on the short/enlarged-text checks. The History section has a viewport-sized minimum so even an empty or unsettled section can scroll its heading to the top.

Screenshots: [360px, 45 workouts](assets/home-history/visual-360-long.png), [390px recommendation](assets/home-history/visual-390-recommendation.png), [412px Resume](assets/home-history/visual-412-resume.png), [390px doubled text, end of history](assets/home-history/visual-390-enlarged-end.png).

Desktop browser coverage includes 1366×768, 1440×900 and 1920×1080. The four desktop links, desktop Workouts markup/messages and logger behavior are retained; only an explicit Home URL shows the new History section there, as specified.

## Phone checks

- Peek on a physical phone: **pending (user)**.
- Comfort of scrolling past the cover: **pending (user)**.
- Production/deployment verification: **not performed**.
