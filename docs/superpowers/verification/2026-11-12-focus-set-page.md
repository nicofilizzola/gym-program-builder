# Focus set page verification

Design: [specification](../specs/2026-11-12-focus-set-page-design.md). Plan: [implementation steps](../plans/2026-11-12-focus-set-page.md).

## Part 1: small fixes (2026-11-12)

Commits: `bf4ff7d` (`5+`), `e3817b7` (no warm-up RIR), `0168132` (note icon and header-row set note), and the Task 4 commit (RIR border, docs). Parts 2 (input) and 3 (tags) are not yet implemented; this file is extended as they ship.

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

No physical-device or deployment verification is claimed; everything above is localhost Chromium emulation.
