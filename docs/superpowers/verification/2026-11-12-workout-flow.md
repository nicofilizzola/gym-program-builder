# Workout flow verification

Design: [specification](../specs/2026-11-12-workout-flow-design.md). Plan: [implementation steps](../plans/2026-11-12-workout-flow.md).

## Part 1: grouped feed (2026-11-12)

Commits: `729dfc1` (pure exercise groups and pinned-block fit), `1ca7fcd` (pinned exercise block), `88c48d0` (note editing ends when the field closes), and the Task 3 commit (note editor cap, focus margins, keyboard clamp, docs). Implemented on localhost only; not deployed.

### Commands (localhost, Chromium via Playwright)

- `npm test`: 494 passed, 0 failed. The first run had one failure, `test/repository.test.js:30` with `EBUSY: resource busy or locked, unlink …test.db` (a Windows file lock on the temporary SQLite file). That file passes on its own (3/3), and a second full run passed 494/494.
- `npm run test:e2e` (full, one invocation, 15.5 min): 649 passed, 7 skipped, 0 failed. The suite rewrites `docs/superpowers/verification/assets/mobile-library-navigation/*.png` as a side effect; those changes were reverted, not committed.
- `npm run build`: passed (`Built public assets.`).

### Task 3 tests

- `e2e/workout-focus-view.spec.js`: `an open exercise note stays pinned and capped` (at 390x740, because at 390x844 the logger's own 14rem cap is already below 40% of the feed), `tight screens pin only the name row`, `a focused field clears the pinned block`, and `structure changes keep the group and the viewed set` (a guard).
- `e2e/workout-focus-fit.spec.js`: `200% text pins only the name row and keeps Complete reachable at the second set`, and `opening the keyboard at the second set at 200% text keeps the reps input clear of the pinned block`. The keyboard copy runs at 200% text because with default text the feed never drops below 180px, so shrinking to 390x380 (or 330, 300, 280) leaves the input clear without the clamp (measured: name-only, pin 44px, input top 73.6px).
- RED before the change: the cap test failed (editor 224px against a 189px limit), the focus-margin test failed (input top 293.0px under the details' bottom at 312.8px), and the keyboard test failed (input 13px under the name row). The structure, tight-screen and 200% Complete tests already passed, as Task 2's design predicted. All pass after the change.

### What was inspected

A scratch Playwright script (not committed) ran the real app against a populated log: a straight exercise with one warm-up and three working sets, a long name (`Single-arm incline dumbbell chest press with a long name`), brand and two focus tags and a 260-character exercise note, followed by a superset of two three-set exercises. At each viewport it scrolled to every set's snap position and measured the geometry. Screenshots are in the git-ignored `.superpowers/sdd/2026-11-12-workout-flow/`.

- 360x660, 390x664, 412x760, 390x844 and 412x839, plus the short tiers 360x560 (feed 319px) and 390x500 (feed 259px), at default text with `reducedMotion: reduce`: no horizontal overflow, the name row is at the feed top (0px) on every set, each non-first row rests exactly under the pin (0px), and every set's Complete is inside the feed. The straight exercise falls back to name-only at 360x660, 390x664, 412x760 and both short tiers (the long note pushes the block too tall), and keeps the whole block at 390x844 and 412x839. At boundaries, the next group's name row is either fully visible (44/44px) or absent.
- 200% text at 390x664 and 360x740: every group is name-only. Every set except the group's first shows through Complete. See the observation below.
- 390x844 with `reducedMotion: no-preference`: same geometry as reduced motion. Pinning adds no animation.
- Open exercise-note editor at 390x664 (feed 423px), filled with 960 characters: the block stays whole (not name-only), the textarea is 169.2px (40% of the feed), it scrolls inside, and the warm-up's Complete stays visible beneath.
- 1366x768, 1440x900 and 1920x1080: Focus hidden, regular tracker shown (3 exercise cards, no groups).

Not inspected: touch scrolling feel and momentum. Emulation cannot show them.

### Observation (Task 2 behaviour, not changed)

At 200% text, the first set of a name-only group whose details are tall (485px here: long name, tags, a 260-character note, history) snaps to the group's top, with the whole block above it (`fitGroup` row 0 offset = name + details). With a 319–395px feed, that set's card starts below the fold, so its Complete is off-screen until the user scrolls. Later sets are unaffected. Left for review.

### Phone checks

- Pinning under momentum scrolling (block stays put while sets snap underneath; it leaves with the group's last set): `pending (user)`.
- The open exercise-note editor and a focused field with the keyboard open, on a real phone: `pending (user)`.
