# Program Week and Sequence verification

Implementation: [plan](../plans/2026-10-24-program-week-sequence-updates.md). Branch: `feat/program-week-sequence`, based on `011d542`. Runtime: Node.js 24.22.1.

## Automated checks

- `npm run db:migrate`: passed explicitly against an isolated local SQLite file inside the plan workspace. No production database or secrets were used.
- `npm test`: 108 passed.
- `npm run build`: passed; output contains only index.html, style.css and browser src assets.
- `npm run test:e2e`: 91 passed (2.4 minutes).
- `git diff --check`: passed.

New coverage exercises mixed/rest-only sequences, strict and draft validation, portable indices/fresh identities, atomic repository/API rejection, save/reload, library duplication, import/export, Retry, conflict Save as copy, mouse/touch dragging, keyboard day movement, rest removal focus, and transition reversal/navigation/update/teardown. Existing session-editor behavior, weekly volume/highlighting, library navigation, recovery and compact layouts remain covered.

## Visual and input checks

Inspected populated Week and Sequence screenshots at 1366×768, 1440×900, 1920×1080, 390×844 and 820×1180. Fixtures include two sessions on Monday, empty days, Unscheduled, rest entries, long session names, all 12 muscles and weekly goals.

- No horizontal document overflow at any sampled size.
- Desktop front/back figures measure 180px at 1366/1440 and 200px at 1920.
- Fine-pointer desktop icon buttons measure 32×32px; mobile/tablet, coarse-touch and hybrid mouse/touch measure at least 44×44px.
- 200% root text at 1366px and 390px wraps and grows without horizontal overflow. Desktop oversized panels retain their normal-flow fallback; mobile weekly panel remains above sessions.
- Rest cards remain visually quieter and shorter than session cards, with visible drag and remove actions. Edit pencil, Duplicate and Remove remain readable.
- Keyboard and mouse focus/hover tooltips use the existing overlay behavior. Shortcuts and polite announcements expose day reassignment without a select.
- Both layout-switch directions fade only the session list (75ms out, 100ms in); reduced motion switches instantly.

Screenshots were inspected from the isolated plan workspace; browser fixtures render the actual program-view/CSS modules. Full application shell/recovery geometry is covered by the existing browser suite.

## Implementation decisions and compatibility

- Used a native managed worktree and PowerShell equivalents for execution bookkeeping because this is a Windows environment. No product behavior changes arise from that choice.
- Recovery Save as copy retains record-scoped session/rest IDs, matching the autosave queue's later snapshots. Remapping only the initial creation would invalidate edits arriving during creation. Independent record IDs isolate the copies; library Duplicate and file import remap nested identities.
- Week movements refill session slots while explicit rests retain their sequence slots, as specified by the plan. Toggling views alone never changes sequence/day data.
- Version-2 exports add optional portable sequence entries. Existing files remain supported; older app versions that do not understand the additive field cannot preserve explicit rest days.
- No new dependency or database table migration was needed. No merge, push or deployment was performed.
