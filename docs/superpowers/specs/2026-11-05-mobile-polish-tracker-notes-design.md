# Mobile navigation, active program, start-sheet search and tracker polish — design (2026-11-05)

Approved in the 2026-11-05 brainstorming session. Seven changes in two parts:

- **Part A:** mobile bottom tab bar, the active program, and search in the Start workout sheet.
- **Part B:** workout tracker set-row alignment and separation, superset/warm-up logging, and notes.

These requirements supersede, where they conflict:

- the Workout start sheet's Up next program rule (AGENTS.md "Workout start sheet");
- the header layout below 761px;
- the tracker V1 "notes" out-of-scope item;
- the logger set-row layout.

Superset and warm-up logging is the approved design `docs/superpowers/specs/2026-11-04-log-warmups-supersets-design.md` (branch `feature/log-warmups-supersets`, Task 1 done). It applies unchanged except where §B1 (set-row grid) and §B3 (notes join log version 2) extend it.

## Intent

- The phone experience, especially logging a workout, is fast and visually calm. That means fewer taps, aligned edges, a clear hierarchy and no cluttered rows.
- Navigation takes one compact row at the top and a thumb-reach tab bar at the bottom, instead of about 190px of wrapped links.
- The user says which program they follow. Up next suggests only from it.
- Long program and template lists are searchable.
- Each set is visually one unit with aligned controls.
- Supersets log the way they are performed.
- Notes can be added at exercise and set level without adding visual weight when unused.

Desktop layouts stay as they are, apart from shared components (start sheet, set row at wide containers).

Out of scope:

- notes on templates/programs, and notes in exports, AI review or analytics;
- rest timer;
- multiple active programs;
- searching by exercise name;
- a per-device active program;
- a mobile side drawer.

---

## Part A

### A1. Mobile navigation (≤760px)

**Structure.** The existing `<nav aria-label="Main">` is restyled with a media query; there is no duplicate navigation markup.

**Bottom tab bar:**

- Fixed to the bottom: `56px + env(safe-area-inset-bottom)`, surface background, top border, above page content (`z-index` below dialogs).
- Four equal tabs, each an inline SVG icon (24px, `currentColor` stroke, `aria-hidden`) above a visible label. The labels are `Programs`, `Templates`, `Catalog` and `Workouts`; each link's accessible name equals its visible label. Tabs are the existing links (native, same hashes, same click handling).
- The current tab uses the accent colour, a 2px top indicator and keeps `aria-current="page"`. Each tab fills its quarter with at least a 44×44px target.
- `index.html` adds `viewport-fit=cover` to the viewport meta so the safe-area inset applies.

**Top bar:**

- One row about 48px tall: save status and its Retry / Reload saved version / Save as copy on the left; Profile and Log out icon buttons (44px) on the right.
- Not sticky, so the tracker's sticky header still pins at `top:0`.
- The brand stays hidden.

**Workout resume bar:**

- The resume bar (`workout-bar`) sits directly above the tab bar.
- Body bottom padding reserves the tab bar plus the resume bar when shown, so content is never covered. The bar's existing 180ms slide stays.

**Keyboard:**

- While a text input, textarea or contenteditable inside `#app` has focus at ≤760px, the tab bar (and the resume bar with it) slides out of view: 150ms `transform` ease-out, back on blur.
- The reserved padding does not change while it is hidden, so the page does not reflow under the keyboard.
- With reduced motion this is instant. Tab changes themselves are instant (route change).

**Above 760px:** the current header is unchanged.

**Accessibility:** focus order follows the DOM. Changing route moves focus to the page heading as today.

### A2. Active program

**Storage:**

- Migration `009-app-settings.sql` creates `app_settings(key TEXT PRIMARY KEY, value_json TEXT NOT NULL, updated_at TEXT NOT NULL)`. Run it explicitly per environment, like every migration; builds and requests never migrate.
- `GET /api/settings` returns `{settings:{activeProgramId}}`. The value is `null` when unset or when the stored id no longer names a program document, so a deleted program reads as none.
- `PUT /api/settings/active-program` with `{programId: string|null}` sets or clears the value. The rules:
  - the request needs the existing authentication and origin checks;
  - a non-null id must name an existing program, else `404 NOT_FOUND` / `Program not found.`;
  - it returns the new `{settings}`.
- Last write wins: it is a single toggle, so there is no revision.
- Settings are server-only, single-user and never exported or sent to the AI review.
- Program duplication never copies it. Deleting a program needs no extra write (GET resolves to `null`).

**Programs list:**

- Each program card gets a star icon toggle among its icon actions:
  - `aria-pressed`;
  - accessible name `Active program {name}`;
  - tooltip `Set as active program` when off and `Active program` when on;
  - outline star when off, filled accent star when on.
- Pressing it sets this program active, or clears it when already active.
- **Optimistic update:** the change shows immediately. On failure it reverts and shows the error in the library's existing message area (401 goes to sign-in as usual).
- **Active card:**
  - an `Active` badge (accent outline pill) after the name;
  - the card sorts first, other cards keep their order;
  - re-sorting is instant (data update, not animated).
- Only one program is active at a time.

**Start sheet (Program tab).** The Workouts route also loads settings. If settings fail to load, the sheet behaves as "no active program".

- **Active program set:**
  - The Up next card comes from the active program only, with unchanged week/sequence rules (`upNextOccurrence`).
  - The active program is listed first, expanded, with an `Active` badge on its disclosure.
  - Other programs follow, collapsed, in the existing order.
- **No active program set:**
  - There is no Up next card. Instead one compact line: `No active program · Make {name} active`, where the action is a text button.
  - `{name}` is the program the previous rule picks (`upNextProgram`: newest program log's program, else most recently edited).
  - Activating it saves the setting, swaps the line for the Up next card (focused) and moves that program first and expanded. Failure shows an inline error with the button still available.
  - With no programs, the existing empty state shows.
- Focus on open is unchanged: the Up next card, else the selected tab.

`src/workout-up-next.js` gains a pure `activeProgram(programs, activeProgramId)`, returning the matching record or `null`. `upNextProgram` remains as the suggestion rule.

### A3. Start sheet search

**Field:**

- One search field under the tabs row:
  - `type="search"`, label `Search sessions` (visually hidden), placeholder `Search`;
  - magnifier icon and the native clear button;
  - 44px tall on touch, 32px on fine pointers.
- It filters the visible tab. The query is kept when switching tabs.
- Filtering runs on every input with no debounce, and results render instantly (routine data update, no animation).
- Escape in a non-empty field clears it and keeps the sheet open; Escape with an empty field closes the sheet as today.
- The field is always visible.
- Opening the sheet never focuses it, so the phone keyboard doesn't cover the sheet.

**Matching:**

- A pure `matchesQuery(text, query)` (`src/search-text.js`).
- Case- and diacritic-insensitive (NFD and strip combining marks, lowercase).
- The query splits on whitespace; every token must appear as a substring.
- An empty or blank query matches everything.

**Template tab:** filters template rows by name.

**Program tab:**

- A non-empty query hides the Up next card / no-active line and the program disclosures. It shows a flat result list instead: each program with at least one match gets a small heading (program name, `Active` badge when active), followed by its matching sessions in `sessionOrder` with their existing meta (day · exercises · duration).
- A session matches if its own name or its program's name matches.
- Results reuse the existing session buttons (same start flow and accessible names).
- Every program loads on the first non-empty query through the sheet's existing per-sheet cache, with a `Searching…` status while any load is pending; results appear as they arrive.
- A failed program shows `Couldn't search {program}.` with Retry inside the results.
- Clearing the query restores the disclosure view, preserving each program's expanded state.

**Empty result:** `No sessions match "{query}".` (Template: `No templates match "{query}".`)

**Busy state:** while a start is in progress, the field is disabled along with the rows, tabs and Blank.

---

## Part B

### B1. Set row: one aligned grid with clear separation

**Grid.** Every set row and the column header use one grid:

```
[#: 1.5rem] [kg: minmax(0,1.15fr)] [reps: minmax(0,1fr)] [action: 44px]
```

**Phone and narrow cards** (card inline size < 560px):

- **Line 1:** set number (`1`, `2`… or `W1`…), kg stepper, reps stepper, ✓ toggle (44×44).
- **Line 2:**
  - a muted `RIR` caption in the number column;
  - a joined 0–5 segmented control spanning exactly the kg and reps columns (six equal segments, shared outer border, 44px tall; existing pressed/placeholder styles);
  - a **⋯ set menu** button (44×44) in the action column, accessible name `Set {n} actions, {exercise}`.
- **Line 3 (only when the set has a note):** the note line, spanning kg through action (§B3).

**Header:** `SET  KG  REPS` aligned to the same columns. The `RIR` column header is removed on narrow cards.

**Wide cards** (≥560px, the existing container query):

- One line per set: `# | kg | reps | RIR segmented | ✓ | ⋯`.
- The header labels the RIR column.
- The note line spans from kg to the end.

**Set menu:**

- Uses the existing menu component (`reorder-menu.js` pattern; keyboard, Escape and focus return).
- Items: `Add note` (or `Edit note` when the set has one) and `Remove set`. Remove keeps its current behaviour, including finished-log last-set confirmation and focus.
- The separate per-row remove button is removed.
- Read-only logs have no menu; their action column stays empty so the grid holds.

**Separation:**

- Consecutive sets are divided by a 1px `--border` hairline with 8px vertical padding per set (none above the first).
- A done set keeps its tinted band, which now spans the full card width, the hairline included.
- Warm-up rows use the muted number style from the 11-04 design.

**Sizing:**

- On phones the logger's page gutter is 12px and card padding 10px, so the steppers have room.
- Steppers keep 44px ± buttons. Inputs use tabular numerals.
- `999.75` kg and `100` reps must be fully visible at 375px width and above. At 360px they may scroll inside the input, but must not overflow.
- Touch targets stay ≥44px. Fine-pointer desktop sizing is unchanged.

**Motion:** set add/remove keeps the 200ms collapse pattern; done tint keeps its 150ms colour transition; reduced motion instant.

### B2. Supersets and warm-ups

Implement `docs/superpowers/specs/2026-11-04-log-warmups-supersets-design.md` §§1–6 as approved: log version 2, W rows, Add warm-up, the superset frame with A1/A2 labels, guided ✓ focus, warm-up-free Last time and placeholders, and Finish rules.

Its set rows use the §B1 grid. Add warm-up sits beside Add set in the same action strip.

### B3. Notes

**Data (log version 2, not yet released):**

| Field | Rule |
|---|---|
| `exercises[].note` | String, 0–1,000 UTF-16 code units; default `""`. |
| `exercises[].sets[].note` | String, 0–280 UTF-16 code units; default `""`. |

- Limits live in `WORKOUT_LIMITS` (`exerciseNoteMax`, `setNoteMax`).
- Validation is shared by client and server. The canonical log always carries both fields.
- Version 1 logs (stored, mirrored or queued) upgrade with `""`.
- Over-limit text rejects the save with `Exercise N: Note must be at most 1,000 characters.` or `Exercise N, set M: Note must be at most 280 characters.` The UI caps input with `maxlength`, so this only guards other clients.
- Notes are stored as typed and trimmed only when the field loses focus; whitespace-only becomes `""`.
- A swap keeps the exercise note. Removing a set or exercise removes its notes.
- New logs start with empty notes. Template, program and catalog data never gain notes.
- Logs are never exported, and notes never reach the AI review, volume or analytics.

**Exercise note UI:**

- Under the Last time line, a quiet text button `✎ Add note` (accessible name `Add note, {exercise}`), muted and 44px tall on touch.
- **Open:** pressing it replaces the button with an auto-growing textarea (label `Note, {exercise}`, `maxlength` 1000, 2 rows minimum). It opens with the 200ms collapse pattern and takes focus.
- **Empty on blur:** collapses back to the button (same motion).
- **Saved note:** shows as a quiet muted line, `✎ {note}`, wrapping with no clamp. It is a button that reopens the textarea with the caret at the end.
- Enter inserts a newline.
- Edits commit on input through the existing commit/autosave/mirror path, like weight and reps.

**Set note UI:**

- `Add note` in the set menu opens a one-line input (`Note, set {n}, {exercise}`, `maxlength` 280) in line 3, with the same motion, and focuses it.
- Enter or blur finishes. Empty on blur collapses it.
- A saved set note shows as a muted line spanning kg → action: `✎ {note}`, a button that reopens the input. `Edit note` in the menu does the same.

**Finished logs:** notes are editable, like other fields.

**Read-only history:** saved notes show as plain text, with no add buttons or menu items.

**Last time's note:**

- `GET /api/workouts/last` also returns each variant's last log exercise note (`note`, `""` when absent or version 1).
- When non-empty, the logger shows it under the Last time line as a read-only quoted muted line, clamped to 2 lines with the full text in `title`, prefixed with the visually hidden `Last time note:`.
- It is never copied into the new log.
- The current exercise's own note control sits below it.

**Motion:** every note open/close uses the 200ms collapse pattern, closing completes before removal, rapid reversal is safe, and reduced motion is instant. Typing is never animated.

---

## Testing and verification

`npm test`, `npm run test:e2e` and `npm run build`; run migration 009 locally.

**Unit:**

- `matchesQuery`;
- `activeProgram`;
- settings repository and API (set, clear, unknown id 404, deleted program reads `null`);
- notes validation and the version 1 upgrade (including mirror recovery);
- note length errors;
- swap keeps the note;
- Last time returns the note;
- the 11-04 unit list.

**E2E:**

- **Phone 390×844 touch:**
  - tab bar navigation and `aria-current`;
  - resume bar above the tab bar;
  - the tab bar hides while typing.
- **Active program:**
  - star toggle and badge/sort;
  - the sheet's Up next comes from the active program only;
  - the no-active line activates in one tap;
  - deleting the active program falls back.
- **Search:**
  - template filter;
  - program search across programs (lazy loads, grouped results, retry on failure);
  - Escape clears first;
  - query kept across tabs.
- **Tracker:**
  - set-row column alignment checked by bounding boxes: kg/reps/✓ columns align across rows and the RIR control spans kg→reps within 1px;
  - hairline separators;
  - set menu remove;
  - exercise and set notes add/edit/collapse;
  - Last time note shown;
  - read-only history shows notes;
  - the 11-04 e2e list.
- **Desktop at 1366×768:** wide-card single-line rows; header unchanged.

**Manual:**

- 360, 390 and 430px widths, 200% text, hybrid touch and reduced motion.
- Screenshots alone can't verify motion.

Record results in `docs/superpowers/verification/2026-11-05-mobile-polish-tracker-notes.md`. Never claim a pending deployment was verified.

## Delivery

Three plans sized to their risk, executed in order:

1. **Light:** `docs/superpowers/plans/2026-11-05-mobile-nav-search.md` covers A1 and A3. Both are client-only, mostly CSS plus one pure helper, with focused tests and the existing suite.
2. **Medium:** `docs/superpowers/plans/2026-11-05-active-program.md` covers A2 (migration 009, API, Programs list, start sheet).
3. **Rigorous:** `docs/superpowers/plans/2026-11-05-tracker-polish-supersets-notes.md` covers B1 (including set separators), then the remaining 11-04 tasks (2–7) adapted to B1, then B3. It continues on `feature/log-warmups-supersets` rebased onto main after plans 1–2 merge, superseding that branch's plan from Task 2 on.

Update AGENTS.md and the design-system doc with each plan's final requirements.
