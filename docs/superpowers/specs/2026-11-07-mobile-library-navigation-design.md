# Mobile Library navigation, User page and swiping

Date: 2026-11-07
Status: Approved, including swipe navigation and the full-page User amendments. The user requested implementation planning on 2026-11-07. Native implementation started on branch `feat/mobile-library-navigation`.

## Intent and agreed direction

Make the mobile app feel focused on training, removing the utility bar that currently holds save feedback, Profile and Log out. Group the related planning and exercise-management screens under Library. Keep a dedicated person icon for user actions; Exercise catalog does not belong in that menu.

The user approved Home, Library, History and User as four full-page mobile destinations, a Library section selector for Programs, Session templates and Exercise catalog, and save feedback integrated into page headings. All four root destinations support horizontal swipe navigation. User uses a person icon and contains Training profile and Log out. Four destinations replace the previous centered-Home arrangement. This design supersedes the mobile navigation and header requirements in AGENTS.md where they conflict. Other training, logging and persistence requirements continue to apply.

## Scope

- Apply the new shell at widths up to and including 760px.
- Keep the desktop navigation, Profile and Log out controls and desktop save-feedback placement.
- Reuse existing list views, editors, APIs and domain models. No database migration, data regrouping, export changes or new exercise-selection flow.
- Do not introduce search across all three Library sections, extra account settings or a generic More menu.

## Mobile navigation

The fixed bottom bar contains, in this order:

1. Home: link to `#/home`.
2. Library: link to the most recently visited Library section in this app session; Programs on first use.
3. History: link to `#/workouts`.
4. User: link to `#/user`, with a person icon and visible and accessible label `User`.

All four items are navigation links, with icon-and-label treatment and `aria-current="page"` on the current destination. Preserve the existing accent and top-indicator treatment. Library is current throughout program, template and catalog routes, including nested editors and tags. History is current on history and workout-log routes. User is current on `#/user` and `#/profile`. User has no disclosure or modal semantics.

Keep the existing safe-area support, text scaling, at least 44px touch targets, bottom-page padding and typing-driven hide/show behavior. The active workout bar and pinned volume panel still sit above the bottom navigation. Retain their existing ownership, reservations and offline behavior.

## Library sections and routing

Use the existing canonical routes as the Library sections:

| Visible section | Existing route |
| --- | --- |
| Programs | `#/programs` |
| Session templates | `#/templates` |
| Exercise catalog | `#/catalog` |

At these three list roots, show a compact Library heading and a three-link section selector above the existing content. Use visible labels Programs, Templates and Exercises in the selector; the content retains its descriptive existing heading and actions. The selector uses ordinary links and `aria-current="page"`, not ARIA tab semantics, because it navigates between routes. Match the existing flat dark surfaces, orange accent and Barlow typography. Allow labels to wrap under enlarged text without horizontal page overflow.

Do not add a redundant landing page or rewrite all URLs under a new prefix. Store the last visited section in memory only, update it after successful navigation into any of its routes, and leave a failed navigation's current section intact. A reload on a direct URL opens that URL; an empty mobile entry still opens Home. Browser Back/Forward and existing links keep working.

Show the selector on list roots only. Nested editors keep their existing breadcrumbs and program-occurrence context; they do not acquire an extra selector above the editing controls. The Library destination remains current while editing. Exercise pickers inside templates and workout logs remain directly accessible.

Explicit routes survive viewport changes. Switching to desktop restores its existing shell without redirecting or discarding the current view, dirty state or focus. The mobile last-section choice is not exported or saved to the server.

## User page

The person link opens a full page at `#/user` with heading `User`, containing:

- Training profile: navigate to the existing `#/profile` page through the normal guarded navigation flow.
- Log out: a separate action below a divider, using the existing logout flow.

Keep Catalog out of this page. The Profile page keeps its existing fields and autosave behavior. Give Profile a breadcrumb back to User on mobile while keeping its desktop presentation. The User page remains readable at an explicit `#/user` URL on desktop; desktop navigation itself keeps its existing controls.

Use normal page navigation, heading focus and browser history. User participates in the same horizontal transitions as Home, Library and History. There is no backdrop, focus trap, Close button or vertical sheet-dismiss gesture for User.

Opening User goes through normal guarded navigation; the active workout controller retains its session and mirror when its logger view detaches. Training profile also uses normal unsaved-change handling. Log out retains `leave()`, workout flushing, API logout, sign-out marker and controller cleanup in their current order. Disable page actions while logout runs. If logout fails, retain the signed-in view and show the error visibly; do not falsely present a successful sign-out.

## Horizontal swipe navigation

### Destinations and boundaries

The ordered sequence is **Home ↔ Library ↔ History ↔ User**. Drag left to reveal the next destination from the right; drag right to reveal the previous destination from the left. Each gesture moves at most one destination. Stop at either end without wrapping. Library resolves to its remembered list section, defaulting to Programs.

Enable gestures only at `#/home`, the three Library list roots, `#/workouts` and `#/user`, on touch input at up to 760px. Library section links remain tap-operated. Program/template editors, catalog detail and Tags screens, Profile, workout loggers and all open dialogs/sheets retain their own interactions and do not switch destinations by swiping. Tapping bottom-navigation links remains available from those screens through normal guarded navigation.

### Content and navigation motion

During a horizontal drag, the outgoing page follows the finger and the incoming page is revealed alongside it. Use a flat horizontal translation without scaling, parallax or an additional fade. The bottom bar stays fixed; one accent indicator interpolates between the source and destination positions. Icons and labels stay stationary. Keep the active-workout bar outside the moving page layer and retain its controller's reservation rules.

On release, a committed gesture settles to the destination in approximately 220ms ease-out; a canceled gesture returns in approximately 180ms. These are initial tuning values to assess in a real mobile browser. Tapping a bottom destination uses the same directional slide, including when skipping an intermediate destination; do not flash intermediate pages. Motion applies only when moving between the four root destinations. Nested routes and Library section changes retain their existing transition behavior.

For reduced motion, keep the gesture and tap actions available but omit finger-tracking page translation and sliding indicators; switch instantly after navigation succeeds. Browser Back/Forward continues to work with ordinary route handling and does not depend on swipe detection.

### Gesture recognition

Start with a 12px movement threshold and require horizontal distance to exceed vertical distance by a factor of 1.5 before capturing a navigation gesture. A vertical gesture keeps normal scrolling. Commit after crossing 25% of the viewport width, or a deliberate flick with at least 24px horizontal travel and release velocity of at least 0.5px/ms in the travel direction. A reversal, pointer cancellation or insufficient movement settles back without navigation. Measure release velocity over recent movement rather than the entire gesture. Tune these defaults against slow drags, quick flicks and diagonal scrolling during browser verification.

Leave a 24px strip at each viewport edge to the browser/system. Ignore gestures starting on inputs, selects, editable text, buttons, links, drag handles or horizontally scrollable controls. Do not intercept pinch zoom, multitouch, text selection, vertical scrolling or an existing pointer capture. Suspend destination gestures while typing, while a modal is open, during reordering or while navigation/logout is pending. Keep native scrolling available without blanket `touch-action: none` on page content.

### State, loading and ownership

Remember each root route's scroll position and relevant list state in memory for the app session. Restore the destination's selected Library section, filters and previously visible history/list extent before applying its remembered scroll; keep existing pagination and first-page history-selection semantics. New direct entries start normally. A reload need not preserve these transient positions. Do not reuse snapshots across authentication changes.

Swiping is an additional input to the existing guarded navigation flow. A canceled gesture must not change URLs, browser history, selection, current view ownership or scroll. On acceptance, create one navigation entry, just as for a tap. Keep the committed `aria-current` state until the destination successfully opens; the moving indicator is visual preview only.

Incoming content can use a previously rendered visual preview from this signed-in session. On first visit show an honest destination-labeled loading preview until its data is ready. Previews are inert, hidden from assistive technology and free of live announcements or duplicate DOM IDs. Never mount a second live logger or Home controller to create a preview. Prepare the actual destination through the existing loading flow; if required data is pending, show Opening feedback and finish the transition when it is ready. A failed load returns to the source with its scroll and selection intact and a visible error; never present failure as an empty list or history. Preserve the existing offline Finish exception: leaving the just-finished logger may open History with its local pending finish and an explicit history-load error. This is a failed-load surface, not successful empty history.

Cancel obsolete animation and preparation work on route/auth lifetime changes, viewport changes, pointer cancellation and superseding navigation. Ignore additional gestures during settlement/loading, while still allowing a deliberate navigation link or browser Back to supersede pending work. Delayed responses cannot commit an obsolete route. Dispose previews, listeners and animation effects when no longer needed. Preserve Home request-order guards, workout ownership/offline sync and existing dirty-edit confirmations.

### Accessibility

Every destination remains reachable through its visible navigation link and keyboard. Announce only committed page changes, using the normal heading-focus behavior; previews never receive focus. Preserve focus in a tapped navigation link while dragging is unavailable and avoid stealing focus during a canceled gesture. Test enlarged text, reduced motion and screen-reader navigation separately from touch gestures.

## Page headings and save feedback

Remove the standalone mobile utility row. Move the existing shared document/profile/finished-log save-feedback controls into a slot adjacent to the current page heading. Align beside the heading when space allows and wrap below it on narrow screens or with enlarged text. Do not add an empty replacement toolbar on read-only or list pages.

Preserve the single live status region and all existing Retry, Reload saved version and Save as copy conditions. Keep the current messages and conflict handling. Normal feedback is muted; failures and recovery actions remain readable and reachable. Do not truncate recovery controls to fit a single row or put them behind the user menu.

The active workout logger already has its own save/sync feedback in its sticky header: keep that controller-owned feedback there without duplicating it. Catalog's own mutation errors and retry controls remain with their content. Home receives no fabricated Saved indicator.

Use explicit view-provided status slots and a shared shell coordinator for placement. Preserve control nodes, listeners, live-region identity and focused recovery controls when moving them. Attach after mounting a view, handle views that rebuild their heading, and return controls to a safe shell host before destroying a view. A route-loading failure must leave the previous view's feedback usable. Desktop/mobile transitions relocate the same controls without resetting saves or caret state.

Keep Home cover sizing, logger sticky positioning, review-dock geometry and picker anchoring correct when the mobile utility row has zero height. Retain the desktop header's dimensions and behavior. Opening User must respect the existing active-workout bar reservation and Home's scoped suppression rules.

## Verification criteria

- Check all Library root and nested routes, User, Profile, Home, history, active logging and finished-log editing at 360px, 390px and 760px, plus desktop at 761px and a wide viewport.
- Verify navigation grouping, last-section memory, direct links, Back/Forward and viewport changes without redirecting explicit routes.
- Check User navigation and heading focus, keyboard access, reduced motion, enlarged text and typing-driven bottom-bar behavior.
- Check both swipe directions across all four destinations, boundaries, cancellation, reversal, diagonal/vertical scrolling, quick flicks, edge gestures, control exclusions and pointer cancellation. Verify that editors and modal surfaces retain their own gestures.
- Check finger-tracking content and indicator synchronization, tap direction, scroll/filter restoration, initial loading previews, required-load failure, rapid navigation, browser history and resize/auth changes during a gesture or pending load. Verify one live owner per view/controller and no announcements from previews.
- Verify save status, Retry, conflicts and applicable Save as copy on mobile and desktop, including route failures and heading rerenders. Active logging keeps exactly one sync-status surface.
- Verify Profile navigation and logout still honor pending edits and workout synchronization; a failed logout leaves the app signed in with a visible error.
- Check Home cover space, floating workout bar, logger header, editor volume panel and exercise picker after removing the mobile utility row.
- Run focused routing/shell tests and the relevant browser flows, then the project's required checks. Record local evidence separately from any pending deployment verification.

## Review

Self-review: existing canonical routes remain compatible; Library is a shell grouping, not a new data model. User is a new full-page route and the fourth swipe destination. Library section changes and nested editor routes do not compete for horizontal destination gestures. Existing save and workout controllers retain ownership. Scope is mobile presentation and navigation, with desktop behavior preserved. The original written design was approved; the additions above incorporate the user's correction that User is a full page.

Written-design approval is required before writing the implementation plan. Plan review and an execution-method choice precede implementation under the repository brainstorming workflow.
