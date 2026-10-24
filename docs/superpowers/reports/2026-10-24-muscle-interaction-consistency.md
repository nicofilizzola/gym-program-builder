# Muscle interaction consistency

Implemented on `fix/muscle-interaction-consistency` using native execution with one independent final review.

- Program cards now follow selected muscles only. Hover and keyboard focus continue previewing the volume panel without changing card emphasis.
- Matching cards share the exercise cards' accent outline, shadow, neutral surface, and filled badge styling. Nonmatching cards dim while a muscle is selected.
- Every matching workout has one `Trains [muscle]` badge, including workouts with both primary and secondary involvement. Reserved badge space prevents card/control shifts across all twelve labels.
- Existing mutation, navigation, import, reorder, and transient-state behavior is preserved. The session editor's product code is unchanged.

## Verification

Node.js 24.22.1: `npm test` passed 101 tests; `npm run test:e2e` passed 65 tests; `npm run build` passed. `git diff --check` passed. Build output contains only index.html, style.css, and browser src assets. No migration or deployment was performed.

The interaction regression tests first reproduced hover highlighting and delayed deselection. Styling tests first reproduced the border and transition mismatch. The first full browser run passed 64/65: the new session-reference test did not await web fonts and observed a different muscle under the pointer. Waiting for `document.fonts.ready` passed six repeated session tests, then the complete 65-test suite.

The independent final reviewer reported no Critical, Important, or Minor findings and declined no behaviors for judgment. Desktop and mobile screenshots were inspected; touch, keyboard, responsive layout, reduced motion, and enlarged-text checks pass.

## Execution decision

At 200% text size, geometry assertions compare card heights and local control positions: the existing volume readout may grow beyond its reserved two lines and move the entire list. Normal-size checks still compare absolute card/control positions. This leaves readout-driven whole-list shifts outside enlarged-text card geometry coverage, preserving the existing allowed readout behavior.

The original package.json and package-lock.json edits were copied unchanged into the worktree for verification and excluded from commits. No dependencies, persistence formats, database schemas, or server code changed.
