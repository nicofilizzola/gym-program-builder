# Workout start sheet design (2026-11-05)

## Intent

Today the Workouts page (`#/workouts`) can only start a blank workout; starting from a program occurrence or a session template means leaving for the Programs or Session templates pages. The user wants to start the session they meant to do directly from Workouts, with the most seamless flow possible.

Success: Workouts → **Start workout** → tap the suggested session → logging. Any other program session, any template, or a blank workout stays two to three taps away. Starting behaves exactly like the existing starts (same log snapshot, same active-workout handling).

Decided with the user (2026-11-04/05):

- One **Start workout** button opens a sheet (bottom sheet on phones/tablets, dialog on desktop) with **Program | Template** tabs and a **Blank workout** action. Blank becoming a second tap is accepted.
- The sheet suggests **Up next** from the program last logged from (fallback: most recently edited program).
- Week mode looks ahead to the next scheduled session not yet logged this week, wrapping to next week once the week is done.
- Approach A: the suggestion is computed in the browser from the first history page; no server, API or schema change.

## Existing behaviour reused

- `workouts.start({template, program, occurrenceId})` via `startWorkout` in `src/app.js` creates the log (`createWorkoutLog`), recovers unsynced logs and asks Resume / Finish / Discard when a workout is active. The sheet only calls it.
- Logs record `source` (`{kind:'program', programId, occurrenceId, templateId, …}`, `{kind:'template', …}` or `{kind:'blank'}`); history summaries (`api.listWorkouts()`, newest first, 30 per page) carry `source` and `startedAt` (local ISO with offset).
- `api.list('program'|'template')` returns `{id, name, updatedAt, …}` ordered by `updated_at DESC`. `api.programBundle(id)` returns the program document and its templates; `resolveProgram` (`src/program-links.js`) resolves occurrences to named workouts. `api.get(id)` loads a full template (as the library's Start workout does).
- Programs: `mode` `'schedule'` = Week, `'simple'` = Sequence; occurrences `{id, templateId, day}` with `day` 0 (Monday)–6 or `null` (Unscheduled); `getSequence(program)` (`src/program-sequence.js`) gives the Sequence order including rest entries.
- `durationLabel(workout)` (`src/duration.js`) gives `~N min`.
- Motion: `mountDialogMotion` (`src/dialog-motion.js`, catalog modal 150ms fade/4px), the `.collapsible`/`.is-closed` 200ms grid-row collapse in `style.css`.

## User experience

### Entry point

The Workouts header's **Start blank workout** button becomes **Start workout** (same `add-btn` accent style, a play icon before the text). The empty-history text becomes `No workouts yet. Start one from a program, a session template or a blank workout.`

### Sheet layout

A native `<dialog class="start-sheet">` opened with `showModal()`:

- **≤760px:** bottom sheet anchored to the bottom edge, full width, rounded top corners (`--radius`), a centered grab handle, `max-height: 85dvh`; the body scrolls inside, header and tabs stay fixed.
- **≥761px:** centered dialog `min(480px, 100vw − 32px)` wide, `max-height: min(640px, 100dvh − 32px)`, same internal scrolling.

Contents, top to bottom:

1. **Header:** title `Start workout` and a Close icon button (`Close`).
2. **Tab row:** `Program | Template` segmented tabs at the left, a text button **Blank workout** at the right (wraps below at narrow widths/enlarged text). Program is selected when at least one program exists, otherwise Template.
3. **Program tab:**
   - **Up next card** (only when a suggestion exists): label `Up next · <program name>`, line `<session name>`, metadata `<Mon|Day N> · N exercises · ~N min`, and a ▶ **Start** affordance; the whole card is one button. While the suggested program's sessions load, the card shows one muted skeleton line `Finding your next session…`.
   - **Program list:** one row per program in list order (most recently edited first). Each row is a disclosure button (`aria-expanded`) showing the program name and mode (`Week`/`Sequence`). The Up next program starts expanded; the others start collapsed and fetch their sessions on first expand (`Loading…` row meanwhile).
   - **Session rows** (inside an expanded program): session name, then the weekday (Week; `Mon`…`Sun`) or `Day N` (Sequence, counting workout entries only), exercise count and `~N min`. Week lists Monday→Sunday in program order, then an `Unscheduled` label with the unscheduled occurrences. Sequence lists workout entries in sequence order (rests omitted). A program with no sessions shows `No sessions in this program.`
4. **Template tab:** one row per template, most recently edited first, showing the name. Exercise counts are not shown (the list endpoint has no document).
5. **Empty states:** no programs → `No programs yet.` and a link `Go to Programs` (`#/programs`, closes the sheet); no templates → `No session templates yet.` and `Go to Session templates`.

Tapping a session row, the Up next card or a template row starts it immediately; **Blank workout** starts a blank workout.

### Starting

1. Rows, the card, tabs and Blank workout get `disabled`/`aria-disabled` (busy) so a double tap cannot start twice.
2. Template starts first fetch the template (`api.get`); program starts use the already loaded bundle.
3. The sheet closes (with its exit motion), then `startWorkout(...)` runs; the existing flow handles the active-workout prompt, errors and navigation to the logger.
4. If the template fetch fails, the sheet stays open, the row shows an inline error (`Couldn't load this template. Try again.`) and the busy state clears.

### Closing

Close, Escape, a backdrop tap and a swipe down on the grab handle/header (bottom sheet only) close the sheet. Focus returns to Start workout. The sheet keeps no state between openings (tab, expansion and caches reset).

## Up next rules

Pure functions in `src/workout-up-next.js`; `now` and logs are inputs, never read from globals.

### Program choice — `upNextProgram(programs, logs)`

- `programs`: the program list (most recently edited first); `logs`: the history page summaries (newest first).
- Returns the `programId` of the first log with `source.kind === 'program'` whose program still exists in `programs`; otherwise the first program's id; `null` when there are no programs.

### Occurrence — `upNextOccurrence(program, logs, now)`

`program` is the resolved program document; only logs whose `source.programId` matches count. Returns `{occurrenceId, label}` (label `Mon`…`Sun` or `Day N`) or `null` when the program has no occurrences eligible for suggestion.

**Week (`mode: 'schedule'`):**

- The current week runs Monday 00:00 to the next Monday 00:00 in local time, derived from `now`. A log is "this week" when `new Date(startedAt)` falls in that range.
- An occurrence is logged this week when a this-week log has its `occurrenceId`.
- Candidates are scheduled occurrences (`day !== null`); Unscheduled ones are never suggested. Within a day, program order applies.
- Pick the first candidate from today through Sunday that is not logged this week. Earlier days this week are not caught up: a missed Monday session is not suggested on Wednesday.
- If none remains, the week is done: pick next week's first scheduled occurrence (lowest day from Monday, then program order), ignoring logged status.
- `null` when there are no scheduled occurrences.

**Sequence (`mode: 'simple'`):**

- Workout entries of `getSequence(program)` in order (rests skipped).
- Find the newest matching log whose `occurrenceId` is still in the sequence; suggest the entry after it, wrapping to the first. Without such a log, suggest the first entry.
- `null` when the sequence has no workout entries.

### Worked examples (unit tests)

Program PPL (Week): Push A Mon(0), Pull A Tue(1), Legs A Thu(3), Arms Unscheduled. `now` = Wednesday 2026-11-04 10:00 local.

| Logs this week (PPL)                 | Up next                    |
|--------------------------------------|----------------------------|
| none (Mon/Tue missed, not caught up) | Legs A (Thu)               |
| Push A, Pull A                       | Legs A (Thu)               |
| Legs A, logged early on Wednesday    | Push A (Mon, next week)    |

- `now` Thursday, nothing logged this week: Legs A (today pending).
- `now` Thursday, Legs A logged today: week done → Push A (Mon).
- Two sessions on Monday (Push A, then Push B in program order), `now` Monday, Push A logged today: Push B.
- `now` Sunday, nothing scheduled Sunday, all logged: wrap → Push A (Mon).
- A log from last week's Thursday does not count as logged this week.

Program Cycle (Sequence): A, rest, B, C.

- No logs → A (`Day 1`). Last log B → C (`Day 3`). Last log C → A. Last log from a removed occurrence, previous log B → C (newest log still in the sequence wins).

Program choice: newest program log is from program X (exists) → X; newest program log's program deleted, older log from Y → Y; no program logs → first program in list order.

## Components and data flow

- **`src/workout-up-next.js`** (new, pure): `upNextProgram`, `upNextOccurrence`, plus a small exported `weekStart(now)` helper. No DOM.
- **`src/workout-start-sheet.js`** (new, view): `openWorkoutStartSheet({programs, templates, logs, listErrors, loadProgram, loadTemplate, onStart, onNavigate, now})`.
  - `programs`/`templates`: list records or `null` when that list failed; `listErrors.retry(kind)` refetches a list.
  - `loadProgram(id)` → `{program, workouts}` where `workouts` are resolved occurrences with `name`, `exercises.length` and `durationLabel`; results are cached per id for the sheet's lifetime.
  - `loadTemplate(id)` → full template record.
  - `onStart(options)` receives `{template, program, occurrenceId}` or `{}` for blank, after the sheet has closed.
  - Builds DOM with the existing helpers/icons, owns tabs (roving `aria-selected`, ←/→/Home/End), disclosures, the swipe gesture (pointer events on the handle/header; close when dragged down > 80px or flung, otherwise spring back) and the busy state.
- **`src/workout-history-view.js`:** button label/icon and `onStartBlank` → `onStart`; empty text updated.
- **`src/app.js`** (Workouts route): fetch `api.list('program')` and `api.list('template')` in parallel with `api.listWorkouts()` (each failure caught separately so history still renders); `onStart` opens the sheet with those results and the history page. `loadProgram` wraps `api.programBundle` + `resolveProgram`; `loadTemplate` wraps `api.get`; `onStart` calls `startWorkout`.
- **`style.css`** then **`docs/design-system/README.md`** (same change): `.start-sheet` dialog/bottom sheet, tab row, Up next card, program disclosure rows and session rows, using existing tokens, borders and radii. Rows are 44px touch / 32px compact fine-pointer desktop minimum height.

On open nothing waits on the network: the sheet renders from the route's data immediately and requests the Up next program's bundle in parallel.

## Errors and offline

- Program or template list failed at route load: the tab shows `Couldn't load programs.` (or templates) with **Retry**; Blank workout always works.
- A program bundle fails: the error and **Retry** appear inside that program's expanded row; the Up next card disappears if it depended on it.
- History failed to load (existing offline message): Up next falls back to the most recently edited program with no logged sessions considered.
- Start failures after closing are handled by the existing start flow.

## Motion

| Interaction | Behaviour | Reduced motion |
|---|---|---|
| Bottom sheet open/close | `transform: translateY(100%) → 0` and backdrop opacity, 200ms ease-out; closing reverses before `close()`/removal; rapid reopen reverses mid-way without stale timers | instant |
| Desktop dialog open/close | existing catalog modal motion (150ms opacity + 4px) via `mountDialogMotion` | instant |
| Swipe down | sheet follows the pointer (no transition while dragging); release past threshold animates closed, otherwise back to 0 over 200ms | follows pointer; release settles instantly |
| Program disclosure | `.collapsible`/`.is-closed` 200ms grid-row + opacity; neighbours glide | instant |
| Tab switch | instant panel swap (navigation, a fade would only delay the list) | instant |
| Up next skeleton → card | text swap, no animation (data update) | — |

Closing content is `inert` and hidden from assistive technology while it animates out.

## Accessibility

- Labeled native `<dialog>` (`aria-labelledby` the title); focus on open goes to the Up next card, else the selected tab; Close/Escape/backdrop return focus to Start workout.
- Tabs: `role="tablist"`/`tab`/`tabpanel`, `aria-selected`, `aria-controls`, arrow keys.
- Program rows: buttons with `aria-expanded`/`aria-controls`; session rows: buttons named `Start <session>, <program>, <Monday|Day N|Unscheduled>`; Up next card named `Up next: <session>, <program>`; template rows `Start <template>`.
- Swipe is a shortcut only. Loading and error rows use `role="status"`/`role="alert"`.

## Testing

- **Unit (`test/workout-up-next.test.js`):** every worked example above, the Sunday→Monday week boundary, a log at exactly Monday 00:00, offsets in `startedAt`, empty programs, removed occurrences, Unscheduled-only Week programs (`null`).
- **E2E (`e2e/workout-start-sheet.spec.js`):** open and start via Up next, a program session (collapsed program expands and loads), a template and Blank; Up next advances after finishing a session; double tap starts once; active workout shows the Resume/Finish/Discard prompt; Close/Escape/backdrop return focus; empty states; offline list error with Retry; bottom sheet at a 390px viewport including swipe close; reduced motion.
- Update `e2e/workouts.spec.js` and `e2e/workout-start.spec.js` for the renamed button.
- **Browser review:** populated data at 390×844, 768×1024, 1366×768, 1440×900 and 1920×1080, 200% text, touch and fine pointer; rapid open/close and swipe reversal; long program/session names wrap; no horizontal scroll at 320px.
- Project verification: `npm test`, `npm run test:e2e`, `npm run build`.

## Out of scope

Remembering the last tab or expansion, search or filtering inside the sheet, editing programs/templates from the sheet, showing Up next on the Workouts page itself, server-side Up next, and suggestions for templates.
