# Interaction polish verification

Implemented on `ux/interaction-polish` in the managed isolated worktree. Base: `dba3a76`.

## Delivered

- Shared live pointer drag preview, placeholder, neighbour motion, touch/edge scrolling, cancellation, and keyboard/click alternatives for exercise cards.
- Workout sorting in sequence and schedule layouts, including empty days and Unscheduled; canonical order and day changes persist after reload.
- Unambiguous shared export icon across libraries and editors.
- Stable workout metadata and animated muscle highlights.
- Compact add-template or empty-workout controls and moderate density across lists/builders.
- Prepared destination navigation, delayed status feedback, reduced-motion support, and internal workout-editor transitions with focus restoration.

## Verification

Using Node.js 24.22.1 with npm.cmd (PowerShell blocks npm.ps1):

- `npm test`: 101 passed, 0 failed.
- `npm run test:e2e`: 62 passed, 0 failed.
- `npm run build`: passed; public assets built.
- `git diff --check`: passed.
- Reviewed 1280 px and 375 px screenshots of program overview, session editor, and template library. Browser layout coverage also includes 320 px and 200% text.
- Motion enabled and reduced-motion browser cases cover dragging, hover, page fades, and internal navigation.

## Execution decisions

- Used a managed isolated branch and Node 24 PATH to preserve the existing main checkout and user package-file edits. This means implementation is not present in the user's main checkout until integrated.
- Updated two old recovery assertions from a hidden editor to a visible, inert editor, as required by the approved navigation design. Inert/busy state and retained data are verified; interaction blocking remains essential. An incorrect assertion here could miss an editable outgoing view, so overlapping-transition regression coverage also verifies ancestor locking.
- The new persistence test initially selected the outgoing library file input; it now waits for the program editor before importing. No application change was needed for that fixture timing issue.

## Review and delivery

Independent whole-branch review completed on e813bbe (gpt-6-astra, read-only). Findings were reproduced with five failing browser regression tests, then fixed in one pass:

1. Critical: internal workout transitions could unlock a pending top-level navigation and allow edit loss. Each view now mounts in a child host; top-level inert ownership stays on the ancestor.
2. Important: a late creation response could override browser Back. Creation now retains the server result but skips superseded navigation.
3. Important: reload preparation could dispose the old queue before its replacement was ready. Queue ownership now changes only at accepted mount.
4. Important: the session editor overflowed at 320 px with 200% text. Bulk controls and the panel header now wrap.
5. Neighbour animations were cancelled by each tiny pointer movement. Regraded from Minor to Important because continuous smooth dragging is a core requested behavior; targeting now uses layout geometry and preserves animations until insertion changes. The extra geometry handling is covered by the regression test.

All five regression tests passed in the 29-case focused browser run. No deferred minor findings. Final verification after the fix pass is recorded above: 101 unit tests, 62 browser tests, and a successful production build. The cross-day test waits for fonts and uses a tall fixture viewport so target-day assertions are independent of edge scrolling; touch edge scrolling has dedicated coverage. No database schema changes, migration, new dependencies, push, merge, or deployment were performed.
