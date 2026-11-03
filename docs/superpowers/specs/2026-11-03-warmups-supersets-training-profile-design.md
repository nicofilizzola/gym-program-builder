# Warm-ups, supersets and structured training profile — design (2026-11-03)

Approved in the 2026-11-03 brainstorming session. Two independently shippable parts: **A** (session template builder: warm-up sets and supersets) and **B** (training profile: user-scoped constraints plus structured fields). These requirements supersede conflicting rules in AGENTS.md sections "Workout duration", "Program hypertrophy analysis", "Program follow-ups" (profile) and the original MVP domain model.

## Intent

- Templates describe real sessions more faithfully: warm-up sets and paired exercises (supersets), with a duration estimate that reflects them.
- Constraints that describe the athlete, not a program, live once in the user profile.
- Limits that can be checked mechanically (days, session length, equipment) become typed fields, so the server computes violations and the AI review receives clean, predictable facts instead of parsing prose. Qualitative text boxes remain for nuance.

Out of scope: per-set rows (weights, set types beyond warm-up), supersets of 3+ exercises, giant sets/circuits, warm-up reps/load, blocking validation against profile limits, in-app equipment hints, age/sex/bodyweight fields, multiple users, migrating old program constraints text.

---

## Part A — Warm-up sets and supersets

### A1. Data model (template exercise; list stays flat and ordered)

| Field | Type | Rule | Default |
|---|---|---|---|
| `warmupSets` | integer | 0–5, step 1 | 0 |
| `superset` | object, optional | present only on the **first** exercise of a pair | absent |
| `superset.restBetweenSeconds` | integer | 0–120, step 15 | 30 |
| `superset.restAfterRoundSeconds` | integer | 0–300, step 15 | max(first.restSeconds, second.restSeconds) at pairing time |

- Limits live in `DURATION_LIMITS` (or the shared `LIMITS`) once and drive sliders and validation.
- **Pair invariant:** if `exercises[i].superset` is present then `exercises[i+1]` exists, `exercises[i+1].superset` is absent, and `exercises[i-1]?.superset` is absent. A violation rejects an import/save as a whole (`Exercise N: Invalid superset.`). Pairs are exactly two consecutive exercises.
- Members keep their own `restSeconds` unchanged while paired; it is unused by duration while paired and applies again after unpairing.
- `warmupSets` never contributes to volume (direct, indirect, weekly or goals). Missing `warmupSets` normalizes to 0; missing `superset` means unpaired.
- Pure helpers in `src/superset.js`: `pairExercises(exercises, i)`, `unpairExercises(exercises, i)`, `swapPair(exercises, i)`, `blocks(exercises) → [{start, length}]`, `moveBlock(exercises, fromBlock, toBlock)`, `removeExercise(exercises, i)` (removing a member dissolves the pair). Collapsed/view-state arrays move with the same block helpers.

### A2. Duration rule (pure, `computeDuration`)

Per exercise or pair, with `S = 60` seconds per set (warm-up or working):

- **Straight exercise** (W warm-ups, n sets, rest r): `W·S + (W > 0 ? r : 0) + n·(S + r)`.
- **Pair** (A: Wa, a sets; B: Wb, b sets; between t; round rest R):
  `(Wa + Wb)·S + (Wa + Wb > 0 ? R : 0)` for warm-ups (A's then B's, back to back), then for each round k = 1…max(a, b):
  - both have a set: `S + t + S + R`
  - only one has a set (leftover): `S + R`
- Rest after the final set/round still counts (existing "rest after every set" rule). Invalid sets (not 1–10) count as 0 sets, as today.
- Breakdown: `warmupSeconds` (warm-up execution), `executionSeconds` (working execution), `restSeconds` (all rest, including warm-up→first-set rest and superset transitions), `extraSeconds`, `bufferSeconds`, `totalSeconds`, `displayMinutes`. Buffer applies to warm-up + execution + rest + extra; round only the final total up.
- Unit-test worked examples:
  1. Straight: W=2, 3 sets, rest 120 → 120 + 120 + 3·180 = 780 s.
  2. Pair: A 4 sets W=1, B 3 sets W=0, t=30, R=90 → warm-ups 60 + 90; rounds 1–3: 3·(60+30+60+90)=720; round 4 leftover: 150 → 1020 s.
  3. Pair, no warm-ups, equal sets 3/3, t=0, R=120 → 3·240 = 720 s.

### A3. Editor UI (session template editor, shared program editor)

Follow docs/design-system/README.md and its Feature design and review checklist.

- **Warm-up sets slider** in `exercise-main-fields`, after Sets: label "Warm-up sets", value text `None` at 0 else the number, `aria-valuetext` matching. Native range input, 44px hit box.
- **Summary:** `3 × 8–12 + 2 warm-up · Rest 2 min`; the warm-up part is omitted at 0. In a pair, the rest part becomes `Superset`.
- **Pair action:** link icon button "Superset with next exercise" (accessible name includes the exercise name, shared tooltip) in card controls, shown only when this card and the next are both unpaired. Last card never shows it.
- **Pair frame:** the two cards render inside a `.superset` wrapper with a slim accent rail and a compact header row:
  - Label `Superset` + summary text `30 s between · 2 min after round`.
  - Icon actions: Superset rest settings (disclosure toggle, `aria-expanded`), Swap exercises, Reorder superset (drag handle + Reorder menu), Unlink superset.
  - Disclosure body: two sliders, "Rest between exercises" and "Rest after round", formatted via `formatDuration`.
- **Members:** hide their individual Reorder action; their Rest per set slider is replaced by the muted text "Rest set by superset". Collapse/expand, name, sets, warm-ups, reps, muscles, catalog actions and remove are unchanged. Removing a member dissolves the pair (the other member keeps its own rest).
- **Reordering:** a pair is one sortable block (pointer drag, touch, keyboard ↑/↓ on the pair handle, Reorder menu). Single cards move around pairs as blocks; nothing can be dropped between pair members. Swap reverses the members and moves `superset` to the new first.
- **Motion:** pairing/unpairing — the frame and header fade in/out and expand/collapse with the existing 200ms ease-out collapse pattern; closing motion completes before nodes are removed; rapid reversal is safe. Settings disclosure uses the same collapse pattern. Reduced motion: instant. Initial render, import and reorder render the final state with no animation.
- **Duration readout/disclosure** adds a `Warm-up` line before Execution.
- Desktop density, 32px/44px pointer sizing and mobile behavior per design system; update the design system document with the superset frame and warm-up slider.

### A4. Files, persistence, propagation

- Template persistence stores the new fields inside the template document; no SQL migration (JSON documents). Drafts relax nothing new: the pair invariant and limits always apply.
- Export bundles become **version 4** (template and program kinds), carrying `warmupSets` (always written) and `superset` (when present). Versions 1–3 still import (defaults: 0 warm-ups, unpaired). Version 4 files with invalid values reject as a whole.
- Catalog propagation, linking, variant moves and copies preserve `warmupSets` and `superset` (they only rewrite catalog-owned fields). Round trip: export then import gives an identical template.

### A5. AI program review

- Analysis input exercises include `warmupSets` and, on the first member, `superset {restBetweenSeconds, restAfterRoundSeconds}`; projected for the model as `supersetWith: <position of partner>` on both members plus the two rests.
- Server facts already use `computeDuration`, so durations include the new rule.
- Prompt `program-hypertrophy-v14`: warm-up sets never count as volume; describe the duration rule (warm-ups 60s with no rest between them, then the exercise rest; superset rounds, transition and round rest); never recalculate duration.

---

## Part B — Structured training profile

### B1. Profile shape (`src/profile.js`, stored in `user_profile.profile_json`; no SQL migration)

| Key | Type | Rule | Empty / unknown |
|---|---|---|---|
| `trainingBackgroundAndApproach` | string | ≤2,000 UTF-16, existing text rules | `''` |
| `constraintsAndPreferences` | string | same text rules | `''` |
| `maxTrainingDaysPerWeek` | integer \| null | 1–7 | `null` |
| `availableWeekdays` | integer[] | unique, 0 (Mon)–6 (Sun), stored sorted | `[]` |
| `maxSessionsPerDay` | integer \| null | 1 or 2 | `null` |
| `maxSessionMinutes` | integer \| null | 20–180, step 5 | `null` |
| `experienceLevel` | string \| null | `beginner` \| `intermediate` \| `advanced` | `null` |
| `typicalRepsInReserve` | integer \| null | 0–4 | `null` |
| `equipment` | string[] | unique subset of `EQUIPMENT`, stored in `EQUIPMENT` order | `[]` |

- `normalizeProfile` fills defaults for missing keys, drops unknown keys and rejects invalid values with one message. Limits are defined once (`PROFILE_LIMITS`) and drive controls and validation.
- `PUT /api/profile` keeps its revision/conflict rules. The profile is never exported.

### B2. Program context change

- `PROGRAM_CONTEXT_FIELDS` becomes `['goalsAndPriorities']`. The Program context dialog shows only Goals and priorities; intro copy unchanged otherwise.
- Existing program `constraintsAndPreferences` values are dropped by normalization on next load/save; imports of v1–v4 files containing it succeed and drop it. No backup or migration (no production data exists; the local database is cleaned manually or by re-saving).
- Context-only replacement confirmation uses the single remaining field.

### B3. Profile page (`#/profile`)

Compact page, existing controls, sections in this order:

1. **Schedule** — "Max training days per week" slider 0–7 (0 = `No limit`); "Available days" Mon–Sun toggle pills (`aria-pressed`; none pressed = not specified, helper text says so); "Max sessions per day" segmented control `No limit / 1 / 2` (native radios).
2. **Session length** — "Max session length" slider 15–180 by 5 where the 15 position means `No limit` (stored `null`), else minutes.
3. **Experience** — "Level" segmented control `Not set / Beginner (<1 yr) / Intermediate (1–3 yrs) / Advanced (3+ yrs)`; "Typical reps in reserve" slider −1–4 where −1 means `Not set`.
4. **Equipment** — multi-select icon pills reusing the equipment pill pattern (`aria-pressed`, visible labels); none = not specified.
5. **Notes** — Training background and approach (existing), Constraints and preferences (new textarea with example help: "Example: Bad left shoulder, avoid overhead pressing. Prefer machines for isolation work.").

Autosave, header save status, Retry, Reload saved version on conflict and the "Used by AI program reviews. Not included in program exports." note are unchanged. Slider/pill/radio changes save immediately like typing. Sections are plain headed groups (no extra cards); fields align in a two-column grid at ≥761px and stack below.

### B4. Profile checks (pure, shared by server facts and in-app hints)

`profileChecks(resolvedProgram, profile) → { trainingDays, unavailableDays, crowdedDays, longSessions, equipmentMismatches }` in `src/profile-checks.js`:

- **Week mode only** (Unscheduled occurrences excluded; reported as `unscheduledCount`):
  - `trainingDays: {count, max}` when `maxTrainingDaysPerWeek` set and distinct scheduled days > max.
  - `unavailableDays: [{day, occurrences}]` for scheduled days not in `availableWeekdays` (skipped when the list is empty).
  - `crowdedDays: [{day, count, max}]` for days with more occurrences than `maxSessionsPerDay`.
- **Both modes:**
  - `longSessions: [{occurrence, name, displayMinutes, max}]` when `computeDuration(...).displayMinutes > maxSessionMinutes`.
  - `equipmentMismatches: [{occurrence, exercisePosition, name, equipment}]` for exercises with `equipment` not in a non-empty profile list; exercises without equipment are skipped (unknown).
- **Sequence mode:** day checks are omitted (order does not establish a calendar).
- Empty / null fields produce no check. Unit-test each check and mode.

### B5. AI program review

- The server injects the whole saved profile as `athlete` (client copies ignored, as today) and `facts.profileChecks` computed by B4 from the snapshot.
- Prompt `program-hypertrophy-v15`: athlete limits are fixed constraints, not negotiable; `profileChecks` are authoritative, never recalculated; null/empty fields mean unknown; experience and reps in reserve are self-report; equipment mismatches name the exercise and suggest using available equipment only when relevant. Update the program evaluation fixtures accordingly.

### B6. In-app hints (non-blocking; text, never colour alone)

The program and session editor routes load the profile (`GET /api/profile`) on entry and revalidate on focus; a failed load hides hints silently.

- **Program session card metadata:** `~72 min · over 60 min max` in the warning colour, with the shared tooltip "Longer than your max session length (Profile)".
- **Week day label:** a warning marker with visible short text — `Not an available day` or `3 sessions · max 2`.
- **Program header / weekly panel line:** `5 training days · max 4` when over.
- **Session template editor duration readout:** `over 60 min max` suffix when over.
- Hints update live with edits, appear/disappear without animation (routine data updates), and never block saving, exporting or analysis. Equipment mismatches appear only in AI facts in this release.

---

## Verification

`npm test`, `npm run test:e2e`, `npm run build`. Real-browser checks per AGENTS.md "Review behavior as well as screenshots": pair/unpair/swap/reorder of pairs (mouse, touch, keyboard), disclosure open/close and rapid toggles, reduced motion, warm-up slider, duration readouts, profile page controls and autosave/conflict, hints in Week and Sequence; at 1366×768, 1440×900, 1920×1080, 390×844 touch, 200% text. Record results in `docs/superpowers/verification/2026-11-03-warmups-supersets-training-profile.md`. Never claim a pending deployment was verified.
