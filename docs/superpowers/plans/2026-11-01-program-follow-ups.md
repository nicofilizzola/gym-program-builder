# Program Follow-ups Bundle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship rest-day action placement, an undeformed drag preview, a stable program header, the review dock from 1024px, a user-level training background profile, and removal of session-template AI analysis.

**Architecture:** Plain browser ES modules + `style.css`, Node API in `server/` behind `api/index.js` (Vercel) and `scripts/dev-server.js` (local), SQLite/libSQL with explicit numbered migrations. Each task is independently shippable; tasks 6–7 share the profile interfaces defined in task 6.

**Tech Stack:** Vanilla JS (no framework/build), `node:test`, Playwright, `@libsql/client`.

**Spec:** `docs/superpowers/specs/2026-11-01-program-follow-ups-design.md`

## Global Constraints

- No new dependencies, frameworks, ORMs or browser persistence. Inline SVG icons via `actionIcon` in `src/action-controls.js`.
- Read `docs/design-system/README.md` (Feature design and review checklist) before UI tasks. Change values in `style.css` first, then the design system doc in the same task.
- Controls: 32px only at `(min-width:1100px) and (pointer:fine) and (not (any-pointer:coarse))`, otherwise ≥44×44px. Body figures never below 180px.
- Dock widths stay `--review-width` 340px / 360px at ≥1600px; dock motion 180ms; reduced motion instant.
- Text limit 2,000 UTF-16 code units for profile/context fields; CRLF→LF; whitespace-only stored as `''`.
- Never migrate or seed during builds/requests. Migration 007 runs only via `npm run db:migrate`.
- Program analysis route/limits/generation settings (2,500 tokens, 1,024 reasoning, no temperature, 60s timeout) unchanged.
- Never claim a pending deployment or migration was verified.
- Commit after each task; messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. Drag preview in a Week day whose container is narrower than 22rem / wider than 52rem (different container-query layouts) — copy must match the source in each. Pinned in Task 2 (two day widths).
2. Opening the dock at 1024–1279px while the volume panel is sticky/oversized — panel must stack above sessions, stay fully reachable, figures ≥180px, no horizontal scroll. Pinned in Task 4.
3. Legacy import (v3 file with `context.trainingBackgroundAndApproach` only) — must import without error, and since no remaining context field is non-empty, must not count as content for replacement confirmation. Pinned in Task 6.
4. Profile save conflict (two tabs) — 409 shows Reload saved version only, never Save as copy, and reload restores the server text without losing focus on the page. Pinned in Task 7.
5. Client posting `athlete` inside the program analysis snapshot — must be ignored; only the server-loaded profile reaches the prompt. Pinned in Task 6.

---

### Task 1: Rest-day actions on the right

**Files:**
- Modify: `src/program-view.js` (rest card build, ~lines 133–146)
- Modify: `style.css` (`.sequence-rest-item` rules ~1341–1343)
- Modify: `docs/design-system/README.md` (program cards paragraph)
- Test: `e2e/program-sequence.spec.js`

**Interfaces:** Produces rest card DOM `article.sequence-rest-item > h3 + div.item-actions > [button.reorder-action, button.action-button--delete]`.

- [ ] **Step 1: Write the failing test** `rest actions sit at the right edge aligned with workout actions` in `e2e/program-sequence.spec.js`, using `mountProgram(page,{sequence:[{type:'workout',workoutId:'a'},{type:'rest',id:'r'},{type:'workout',workoutId:'b'}]})` at 1440×1100:
  - `rest.locator('.item-actions button')` aria-labels equal `['Reorder rest day','Remove rest day']`.
  - Reorder box `x` > `h3` box right edge.
  - `|restRemove.right − workoutRemove.right| < 1` (workout = `[data-workout="a"] [data-action=Remove]`).
- [ ] **Step 2:** Run `npx playwright test e2e/program-sequence.spec.js -g "rest actions"` → FAIL (Reorder left of title).
- [ ] **Step 3: Implement.** Build `const actions=document.createElement('div');actions.className='item-actions';actions.append(handle,remove);card.append(title,actions);`. CSS: `.sequence-rest-item .item-actions {margin-left:auto;flex-wrap:nowrap;gap:6px}` (match `.workout-item .item-actions` gap). Update the design system program-cards paragraph: rest card actions are a right-aligned group (Reorder, Remove).
- [ ] **Step 4:** Run `npx playwright test e2e/program-sequence.spec.js e2e/drag-reorder.spec.js` → all PASS (existing touch test grabs `h3`).
- [ ] **Step 5: Commit** `fix: place rest-day actions at the right like session cards`.

### Task 2: Drag preview keeps the card's layout

**Files:**
- Modify: `src/sortable.js` (`begin()` ~51–62, `preview()`, teardown)
- Modify: `style.css` (`.sort-drag-copy` line ~1420; add `.sort-drag-host`)
- Modify: `docs/design-system/README.md` (drag feedback paragraph)
- Test: `e2e/drag-reorder.spec.js`

**Interfaces:**
- Produces (module-private in `src/sortable.js`): `dragHost(item: Element, root: Element) → {host: HTMLElement, slot: HTMLElement}` — `host` is appended to `document.body`; `slot` is the innermost recreated parent that receives the copy.
- `mountSortable` public signature unchanged.

- [ ] **Step 1: Write the failing test** `drag copy matches its source card layout` (parametrized over Week day widths and Sequence, plus the session editor):
  - Mount the program fixture used by `e2e/drag-reorder.spec.js` line 121 in `schedule` mode at 1440×1200 and at 1100×1200 (narrow vs wide day containers), and in `simple` mode.
  - Record source rects for the card and its `h3`, `.item-actions`, `[data-workout-duration]` (relative to the card). Start a mouse drag on the card body (`page.mouse.down`, move 20px), then measure the same elements inside `.sort-drag-copy`.
  - Assert copy width/height equal source within 1px and each relative offset equal within 1px; `.sort-drag-copy` has `inert` and `aria-hidden="true"`; release and assert `.sort-drag-copy,.sort-drag-host,.sort-placeholder` count 0.
  - Session editor: same assertions for `.exercise` with `.card-controls` and `.card-identity`.
- [ ] **Step 2:** Run `npx playwright test e2e/drag-reorder.spec.js -g "matches its source"` → FAIL in Week (title/action offsets differ).
- [ ] **Step 3: Implement `dragHost`.** Walk from `item.parentElement` up to and including `root`; for each ancestor create `document.createElement(tag)` with only `className` copied, `style` = `width:${borderBoxWidth}px;margin:0;padding:0;border:0;min-height:0;box-sizing:border-box`; nest outermost first. Outer host gets class `sort-drag-host` plus its ancestor class. Append the copy to `slot`; keep existing id/aria stripping, `inert`, `aria-hidden`, explicit copy width/height. Move translate from copy to host in `preview()`. Remove the host (not just the copy) everywhere the copy is removed today.
  CSS: `.sort-drag-host {position:fixed;left:0;top:0;z-index:1000;pointer-events:none;will-change:transform}`; `.sort-drag-copy` drops `position:fixed !important;left;top;z-index;will-change` and keeps `margin:0 !important;list-style:none;box-shadow;border-color;opacity`. Ensure `items()`/`targetAt()` still exclude the copy (host lives in body, outside groups).
- [ ] **Step 4:** Run `npx playwright test e2e/drag-reorder.spec.js e2e/program-sequence.spec.js e2e/reorder-regressions.spec.js e2e/exercise-disclosure.spec.js` → PASS.
- [ ] **Step 5: Commit** `fix: keep the dragged card's layout during drag previews`.

### Task 3: Program header with selector beside the name

**Files:**
- Modify: `src/program-view.js` (`buildOverview()` header markup ~225–233)
- Modify: `style.css` (`.program-heading`, `.program-toolbar`, `.program-file-actions` rules ~1345–1361, ~1447, ~1484–1489)
- Modify: `docs/design-system/README.md` ("Program context editor" toolbar paragraph, AI review toggle paragraph)
- Test: `e2e/program-review-dock.spec.js`, existing `e2e/compact-desktop.spec.js`, `e2e/program-overview.spec.js`

**Interfaces:** Produces header DOM `header.program-heading > h1 + div.program-identity(label.field[name] + fieldset.program-layout) + div.program-file-actions(...)`. `.program-toolbar` is removed; update any selectors using it (`grep -rn program-toolbar src e2e style.css`).

- [ ] **Step 1: Write the failing test** `program header keeps file actions together and the selector beside the name` in `e2e/program-review-dock.spec.js`, for `[1024,768],[1280,800],[1440,900],[1920,1080]`, dock closed then open:
  - `fieldset.program-layout` left − name field right is between 8 and 16px, and their vertical centers differ < 2px (when on one row).
  - The four file-action buttons (`[data-program-context]`,`[data-import]`,`[data-export]`,`[data-program-review]`) share one `top` (±1px), appear in that x order, AI review left − Export right = 16 (±1), and their right edge is within 1px of the header's content right edge.
  - Pairwise x-gaps between the four buttons are identical with dock closed and open.
  - At 390×844 the group may wrap; assert only no horizontal overflow (`scrollWidth<=clientWidth`).
- [ ] **Step 2:** Run it → FAIL (selector is in the actions row; buttons wrap individually).
- [ ] **Step 3: Implement.** Markup per Interfaces. CSS: `.program-heading {display:flex;flex-wrap:wrap;align-items:center;gap:12px 24px}`; `.program-identity {display:flex;align-items:flex-end;gap:12px;flex:1 1 360px;min-width:0}` with the name field `flex:1 1 240px;max-width:480px`; `.program-file-actions {display:flex;flex-wrap:nowrap;gap:8px;margin-left:auto}`; keep `.review-toggle {margin-left:8px}`; `@media (max-width:760px){.program-file-actions{flex-wrap:wrap;margin-left:0}}`. `.analysis-unavailable` currently relies on wrapping inside the group (`flex-basis:100%`); render it instead as a sibling `p` directly after `header.program-heading`, right-aligned, and delete the `.program-file-actions .analysis-unavailable` rule.
- [ ] **Step 4:** Run `npx playwright test e2e/program-review-dock.spec.js e2e/compact-desktop.spec.js e2e/program-overview.spec.js e2e/program-analysis.spec.js e2e/layout-polish.spec.js` → PASS.
- [ ] **Step 5: Commit** `fix: keep program file actions together and the layout selector by the name`.

### Task 4: Review dock from 1024px

**Files:**
- Modify: `style.css` (dock media queries ~1909–1937; add stacked grid rule)
- Modify: `src/analysis-panel.js:8` (fullscreen media query)
- Modify: `AGENTS.md` ("Program review dock and Week agenda": ≥1280px → ≥1024px, stacking rule), `docs/design-system/README.md` (dock section)
- Test: `e2e/program-analysis-panel.spec.js`, `e2e/program-review-dock.spec.js`, `e2e/program-analysis.spec.js:66`

**Interfaces:** CSS/media change only; JS `fullscreen=matchMedia('(max-width: 1023.98px)')` for the dock case.

- [ ] **Step 1: Update/write failing tests.**
  - Rename and retarget `below 1280px …` → `below 1024px the program review is a full-screen modal …` at 1023×800 (dialog box `{x:0,y:0,width:1023,height:800}`); breakpoint crossing tests use 1023/1024.
  - New `laptop widths dock the review and stack the weekly panel above sessions` for `[1024,768],[1152,864],[1279,800]`: after opening, `.review-dock` visible and `dialog.analysis-modal` absent; `[data-weekly-panel]` bottom ≤ sessions container top; each `.body-map svg` height ≥180; `document.documentElement.scrollWidth<=innerWidth`; after Close, panel is beside sessions again (panel left > sessions right).
  - `e2e/program-analysis.spec.js:66` selector condition `width>=1024`.
- [ ] **Step 2:** Run `npx playwright test e2e/program-analysis-panel.spec.js e2e/program-review-dock.spec.js` → FAIL.
- [ ] **Step 3: Implement.** Replace `min-width:1280px` / `max-width:1279.98px` in the dock block with `1024px` / `1023.98px`. Add `@media (min-width:1024px) and (max-width:1279.98px){.program-route:has(> .review-dock.is-open) .program-grid{grid-template-columns:minmax(0,1fr)}.program-route:has(> .review-dock.is-open) .program-grid>[data-weekly-panel]{grid-row:1}}` (place after the 1100px `.program-grid` rule so it wins). Update `analysis-panel.js:8`.
- [ ] **Step 4:** Run `npx playwright test e2e/program-analysis-panel.spec.js e2e/program-review-dock.spec.js e2e/program-analysis.spec.js e2e/compact-desktop.spec.js` → PASS.
- [ ] **Step 5: Commit** `feat: dock the program review from 1024px and stack the panel while docked on laptops`.

### Task 5: Remove session-template AI analysis

**Files:**
- Modify: `src/session-markup.js` (remove `[data-analyze]` button), `src/session-editor.js` (remove `mountAnalysisPanel` import, `analysisPanel`, `setAnalysisEnabled`, `analysisEnabled` option, `refresh()` call, destroy call), `src/app.js:196–198` (remove `analysisEnabled:null` and template capability fetch)
- Modify: `src/analysis-panel.js` (drop session/anchored-popup branches; `dock` and `getSnapshot` required; subject fixed to Program), `src/analysis-controller.js` (drop `getWorkout` default; `getSnapshot` required), `src/analysis-client.js` (remove `streamAnalysis`)
- Modify: `server/api.js` (analysis block: `GET /api/analysis` capability; `POST /api/analysis/program`; anything else under `analysis` → 405), `server/analysis-service.js` (program-only messages/generation; `CONFIGURATION` message `Program analysis is not configured.`)
- Delete: `server/analysis-prompt.js`, `scripts/evaluate-analysis.js`, `test/fixtures/analysis-sessions.js` (if only used by deleted files — verify with grep), `test/analysis-prompt.test.js`, `e2e/session-analysis.spec.js`, `e2e/session-analysis-review.spec.js`
- Modify: `style.css` (remove `.analysis-trigger` and session-only overlay/≤760px rules not used by `.analysis-panel--review`/`.review-dock`), `AGENTS.md` (remove "Standalone session analysis keeps…" line; note removal), `docs/design-system/README.md` (delete "Session analysis overlay" section, keep review rules)
- Test: `test/analysis-service.test.js`, `test/analysis-api.test.js`, `test/analysis-client.test.js`, `test/analysis-controller.test.js`, `e2e/session-editor.spec.js`

**Interfaces:**
- `mountAnalysisPanel({anchor, getSnapshot, dock, request, enabled=true, onValidationError=()=>{}})` — `scope`/`getWorkout` removed; update the call in `src/program-view.js:241`.
- `createAnalysisController({getSnapshot, request, …})` — unchanged otherwise.
- `analysis.analyze(snapshot,{signal})` — program only; `scope` option removed (update api.js call).

- [ ] **Step 1: Write failing tests.**
  - `test/analysis-api.test.js`: `POST /api/analysis` with a workout body → 405 `{error:{code:'METHOD'}}`; `GET /api/analysis` → `{enabled:true}`.
  - `e2e/session-editor.spec.js`: `session template has no Analyze action` → `[data-analyze]` count 0 and no `.analysis-panel` in the DOM after mount.
- [ ] **Step 2:** Run `npm test` and `npx playwright test e2e/session-editor.spec.js` → new tests FAIL.
- [ ] **Step 3: Implement** the removals/edits listed under Files. Run `grep -rn "streamAnalysis\b\|analysis-prompt.js\|getWorkout\|data-analyze\|analysis-trigger\|scope:'session'\|evaluate-analysis" src server test e2e scripts style.css package.json` → no matches except program equivalents. Adjust remaining session-scoped cases in the listed unit tests to program scope or delete them where they only covered session behavior.
- [ ] **Step 4:** Run `npm test` and `npm run test:e2e` → PASS; `npm run build` → `Built public assets.`
- [ ] **Step 5: Commit** `feat: remove session-template AI analysis, keeping shared review modules`.

### Task 6: Profile data, migration 007 and analysis input

**Files:**
- Create: `src/profile.js`, `migrations/007-user-profile.sql`, `server/migrate-program-background.js`, `server/profile-repository.js`, `test/profile.test.js`, `test/profile-migration.test.js`
- Modify: `src/program-context.js` (two fields; export text helper), `src/program-context-dialog.js` (two labels/examples; note copy), `server/db.js` (version 7 hook), `server/api.js` (`/api/profile`; inject athlete), `api/index.js` + `scripts/dev-server.js` (wire `profile`), `src/program-analysis-input.js` (ignore client `athlete`), `server/program-analysis-prompt.js` (v13, athlete data + rule wording), `test/fixtures/analysis-programs.js`, `scripts/evaluate-program-analysis.js` (pass athlete), `test/program-context.test.js`, `test/program-analysis-input.test.js`, `test/program-analysis-prompt.test.js`, `test/program-analysis-api.test.js`, `e2e/program-context-dialog.spec.js`, `docs/operations/` (new `program-background-rollout.md`)

**Interfaces (produced):**
- `src/program-context.js`: `PROGRAM_CONTEXT_FIELDS = ['goalsAndPriorities','constraintsAndPreferences']`; `normalizeContextText(raw: unknown, key: string) → string` (throws `Invalid program context <key>.` / the existing 2,000-character message); `normalizeProgramContext` unchanged otherwise and ignores unknown keys (legacy `trainingBackgroundAndApproach` dropped).
- `src/profile.js`: `PROFILE_FIELDS = ['trainingBackgroundAndApproach']`; `normalizeProfile(value?: object) → {trainingBackgroundAndApproach: string}` (throws `Invalid profile.` / `Profile fields must be at most 2,000 characters.`).
- `server/profile-repository.js`: `createProfileRepository(db,{now}) → {get(): Promise<{profile, revision:number}>, update({revision:number, profile}): Promise<{profile, revision:number}>}`; missing row → `{profile:normalizeProfile(), revision:0}`; stale revision → `domainError('CONFLICT','Profile changed on another device.')`.
- HTTP: `GET /api/profile → {profile, revision}`; `PUT /api/profile {revision, profile} → {profile, revision}`; 409 on conflict; 400 on invalid; requires auth like documents.
- `createApi({…, profile})`; program analysis passes `{...snapshot, athlete:{trainingBackgroundAndApproach}}` to `analysis.analyze`.
- `migrateProgramBackground(tx) → {cleared:number}`.

- [ ] **Step 1: Write failing tests.**
  - `test/profile.test.js`: `normalizeProfile()` → `{trainingBackgroundAndApproach:''}`; CRLF→LF; `'  '`→`''`; 2,001 chars throws; non-string throws; repository `get` on empty DB → revision 0; `update({revision:0,…})` → revision 1; `update({revision:0,…})` again → CONFLICT; API GET/PUT round trip and 409 via `createApi`.
  - `test/profile-migration.test.js` (apply 001–006 then 007 as in `test/catalog-metadata-migration.test.js`): program A with all three context fields → only background removed, revision +1, backup row has A's text; program B with only background → `context` key removed; program C without context → revision unchanged; `user_profile` has no row.
  - `test/program-context.test.js`: legacy context with background only → `hasProgramContext` false; v3 bundle import containing background → document has no background and no `context`.
  - `test/program-analysis-api.test.js`: with stored profile text `"Five years"`, the analyzed snapshot has `athlete.trainingBackgroundAndApproach==="Five years"`; a client snapshot containing `athlete:{trainingBackgroundAndApproach:"spoof"}` still yields `"Five years"`.
  - `test/program-analysis-prompt.test.js`: version `program-hypertrophy-v13`; user message JSON contains `athlete.trainingBackgroundAndApproach`; context JSON has no background key.
  - `e2e/program-context-dialog.spec.js`: dialog shows exactly two textareas labeled `Goals and priorities`, `Constraints and preferences`.
- [ ] **Step 2:** Run `npm test` and the e2e file → FAIL.
- [ ] **Step 3: Implement.**
  - `007-user-profile.sql`: `CREATE TABLE user_profile(id INTEGER PRIMARY KEY CHECK(id=1),revision INTEGER NOT NULL,profile_json TEXT NOT NULL,updated_at TEXT NOT NULL); CREATE TABLE program_context_background_backup(program_id TEXT PRIMARY KEY,text TEXT NOT NULL,backed_up_at TEXT NOT NULL);`
  - `migrateProgramBackground`: select `kind='program'` documents; for non-empty `context.trainingBackgroundAndApproach` insert backup, delete key, delete `context` if `!hasProgramContext`, `revision=revision+1`, `updated_at=now`. Wire `if(version===7)` in `server/db.js`.
  - Repository `update` uses `INSERT … ON CONFLICT(id) DO UPDATE … WHERE revision=?` semantics (check affected rows; 0 → CONFLICT).
  - `program-analysis-input.js` `header()` never copies `athlete`; api.js loads profile and spreads `athlete` after validation.
  - Prompt: replace references to context-provided training background with an `athlete` object; keep the untrusted-data/self-report rule covering it.
  - Context dialog: drop third label/example; footer note unchanged ("These notes are included in program exports.").
  - Rollout doc: backup DB → `npm run db:migrate` per environment → verify `SELECT count(*) FROM program_context_background_backup` and program revisions; profile starts empty.
- [ ] **Step 4:** Run `npm test` and `npx playwright test e2e/program-context-dialog.spec.js e2e/program-context.spec.js e2e/program-analysis.spec.js` → PASS.
- [ ] **Step 5: Commit** `feat: move training background to a server-side user profile`.

### Task 7: Profile page and header entry

**Files:**
- Create: `src/profile-view.js`, `e2e/profile.spec.js`
- Modify: `index.html` (header button), `src/router.js`, `src/app.js` (route, autosave, conflict UI), `src/api-client.js`, `src/action-controls.js` (`profile` icon), `style.css` (`.profile-page`), `test/router.test.js`, `test/api-client.test.js`, `AGENTS.md` (new dated section summarizing this bundle), `docs/design-system/README.md` (Profile page + header icon)

**Interfaces:**
- Consumes: `normalizeProfile`, `PROFILE_FIELDS` (Task 6); HTTP profile endpoints.
- `parseRoute('#/profile') → {view:'profile'}`.
- api-client: `getProfile() → Promise<{profile,revision}>`; `updateProfile({revision,profile}) → Promise<{profile,revision}>`.
- `mountProfileView(root,{profile, onChange:(profile)=>void}) → {setProfile(profile), destroy()}` — `setProfile` updates the textarea only when its value differs, preserving focus and caret.
- Autosave adapter in `app.js`: `createAutosave({record:{id:'profile',revision,document:profile}, save:({revision,document})=>api.updateProfile({revision,profile:document}).then(r=>({id:'profile',revision:r.revision,document:r.profile})), …})`.

- [ ] **Step 1: Write failing tests.**
  - `test/router.test.js`: `#/profile` → `{view:'profile'}`.
  - `test/api-client.test.js`: `getProfile` GETs `/api/profile`; `updateProfile` PUTs body `{revision,profile}`.
  - `e2e/profile.spec.js` (log in with `test-password` as in `e2e/drag-reorder.spec.js:153`):
    - Header button with accessible name `Profile` sits immediately before `Log out`, shows tooltip `Profile`, navigates to `#/profile`, gets `aria-current="page"`; h1 `Profile`; textarea labeled `Training background and approach` with `maxlength="2000"`; note text `Used by AI program reviews. Not included in program exports.`
    - Typing → save status reaches `Saved`; reload → text persists.
    - Conflict: change revision server-side via a second `request.put('/api/profile')`, then type → status `Conflict`, `#reload-saved` visible, `#copy-saved` hidden; Reload saved version shows the server text.
    - 390×844 touch: button ≥44×44, no horizontal overflow; 1440: 32px.
- [ ] **Step 2:** Run `npm test` and `npx playwright test e2e/profile.spec.js` → FAIL.
- [ ] **Step 3: Implement.** Header: `<button id="profile" class="action-button" aria-label="Profile" data-action-tooltip="Profile">` before `#logout`, icon `profile` (`<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>`), click navigates to `#/profile` through the app's existing navigation (leave-guard like other routes). Route renders `.profile-page` reusing `.field`/textarea/help styles from the context dialog, same max width and gutters as `.program-page`. In `saveStatus`, hide `#copy-saved` when the active record id is `'profile'`; Reload saved version re-fetches via `getProfile` and calls `setProfile`. Navigation away flushes the profile autosave like documents.
- [ ] **Step 4:** Run `npm test`, `npm run test:e2e`, `npm run build` → all PASS.
- [ ] **Step 5: Commit** `feat: add the profile page for training background`.

### Task 8: Browser verification and record

**Files:**
- Create: `docs/superpowers/verification/2026-11-01-program-follow-ups.md`
- Modify: `docs/superpowers/backlog/2026-11-01-follow-ups.md` (mark items shipped, link spec/plan/verification)

- [ ] **Step 1:** `npm run db:migrate` against the local `local.db` only; record migration output and backup count. Do not touch preview/production.
- [ ] **Step 2:** In a real browser with populated data, exercise and record: drag in Week (narrow and wide days) and Sequence with dock open/closed, mouse and touch; header at 1024, 1152, 1280, 1366, 1440, 1920 with dock open/closed and rapid toggles; dock open/close, Escape/Close focus return, crossing 1024px while open; profile edit/save/reload/conflict; program review uses the profile text (inspect request on the server log or a stubbed provider); session template shows no Analyze action; 390×844 touch, 200% text, reduced motion.
- [ ] **Step 3:** Write the verification doc with what was inspected, viewport list, commands and their results, and explicit gaps (pending preview/production migration and deployment).
- [ ] **Step 4: Commit** `docs: record program follow-ups verification`.
