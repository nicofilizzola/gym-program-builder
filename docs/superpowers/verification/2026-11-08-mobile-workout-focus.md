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
