# Workout flow verification

Design: [specification](../specs/2026-11-12-workout-flow-design.md). Plan: [implementation steps](../plans/2026-11-12-workout-flow.md).

## Part 1: grouped feed (2026-11-12)

Commits: `729dfc1` (pure exercise groups and pinned-block fit), `1ca7fcd` (pinned exercise block), `88c48d0` (note editing ends when the field closes), `79ba9d0` (note editor cap, focus margins, keyboard clamp, docs), and the fix-round commit (set 1 reachability test, precise docs). Implemented on localhost only; not deployed.

### Commands (localhost, Chromium via Playwright)

- `npm test`: 494 passed, 0 failed. The first run had one failure, `test/repository.test.js:30` with `EBUSY: resource busy or locked, unlink …test.db` (a Windows file lock on the temporary SQLite file). That file passes on its own (3/3), and a second full run passed 494/494.
- `npm run test:e2e` (full, one invocation, 15.5 min): 649 passed, 7 skipped, 0 failed. The suite rewrites `docs/superpowers/verification/assets/mobile-library-navigation/*.png` as a side effect; those changes were reverted, not committed.
- `npm run build`: passed (`Built public assets.`).

### Task 3 tests

- `e2e/workout-focus-view.spec.js`: `an open exercise note stays pinned and capped` (at 390x740, because at 390x844 the logger's own 14rem cap is already below 40% of the feed), `tight screens pin only the name row`, `a focused field clears the pinned block`, and `structure changes keep the group and the viewed set` (a guard).
- `e2e/workout-focus-fit.spec.js`: `200% text pins only the name row and keeps Complete reachable at the second set`, and `opening the keyboard at the second set at 200% text keeps the reps input clear of the pinned block`. The keyboard copy runs at 200% text because with default text the feed never drops below 180px, so shrinking to 390x380 (or 330, 300, 280) leaves the input clear without the clamp (measured: name-only, pin 44px, input top 73.6px).
- RED before the change: the cap test failed (editor 224px against a 189px limit), the focus-margin test failed (input top 293.0px under the details' bottom at 312.8px), and the keyboard test failed (input 13px under the name row). The structure, tight-screen and 200% set-2 Complete tests already passed, as Task 2's design predicted. All pass after the change.

### What was inspected

A scratch Playwright script (not committed) ran the real app against a populated log: a straight exercise with one warm-up and three working sets, a long name (`Single-arm incline dumbbell chest press with a long name`), brand and two focus tags and a 260-character exercise note, followed by a superset of two three-set exercises. At each viewport it scrolled to every set's snap position and measured the geometry. Screenshots are in the git-ignored `.superpowers/sdd/2026-11-12-workout-flow/`.

- 360x660, 390x664, 412x760, 390x844 and 412x839, plus the short tiers 360x560 (feed 319px) and 390x500 (feed 259px), at default text with `reducedMotion: reduce`: no horizontal overflow, the name row is at the feed top (0px) on every set, each non-first row rests exactly under the pin (0px), and every set's Complete is inside the feed. The straight exercise falls back to name-only at 360x660, 390x664, 412x760 and both short tiers (the long note pushes the block too tall), and keeps the whole block at 390x844 and 412x839. At boundaries, the next group's name row is either fully visible (44/44px) or absent.
- 200% text at 390x664 and 360x740: every group is name-only. Every set except the group's first shows through Complete. See the observation below.
- 390x844 with `reducedMotion: no-preference`: same geometry as reduced motion. Pinning adds no animation.
- Open exercise-note editor at 390x664 (feed 423px), filled with 960 characters: the block stays whole (not name-only), the textarea is 169.2px (40% of the feed), it scrolls inside, and the warm-up's Complete stays visible beneath.
- 1366x768, 1440x900 and 1920x1080: Focus hidden, regular tracker shown (3 exercise cards, no groups).

Not inspected: touch scrolling feel and momentum. Emulation cannot show them.

### First set under the name-only fallback (review fix round 1)

At 200% text, the first set of a name-only group whose details are tall (485px here: long name, tags, a 260-character note, history) snaps to the group's top, with the whole block above it (`fitGroup` row 0 offset = name + details). With a 319–395px feed, that set's card starts below the fold, so its Complete is off-screen at the snap position. By decision this stays: snapping row 0 under the name row would make the details unreachable under mandatory snap. Because the set's snap area is larger than the snapport, the user can scroll within it.

Check: `200% text with tall details lets the user scroll to set 1 Complete and back to the details` (`e2e/workout-focus-fit.spec.js`, 390x664 at 200%, one line of tags, a 279-character note, history). Measured: at the snap position `scrollTop` is 0 and Complete is outside the feed. Mouse-wheel steps of 60px, with 250ms to settle, reach `scrollTop` 300. After a further 600ms, `scrollTop` is still 300 (Chromium did not snap back), Complete is inside the feed (the viewed card's sticky Complete) and set 1 is still `.is-viewed`. Wheeling back up returns the details to directly under the name row. Touch-momentum behaviour on a real phone is `pending (user)`.

### Phone checks

- Pinning under momentum scrolling (block stays put while sets snap underneath; it leaves with the group's last set): `pending (user)`.
- Scrolling within a tall first set (200% text or a long note) to its Complete without snapping back: `pending (user)`.
- The open exercise-note editor and a focused field with the keyboard open, on a real phone: `pending (user)`.

## Part 2 task 5: compact rows and actions menu

Tests in `e2e/workout-overview.spec.js`: `the actions menu holds every exercise command`, `rows show reorder, name, tags and actions; pairs show one header`, `six exercises with four sets fit without scrolling at 390x844`, `removing an exercise from its menu keeps focus in the sheet`; the other overview tests, `e2e/workout-logger.spec.js` (overview swap) and `e2e/workout-focus-integration.spec.js` (overview warm-up) now open `Actions, {name}` first. RED before the change: 11 of the 18 overview tests failed (no `Actions, ...` buttons).

### What was inspected

A scratch Playwright script (not committed) rendered the sheet populated (a tagged straight exercise with a done set, a superset pair, a zero-set exercise) at 360x800, 390x844 and 412x915 on touch, 1366x768 with a fine pointer and 390x844 with reduced motion: no horizontal overflow in any (scrollWidth equals clientWidth), the actions button is 44px on touch and 32px on the fine pointer, tags sit muted beside the name, the pair shows one header with `A1`/`A2` members. At 390x844 with the root font size at 200% the sheet still had no horizontal overflow; the superset summary wraps to three lines and the tags line wraps under the name. That 200% check is a font-size override, not browser text zoom. Screenshots are in `.superpowers/sdd/2026-11-12-workout-flow/` (git-ignored). The density test passes at 390x844 (six exercises, four sets each, no scrolling) by arithmetic and measurement in that test; no spare margin was measured beyond the assertion.

Not inspected: real text zoom, the menu popup under the 200% font override.

### Phone checks

- Chip tapping accuracy and reading the sheet at a glance on a real phone: `pending (user)`.

## Part 3 task 6: animated jumps (travel)

Tests in `e2e/workout-focus-motion.spec.js` (motion on): `an overview chip travels through the sets in between` (real overview open, chip click, travel after the sheet closes), `Back to current travels too`, `a touch during travel stops at a set`, `an interrupted travel never sticks` (suspend and target removal mid-travel), `reduced motion jumps at once`; `warmup completion advances…` now polls the viewed set. RED before the change: the chip and Back to current tests failed (viewed set changed at the start; Back to current was instant) and the touch test ended on the target.

Headless Chromium does produce intermediate scroll samples for programmatic smooth scrolls (the tests assert at least three between start and end), so the Step 2 fallback was not needed. The browser sets the duration; how long jumps feel against snapping on a real phone: `pending (user)`.

Known flake, not from this task: `e2e/workout-focus-view.spec.js` `opening a long exercise note keeps the viewed set anchored` misses its 2px tolerance by 1px in about half of runs, on HEAD 487bfe3 before this change as well.
