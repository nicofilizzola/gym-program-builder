# Tracker inputs and benchmarks

Date: 2026-11-15.

Status: Written specification approved by the user in conversation after commit `f8f452b`. Not implemented or deployed. Covers original requests 1–3 in the [refinement design map](2026-11-15-mobile-tracker-refinements-design.md).

## Purpose

Soften the abrupt large weight/reps readout when a Focus ruler changes it, while keeping the control responsive. Correct two shared logging rules: Best considers any qualifying performance above the target minimum, and Complete never supplies an unanswered RIR.

Success means the selected value stays exact and immediate, dragging does not accumulate work or animation lag, a 15-rep performance can qualify for an 8–12 target, and an unanswered RIR remains empty after completion and synchronization.

## 1. Ruler readout feedback

Scope: the large canonical weight/reps input in editable mobile Focus. Reuse the current input, ruler, direct-entry behavior and `onAdjust` path in `src/workout-ruler.js` and `src/workout-focus-view.js`.

On an actual ruler-originated value change (drag, nudge, horizontal wheel or ruler key), animate the whole displayed number as one unit: 120ms ease-out, opacity .75→1, and a 3px vertical slide into place. An increase enters from below (+3px); a decrease enters from above (−3px). Captions and the unit do not move. This is visual feedback over the immediate authoritative value, not numeric interpolation: never display intermediate invented reps/weights.

Keep one readout animation per input. If another adjustment arrives while it is running, retarget from its current visual transform/opacity toward the settled state; do not restart from the full initial displacement or queue animations. A limit press that changes nothing produces no motion. A sustained fast drag must remain legible without repeatedly blanking the number.

Do not animate direct typing, focus/caret, invalid text, placeholder restoration, initial mounting, hydration, save acknowledgements, history refresh, completion filling kg/reps or responsive relocation. Typing/composition cancels any active readout animation. Reduced motion, disabling Focus and teardown cancel the effect and show the final value immediately. Formatting, accessible values and validation remain exact throughout.

The 120ms/3px values are the proposed mild tuning for written review; phone calibration must verify the resulting feel before claiming that the user's report is resolved.

### Drag responsiveness

The user also perceived slight lag around value changes. Source inspection found that `draw()` rebuilds the visible ruler tick nodes on pointer movement and can run again through the synchronous value-update/render path. This is a plausible source of excess work, not a measured phone diagnosis.

The implementation must measure the real ruler path with slow drags, sustained fast drags, direction reversals and a populated workout. Keep direct state writes immediate; coalesce purely visual ruler painting to at most once per animation frame. Reuse the existing tick window while its visible labels, increment, width and target band are unchanged, rather than rebuilding it for every fractional track translation. Rebuild on a genuine window/geometry change. Avoid redundant layout reads and identical draws inside one frame. Do not introduce debouncing, data-write delays, inertia, new step rounding or a new gesture system.

Preserve pointer capture from press through release, vertical-drift ownership, 8px slop, 32px tick spacing, all weight increments, off-grid typed values, clamping, suggestions, keyboard support and direct entry. The ruler follows the pointer without an added transition while held; retain the existing 150ms release settling transition. Performance work stays local to demonstrated unnecessary ruler/render work.

## 2. Best uses an inclusive lower bound

Change the shared selection rule in `src/workout-best.js`, consumed by `src/workout-history-summary.js`. For a target range `{min,max}`, a historical candidate qualifies when `candidate.reps >= min`. The upper target is ignored for Best selection. With no range, all valid historical rep counts still qualify.

Examples:

| Target | Historical set | Qualifies? |
|---|---|---|
| 8–12 | 100 kg × 7 | No |
| 8–12 | 100 kg × 8 | Yes |
| 8–12 | 100 kg × 12 | Yes |
| 8–12 | 100 kg × 15 | Yes |
| 8–8 | 100 kg × 9 | Yes |

Ranking remains weight, reps, finish instant, then descending log ID. Thus 100 kg × 8 still beats 95 kg × 15; this is not an estimated-strength formula. Bodyweight handling is unchanged.

Display `Best (8+ reps)` whenever the target minimum is 8, including equal-bound targets. Use `Best` without a range. Retain the current winning-set/date formatting, empty wording, loading/error/offline states and cached-history behavior.

The server already returns one winner per exact rep count, at most 100 per variant, through `bestPerRep`. Keep that payload, reduction, 40-variant request bound and request ownership unchanged. The eligible history still consists only of completed working sets from other finished logs for the exact variant. No current-log, warm-up, incomplete or cross-variant candidates become eligible.

Apply this rule and label everywhere the shared Best presenter is used, including the regular desktop tracker and finished records. Target rep guidance remains the original inclusive min–max range; this change does not widen that guidance.

## 3. Completion preserves optional RIR

Fix the shared `toggleSetDone` path in `src/workout-edit.js`. Completing an unfinished set keeps `current.rir` exactly as recorded; `null` remains `null`, even if Last time or an earlier set suggests a value. Preserve the existing kg/reps fallback and reps validation. Undo preserves all recorded values.

For blank RIR, no option is pressed, selected or presented as a suggested current choice. Remove the blank-RIR placeholder highlight from `src/workout-set-row.js`; historical RIR remains visible in Last time. Users select a value explicitly and can tap it again to clear it. A recorded zero is a real choice and must not be mistaken for missing RIR. Keep stored 5 and displayed `5+` semantics.

Apply this shared correction to Focus, the regular tracker and completion in editable finished records. Explicit existing copy/repeat commands may continue copying an already recorded RIR when that command intentionally copies a working set; they must not convert an absent RIR into an inferred one. Warm-ups retain their stronger rule: no RIR control, no inferred/copied RIR on a new warm-up, and existing legacy warm-up RIR is retained without display.

Do not clear historical or already stored RIR values: there is no reliable way to distinguish an earlier inferred value from a deliberate choice. No backfill or schema change is required.

## Architecture and affected surface

| Responsibility | Existing owner |
|---|---|
| Ruler pointer/keyboard changes, visual painting | `src/workout-ruler.js` |
| Canonical input binding and Focus-only feedback trigger | `src/workout-focus-view.js`, `src/workout-set-row.js` |
| Shared completion rule | `src/workout-edit.js` |
| Shared Best selection and presentation | `src/workout-best.js`, `src/workout-history-summary.js` |
| Styling and implementation documentation | `style.css`, `AGENTS.md`, `docs/design-system/README.md` |

Retain the logger port and controller as the only write path. Keep presentation animations outside the log, mirror and exports. Add no dependency, persistence, endpoint or migration.

This supersedes earlier requirements that Best filters by both rep-range bounds, that completion accepts an inferred RIR, and that ruler-driven readouts receive no new feedback. The exception for ruler feedback does not permit animation of typing, routine data updates or stored values.

## Verification required during implementation

- Unit: lower-bound inclusivity, above-max qualification, absent/equal-bound ranges, ranking ties/bodyweight, immutable per-rep reduction and per-occurrence targets. Keep repository candidate filtering covered.
- Unit: blank RIR with nonblank historical/previous suggestions stays null; explicit 0–5 persists; completing/undoing twice does not infer a value; required-reps failure and kg/reps suggestions remain intact; legacy warm-up values are not rewritten.
- Browser: Focus and desktop completion show no selected RIR for null after render/acknowledgement; users can select and clear it; shared Best labels and winners agree across presentations.
- Browser: ruler changes animate only the readout, preserve input identity and exact decimal values, avoid queued animations during rapid reversals, retain IME/invalid drafts, respect reduced motion, and cancel on resize/teardown. Tick identity is retained within the same render window; visual draws are coalesced without delaying canonical writes.
- Reuse `test/workout-best.test.js`, `test/workout-edit.test.js`, `test/workout-sets.test.js`, `e2e/workout-ruler.spec.js`, `e2e/workout-best.spec.js`, `e2e/workout-set-row.spec.js` and the relevant Focus integration tests. Add narrowly scoped checks where existing files do not exercise the changed behavior.
- Phone: judge large-number feedback and ruler fluidity with slow/fast drags. This remains pending (user); browser emulation does not establish hardware performance or deployed behavior.
