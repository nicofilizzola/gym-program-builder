# Mobile workout Focus verification

Implementation: 2026-11-07–10. Verification date: 2026-11-10. Branch: `feat/mobile-workout-focus`.
Design: [approved specification](../specs/2026-11-08-mobile-workout-focus-design.md).
Plan: [implementation steps](../plans/2026-11-08-mobile-workout-focus.md).

Tasks 1–7 were implemented in a Codex session that hit its context limit during Task 8. Tasks 8–10 were resumed in Claude Code from that session's transcript and the worktree state; the uncommitted Task 8 work was kept and completed.

## Local checks

- Baseline before Task 1: 437 unit cases passed.
- Final unit suite (`npm test`): 457 passed, 0 failed.
- `npm run build`: passed (`Built public assets.`).
- `git diff --check`: passed.
- Full browser suite (559 cases): 552 passed, 7 skipped, 0 failed. It ran as nine consecutive invocations against the final Task 9 commit (`d9daf38`), not one combined invocation. An earlier single full invocation was stopped by the host for low system memory; its late `Target crashed` failures were browser crashes, not assertions, and are not counted.
- The browser suite ran on port 3299 through a local, uncommitted `TEST_PORT` override, so it could run beside another worktree's suite; `e2e/profile.spec.js` hardcodes its base URL and ran on the default port 3199. Neither override is part of the branch.

## Fixes made while resuming

- **Toolbar under the tab bar.** The measured feed height was written to the logger root but shadowed by `.workout-focus`'s own `--focus-feed-height`, so the toolbar overlapped the bottom navigation at 390×844. Focus now owns `setFeedHeight`.
- **Long workout note.** The resize observer watched a `.workout-note` element that does not exist, and the measurement depended on page scroll; a 45-line note left a 180px feed. The height now uses document positions, observes the logger root, and falls back to the space under the sticky header.
- **Re-anchoring.** Height changes hold snapping and scroll tracking until the viewed set is re-anchored (breakpoint round trip and viewport height change are pinned in `e2e/workout-focus-integration.spec.js`).
- **Flaky Task 7 test.** `note opening cancels auto-next…` failed about half the time: Playwright's installed clock keeps flowing in real time, so the click could land after the 650ms advance. The test now pauses the clock; the product behavior was correct.
- **Legacy finish navigation** now skips navigating when its attachment was left (route change or sign-out) while flushing.

## Test coverage changes

Phone-width tests that asserted the compact active tracker were kept, not deleted: compact geometry moved to finished logs on phones (`finished set rows share one grid`, `finished member card content stays at least 300px`) or to active touch at 800px (two-line rows, warm-ups, superset frames, guided partner focus, reduced-motion note). Real-shell Focus tests were added for placeholders, one-tap done, RIR, comma decimals, invalid drafts across reload, `Enter reps`, overview swap, logout clearing Focus memory, and logger swipes never changing root destinations. A mutation check confirmed the logout test fails when the session clear is removed.

Recap coverage (`e2e/workout-recap.spec.js`, `test/workout-controller.test.js`): stay-finish before network settles, acknowledgement before `onFinish`, no publication after detach or sign-out, conflict restoring an active log never shows success, legacy navigation, honest post-pruning rows and skipped-exercise line, note hand-off and autosave, View workout and reload without replay, resize after recap, offline pending recap with read-only note and later sync, desktop Finish unchanged.

## Visual inspection

Populated screenshots ([assets/mobile-workout-focus](assets/mobile-workout-focus/)) at 360×740, 390×844, 390×844 with 200% root text, 760×1024 (Focus) and 761×1024, 1366×768, 1440×900, 1920×1080 (tracker), plus the overview and recap at 390×844. Every size had no horizontal overflow. At 360px and 200% text the first card is taller than the feed and scrolls internally, so the next-card preview is not visible; the specification allows this. At 760×1024 the card's controls anchor to the card bottom, leaving a gap under Best.

## Not verified

- **Real mobile device:** not performed. Native numeric keyboard, ruler and ticker gestures under real touch, pinch zoom, safe areas, snap feel and the typing-hidden tab bar have only Chromium viewport/touch emulation. Do not describe them as verified on a device.
- Motion was checked through automated animation assertions and still screenshots, not by watching it on a device.
- The independent review covered the whole branch but did not run tests; see below.
- Nothing was merged, pushed or deployed; no migration exists or was run.

## Independent review and fix pass

One fresh read-only reviewer examined `64669d0..279ed7d`: no Critical findings, two Important, eight Minor. Both Important findings were reproduced with failing tests and fixed in `fcaba77`:

1. **Animated card `min-height` drifted the viewed set.** A feed height change (for example the soft keyboard) animated every card's minimum height over 200ms while the viewed set had already been re-anchored. Chromium's scroll anchoring hides this; the test disables `overflow-anchor` to emulate iOS Safari and uses a tall viewport where `min-height` governs card height. The transition no longer includes `min-height`.
2. **Closing the overview took away a Focus-card exercise note.** Closing restored every borrowed note host to the hidden compact card. It now restores only notes inside the overview dialog.

After the fix pass: 457 of 457 unit cases; 562 browser cases, 555 passed and 7 skipped, again as nine consecutive invocations; the 26 mobile Library navigation evidence images that `e2e/mobile-navigation-layout.spec.js` rewrites on every run were restored. The eight Minor findings are deferred and listed in the final report; none loses data.

## Card fit (2026-11-10)

Plan: docs/superpowers/plans/2026-11-10-focus-card-fit.md. Reported on a physical Pixel 8: the first card cut off at Add set note, so Complete needed a scroll; DevTools presets showed more.

**Cause.** Card content was a fixed ~530–555px, the feed got the visible viewport minus ~320px of chrome, and `min-height: feed − 60px` let the card overflow. DevTools presets (412×915) omit browser UI; real Chrome on a Pixel 8 leaves roughly 750–790px. Measured before the fix (2 exercises, no history):

| Viewport | Feed | Card | Complete visible | Preview |
|---|---|---|---|---|
| 412×760 | 439 | 532 | no (cut at Add set note) | none |
| 390×844 | 523 | 554 | no (−3px) | none |
| 412×915 | 594 | 554 | yes | 39 |

**After.** `e2e/workout-focus-fit.spec.js` asserts Complete inside the feed, no horizontal overflow and a minimum preview: ≥24px at 360×660, 390×664 and 412×660 (360×660 measured 28px), ≥48px at 412×760, 390×844 and 430×932; Complete inside the feed with Last time, its note and Best at 412×760; and at 200% text (390×664) Complete is pinned on the viewed card only, never covering a focused input. Screenshots: `assets/mobile-workout-focus/fit-*.png` (360×660, 390×664, 412×760, 390×844, 200% text, Workout actions menu, completed set).

**Local checks.** `npm test` 476/476; `npm run build` passed; full `npm run test:e2e` 580 passed, 7 skipped, 3 failed. Two failures were a real regression (a long unbreakable catalog name widened the card through the new flex title row), fixed with `grid-template-columns: minmax(0,1fr)` and pinned by `a long unbreakable exercise name never widens the card`; the paired rerun passed 30/30. The third (`reference-exercises` catalog mutation focus) passed in two reruns and is unrelated to Focus.

**Known limits.** With Last time history at 360×660 Complete fits but the next-card preview is absent (the specification allows this). Physical-device verification on the Pixel 8 is pending: confirm in Chrome with the default font and display size; larger system font or display size settings make cards taller, where the sticky Complete applies. Motion was checked only through the existing automated motion tests.

**Independent review (card fit).** One fresh reviewer read `9a6e739..edc8945`: no Critical, two Important, seven Minor. Both Important findings were reproduced with failing tests and fixed: (1) a keyboard-driven feed shrink re-anchored the card top and left the focused input under the pinned Complete; `setFeedHeight` now keeps a focused field 64px above the feed bottom (`opening the keyboard keeps the focused reps input above the pinned Complete`). (2) Closing the workout note returned focus to the header before a tapped control could take it; both note blur paths now wait for the focus move to settle (`tapping a set input while the workout note is open moves focus to that input`). After the fix pass: unit 476/476; e2e 501 passed with no failures before the run was interrupted, then the remaining 11 files 94/94; build passed. Deferred minors: a stale milestone label after undoing a different set of the same exercise, a wrapping completion label, density tiers reacting to the keyboard, a focused inline note button lost when crossing 761→760px, the 32px saved exercise-note text target, a misleading CSS comment about the RIR caption, and the sticky-pin test asserting only computed `position`.

## Card rhythm and clean peek (2026-11-11)

Plan: docs/superpowers/plans/2026-11-11-focus-card-rhythm.md. Local Chromium (Playwright, touch, mobile) with seeded Last time and Best; heights are visible browser viewports.

| Viewport | Before: next title visible / history→inputs / RIR→Complete | After |
|---|---|---|
| 412×839 (Pixel 7) | 17px / 126px / 4px | next-set header whole, title 0px; every section gap equal |
| 412×850 (Pixel 8/9) | 17px / 137px / 4px | same |
| 393×750 (iPhone 16, toolbar collapsed) | 17px / 50px / 4px | equal gaps; peek only when whole |
| 440×770 | 17px / 70px / 4px | equal gaps; peek only when whole |
| 393×659, 360×660 (418px feed) | header cut mid-row / 6px / 4px | no peek (`.is-peekless`), card fits without the sticky fallback, 6px gaps |

- `e2e/workout-focus-fit.spec.js`: rhythm at 11 viewports (min gap ≥6px, spread ≤16px, RIR→Complete ≥ inner gap) and clean peek (title ≤1px, header whole or absent, expected peekless per viewport). `e2e/workout-focus-view.spec.js`: last set never peeks, two-line superset eyebrow sets the peek, long exercise note keeps the viewed set anchored. Unit: `test/workout-focus-fit.test.js`.
- Inspected screenshots at 412×839, 412×850, 393×659, 393×750, 440×770, 360×660 and 390×664 at 200% text; completed a set on Pixel 7 (Auto-next settled on set 2 with a clean peek of set 3). At 200% text and on 418px feeds with a previous-session note the card still outgrows the feed and the existing sticky Complete applies.
- Checks: `npm test` 483/483; `npm run build` passed; full `npm run test:e2e` 604 passed, 7 skipped, 1 failed — `with motion › a height change while typing re-anchors the viewed set…` (anchor 1 instead of 2). Not reproduced in 69 targeted runs (isolated ×5, whole file ×4, 6× CPU throttling ×8 on this branch and ×8 on the pre-change base); the seven workout suites together then passed 103/103. Root cause found after review: that test and `feed re-measures without losing the viewed set` read geometry once (after a fixed 400ms wait, or right after an already-true poll) although the logger re-measures the feed on the next frame (28–37ms measured); slower frames late in a full run lost the race, more often with the per-frame refit. Both now poll for the settled state; the catalog specs + Focus integration sequence that failed 2 of 3 times on the branch passed 3 of 3.
- Gaps: no physical device, no WebKit/Safari engine run; the Pixel gaps are evenly spread (about 35px each) and could be tightened further by raising `--focus-gap`'s range or input sizes if they read as airy on device.
- Independent review (card rhythm): one fresh reviewer read `e7b092d..583dd33`: no Critical, three Important, six Minor. All three Important were reproduced with failing tests and fixed: (1) `fitCards` anchored to a possibly stale `viewed` when its refit frame ran before a user scroll's tracking frame — it now anchors to the set the scroll position shows (likely cause of the intermittent re-anchor failure above); (2) scroll events dropped while a feed measurement settles are now caught up once it ends (pre-existing on main); (3) the large-input tier had been lost at 640px and is now 560px as documented. Minors deferred: peek rounding can trim ≤0.5px, a mid-note-expand flip to peekless shifts Complete by the peek height, `fitCards` measures every card per update, set errors are not observed, a dead `.log-set-row` flex rule, inline fit state left on restore.
- Final checks on `0bef1e8`: full `npm run test:e2e` 608 passed, 7 skipped, 0 failed; `npm test` 483/483; `npm run build` passed.
