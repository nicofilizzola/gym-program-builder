# Home and history

Date: 2026-11-12.

Status: Design approved in conversation on 2026-11-12; written specification awaiting user review. This is spec 3 of four from the 2026-11-11 backlog (item 4). It does not depend on specs 1 or 2.

## Purpose and agreed direction

On a phone, history lives on its own tab, which repeats Home's Start workout button. The user asked for history to sit on Home, "right below the start workout immersive menu", so they "could just scroll past and find the history directly", and for the History page to go. The aim is a simpler experience: no redundancy, clean, fluid and intuitive.

Decisions:

- Mobile has three tabs: Home, Library, User. History becomes a section of Home.
- The cover stays big but leaves room for the History heading and the top of the latest workout to peek above the tab bar. That peek is the only scroll cue.
- Older workouts load as you scroll, with Retry on failure and a `Load more` button kept for keyboard and screen-reader users.
- A workout that ends lands on Home at the top. The cover then shows what is next, and the workout just finished is the first item in the peek.
- Desktop is unchanged.

Success means the user finds any past workout by scrolling Home, never sees two Start workout buttons, and sees the workout they just finished without scrolling.

## Existing requirements and boundaries

This extends [Mobile training home](2026-11-06-mobile-training-home-design.md), [Mobile Library navigation](2026-11-07-mobile-library-navigation-design.md) and [Fluid root navigation](2026-11-08-fluid-mobile-navigation-design.md). It replaces these rules, and `AGENTS.md` and `docs/design-system/README.md` are updated in the same change:

| Existing rule | Replaced by |
|---|---|
| Mobile training home: "Home has one immersive cover and Start/Resume/Choose actions, never a history section." | Home has the cover, its actions and a History section below them (§2). |
| Mobile training home: "`#/workouts` remains history" | Only on desktop. At ≤760px `#/workouts` opens Home at its History section (§1). |
| Library navigation: "At ≤760px the bottom destinations are Home, Library, History and User." | Home, Library, User (§1). |
| Library navigation: "Touch swipes traverse Home ↔ Library ↔ History ↔ User" | Home ↔ Library ↔ User, still one destination at a time, without wrapping (§1). |
| Library navigation: "offline Finish may show the local pending finish with an explicit History load error" | Offline Finish lands on Home; the pending finish and the load error show in its History section (§3). |
| Fluid root navigation: History's visible extent, pagination, restoration and its pinned refresh status | The same rules apply to Home's History section. Its status shows inside the section, never pinned (§3). |

Unchanged:
- The cover's states, actions and recommendation rules (`workout-up-next.js`, Resume wins, the working-set progress, `coverId`).
- The start sheet, the workout bar and its suppression on Home.
- The history rows, day grouping, the pending-finish deduplication and the first-page recommendation input.
- Library, User, Profile and every desktop route and link, including the desktop Workouts page with its Start workout button.
- Logs, endpoints, cache scope, exports and AI review. No migration.

## 1. Navigation (≤760px)

- **Tabs.** Home, Library and User, evenly spaced, with today's icons, labels, 44px targets, accent and indicator. The History tab is removed on mobile only.
- **Swipes.** Home ↔ Library ↔ User, under every existing gesture rule (root pages only, inert previews, 220ms settle, 180ms cancel, instant with reduced motion).
- **Workout pages.** `#/workouts/{id}` (active logger, finished workout, recap) belong to the Home destination: the Home tab is current.
- **`#/workouts` on mobile** replaces itself with `#/home` (no extra history entry). Home opens with the History heading at the top of the page, under the app header, without animation. On desktop `#/workouts` stays the Workouts page. A route opened on one side of 760px survives a resize, as today. The Home tab is current for a Workouts page shown at ≤760px.
- **Where workouts end.** Finish, Discard, deleting a workout and the recap's Done land on `#/home` at the top on mobile. Desktop keeps `#/workouts`.
- **Home tab on Home.** Tapping the Home tab while Home is shown scrolls the page to the top: smoothly, or instantly with reduced motion. Focus stays on the tab. It does nothing else, such as refreshing or rebuilding the page.
- Empty entry still resolves to `#/home`.

## 2. Home layout

```
 Your training               Thu 12 Nov
 ┌───────────────────────────────────┐
 │ [cover image]                     │
 │ Push · Week 3                     │
 │ TODAY                             │
 │ Upper body A                      │
 │ ~55 min · 6 exercises             │
 │ [ ▶  Start workout              ] │
 └───────────────────────────────────┘
          Choose another workout
 History
 TUE 10 NOV
  Lower body B ·····················    ← first screen ends here
 ═══════════════ tab bar ══════════════
  Lower body B · Week 3 · 18:02 · 54 min · 18 sets
 SUN 8 NOV
  Upper body A …
```

- **Order.** The page is one column in this order: the heading (`Your training` and the date), the cover, `Choose another workout`, the existing status, error and setup lines, then `section.home-history` with an `h2` `History`.
- **First screen.** The heading, cover, alternative action and feedback lines fill the first screen less a 72px peek. The first screen is the existing `.workout-home` area under the app header and above the tab bar. At default text on a 390×844 viewport, the peek shows the History heading whole and the first day heading or the top of the first row. The cover keeps its 340px minimum, so on short phones or with enlarged text the peek shrinks to the heading or to nothing, and the page simply scrolls.
- **Rows.** Today's history rows, unchanged:
  - day headings;
  - each workout's name as a link to `#/workouts/{id}`;
  - a meta line: source · start time · duration · sets;
  - a locally pending finish first, tagged `Not synced yet`.
  - The section has no Start workout button; the cover's actions are the only way to start.
- **Empty.** `No workouts yet. Your finished workouts appear here.`
- **Loading as you scroll.**
  - When the end of the loaded rows comes within one screen height of the viewport, the next page loads. A `Loading…` line (`role="status"`) shows at the end while it loads.
  - A failure shows `Couldn't load older workouts.` with a `Retry` button in the same place.
  - When nothing is loading and more exist, the end of the list shows a `Load more` button. Keyboard and screen-reader users reach every page with it, and loading as you scroll presses the same action.
  - When the last page is loaded, nothing shows after the rows.
  - Loading never starts while a previous page request is in flight, and never repeats a failed page without Retry.
- **Returning.** Coming back to Home from a workout, by Back or by a swipe or tab, restores how much history was loaded and then the scroll position, under today's restoration rules. Restoration never overrides a scroll the user already made.
- **Motion.** Rows that load later and refreshed data appear without animation. The only motion this spec adds is the Home tab's scroll to the top.
- **Accessibility.** The History section is labelled by its `h2`. Day headings become `h3` and workout names `h4` under it, one level below the History page's. Focus stays on a row link across refreshes, as today. The cover's focus rules are unchanged.

## 3. Data and states

- **Two independent sources.** The cover keeps its recommendation controller, which is never cached. The History section uses the existing history page loader with the shared first-page cache, pagination and pending-finish deduplication. Up next already reads that first page, so it is never fetched twice. Neither source waits for the other.
- **Section states.**
  - Loading: `Loading…` under the heading.
  - First load failed: `Workouts could not be loaded. Connect to see your history.` with `Retry`.
  - Refresh failed: the old rows stay, with `Couldn't refresh. Showing previously loaded data.` and `Retry` under the heading.
  - An unknown or failed load never shows the empty message.
  - These lines live inside the section and are never pinned above the tab bar. The cover keeps its own status line.
- **Offline Finish.** Landing on Home after an offline Finish shows the pending finish as the first row. If the history list cannot load, the section shows its load error under that row.
- **Session memory.** Home remembers `{visibleCount, scrollY}` in memory only, as History did. Auth changes clear it.
- **Desktop.** Unchanged, including the Workouts page and its own loader.

## 4. Delivery order

One plan in two parts, built in this order and released together:

1. **History on Home:** the section, its states, loading as you scroll and restoration, on every viewport where Home shows. Desktop users reach Home only by URL.
2. **Mobile navigation:** three tabs, swipes, the `#/workouts` redirect, workout pages under Home, workouts ending on Home and the Home tab's scroll to the top.

Part 1 alone would leave a mobile History tab that duplicates Home's section, which is why the parts are released together.

## 5. Verification

- **Unit:** destination mapping (`#/workouts` and `#/workouts/{id}` to Home on mobile), the three-destination swipe order without wrapping, and whether loading as you scroll may start (in flight, failed, no more pages).
- **Browser (`npm run test:e2e`), at real browser heights:**
  - the peek at 390×844, and none at 360×660 or at 200% text;
  - three tabs, and the Home tab current on a workout page;
  - swipes Home ↔ Library ↔ User;
  - `#/workouts` opening Home at History with no extra history entry;
  - Finish, Discard, Delete and recap Done landing on Home at the top, with the finished workout first;
  - the pending row and an offline History error;
  - pages loading by scroll and by `Load more`, and a page failure with Retry;
  - restoration after opening a workout and going back;
  - the Home tab scrolling to the top;
  - desktop's four links and Workouts page unchanged.
- **Review:** populated Home with a recommendation, a Resume, an empty history and a long history, at 360, 390 and 412px, 200% text, reduced motion and touch input. Desktop at 1366×768, 1440×900 and 1920×1080 must be unchanged.
- **Physical phone:** the peek and scrolling past the cover. Record these as user-confirmed or pending in `docs/superpowers/verification/2026-11-12-home-history.md`. Never claim physical-device or deployment verification from localhost or emulation.
- `npm test`, `npm run test:e2e` and `npm run build` pass.

## Out of scope

Any desktop change; history search, filters, calendar or statistics; redesigned history rows; a pinned or floating "back to top" control; a mobile History route of its own; prefetching, polling or new persistence; backlog items 3 and 9–10 (specs 4 and 2).
