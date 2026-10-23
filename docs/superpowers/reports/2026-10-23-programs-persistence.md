# Programs and persistence implementation record

Branch: `feat/programs-persistence`, isolated checkout `.worktrees/programs-persistence`, based on `316beb1` from `main`.

All nine implementation tasks are implemented. The app retains vanilla JavaScript, adds named template/program libraries, independent copies, simple/weekday scheduling, weekly volume/goals, automatic draft persistence, password access and versioned JSON import/export. SQLite documents use conditional revisions and idempotent write retries. Runtime database access uses `@libsql/client`; only Playwright is a development dependency.

## Verification evidence

Final verification used Node **24.22.1**:
- `npm test`: **98 passed, 0 failed**.
- `npm run test:e2e`: **12 passed, 0 failed**, Chromium, against the actual HTTP API and temporary SQLite database.
- `npm run build`: passed; a regression test verifies that stale private files are removed from static output.
- `git diff --check`: passed after normalizing source line endings.
- `npm audit --audit-level=high`: **0 vulnerabilities**, including development dependencies.
- Initial baseline: 80 passing tests.

The browser suite covers library reloads, independent copies, schedule persistence, weekly goals, legacy import/program export, cross-device stale revisions, failed-save Retry, expired login, narrow-screen overflow, original exercise-editor interactions, visibility of recovery actions, late imports, delayed navigation, creation after a lost acknowledgement and browser Back during a pending load.

## Fresh review and fixes

A separate read-only reviewer evaluated the whole branch. All eight substantive findings were accepted and fixed in one regression/fix pass. Newly added tests were observed failing before their corresponding fixes:

| Finding | Regression evidence |
|---|---|
| Import completing after navigation could modify another record | `late file reads cannot overwrite the document opened after import started` |
| Edits during navigation/logout could be discarded | `navigation locks the old editor before a delayed document load`; transitions disable the shell, bind callbacks to queues and guard awaited mounts |
| Copy creation could discard newer local edits | `save as copy persists edits made while creation is in flight` |
| Lost acknowledgement plus later edits caused a false conflict | `retry replays a committed snapshot before saving edits made after a lost acknowledgement` |
| Creation retries minted a new UUID | `creation retry reuses its ID after the server commits but the response is lost` |
| Editing a conflicted record hid recovery state | `conflict remains recoverable while local edits continue` and the recovery-controls browser test |
| CSS overrode recovery buttons' hidden attributes | `recovery controls are visible only for their matching save state` |
| Windows-1252 source corrupted a status comparison | `all published browser sources are valid UTF-8` |

A related navigation regression, `browser back during a delayed load opens the newest requested route`, also failed before fixing queued route changes. Final full suites passed after all fixes. No second reviewer pass was requested; covering regressions and the green full suite verify the fixes.

## Execution decisions

1. The user's execution request superseded the planning-only language in the artifacts; work occurred on an isolated branch, with deployment excluded. Cost if misunderstood: local branch changes only.
2. Use `npm.cmd` on Windows where PowerShell blocks npm.ps1. Initial tests used installed Node 22; final full verification used the target Node 24. Cost: maintainers need Node 24 for the documented commands.
3. Use a local HTTP development server and a separate optional Vercel CLI command to avoid recursive invocation. Cost: local tests do not certify platform routing.
4. Retain the existing workout panel inside the mounted session editor and add a separately mounted weekly panel sharing markup/styles and pure calculations. Cost: some rendering duplication preserves the established tooltip/hover behavior.
5. Remove the Vercel CLI from project development dependencies and invoke it on demand; this removes its transitive audit findings. Cost: optional CLI checks require a separate download.
6. Remote Vercel routing, Turso provisioning and provider backup/restore remain operator release checks. Cost: remote deployment readiness is not certified by the local suite.
7. Keep the weekly mobile panel's inherited sticky behavior because review found no inaccessible interaction. Cost: future visual refinement may be useful.

No minor review findings were deferred.

## Deployment boundary and account side effect

No preview or production deployment was performed; no production database was provisioned or migrated. During an attempted `vercel dev --yes` routing check, the CLI unexpectedly created and linked a Vercel project named `programs-persistence` and connected the GitHub repository. This was disclosed in the session and the CLI was stopped. Confirm the intended Vercel project before release; no remote project was deleted as part of implementation.

Follow [the deployment runbook](../../deployment.md) for separate preview/production databases, secrets, explicit migrations, platform smoke tests and backup/restore. These remote checks remain outstanding. The branch is ready for integration review; it has not been merged or pushed.
