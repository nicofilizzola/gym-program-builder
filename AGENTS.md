# Gym Program Builder

## Purpose

A simple interface for building gym session templates. While the user builds a session, they see the **training volume per muscle group** update in real time.

This is an **MVP**. Keep the tech stack and the code as simple as possible. Do not add features, dependencies, or abstractions that the requirements below do not call for.

## Domain model

```
Session
├── exercises: Exercise[]   // ordered; the user controls the order
└── goals: Partial<Record<MuscleGroup, number>>   // optional volume goal per muscle; a missing key means no goal

Exercise
├── name: string (required)
├── sets: integer from 1 to 10
├── repRange: { min: integer from 1 to 30, max: integer from 1 to 30 }   // min <= max
├── primaryMuscles: MuscleGroup[]
└── secondaryMuscles: MuscleGroup[]

Goal value: multiple of 0.5 from 0.5 to 30 (for example 10 or 4.5)

MuscleGroup (fixed list, exactly these 10 values, in this order):
  Chest, Lats, Upper back, Biceps, Triceps, Shoulders, Abs, Quads, Hamstrings, Calves
```

## Functional requirements

1. **Session form.** The user can create a session template: add exercises, edit them, remove them, and reorder them. A session has no name.
2. **Exercise fields.** For each exercise the user sets the name, the number of sets, the rep range, the primary muscle groups, and the secondary muscle groups. Sets and the rep range are set with sliders (see requirement 14); the name is a text field.
3. **Muscle group choices.** Primary and secondary muscle groups come only from the fixed `MuscleGroup` list above. Users cannot add custom muscle groups.
4. **Live volume panel.** A panel always shows the session's volume per muscle group and updates on every edit. No submit or refresh step is needed. The volume list shows only the muscle groups that are relevant to the session (see requirement 12).
5. **Reorder exercises.** Each exercise card has a drag handle. Dragging it with a mouse or by touch moves the exercise to a new position. When the handle has keyboard focus, the ↑ and ↓ arrow keys move the exercise up or down one place, and focus stays on the moved exercise's handle. Order does not affect volume.
6. **Volume goals.** A "Set goals" button in the volume panel opens a dialog with one goal slider per muscle group, in `MuscleGroup` order (see requirement 14). The user can set, change, or clear a goal for any muscle; sliding to the far left (0, shown as `No goal`) clears it. Every goal is optional. Changes apply live while the user slides. A "Done" button, Escape, or a click outside the dialog closes it; there is no Save/Cancel step. A slider cannot hold an invalid value, so the dialog shows no goal errors.
7. **Volume relative to goals.** In the volume list, a muscle with a goal shows its volume against the goal (for example `7 / 10`), a bar with a goal marker (see requirement 13), and a text status: **under**, **met**, or **over**. A muscle without a goal shows its volume alone, with no marker and no status. The body map keeps its absolute heat colours; goals do not change it.
8. **Export session.** An "Export" button downloads the current session (exercises in order, and goals) as a JSON file named `gym-session-YYYY-MM-DD.json`, using today's local date. Export is refused while any exercise is invalid: nothing is downloaded, and a message names the first invalid exercise (for example `Fix exercise 2 before exporting.`). A session with no exercises can be exported.
9. **Import session.** An "Import" button opens a file picker for `.json` files. A valid file **replaces** the whole current session (exercises and goals). If the current session has any exercise or goal, the user is asked to confirm the replacement first; declining changes nothing. A file that is not valid JSON or does not match the session file format is **rejected as a whole**: the session does not change, and one error message says what is wrong (for example `Exercise 2: unknown muscle group "Glutes".`).
10. **Direct and indirect volume.** In the volume list, each muscle's bar has two stacked segments: **direct** volume (from exercises where it is a primary muscle) first, then **indirect** volume (from exercises where it is a secondary muscle). Direct is a solid fill of the bar's colour; indirect is a soft fill of the same colour with an outline of that colour. The bar's colour comes from its goal status (see requirement 13). The bar does not use heat colours; the body map keeps them. The filled part of the bar reads as one rounded pill: its left end and the right end of its last visible segment are fully rounded, like the track, and the join between direct and indirect stays straight. This holds for every bar (direct only, indirect only, or both, including a full bar), and the indirect segment's orange outline follows its rounded ends instead of being clipped into a square corner. A small "Direct / Indirect" key sits above the list (hidden on mobile, where bars are hidden); its swatches use the neutral no-goal colour. Each row still shows one number: the total, or `total / goal`. The split is shown as text in the readout (for example `Triceps 5 sets (3 direct · 2 indirect) · 2 exercises`, or `Triceps 5 / 4 sets (3 direct · 2 indirect) · over · 2 exercises` with a goal), always naming both parts even when one is 0, and in a visually hidden text inside each row button for screen readers.
11. **Expand and collapse exercises.** Each exercise card has a chevron toggle button in its header, between the highlight tag and the remove button. It hides or shows the card's fields; its `aria-expanded` reflects the state and its label is `Collapse exercise` or `Expand exercise`. A collapsed card keeps its header (drag handle, `Exercise N`, highlight tag, toggle, remove button) and shows a one-line summary below it instead of the fields (see **Exercise summary**). "Expand all" and "Collapse all" buttons sit above the exercise list and are hidden when the session has no exercises. A newly added exercise starts expanded; every exercise loaded by an import starts collapsed. A collapsed invalid exercise shows a `Needs fixing` text marker in its header. When export is refused, the exercise it names expands and its first invalid field gets focus. Collapsing changes nothing in the session: not volume, order, validation, or the exported file. Reordering (mouse, touch, keyboard), removing, and muscle highlighting work the same on collapsed cards, and an exercise keeps its collapsed state when it moves.
12. **Hide irrelevant muscles in the volume list.** The volume list hides a muscle's row when the muscle has **no goal and** its volume is **0** (both must be true; see **Visible volume rows**). Visible rows keep `MuscleGroup` order. Rows appear and disappear live on every edit, including goal edits. When no row is visible, the list shows `No volume yet. Add an exercise or set a goal.` and the "Direct / Indirect" key is hidden. The body map is unchanged: it still shows every muscle with its heat colour. Selecting a muscle works the same whether or not its row is visible (for example by clicking a body map region); a hidden row stays hidden even when its muscle is selected, and the readout still describes it.
13. **Goal-coloured bars on a shared scale.** In the volume list, each bar's colour shows its goal status: **amber** when under, **green** when met, **red** when over, and a **neutral grey-blue** for a muscle without a goal. Direct and indirect segments both use that colour (solid and soft, see requirement 10), and the status text uses it too. A muscle with 0 volume shows only the grey empty track. All bars share one scale, so one set has the same length in every row (see **Bar scale**). A muscle with a goal shows a thin vertical **goal marker** on its bar at the goal's position; the fill can run past the marker, so the user sees by how much they are over. The marker is visual only (`aria-hidden`); the `volume / goal` value and the status text carry the same information. Nothing is cut off: the scale always fits the largest volume. Bars, marker and key stay hidden on mobile. The body map keeps its heat colours.
14. **Sliders for numbers.** Every number the user enters is set with a slider instead of a number field; there is no typing.
    - **Sets:** one slider, whole numbers from 1 to 10.
    - **Rep range:** one slider with two thumbs (min and max), whole numbers from 1 to 30; the part of the track between the thumbs is filled. min can never pass max: moving one thumb past the other pushes the other thumb along, so min ≤ max always holds and the rep range error can no longer appear in the form.
    - **Goals:** one slider per muscle, from 0 to 30 in steps of 0.5; 0 means no goal and is shown as `No goal`. A new dialog opens with every slider at its applied goal, or at 0.
    - Each slider shows its current value as text next to its label, updating live while the user slides: sets as `3`, reps as `8–12` (en dash) or `8` when min = max, goals as `4.5` or `No goal`.
    - Every change applies on every movement (no release step needed), like typing did before; volume, goal status, summary and validation update live.
    - Sliders are native `<input type="range">` elements: they work with mouse, touch and keyboard (arrow keys, Home, End, Page Up/Down), have a visible focus ring, an accessible name (for example `Sets`, `Reps min`, `Reps max`, `Chest goal`), and a value text for screen readers (`No goal` at 0).
    - Imported values outside these limits are rejected (see **Session file format**). New exercises keep the defaults 3 sets and 8–12 reps.

## Volume calculation (core business rule)

For each muscle group:

```
volume(muscle) = Σ over exercises:
                   sets × 1    if muscle ∈ primaryMuscles
                   sets × 0.5  if muscle ∈ secondaryMuscles
                   0           otherwise
```

- Rep range does **not** affect volume.
- Volume is a multiple of 0.5. Show it as-is (for example `4.5`); do not round it.

### Worked example (use as a test case)

| Exercise    | Sets | Primary          | Secondary          |
|-------------|------|------------------|--------------------|
| Bench press | 4    | Chest            | Triceps, Shoulders |
| Dips        | 3    | Chest, Triceps   | Shoulders          |
| Pull-ups    | 3    | Lats             | Biceps, Upper back |

Expected volume: Chest **7**, Triceps **5**, Shoulders **3.5**, Lats **3**, Biceps **1.5**, Upper back **1.5**. Every other muscle group is **0**.

## Goal status (business rule)

For a muscle with a goal:

```
status = under   if volume < goal
         met     if volume = goal
         over    if volume > goal
```

- A muscle with no goal has no status. It is never shown as under.
- Volume and goal are both multiples of 0.5, so an exact equality comparison is safe.
- Status is always shown as text next to the bar. Colour alone is not enough.

### Worked example (use as a test case)

Using the volume from the volume worked example above, with goals Chest **7**, Triceps **4**, Lats **6**, Quads **8**:

| Muscle  | Volume | Goal | Shown      | Status |
|---------|--------|------|------------|--------|
| Chest   | 7      | 7    | `7 / 7`    | met    |
| Triceps | 5      | 4    | `5 / 4`    | over   |
| Lats    | 3      | 6    | `3 / 6`    | under  |
| Quads   | 0      | 8    | `0 / 8`    | under  |
| Biceps  | 1.5    | —    | `1.5`      | —      |

## Direct and indirect volume (business rule)

For each muscle group:

```
direct(muscle)   = Σ sets         over exercises where muscle ∈ primaryMuscles
indirect(muscle) = Σ sets × 0.5   over exercises where muscle ∈ secondaryMuscles
volume(muscle)   = direct(muscle) + indirect(muscle)
```

- Indirect is **counted volume** (half sets), not raw secondary sets, so the two parts always add up to the volume.
- Goal status still compares the total volume to the goal.

The bar fills **direct first**, on the same scale for both segments (the shared `scale` from **Bar scale**):

```
directFill    = min(direct / scale, 1)
indirectFill  = min(indirect / scale, 1 − directFill)
```

The shared scale always fits the largest volume, so in practice nothing is cut off; the `min` caps are only a safeguard.

## Bar scale (business rule)

All bars in the volume list use one scale: the number of sets that fills a whole bar.

```
maxGoal   = the largest goal, or none when no goal is set
maxVolume = the largest volume over all muscles
scale     = max(maxGoal / 0.75, maxVolume)   if a goal is set
            maxVolume / 0.75                  if no goal is set and maxVolume > 0
            1                                 otherwise (nothing is visible; avoids dividing by 0)
marker(muscle) = goal(muscle) / scale        // only for a muscle with a goal; 0 to 1 from the bar's left end
```

- The largest goal's marker sits at 75% of the bar, unless some volume is larger than `maxGoal / 0.75`: then the scale grows to fit that volume, the largest volume fills the whole bar, and every marker moves left.
- With no goals, the largest volume fills 75% of the bar.
- The scale is computed on render from the volume and the goals; never store it. It changes live on every exercise or goal edit.
- Fill widths and marker positions are fractions and do not have to be multiples of 0.5. Tests compare them with a small tolerance.

### Worked example (use as a test case)

Volume worked example with the goal worked example's goals (Chest 7, Triceps 4, Lats 6, Quads 8): maxGoal = 8, maxVolume = 7, scale = max(8 / 0.75, 7) = 32/3 ≈ 10.667.

| Muscle     | Direct | Indirect | Goal | Colour  | Direct fill | Indirect fill | Marker  |
|------------|--------|----------|------|---------|-------------|---------------|---------|
| Chest      | 7      | 0        | 7    | green   | 0.65625     | 0             | 0.65625 |
| Triceps    | 3      | 2        | 4    | red     | 0.28125     | 0.1875        | 0.375   |
| Lats       | 3      | 0        | 6    | amber   | 0.28125     | 0             | 0.5625  |
| Quads      | 0      | 0        | 8    | amber   | 0           | 0             | 0.75    |
| Shoulders  | 0      | 3.5      | —    | neutral | 0           | 0.328125      | —       |
| Biceps     | 0      | 1.5      | —    | neutral | 0           | 0.140625      | —       |
| Upper back | 0      | 1.5      | —    | neutral | 0           | 0.140625      | —       |

Other cases:

- Volume worked example, no goals: scale = 7 / 0.75 = 28/3 ≈ 9.333; Chest fills 0.75.
- Volume worked example, only goal Chest 4: scale = max(4 / 0.75, 7) = 7; Chest fills the whole bar (direct fill 1), its marker is at 4/7 ≈ 0.571, and it is red (over).
- Empty session, goal Calves 6: scale = 6 / 0.75 = 8; Calves fill 0, marker 0.75.
- Empty session, no goals: scale = 1.

## Exercise summary (business rule)

A collapsed card shows one line built from its exercise:

```
summary = name · sets × reps · primary muscles · secondary: secondary muscles
```

- **name**: trimmed; `Untitled exercise` when empty.
- **reps**: `min–max` (en dash), or just `min` when `min = max`.
- A sets, min or max value that is not a positive whole number shows as `?` (for example `? × 8–12`).
- Muscles are joined with `, `, in `MuscleGroup` order. The primary part is left out when there are no primary muscles; the `secondary: …` part is left out when there are no secondary muscles.
- Parts are joined with ` · `.

### Worked example (use as a test case)

| Exercise                                                  | Summary                                                          |
|-----------------------------------------------------------|------------------------------------------------------------------|
| Bench press, 4 sets, 6–10, Chest / Triceps, Shoulders     | `Bench press · 4 × 6–10 · Chest · secondary: Triceps, Shoulders` |
| Dips, 3 sets, 8–8, Chest, Triceps / Shoulders             | `Dips · 3 × 8 · Chest, Triceps · secondary: Shoulders`           |
| New exercise (defaults)                                   | `Untitled exercise · 3 × 8–12`                                   |
| `"  Row "`, sets empty, 8–12, no primary / Biceps         | `Row · ? × 8–12 · secondary: Biceps`                             |

## Visible volume rows (business rule)

```
visible(muscle) = goal(muscle) is set  OR  volume(muscle) > 0
```

- Uses the computed volume, so a muscle chosen in an exercise whose sets are empty or invalid has volume 0 and is hidden if it has no goal.
- A muscle with a goal is always visible, even at volume 0 (it shows as **under**).

### Worked example (use as a test case)

- Volume worked example, no goals: visible = Chest, Lats, Upper back, Biceps, Triceps, Shoulders. Hidden = Abs, Quads, Hamstrings, Calves.
- Volume worked example with the goals from the goal worked example (Chest 7, Triceps 4, Lats 6, Quads 8): visible = Chest, Lats, Upper back, Biceps, Triceps, Shoulders, Quads. Hidden = Abs, Hamstrings, Calves.
- Empty session, no goals: no muscle is visible.
- Empty session, goal Calves 6: visible = Calves.

## Session file format (business rule)

```json
{
  "version": 1,
  "exercises": [
    {
      "name": "Bench press",
      "sets": 4,
      "repRange": { "min": 6, "max": 10 },
      "primaryMuscles": ["Chest"],
      "secondaryMuscles": ["Triceps", "Shoulders"]
    }
  ],
  "goals": { "Chest": 10, "Triceps": 4.5 }
}
```

- `version` must be exactly `1`. Any other value is rejected (`Unsupported file version.`).
- Values must be within the slider limits (sets 1–10, reps 1–30, goals 0.5–30); a value outside them rejects the whole file, for example `Exercise 2: Sets must be a whole number from 1 to 10.` or `Goal for Chest must be a multiple of 0.5 from 0.5 to 30.`
- `exercises` is an array, possibly empty, in session order. Each exercise must pass the same validation as the form (see **Validate input**). Muscle names must match `MuscleGroup` values exactly, with the same case.
- `goals` is an object whose keys are `MuscleGroup` values and whose values are valid goals. It may be empty. A muscle without a key has no goal.
- Unknown extra keys are ignored on import and never written on export.
- Export writes JSON indented with 2 spaces.
- **Round trip:** exporting a session and importing the file gives an identical session.

## Implementation guidelines for agents

- **Keep the volume calculation in a pure function**, separate from the UI (for example `computeVolume(session) → Record<MuscleGroup, number>`). Unit-test it, including the worked example above.
- **Keep the direct/indirect split and the bar fill pure**, separate from the UI: for example `computeVolumeSplit(session) → Record<MuscleGroup, { direct, indirect }>`, with `computeVolume` derived from it (`direct + indirect`) so the volume rule lives in one place, and `barSegments(direct, indirect, scale) → { direct, indirect }`. Unit-test both, including the direct/indirect worked example. Compute them on render; never store them.
- **Define the muscle group list once** as a single constant, and use it for the form choices, the volume panel, and validation.
- **Prefer derived state.** Compute volume from the session on render. Do not store it separately.
- **Validate input:** exercise names must not be empty, sets are a whole number from 1 to 10, reps are whole numbers from 1 to 30 with `min ≤ max`, goals are a multiple of 0.5 from 0.5 to 30 (a goal slider at 0 clears the goal). The form's sliders cannot produce out-of-range values, but validation still checks them, because imported files are validated with the same rules.
- **Define the slider limits once** (sets 1–10, reps 1–30, goals 0.5–30 in steps of 0.5) as a single constant, and use it for the slider `min`/`max`/`step` attributes and for validation.
- **Keep the rep range push rule in a pure function**, separate from the UI (for example `setRepBound(repRange, bound, value) → repRange`, where moving `min` above `max` raises `max` to it and moving `max` below `min` lowers `min` to it). Unit-test it.
- **Sliders use native `<input type="range">` with no library.** The two-thumb rep range is two overlapping range inputs on one track, styled with CSS.
- **Keep goal status in a pure function**, separate from the UI (for example `goalStatus(volume, goal) → { status } | null`). Unit-test it, including the goal worked example above. Compute it on render; never store status.
- **Keep the bar scale in a pure function**, separate from the UI (for example `barScale(volume, goals) → number`), and feed it to `barSegments` and the marker position. Unit-test it, including the bar scale worked example. Compute it on render; never store it.
- **The goals dialog uses the native `<dialog>` element**, with no library.
- **Keep reordering logic pure.** Moving an exercise is a pure function on the exercise list (for example `moveExercise(exercises, from, to) → Exercise[]`), unit-tested separately from the drag UI.
- **Drag and drop uses pointer events, with no dependencies.** Do not use the native HTML5 drag API (unreliable on touch) or a library.
- **Keep the session file logic pure**, separate from the UI: for example `serializeSession(session) → string` and `parseSession(text) → { session } | { error }`. Reuse `validateExercise`, `validateGoal`, and `MUSCLE_GROUPS`; do not duplicate the rules. Unit-test the round trip (with the volume worked example and the goal worked example) and every rejection case.
- **Keep the exercise summary in a pure function**, separate from the UI (for example `exerciseSummary(exercise) → string`). Unit-test it, including the summary worked example above. Compute it on render; never store it.
- **Keep row visibility in a pure function**, separate from the UI (for example `visibleMuscles(volume, goals) → MuscleGroup[]`, in `MuscleGroup` order). Unit-test it, including the visible rows worked example. Compute it on render; never store it.
- **Collapsed state is view state**, not domain state: it is not a field of `Exercise` or `Session`, it is never exported, and it is not kept between page loads. Keep it in the UI next to the session (for example a boolean per exercise, in session order), and move it with the same pure `moveExercise` when exercises are reordered.
- **File I/O uses browser built-ins only:** a `Blob` with an `<a download>` link for export, a hidden `<input type="file" accept=".json,application/json">` for import, and the native `confirm()` for the replace prompt. No libraries.

## Decided

- **Volume goals** (2026-10-09): a single target per muscle, not a range. Volume above the goal is flagged as **over**. Goals are part of the single in-memory session; they are not persisted, like the rest of the session. The body map stays on absolute heat colours.
- **Session import/export** (2026-10-09): one session per JSON file, with exercises and goals. Import replaces the whole session after a confirmation (asked only when the current session is not empty). Export is blocked until every exercise is valid. An invalid file is rejected as a whole. The file name is `gym-session-YYYY-MM-DD.json`. This is a manual, user-triggered file exchange; the app still keeps nothing between page loads.
- **Direct and indirect volume** (2026-10-09): indirect volume is counted volume (secondary sets × 0.5), so direct + indirect = volume. The volume-list bar shows two stacked segments, direct first, coloured like the primary and secondary chips; heat colours stay on the body map only. When volume exceeds the bar's scale, direct fills first and indirect is cut off. Rows show only the total; the split appears in the readout and in screen-reader text. Goals, the session file format, and the body map are unchanged.
- **Expand and collapse exercises** (2026-10-09): a chevron toggle per card plus "Expand all" / "Collapse all" above the list. A collapsed card shows its header and a one-line summary (name, sets × reps, primary and secondary muscles). New exercises start expanded; imported exercises start collapsed. A collapsed invalid exercise shows a `Needs fixing` marker, and a refused export expands the exercise it names and focuses its first invalid field. Collapsed state is UI-only: not in the session, not in the file, not persisted.
- **Hide irrelevant muscles** (2026-10-09): the volume list hides a muscle when it has no goal and 0 computed volume (empty or invalid sets count as 0). It applies to the volume list only; the body map still shows every muscle. Visible rows keep `MuscleGroup` order. When nothing is visible, a short `No volume yet. Add an exercise or set a goal.` message replaces the list and the Direct / Indirect key is hidden. Selecting a muscle whose row is hidden keeps working (body map and readout); the row is not forced visible and the selection is not cleared.
- **Rounded bar ends** (2026-10-09): the filled part of each volume-list bar is one pill. The outer ends (left end, and the right end of the last visible segment) are fully rounded, and the direct/indirect join stays straight. It applies to all bars, not only those with indirect volume. The indirect outline is drawn around its rounded ends, including when the fill reaches the full bar. Visual only: volume, fill widths (`barSegments`), goals, and the body map are unchanged.
- **Goal-coloured bars on a shared scale** (2026-10-10): this replaces the orange bar colours and the per-row scale (goal, or 10) from the direct/indirect decision. Bar colour comes from goal status: amber under, green met, red over, neutral grey-blue without a goal; 0 volume shows only the grey track. The direct/indirect split stays (solid and soft of the status colour), and the status text takes the same colour. One shared scale for all bars: the largest goal's marker sits at 75%, and the scale grows when a volume would pass the bar's end, so nothing is cut off. With no goals, the largest volume fills 75%. A thin goal marker shows the goal on each bar that has one. This adds status colours next to the orange accent; the design system is updated to match. `goalStatus` no longer returns `progress`. The body map, the readout text, the session file format, and mobile (bars hidden) are unchanged.
- **Sliders for numbers** (2026-10-10): sets, the rep range and goals are set with sliders instead of number fields, so one drag replaces click-and-type. Limits: sets 1–10, reps 1–30, goals 0.5–30 in 0.5 steps. The rep range is one two-thumb slider; thumbs push each other, so min ≤ max always holds. A goal slider's far-left 0 position means `No goal` and clears the goal. Each slider shows its value as text. The limits are part of validation, so an imported file with an out-of-range value is rejected as a whole (no clamping). Native range inputs, no library. The domain model shape, the file format keys, and volume rules are unchanged.

## Open decisions (ask the user before deciding)

- **Tech stack.** It is not chosen yet. Propose the simplest option that works (for example, a single static page with no build step, or a minimal framework) and get approval before you scaffold.
- **Persistence.** It is unspecified whether sessions are saved (in memory only, `localStorage`, or a backend). The MVP default is in memory only, unless the user says otherwise.
- **Same muscle as primary and secondary.** It is unspecified whether one exercise can list a muscle as both. The recommended default is to prevent it in the UI.
- **Exercises with no primary muscle.** It is unspecified whether an exercise may have zero primary muscle groups.
- **Multiple sessions.** It is unspecified whether the MVP supports several sessions or a program made of sessions. The default is a single session.

## Out of scope for the MVP

Authentication, multiple users, exercise libraries or presets, weight/RPE tracking, scheduling, and analytics beyond per-muscle set volume (with its direct/indirect split) and per-muscle volume goals. Goal presets or templates, and goal ranges (min–max), are out of scope. For import/export: automatic saving, merging or appending an imported session, partial imports, several sessions per file, migrating other file versions, and other formats (CSV and so on) are out of scope. For collapsing: remembering collapsed state between page loads or in the session file, collapse animations, and collapsing the volume panel are out of scope. For hiding muscles: a "show all muscles" toggle, sorting rows by volume, and hide/show animations are out of scope.
