# Disclosure, Glutes and confirmations verification

Plan: [2026-10-30 implementation plan](../plans/2026-10-30-disclosure-glutes-confirmations.md).

## Delivered behavior

- Expanded exercise headers have a full-width hover/focus surface, consistent card padding and centered number/name/actions. Collapsed cards retain click-to-expand without the extra hover surface. One full-header keyboard outline replaces the former duplicate outlines. Independent actions and drag/collapse motion remain intact.
- Glutes joins the central muscle registry between Abs and Quads, with mirrored back anatomy, goals, explicit direct/indirect volume, repeated weekly occurrence counting, filters, catalog mappings/defaults, analysis normalization and portable file support. No database assignments or seed mappings were changed; no migration/seed was run.
- Program session titles open their occurrence editor using native links, with hover/focus transitions and program breadcrumbs. The Edit icon is removed. Standalone view fixtures use a native title button when no route resolver is supplied. Return, duplicate and export-validation focus paths use the title target.
- Reference-scoped Add variant initializes the name from the reference once. Explicit names and source-variant cloning retain precedence; existing refresh/error handling retains typed drafts.
- Catalog variant names are plain headings. Their old links only changed catalog route/breadcrumb context; they did not open editing. Deep links, Edit actions and workout View in catalog remain available.
- All eight in-app `confirm()` calls use one branded asynchronous native dialog. Cancel, Escape and backdrop preserve data. Callers guard target identity, document state and view lifetime; simultaneous requests do not stack. The browser-controlled tab-close/reload unsaved-change warning remains native.

## Automated verification

- `npm.cmd test`: 205 tests passed, zero failed.
- `npm.cmd run build`: passed; public browser assets built successfully.
- Focused confirmation/compact-layout checks: 21 passed, including both final review regressions.
- Full `npm.cmd run test:e2e`: 231 tests passed, zero failed (5.4 minutes).
- `git diff --check`: passed. Source search found no remaining in-app `confirm()` calls.

The initial full browser run passed 227 tests and exposed three old assertions expecting 12 muscle choices/rows or three program icon actions. Those assertions were updated to the approved 13 choices/rows and two remaining icons. Final verification uses the updated suite.

## Browser inspection

Inspected populated native session editor, program overview, catalog and modal fixtures in Chromium. Editor measurements at 1366×768 and 1440×900 retained two 180px body figures; 1920×1080 retained 200px figures. No horizontal overflow at those sizes, 390×844 mobile, 820×1024 tablet or 200% text at 1366×768. Mobile figures retained their existing 120px presentation. Screenshots were captured after transitions settled and inspected for header alignment, long-name wrapping, muscle chips, body prominence, title links, plain catalog names, variant prefilling and modal density.

Browser tests also exercise keyboard focus/activation, independent heading actions, drag-release suppression, touch hold/drop, hybrid/coarse 44px targets, rapid disclosure reversal, motion and reduced motion, modal entry/exit, Cancel/Confirm/Escape/backdrop, duplicate requests, stale-view abort and focus restoration. Existing program/catalog/draft/revision checks remain in the full suite.

Verification limits: Chromium with emulated touch/hybrid input; no physical touchscreen or Safari/Firefox device session. Production rollout and deployment were not performed. Existing files stay valid in this app, but older app releases may reject exports containing Glutes.

## Independent review and fixes

One read-only independent review found no critical issues and two important confirmation lifecycle issues. Both were reproduced by failing browser tests, then fixed in one pass:

1. A delayed autosave 401 could leave a view-owned modal blocking sign-in and allow a hidden draft mutation. Authentication now calls `cancelActiveConfirmation()` for any active dialog. The test verifies modal removal, Password focus and the retained occurrence.
2. An identical `syncSaved()` rerender disconnected a modal's Remove invoker and Cancel lost focus. Program removal now supplies a resolver for the current occurrence's Remove control, with Add empty as fallback. The helper rejects disconnected, inert, hidden or disabled focus targets. The test verifies restored focus and zero mutations after the rerender.

No declined review topics or deferred minor findings.

## Execution decisions

- Used a feature branch in the existing shared checkout to preserve installed tools and the approved plan. Cost/tradeoff: branch isolation without a second filesystem worktree.
- Interactive session titles do not initiate dragging; background/metadata dragging and Reorder remain available. Drag tests now target noninteractive metadata. Cost/tradeoff: dragging must start outside the title link.
- Used `npm.cmd` and the direct Playwright Node CLI on Windows because `npm.ps1` was execution-policy blocked and `npx.cmd` stalled. Cost/tradeoff: alternate command entrypoints invoke the same project runners; no policy or dependency changes.
- Grouped cross-cutting CSS, title-focus and async-confirmation changes into one verified implementation commit. Cost/tradeoff: coarser history instead of intermediate commits with incompatible focus/confirmation expectations.
