# Mobile training home

Date: 2026-11-06. Product direction approved in conversation; this written spec awaits review. Implementation and release verification are separate work.

## Intent and agreed direction

On a phone, Gym Program Builder should lead with training. Opening the app should make the next workout obvious and let the athlete start it with one tap. Program, template and catalog management remain available, with desktop retaining its existing entry point and navigation.

The selected direction is **A: an immersive workout cover**, using equipment photography, a dark readability gradient, the existing orange accent and Barlow / Barlow Condensed typography. The cover occupies the available space above the mobile navigation. It contains the session identity and primary Start or Resume action. A quieter Choose another workout action sits below the cover. **There is no history section on Home**: history has its own adjacent navigation tab. No activity dashboard, statistics, streaks or promotional content.

The approved mockup establishes composition and visual direction, not production dimensions or an extra application header. It originally included history below the fold; that section was explicitly removed during discussion. Temporary mockups live in the ignored `.superpowers/brainstorm/11940-1793998269/` directory and are not production assets.

## Navigation and routing

- Use the existing mobile breakpoint, **760px and below**.
- Mobile bottom tabs, left to right: **Programs · Templates · Home · History · Catalog**. Home is the middle tab. Use the existing inline outline icon family, visible labels, at least 44px targets, accent plus the 2px active indicator, and `aria-current="page"`. Home is a normal navigation item, not a floating Start button.
- Add canonical `#/home`. Keep `#/workouts` and `#/workouts/:id` working as history and log routes. The mobile label for the former becomes History; the existing desktop Workouts label remains unchanged. Keep the history page's existing Start workout action.
- A launch with no hash (or an empty root route) resolves to Home on mobile and Programs on desktop. Centralize this choice so boot, login and hash navigation do not disagree. Explicit routes, including Programs and workout deep links, always win. Do not remember a last page or redirect in response to a resize.
- At desktop widths, keep the existing four main navigation items and Programs default. An explicit `#/home` remains usable as a centered, width-constrained version of the training home; resizing never strands the user or destroys an open view.
- Keep the existing compact mobile shell header, including save status, Profile and Log out. Add the local date within Home without duplicating profile controls or adding a second application toolbar. The mockup's phone status bar is not application UI.
- Preserve mobile safe-area handling, tab height, typing-state behavior and editor panel placement. The existing labels on desktop remain unchanged.

## Home composition

One semantic page, in reading order:

1. A compact **Your training** heading and current local date.
2. One immersive cover or its loading/fallback state.
3. **Choose another workout**, opening the existing start sheet. In a fallback state the cover's primary action is Choose a workout and the duplicate secondary action is omitted.
4. Only when relevant, a compact setup action or an inline error with Retry. No unrelated content below.

The cover shows the active program name and star when it is a program recommendation, a timing label, the session name, estimated duration from the existing duration helper, exercise count, and **Start workout**. Duration is an estimate and uses the existing approximate duration label, not an independently calculated number. Count exercise entries, including both members of a superset.

Use 12px page gutters, the existing radius family and responsive cover padding around 20px. Use condensed display type around 48px for typical session names, scaling down or wrapping as needed. The primary button is full width within the cover and at least 54px tall at default text size. Keep secondary actions at least 44px tall. Do not turn the entire cover into a second Start target.

The photograph fills the cover with a curated focal point and `object-fit: cover`. Apply a dark gradient behind all overlaid copy and controls, preserving readable contrast independently of the image. Keep gradients on the photographic treatment; do not add animated washes, glows or gradient buttons.

Size the cover from available dynamic viewport height after accounting for the real shell header, Home heading, secondary action, bottom tabs and safe areas. On typical 390×844 phones all essential actions fit without scrolling. This is a flexible minimum-height layout, not a fixed-height crop: long names, errors, landscape, 320px widths and 200% text can grow the page and scroll. Never hide an action to preserve the composition. Desktop explicit Home uses a centered maximum width of 480px and the same content order.

## State priority

| Condition | Cover and primary action |
|---|---|
| Owned active workout, including a local offline mirror | Workout in progress; workout name; working-set progress; Resume workout |
| Active Week program with an eligible session today | Today's session; session details; Start workout |
| Active Week program whose next eligible session is in the future | Up next · weekday and date; session details; Start workout |
| Active Sequence program with a workout entry | Up next; session details; Start workout |
| No active program, deleted active program or no programs | Choose a workout; explanatory text; primary opens the picker; Set active program when programs exist, otherwise Go to Programs |
| Active program without an eligible scheduled/sequence session | No scheduled sessions; active program name; Choose a workout; secondary Open program |
| Recommendation data failed | Couldn't load your next workout; Retry; Choose a workout remains available |

Resume takes priority before recommendation requests settle. Its progress is `N of M working sets completed`, counting working sets only across the active snapshot. At zero working sets, say No working sets yet; never show a misleading percentage or divide by zero. A small progress track may accompany nonzero totals, but the text carries the meaning. Do not show a template-based duration estimate for an already running workout.

Resume navigates to the owned workout through the existing controller. It does not wait for program, template, history or image requests. The floating active-workout bar is suppressed on Home when the Resume cover is present, including its reserved space. Preserve the controller's ownership and logger attachment: Home must not pretend to be a logger to hide the bar. Restore the normal bar policy immediately on leaving Home. Finished unsynced snapshots are not resumable active workouts; preserve their existing history and sync behavior.

Choose another workout remains available in the Resume state and uses the existing Resume / Finish / Discard prompt if another start is attempted. No new replacement or discard behavior.

## Recommendation and date rules

Reuse the pure logic in `src/workout-up-next.js`; Home and the start sheet must choose the same occurrence from the same inputs. Extend its shared selection result with the scheduled local date needed by Home while preserving existing consumers. Do not write a second recommendation algorithm.

- Only the active program supplies a recommendation. Never silently activate or recommend another program when the setting is absent or names a deleted program.
- **Week:** local Monday–Sunday; select the first scheduled occurrence from today through Sunday not logged this week, in program order within a day. Missed earlier days are not caught up. Unscheduled entries are never suggested. When nothing remains, select next week's first scheduled occurrence and give it that future date.
- **Sequence:** after the newest matching program log whose occurrence still exists, choose the next workout entry, skipping rests and wrapping. Without a matching log, choose the first workout. Never infer weekdays or a rest-day schedule.
- Existing completion matching remains keyed by program and occurrence, using the log's `startedAt` for Week membership. Early completion of a later occurrence suppresses that occurrence for the current week. A discarded workout does not advance the recommendation.
- Home uses the same existing first-page history input as the start sheet. This preserves the current bounded-history behavior; this feature does not claim an all-history scheduling engine. Include any locally finished pending summary once, deduplicated by log ID, so a just-finished workout can advance Home before its sync acknowledgement. An active local log is handled by Resume rather than counted as a completion.
- Date computation uses calendar arithmetic in local time, including DST and year boundaries. Examples: Today's session; Up next · Mon, 9 Nov; include the year when it differs from the current year. Use a semantic `time` with the selected local calendar date. Sequence says Up next only.

Recompute on Home entry, successful finish/discard, a relevant active-workout update, window focus, and local date rollover while visible. On focus, refresh settings, history and the active program bundle; guard against overlapping and obsolete requests. A hidden page need not poll. Do not refetch for every autosave acknowledgement or animate progress changes.

The **Set active program** fallback opens the existing Program tab of the start sheet. Reuse its existing Make {name} active action and Programs access; do not add another program-selection dialog. On sheet close, adopt the successful setting change and refresh Home. When the chosen active program has no scheduled session, show the explicit fallback above.

## Covers and session identity

Bundle four equipment-focused photographs with stable public IDs: `gym`, `dumbbells`, `barbell`, `machines`. `gym` is the default. Each has a local optimized image URL, dimensions, crop focal point and source/license attribution in one shared manifest. No runtime image service or third-party image URL is needed to use Home. Final asset selection must establish redistribution rights and include credits where required; the reference mockup photo is not automatically approved as a shipped asset.

Store `coverId` on the **shared session template**, not on a program occurrence or catalog exercise. Missing values normalize to `gym`; non-string or unrecognized values reject a submitted template as Invalid workout cover. The manifest/ID whitelist is shared by validation and presentation.

Add an optional **Workout cover** disclosure to the shared session editor, after the identity controls and before exercise content. Inside, provide four labeled image choices with native radio semantics and a clear selected state; selecting one autosaves through the existing template revision flow. The control is available at every viewport, although desktop is the intended setup context. Close/open uses the existing 200ms collapsible pattern; reduced motion is instant. This is a shared setting, so all occurrences using the template show the choice. Keep the disclosure collapsed initially and out of collapsed exercise cards. No image upload, crop editor, generated images or per-occurrence overrides.

Preserve the choice through template duplication, program linking/copying, catalog propagation, revision recovery and import replacement. Portable bundles remain version 4: write the portable `coverId` for each template and accept it as an additive field. Versions 1–4 without it get `gym`; invalid present values fail atomically. An older application may drop this new optional field on re-export; there is no compatibility claim that older code preserves new metadata. Do not introduce a version 5 format for a visual choice that needs no new identity model.

Copy the resolved `coverId` into each newly created workout snapshot, including starts from programs and templates; blank workouts use `gym`. Logs retain version 2, and old version 1/2 logs and mirrors missing the field normalize to `gym` without migration. Validate present IDs against the same whitelist with Invalid workout cover. Preserve the snapshot field through editing, sync, queues and conflicts. Later template edits/deletion do not change a running workout's cover. Workout logs remain outside exports. Exclude cover metadata from AI review projections, volume and analytics.

The template and workout JSON documents accommodate this field; no SQL migration or new persistence table. Keep the existing server revision and active-workout invariants.

## Starting, loading, failure and offline behavior

- Render Home's structural layout immediately, with a stable dark cover placeholder and a Finding your next workout… status. Avoid a layout shift when the image arrives. Resolve local Resume first.
- Fetch settings, program/template lists and the first history page independently; resolve only the active program bundle for the recommendation. Fetch other program bundles and template documents on demand through the existing picker, not all on Home entry.
- Start uses the loaded resolved template/program occurrence and existing `startWorkout` controller. No intermediate details screen or picker. The button says Starting… and prevents repeated actions until start succeeds, fails or an existing-workout prompt is canceled. Do not introduce a second log-creation request path.
- Resume is an existing workout navigation, not a new start. Preserve offline edits, backoff, conflicts, finish validation and authentication behavior.
- A start error keeps the user on Home with a visible actionable error and restores the controls. A canceled prompt also restores them. A removed/obsolete source found during refresh cannot remain a working Start target.
- A failed history/settings/program load is distinct from successfully empty data. Do not manufacture a first-session or no-active-program recommendation when required data is unknown. Show Retry and keep Choose a workout usable. A template-list failure affects the picker, not an otherwise valid program recommendation.
- While refreshing an already resolved recommendation, keep its cover visible but disable Start until the required inputs are confirmed. On a failed refresh, keep that cover as context with an inline unavailable message, Retry and the picker; do not start from an unconfirmed recommendation. Resume stays usable regardless of recommendation failures.
- Image failure shows the plain dark cover with all text and controls intact. No retry is needed just to train. Images are decorative (`alt=""`) because the same session identity is present as text.
- Existing active mirrors can resume offline. This feature does not introduce offline cold-launch/PWA support, offline template/program caching, or new-workout offline creation. Blank workout remains reachable through the picker under the existing controller's connectivity rules.
- Guard every async update by authentication owner, mounted route lifetime and request order. Ignore results after navigation, sign-out, a later refresh, or activation of another program. Destroy subscriptions, focus listeners and rollover timers with the view. Do not let a late recommendation replace Resume.

## Components and integration

Keep responsibilities small and follow the current plain JavaScript module patterns:

- `src/workout-up-next.js`: pure shared occurrence selection and local recommendation date. Existing active-program helper stays authoritative.
- A shared cover module: fixed IDs, manifest lookup and normalization; static assets are bundled by the existing build.
- A Home state/controller module: data loading, refresh, state priority and lifecycle. The view does not perform API mutations or infer scheduling.
- A Home view module: accessible cover, loading/fallback/error states and action callbacks. Patch changed content without rebuilding a focused action on routine updates.
- `src/workout-controller.js`: expose a read-only subscription for relevant owned-workout changes and a scoped way to suppress the bar. Observers are removable and receive active snapshots without taking logger ownership. Existing sync remains the sole writer of the active mirror.
- `src/app.js` / `src/router.js`: canonical Home route, centralized empty-route default, responsive navigation and wiring to the existing start sheet/controller. Extract the shared sheet-launch wiring so Home and History cannot diverge in activation, retries or start behavior.
- Template validation/serialization, workout validation/creation, and `src/session-editor.js`: preserve cover metadata and implement the cover choice with existing autosave.
- `style.css` and `docs/design-system/README.md`: document and implement Home, five mobile tabs, cover selector, sizing and motion together. The five-tab layout must work on every mobile route, not only Home.

An explicit desktop Home is the same route/state model with a narrower presentation, not a separate application.

## Accessibility and motion

- One page heading and a subordinate session heading; program/date/status/action have a meaningful reading order. Long user text wraps and is inserted safely as text.
- Native buttons/links, visible focus, at least 44px touch targets, normal zoom, and 4.5:1 text contrast over every shipped cover. Never rely on star, color or progress track alone to convey meaning.
- Home does not autofocus Start or move focus when data settles. Reuse route heading focus conventions. The sheet returns focus to its actual invoking action, whether Start fallback, Choose another workout or Set active program. If an update removes that action, restore the nearest surviving logical control without stealing a user's new focus.
- Loading/progress uses a restrained live status; errors are announced once. Do not announce every autosave or repeated identical progress update. Starting exposes its busy state without an animated decorative treatment.
- Reuse existing route transition and start-sheet motion. Home data/image/progress replacements are instant, with no initial reveal, parallax, crossfade or idle animation. Cover disclosure uses the 200ms ease-out pattern, closing content inert immediately, rapid reversal safe. Reduced motion makes transitions instant.
- The active-workout bar has no entrance/exit animation on initial Home presentation. Leaving Home restores its normal existing behavior without retaining phantom bottom padding.

## Verification and release acceptance

These are required future checks, not a claim that the feature has been implemented or verified.

- Pure selection tests: today/future/next week, Sunday–Monday, DST, year rollover, multiple sessions today, completed early, discarded workout, removed occurrence, Unscheduled-only/empty program, Sequence rests/wrap, missing/deleted active program. Home and sheet select the same occurrence from identical inputs. Preserve the bounded history input deliberately.
- Data tests: template and log defaults, valid/invalid cover IDs, old log mirrors/queues, revision saves, snapshot independence after template edits, duplicate/link/catalog propagation, portable v1–v4 import/export, and absence from AI input and analytics. No migration required.
- Lifecycle tests: immediate local Resume, finish pending sync then Home, discard, activation while sheet open, request races, navigation/sign-out, focus/midnight refresh, failed required inputs, failed refresh disabling stale Start, image failure, and cleanup. Home subscriptions must coexist with logger ownership.
- Browser flows: no-hash mobile landing, unchanged desktop landing, preserved deep links, all five tabs and active states, direct one-tap start, repeated tap creating one workout, Resume offline, choose another with existing-workout prompt, fallback Blank/program/template starts, cover selection autosave/shared use, and bar suppression/restoration.
- Inspect populated states at 320/360/390px, 760/761px boundary, phone landscape, tablet, 1366×768, 1440×900 and 1920×1080, plus 200% text, long names, touch/hybrid input, keyboard focus and reduced motion. Review all four cover crops and contrast. No horizontal scrolling or unreachable controls.
- Run the unit suite, targeted affected browser suites and production build; broaden checks when changed shared code warrants it. Record actual commands, results, screenshots and remaining release checks in the verification document during implementation.
- Deploy the client and server validation changes together. Asset credits ship with the assets. No database operation is needed. Never claim a pending preview or production deployment was verified.

## Out of scope

History or activity widgets on Home; weekly charts/streaks; new scheduling or rest-day inference; all-history recommendation redesign; workout previews before Start; changing tracker inputs or finish rules; desktop navigation redesign; custom uploads; cover generation; occurrence-specific covers; profile changes; new offline/PWA capabilities; server-side stored recommendations or a recommendation endpoint.
