# Focus set page verification

Design: [specification](../specs/2026-11-12-focus-set-page-design.md). Plan: [implementation steps](../plans/2026-11-12-focus-set-page.md).

## Part 1: small fixes (2026-11-12)

Commits: `bf4ff7d` (`5+`), `e3817b7` (no warm-up RIR), `0168132` (note icon and header-row set note), and the Task 4 commit (RIR border, docs). Part 3 (tags) is not yet implemented; this file is extended as it ships.

### Commands (localhost, Chromium via Playwright)

- `npm test`: 486 passed, 0 failed.
- `npm run build`: passed (`Built public assets.`).
- `npm run test:e2e` (full, one invocation, 14.6 min): 612 passed, 7 skipped, 2 failed. Both failures are unrelated to Part 1 and pass in isolation:
  - `e2e/program-analysis-panel.spec.js:53` failed with `page.goto: Test timeout of 20000ms exceeded` (the dev server stalled on the initial load). Re-run alone once and with its whole file three more times: passes.
  - `e2e/root-cache-refresh.spec.js:110` failed on a 2px versus 1px heading `y` offset between the cold and loaded Catalog heading (a layout comparison in a spec Part 1 does not touch). Re-run alone once and with its whole file three more times: passes.
  - The suite rewrites `docs/superpowers/verification/assets/mobile-library-navigation/*.png` as a side effect; those changes were reverted, not committed.

### RIR border (Task 4)

- Added `'a deselected RIR option returns to the plain border on touch'` (390x844, `hasTouch`, `isMobile`) and `'a suggested RIR option keeps a dashed non-accent border'`.
- **The bug did not reproduce in emulation.** Before the CSS change the touch test already passed: after `tap()` on option 2 twice, `aria-pressed` is `false` and the border is `rgb(44, 55, 70)` (`--border`). So emulation did not reproduce the report (the cause on a real phone is unconfirmed), and the tests stay as guards. The fix the spec asks for was applied regardless: the hover rule is wrapped in `@media (hover:hover) and (pointer:fine)`, and `:focus-visible` on an option is a `--text` ring (2px, offset 1px) instead of the inherited accent outline. Only `[aria-pressed="true"]` uses the accent border.

### Defect found and fixed during inspection

The `note` icon from `0168132` was an `svg` inheriting the global `svg{display:block}`, so in the regular tracker and finished logs the saved set note, saved exercise note and exercise Add note rendered the icon on its own line above the text (visible in the 390px screenshot). The rule in `style.css` now sets `display:inline-block`. Covered by `'a saved set note shows the note icon inline before its text'`; with the fix reverted it fails (`Expected: "inline-block"`, `Received: "block"`).

### What was inspected

A scratch Playwright script (not committed) built a populated log (two warm-ups, one with an old stored RIR of 3 and a saved note; three working sets, one with a saved note; a saved exercise note) and measured geometry plus screenshots, with `reducedMotion: reduce` from the e2e config.

- **Menu column on warm-up rows (finished log, regular tracker).** At 360, 390 and 412px touch and at 1366, 1440 and 1920px fine pointer, the warm-up row's set menu button has the same x position as the working rows' menus (293/323/345px left edges at 360/390/412; 934px at 1366), is 44px wide on touch and 32px on fine pointers, and stays inside the card. At 360 and 390px the layout is below 22rem and the menu sits on line 2 under the done column; at 1366px and above (container of 35rem or more, fine pointer only) it is on the single line. No row overflowed horizontally. At 200% text (360 and 390px) the same held and the page had no horizontal scroll.
- **Saved note icons.** After the fix the `note` icon is 15px, inline before the text and vertically centred with the first line for the saved set note and the saved exercise note, in the regular tracker (360, 390, 412, 1366, 1440, 1920px, 200% text at 360) and in Focus (saved set note, 360 to 412px). The Focus exercise-note button and header workout-note indicator also use the icon.
- **Warm-up Focus cards.** At 360x740, 390x844 and 412x839 touch, the warm-up card shows the set-note button inside `.focus-context` (44x44px, context row 44px tall) with no RIR strip, and no horizontal page scroll. The button is correctly absent on a card whose set already has a note. At 200% text (360 and 390px) the button stays 44x44 inside the context row, which grows to about 67px.
- **Short feed with notes.** At 390x844 a working set with both an exercise note and a set note makes the viewed card taller than the feed; the saved set note then sits below the fold with Complete pinned and is reached by scrolling the card (existing sticky-Complete behaviour for oversized cards, not a Part 1 change).
- Screenshots were viewed at 390px (finished and Focus), 360px at 200% text (finished and Focus) and 1366px; the other widths were checked by measurement only.
- Reduced motion is the e2e default, so every run above was under reduced motion.

### Not inspected

- No inspection of 1366x768, 1440x900 and 1920x1080 for the Focus feed itself (Focus is phone-only; those sizes show the regular tracker, which was inspected as above at 1366, 1440 and 1920 widths with tall viewports).
- Hybrid (touch plus mouse) devices.
- Real devices of any kind.

### Phone checks

- RIR border after tapping, deselecting and tapping another option on the user's phone: `pending (user)`.
- Set-note button on the header row feels right to hit with a thumb, on working and warm-up cards: `pending (user)`.
- `5+` label and Last time `@5+` read correctly on the phone: `pending (user)`.

## Part 2: input (2026-11-12)

Commits: `23b7e16` (Weight steps in Workout actions), `799d805` (Reps caption, help row and `kg steps` select removed), `d623ab3` (ruler gesture, tap nudges, ruler heights, Part 2 docs) and the review fix (a vertical swipe on a ruler never nudges).

### Commands (localhost, Chromium via Playwright)

- `npm test`: 488 passed, 0 failed.
- `npm run build`: passed (`Built public assets.`).
- `npm run test:e2e` (full, one invocation, 14.9 min): 626 passed, 7 skipped, 0 failed. The tap-nudge motion change (a tap no longer adds the settle transition) landed during that run, so the ruler and every Focus spec were re-run afterwards: `workout-ruler`, `workout-focus-integration`, `workout-focus-fit`, `workout-focus-motion`, `workout-focus-view`, 82 passed. The suite's rewrites of `docs/superpowers/verification/assets/mobile-library-navigation/*.png` were reverted, not committed.

### Ruler gesture (Task 7)

- RED before the change (`npx playwright test e2e/workout-ruler.spec.js`): `'a drag that drifts vertically keeps adjusting'` wrote nothing (the gesture was dropped once the first movement leaned vertical), `'tapping left or right of centre steps once'` wrote nothing, `'taps respect limits and off-grid values'` found no `.workout-ruler-nudge`, and the strip's `touch-action` was `pan-y pinch-zoom`. `'a cancelled press writes nothing and a cancelled drag settles on a step'` already passed (drags write live per step) and stays as a guard.
- `'a swipe that starts on a ruler never scrolls the feed'` (`e2e/workout-focus-integration.spec.js`): the brief named `Input.synthesizeScrollGesture` with `gestureSourceType:'touch'`, but in this headless Chromium it dispatched `touchstart` and no `touchmove`, so it scrolled nothing anywhere (title included) and could not tell the cases apart. The test drives raw CDP `Input.dispatchTouchEvent` (start, ten 20px moves, end) instead and reads the furthest `scrollTop` (snapping returns a short swipe to the same card). With `touch-action:pan-y pinch-zoom` restored temporarily it fails (`Expected: 0`, `Received: 185`); with `none`, the ruler swipe leaves the feed at 0 and the title swipe still scrolls it (about 185px).
- Review fix: as first committed, a release after a long vertical swipe with little horizontal travel counted as a tap and nudged one step (the swipe test above wrote `2.5` into the empty weight; a 40px vertical mouse swipe wrote `82.5`). The press now records vertical travel; a release with no drag after more than 8px vertically writes nothing, while horizontal movement after vertical drift still starts a drag. Covered by `'a vertical swipe without horizontal travel writes nothing'`, the swipe test's new no-write assertion, and `'a diagonal touch drag on a ruler holds until release'` (CDP touch: 120px left with 100px downward drift from 80 ends at 90 with the feed at `scrollTop` 0, so the gesture is not released mid-swipe on touch). The first two fail on `d623ab3`; the diagonal test passes on both as a guard. After the fix, `npm run test:e2e` (one invocation, 15.0 min): 627 passed, 7 skipped, 1 failed. The failure was `workout-focus-integration.spec.js:102` (`with motion › a height change while typing re-anchors the viewed set…`, anchor 1 instead of 2 within 5s after a viewport resize). It clicks a reps input and resizes, never touching a ruler, and passed 5/5 alone (`--repeat-each=5`) and with its whole file (17 passed); treated as a timing flake, not on the previously known list.
- Ruler heights (`e2e/workout-focus-fit.spec.js`): 56px at 412x839 (feed 598px), 48px at 412x760 (feed 519px), 44px at 360x660 (feed 419px). The whole fit and rhythm matrix passes unchanged with the taller rulers, including the `false` peek rows at 360x660, 393x659 and 412x839.

### What was inspected

A scratch Playwright spec (not committed) opened a populated active workout with Last time and Best (touch, `isMobile`) and measured the viewed card.

- **Viewports.** At 360x660, 390x664, 393x659, 412x760, 412x839 and 430x932 both rulers have the tier height above (44/44/44/48/56/56px), each chevron cap is 20px wide and flush with its strip end, Complete is inside the feed, and neither the page nor the card overflows horizontally. Screenshot at 390x664 viewed: the chevrons sit in opaque `--surface` caps so tick labels slide under them instead of colliding (the first transparent version overlapped `57.5` and `12`, fixed before commit).
- **200% text** (360x660, 390x664): rulers stay 44px with intact caps, inputs 70.4px, the card goes peekless with Complete pinned inside the feed, no horizontal overflow; screenshot at 360 viewed.
- **Touch and motion** (390x844): a touchscreen tap at the left quarter of the weight ruler from the 62.5 placeholder wrote 60, a right-quarter tap wrote 62.5, and a diagonal touch drag (80px left, 96px down) wrote 70 with the feed still at `scrollTop` 0. With reduced motion neither a tap nor a drag release adds `is-settling`; without it a tap is still instant (no `is-settling`) and only a drag release uses the existing 150ms settle.
- Desktop sizes show the regular tracker, where no ruler is mounted; not re-inspected.

### Not inspected

- Real devices of any kind, hybrid input, and browsers other than Chromium.
- Whether `touch-action:none` on the strip was in fact the cause of the reported drop on the user's phone (the spec's hypothesis); emulation shows only that a swipe from the strip no longer scrolls the feed.

### Phone checks

- Grabbing a ruler with a thumb on the first try: `pending (user)`.
- A full swipe across a ruler without lifting never lets go, including when the thumb drifts vertically: `pending (user)`.
- Tapping either side of the needle nudges one step, and stops at the limits: `pending (user)`.
- A swipe that starts on a ruler never scrolls the feed by accident, while the rest of the card still scrolls: `pending (user)`.
- Logging a whole workout with rulers and taps only: `pending (user)`.

No physical-device or deployment verification is claimed; everything above is localhost Chromium emulation.
