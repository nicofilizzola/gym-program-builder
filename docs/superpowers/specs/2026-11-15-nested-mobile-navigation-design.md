# Nested mobile navigation

Date: 2026-11-15.

Status: Direction and compact-back-link treatment agreed in conversation; written specification awaiting user review. Not implemented or deployed. Covers request 7 in the [design map](2026-11-15-mobile-tracker-refinements-design.md).

## Purpose

Keep bottom navigation on the three main mobile destinations, and let nested screens use the space for their own task. The user referenced the familiar root-versus-detail behavior of mobile apps and accepted a compact parent back link instead of the full mobile breadcrumb trail.

At ≤760px, hide bottom tabs on nested routes and provide an obvious one-level return. At >760px, preserve current desktop navigation and full breadcrumbs. Route URLs, data loading, editor guards and workout ownership remain the same.

Read this alongside [fluid root navigation](2026-11-08-fluid-mobile-navigation-design.md) and [Home/history](2026-11-12-home-history-design.md). Their loading, cache, restoration and explicit-exit contracts remain in force except for the nested chrome changes specified here.

## 1. Visibility follows the committed route

| Mobile view | Bottom tabs | Back target |
|---|---|---|
| Home (`#/home`, including its History section) | Visible | No added back link |
| Programs list (`#/programs`) | Visible | No added back link |
| Templates list (`#/templates`) | Visible | No added back link |
| Exercises/catalog root (`#/catalog`) | Visible | No added back link |
| User (`#/user`) | Visible | No added back link |
| Program (`#/programs/:id`) | Hidden | Programs |
| Workout/template within a program (`#/programs/:id/workouts/:occurrenceId`) | Hidden | That program |
| Standalone template (`#/templates/:id`) | Hidden | Templates |
| Reference exercise (`#/catalog/references/:id`) | Hidden | Exercises |
| Variant (`#/catalog/references/:id/variants/:variantId`) | Hidden | Its reference exercise |
| Tag management (`#/catalog/tags`, including filter/query changes) | Hidden | Exercises |
| Profile (`#/profile`) | Hidden | User |
| Active or finished workout (`#/workouts/:id`), including transient Focus recap | Hidden | Home |

The three Library section lists remain roots of the Library destination; changing Programs/Templates/Exercises does not hide the tabs. The existing Library section links remain on those list roots. Do not add a new Library route or data model.

Mobile `#/workouts` still canonicalizes to Home at History using the existing replacement semantics; it is not a new nested list. Desktop Workouts and explicit routes survive resize.

Visibility is derived from the committed view, not simply from the requested hash or URL depth. If a leave guard refuses navigation, or a required nested load fails while the source remains mounted, keep the source's tabs/back link and geometry. Stale responses cannot change navigation chrome. Root loading/error destinations keep their existing navigation and Retry behavior.

For a known nested route whose record is missing/unavailable, keep the nested treatment and show its available parent link alongside the error. Use a safe owning-root fallback if the parent record is unavailable: Programs for a missing program context, Exercises for a missing reference, Home for a missing workout. An unrelated unknown route gets an accessible error and a Home return on mobile; do not fabricate a parent from path segments. Preserve existing desktop error behavior.

## 2. Compact parent back link

Replace the full breadcrumb trail on nested mobile screens with one left-facing arrow and the immediate parent's label, e.g. `Programs`, `Upper / Lower` (the parent program name), `Templates`, `Exercises`, the reference name, `User` or `Home`.

Use a real link with the canonical parent href, an accessible name `Back to {parent label}`, visible text, and at least a 44px target height/width. Reuse the existing inline SVG/currentColor and typography. Long parent names may visually ellipsize on one line; keep the full accessible name. Do not add a persistent full breadcrumb row beside it. Keep the current page's existing heading and save controls.

Keep the same focused parent link through save acknowledgements, current-record renames and responsive changes when its target is unchanged. Update a changed parent label in place; do not rebuild a focused back link because the hidden current breadcrumb text changed.

Route activation goes through the app's existing guarded `navigate` path, preserving modified-click link behavior. This is a parent link, not a blind `history.back()`: a direct/deep-linked nested screen must have a reliable in-app destination even with no prior entry. Browser Back/Forward keep their normal route-history behavior and guards.

Returning from a program workout goes to that program, preserving its existing return-to-occurrence focus and scroll behavior. Returning from a standalone shared template goes to Templates. Returning from a variant goes to its reference before the Exercises root. Do not flatten every back link to the Library root.

Back from an active workout is ordinary route navigation. It detaches the view while retaining the active controller, mirror and background sync; it does not finish/discard/delete the workout or create a recap. Return to Home's remembered extent/scroll when available, with Resume available. Finish, Discard, Delete and recap Done retain `exitWorkout`: Home at the top, clearing Home page memory as currently specified. Desktop keeps its current exit behavior.

When a recap is transiently mounted at the workout route, the compact Home link and its accessible behavior remain available. Keep pending finishes truthful and read-only until the established ownership handoff; this navigation change creates no new writer.

## 3. Space, bars and safe areas

Hidden tabs are absent from painting, focus and the accessibility tree. Reclaim their reserved height; do not only translate an invisible bar off-screen while leaving a dead strip. Keep an explicit full mobile tab-height value separate from the effective current reservation so root navigation can restore the correct 56px/text-scaled height plus safe area.

The effective `--tab-bar-height` is zero on nested mobile routes, full-height on mobile roots and zero on desktop. All consumers must use the appropriate effective geometry: body bottom reservation, `#app` minimum height, active workout bar offset, pinned volume panel, root refresh status and the Focus feed measurement. Update the owning bar's reservation when route visibility changes even when the bar's own pixel height does not change.

Keep the active-workout Resume bar available on other screens under its existing controller/suppression rules. Hiding tabs does not finish a workout or suppress Resume globally. On a nested screen it sits at the bottom with its own safe-area padding; on a root it sits above the tabs, which own that inset. Active Focus/Home suppression tokens retain their current lifetimes. Avoid double-counting or dropping the inset when the effective tab height becomes zero.

Nested editors' pinned panels and bottom actions also retain safe-area clearance. The direct Workout overview footer from the [Focus spec](2026-11-15-focus-rounds-and-presentation-design.md) uses the reclaimed area and remains above the device inset. Keyboard/visualViewport changes must keep the current input and Complete reachable without reserving the hidden tabs again.

Typing remains a separate transient state. On roots, retain the current user-initiated typing hide/restore behavior and reserved-padding policy. On nested routes, leaving a field must not briefly restore tabs or reset nested reservations. Script focus alone still does not imply keyboard typing. Returning to a root while a field is blurred/being restored must respect the committed route, click ownership and current typing state.

## 4. Motion, focus and responsive changes

Use the existing nested-route fade (75ms outgoing, 100ms incoming, ease-out) and commit chrome visibility with the route swap. Recompute reserved height at that commit, not as an independently animated CSS height. Tabs are hidden while the outgoing content is faded and the destination refits, so the user does not see a second moving layer or a delayed gap. Initial load and reduced motion commit final states immediately.

Do not introduce a new push-navigation animation, nested swipe system or edge-back gesture. Root swipes remain Home↔Library↔User under the existing eligibility rules, with 220ms settlement and 180ms cancellation. They remain disabled in nested editors/loggers, open dialogs, typing and reorder interactions.

Restore a root's cached list extent before restoring its scroll. Keep Home History restoration and explicit exit semantics unchanged. Preserve parent-specific focus restoration where present; otherwise focus the destination heading after navigation, not a tab that is about to disappear. If focus was in newly hidden navigation during a responsive change, move it to an appropriate visible current control/heading.

At a width change, preserve the explicit route, data/controller owner, draft fields, caret/composition and viewed workout set. Nested desktop routes show the desktop header/navigation and full breadcrumb trail; crossing back to mobile shows the compact parent link and hides tabs. Focus geometry refits instantly around the surviving viewed set. Do not reload, navigate to a default page or reset root page memory because of resize.

A loading/failed request, auth transition, cancelled leave or rapid Back/Forward cannot leave chrome representing another route. Clear auth-scoped navigation memory through the existing auth lifecycle; keep workout mirrors under their existing rules. Hide/close transient back-link tooltips/menus when their anchors leave.

## Architecture and verification

Reuse parsed route views and `isSwipeRoot`/destination mapping in `src/mobile-navigation-state.js`; do not create a second ad hoc URL-depth classifier. Extend `src/mobile-navigation.js`/`src/app.js` at committed-route and breakpoint boundaries. Adapt `src/breadcrumbs.js` to present one parent link on mobile while retaining its full desktop items. Workout routes/errors need explicit parent metadata because they do not all currently mount breadcrumbs.

Audit the effective-height consumers in `style.css`, `src/workout-bar.js` and the Focus measurement in `src/workout-logger-view.js`. Keep ordinary view-transition, save-controls-host, typing-state and controller ownership contracts intact. No new persistence, API, migration, prefetch or deployment.

Required implementation checks:

- Unit: every route in the matrix, query variants, unknown routes, safe parent fallback, root/nested classification and destination ownership.
- Browser: enter and leave every nested type; roots retain three tabs; Library list section changes keep them; known errors have a usable parent; initial deep links return correctly; full desktop links/breadcrumbs survive resize.
- Guards/loading: failed required nested load, denied unsaved leave, cancelled discard prompt, stale response and rapid Back/Forward all retain the correct source/destination chrome, focus and reservation.
- Workout: Back leaves the active workout resumable without finishing it; Resume works; explicit finish/discard/delete/Done still return to Home at the top; pending/offline finish and recap ownership remain correct.
- Geometry: visible/hidden tabs with and without Resume, pinned editor panel, refresh status, safe-area inset, keyboard typing exit, 200% text and Focus at 660px visible height. Check no double inset, hidden tab focus target, stale bottom gap or moving current input.
- Reuse `test/router.test.js`, `test/mobile-navigation-state.test.js`, `e2e/breadcrumbs.spec.js`, the existing mobile navigation/layout/latency suites, and relevant Home/history/Focus integration checks. Test the actual app geometry, not only the concept frame.

Physical-phone safe areas, keyboard transitions, momentum and deployed verification remain pending. This supersedes the earlier rule that mobile tabs and full breadcrumb trails remain on nested screens; other Home/history/root-navigation and editor/workout behavior remains in force.
