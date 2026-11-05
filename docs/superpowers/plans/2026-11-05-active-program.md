# Active Program Implementation Plan (medium)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The user marks one program as active on the Programs list. The Start workout sheet's Up next comes only from that program, listed first and expanded. With none set, the sheet offers a one-tap "Make {name} active".

**Architecture:**

- **Server:** a single-user server setting in a new `app_settings` table (migration 009), exposed by `GET /api/settings` and `PUT /api/settings/active-program`.
- **Client:** a pure `activeProgram` selector in `src/workout-up-next.js`; a star toggle in `src/library-view.js`; and active-program handling in `src/workout-start-sheet.js`, all wired in `src/app.js`.

**Tech Stack:** Vanilla ES modules, SQLite/libSQL, node:test, Playwright. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-11-05-mobile-polish-tracker-notes-design.md` §A2. Plan 1 (`2026-11-05-mobile-nav-search.md`) is merged first: the start sheet already has search.

## Global Constraints

- **Table:** `app_settings(key TEXT PRIMARY KEY, value_json TEXT NOT NULL, updated_at TEXT NOT NULL)`, key `activeProgramId`. Run migration 009 explicitly per environment; builds and requests never migrate.
- **`GET /api/settings`** returns `{settings:{activeProgramId}}`, where the id is `null` when unset or when it names no `kind='program'` document.
- **`PUT /api/settings/active-program`:**
  - body `{programId:string|null}`, returning `{settings}`;
  - an unknown id fails with `NOT_FOUND` / `Program not found.`;
  - any other body fails with `INVALID` / `Invalid program id.`;
  - last write wins, with no revision.
- **Scope:** never exported, never sent to the AI review, not copied by program duplication.
- **Star toggle:**
  - `aria-pressed`; accessible name `Active program {name}`;
  - tooltip `Set as active program` when off and `Active program` when on;
  - accent filled star when on;
  - the `Active` badge (accent outline pill) after the name; the active card sorts first.
- **No active program (sheet):** the line `No active program · ` followed by a text button `Make {name} active`, where `{name}` is `upNextProgram(programs, logs)`.
- **Failures:**
  - The list toggle reverts and the error shows in `#app-message` through `report`.
  - The sheet shows `Couldn't set the active program.` (role alert) under the line, and the button stays usable.
- **UI rules:** follow docs/design-system/README.md and AGENTS.md. Re-sorting and badge changes are instant (data updates). Change `style.css` first, then the design-system doc in the same commit.
- **Verification:** `npm test`, `npm run test:e2e`, `npm run build`. Never claim a pending deployment was verified.

## Review Focus

1. **The active program was deleted:** GET returns `null`, the list shows no badge, and the sheet shows the "Make … active" line. Task 1 unit and Task 4 e2e.
2. **Rapid double-tap on stars, or two different stars:** the final UI matches the last intent and a stale response never overwrites a newer choice. Task 3: client request sequencing, plus an e2e with delayed routes.
3. **Settings fail to load on the Workouts route** (offline): the sheet behaves as "no active program" and still lists everything. Task 4 e2e with the route aborted.
4. **The active program has no scheduled sessions** (only Unscheduled), or is an empty Sequence: there is no Up next card and the program is still expanded first, without the "Make active" line, because a program is active. Task 4 e2e.
5. **Activating from the sheet while a start is in progress:** the button is disabled with the other controls. Task 4 e2e.

---

### Task 1: Settings storage and API

**Files:**
- Create: `migrations/009-app-settings.sql`, `server/settings-repository.js`, `test/settings.test.js`
- Modify: `server/api.js` (route `settings`), `api/index.js` and `scripts/dev-server.js` (pass `settings:createSettingsRepository(db)`), `src/api-client.js`

**Interfaces:**
- Produces:
  - `createSettingsRepository(db,{now})`, with `get() → {activeProgramId:string|null}` and `setActiveProgram(programId:string|null) → {activeProgramId}`;
  - `createApi({...,settings})`;
  - client `api.getSettings() → {activeProgramId}` (unwraps `settings`) and `api.setActiveProgram(programId) → {activeProgramId}`.

- [ ] **Step 1: Write the failing tests** (follow `test/profile.test.js` setup: in-memory db, `migrate`, `createApi` with a stub auth):

```js
test('active program defaults to null, sets, clears and ignores deleted programs',async()=>{
  assert.deepEqual(await settings.get(),{activeProgramId:null});
  await assert.rejects(settings.setActiveProgram('nope'),{code:'NOT_FOUND'});
  await assert.rejects(settings.setActiveProgram(42),{code:'INVALID'});
  assert.deepEqual(await settings.setActiveProgram(programId),{activeProgramId:programId});
  await assert.rejects(settings.setActiveProgram(templateId),{code:'NOT_FOUND'});
  await repository.remove({id:programId,revision:1});
  assert.deepEqual(await settings.get(),{activeProgramId:null});
  assert.deepEqual(await settings.setActiveProgram(null),{activeProgramId:null});
});
test('settings API',async()=>{
  // GET /api/settings → 200 {settings:{activeProgramId:null}}; PUT /api/settings/active-program {programId} → 200 {settings:{activeProgramId}}
  // PUT unknown → 404; POST /api/settings → 405; GET /api/settings/x → 404; cross-origin PUT → 403; unauthenticated → 401
});
```

- [ ] **Step 2: Run `npm test`.** Expected: FAIL.
- [ ] **Step 3: Implement.**
  - The migration is the single `CREATE TABLE`.
  - `get` reads the row and checks `SELECT 1 FROM documents WHERE id=? AND kind='program'`.
  - `setActiveProgram` validates (`typeof programId==='string'&&programId` or `null`), checks existence, then upserts (`INSERT … ON CONFLICT(key) DO UPDATE`). `null` deletes the row.
  - API errors map through the existing `domainError` handling.
- [ ] **Step 4: Run `npm test`.** Expected: PASS. Run `npm run db:migrate` against the local db.
- [ ] **Step 5: Commit** `feat: store the active program as a server setting`.

### Task 2: `activeProgram` selector

**Files:**
- Modify: `src/workout-up-next.js`, `test/workout-up-next.test.js`

**Interfaces:**
- Produces: `activeProgram(programs:Array<{id}>, activeProgramId:string|null) → record|null`.

- [ ] **Step 1: Write the failing test**

```js
test('activeProgram returns the matching listed program or null',()=>{
  const list=[{id:'a'},{id:'b'}];
  assert.equal(activeProgram(list,'b'),list[1]);
  assert.equal(activeProgram(list,'gone'),null);
  assert.equal(activeProgram(list,null),null);
});
```

- [ ] **Step 2: Run `npm test`.** Expected: FAIL. **Step 3: Implement.** **Step 4: Run `npm test`.** Expected: PASS.
- [ ] **Step 5: Commit** `feat: select the active program`.

### Task 3: Star toggle on the Programs list

**Files:**
- Modify: `src/library-view.js`, `src/action-controls.js` (icons `star` outline and `star-filled`, filled via `fill="currentColor"`), `src/app.js` (programs route), `style.css`, `docs/design-system/README.md`
- Test: `e2e/active-program.spec.js` (new)

**Interfaces:**
- Consumes: `api.getSettings`, `api.setActiveProgram` (Task 1).
- Produces:
  - `mountLibrary(root,{...,activeProgramId=null,onToggleActive})`; when `kind==='program'` and `onToggleActive` is given, each card gets the star as the first icon action;
  - `update(items,{activeProgramId})` re-renders with the badge and active-first order (stable for the rest).

- [ ] **Step 1: Write the failing e2e:**
  - With programs `A` and `B` (B edited last, so listed first), pressing `Active program A` sets `aria-pressed=true`, shows `Active` after A's name and moves A first.
  - After a reload the state persists.
  - Pressing it again clears it.
  - Pressing B's star while A is active moves the badge to B.
  - With `PUT **/api/settings/active-program` fulfilled 500, the toggle reverts and `#app-message` shows the error.
  - With the first PUT delayed 500ms, tapping A then B quickly ends with B active after both settle (Review Focus 2).
- [ ] **Step 2: Run the spec.** Expected: FAIL.
- [ ] **Step 3: Implement.**
  - The programs route loads `api.getSettings()` in parallel with `api.list('program')`. A failure is treated as `null` (network) or reported (other).
  - `onToggleActive(record)`:
    - computes `next = current===record.id ? null : record.id`, applies it optimistically through `update`, and increments a request counter;
    - awaits `api.setActiveProgram(next)`;
    - when this request is still the latest, adopts the response, or on failure reverts to the last confirmed value and calls `report(error)`.
- [ ] **Step 4: Run the spec plus `e2e/libraries.spec.js e2e/library-navigation.spec.js`.** Expected: PASS.
- [ ] **Step 5: Browser review and commit.**
  - Check 390 touch and 1366: the star is 44px on touch and 32px on fine pointers, with tooltips and focus ring.
  - Commit `feat: mark the active program on the Programs list`.

### Task 4: Start sheet uses the active program

**Files:**
- Modify: `src/workout-start-sheet.js`, `src/app.js` (workouts route), `style.css`, `docs/design-system/README.md`
- Test: `e2e/active-program.spec.js`, `e2e/workout-start-sheet.spec.js` (update the Up next expectations that relied on the old rule)

**Interfaces:**
- Consumes: `activeProgram`, `upNextProgram` (Task 2), `api.getSettings` and `api.setActiveProgram`.
- Produces: `openWorkoutStartSheet({...,activeProgramId=null,onActivate})`, where `onActivate(programId) → Promise<{activeProgramId}>`.

- [ ] **Step 1: Write the failing e2e:**
  - **Active set:** with A active and a newer log from B, Up next reads `Up next · A`. A is listed first with `Active` and expanded; B is collapsed.
  - **None set:** the sheet shows `No active program · Make B active` (B from the newest log) and no Up next card.
  - **Activating:** pressing it shows the Up next card for B (focused), B first and expanded with `Active`, and the Programs list shows B active.
  - **Activation fails** (500): `Couldn't set the active program.`
  - **Active program deleted:** behaves as none.
  - **Settings route aborted:** behaves as none.
  - **Active program with only Unscheduled sessions:** no Up next card and no "Make active" line.
  - **Searching** (Plan 1) shows `Active` on the active program's result heading.
  - **Busy:** while a start is pending, the Make-active button is disabled.
- [ ] **Step 2: Run the specs.** Expected: FAIL.
- [ ] **Step 3: Implement.**
  - The workouts route adds `optional(api.getSettings())` to its parallel lists. On failure `activeProgramId` is `null`.
  - **The sheet:**
    - `const current=activeProgram(programs,activeProgramId)`; the program order is `[current, ...others]`; the expanded program is `current`.
    - Up next renders only for `current`.
    - Without `current` (and with programs), render the line into the Up next slot with the suggestion `upNextProgram(programs,logs)`.
    - On press, disable the button, `await onActivate(id)`, set `activeProgramId` and re-render the Program panel (instant), then focus the new Up next card.
    - On failure, re-enable the button and show the alert.
    - The `Active` badge renders inside the disclosure toggle and the search result heading.
    - `setBusy` covers the button.
- [ ] **Step 4: Run `e2e/active-program.spec.js e2e/workout-start-sheet.spec.js e2e/workout-start-search.spec.js e2e/workout-start.spec.js`.** Expected: PASS.
- [ ] **Step 5: Docs, verification and commit.**
  - **AGENTS.md:**
    - update the "Workout start sheet" Up next bullet: active program only; none set → the Make-active line with the old rule as suggestion;
    - add an "Active program (2026-11-05)" section: storage, API, migration 009 run explicitly per environment, list toggle, never exported.
  - Add a "Plan 2" section to the verification doc.
  - Run `npm test`, `npm run test:e2e` and `npm run build`.
  - Commit `feat: suggest Up next from the active program`.
