# Mobile Library navigation and user menu

Date: 2026-11-07
Status: Proposed written design; the user approved the conversational direction. Implementation has not started.

## Intent and agreed direction

Make the mobile app feel focused on training, removing the utility bar that currently holds save feedback, Profile and Log out. Group the related planning and exercise-management screens under Library. Keep a dedicated person icon for user actions; Exercise catalog does not belong in that menu.

The user approved Home, Library, History and a person button as the mobile navigation, a Library section selector for Programs, Session templates and Exercise catalog, and save feedback integrated into page headings. Four destinations replace the previous centered-Home arrangement. This design supersedes the mobile navigation and header requirements in AGENTS.md where they conflict. Other training, logging and persistence requirements continue to apply.

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
4. User: person-icon button, accessible name `User menu`, with the visible short label `User` for consistency with the other destinations.

The first three items are navigation links. User opens a sheet and exposes `aria-expanded` and `aria-controls`; it does not change the route. Home, Library and History retain icon-and-label treatment. Preserve the existing accent and top-indicator treatment for the current destination. Library is current throughout program, template and catalog routes, including nested editors and tags. History is current on history and workout-log routes. User indicates the current Profile destination and its expanded state with appropriate, separate semantics.

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

## User sheet

The person button opens a compact, accessible bottom sheet titled `User menu` containing:

- Training profile: navigate to the existing `#/profile` page through the normal guarded navigation flow.
- Log out: a separate action below a divider, using the existing logout flow.

Keep Catalog out of this sheet. The Profile page keeps its existing fields and autosave behavior.

Reuse the established dialog/sheet interaction patterns: labeled modal, backdrop, focus containment, Close button, Escape and backdrop dismissal, focus restoration to the person button, and 200ms bottom-sheet motion with instant reduced motion. Support the existing sheet swipe-dismiss thresholds where that reusable behavior is available. Close the sheet before route changes, authentication changes or switching to desktop. Never restore focus into a hidden or disconnected control; on desktop use the corresponding Profile control as the fallback.

Opening and dismissing the sheet does not flush edits, navigate or detach the active workout. Training profile uses normal unsaved-change handling. Log out retains `leave()`, workout flushing, API logout, sign-out marker and controller cleanup in their current order. Disable sheet actions while their operation runs. If logout fails, retain the signed-in view and show the error visibly; do not falsely present a successful sign-out.

## Page headings and save feedback

Remove the standalone mobile utility row. Move the existing shared document/profile/finished-log save-feedback controls into a slot adjacent to the current page heading. Align beside the heading when space allows and wrap below it on narrow screens or with enlarged text. Do not add an empty replacement toolbar on read-only or list pages.

Preserve the single live status region and all existing Retry, Reload saved version and Save as copy conditions. Keep the current messages and conflict handling. Normal feedback is muted; failures and recovery actions remain readable and reachable. Do not truncate recovery controls to fit a single row or put them behind the user menu.

The active workout logger already has its own save/sync feedback in its sticky header: keep that controller-owned feedback there without duplicating it. Catalog's own mutation errors and retry controls remain with their content. Home receives no fabricated Saved indicator.

Use explicit view-provided status slots and a shared shell coordinator for placement. Preserve control nodes, listeners, live-region identity and focused recovery controls when moving them. Attach after mounting a view, handle views that rebuild their heading, and return controls to a safe shell host before destroying a view. A route-loading failure must leave the previous view's feedback usable. Desktop/mobile transitions relocate the same controls without resetting saves or caret state.

Keep Home cover sizing, logger sticky positioning, review-dock geometry and picker anchoring correct when the mobile utility row has zero height. Retain the desktop header's dimensions and behavior. Opening the user sheet must not affect active-workout bar reservations.

## Verification criteria

- Check all Library root and nested routes, Profile, Home, history, active logging and finished-log editing at 360px, 390px and 760px, plus desktop at 761px and a wide viewport.
- Verify navigation grouping, last-section memory, direct links, Back/Forward and viewport changes without redirecting explicit routes.
- Check sheet keyboard access, Escape/backdrop/Close, focus restoration, reduced motion, enlarged text and typing-driven bottom-bar behavior.
- Verify save status, Retry, conflicts and applicable Save as copy on mobile and desktop, including route failures and heading rerenders. Active logging keeps exactly one sync-status surface.
- Verify Profile navigation and logout still honor pending edits and workout synchronization; a failed logout leaves the app signed in with a visible error.
- Check Home cover space, floating workout bar, logger header, editor volume panel and exercise picker after removing the mobile utility row.
- Run focused routing/shell tests and the relevant browser flows, then the project's required checks. Record local evidence separately from any pending deployment verification.

## Review

Self-review: canonical routes remain compatible; Library is a shell grouping, not a new data model. The user sheet is an action surface, not a fourth route. Existing save and workout controllers retain ownership. Scope is mobile presentation and navigation, with desktop behavior preserved.

Written-design approval is required before writing the implementation plan. Plan review and an execution-method choice precede implementation under the repository brainstorming workflow.
