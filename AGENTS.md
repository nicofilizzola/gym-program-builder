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
├── sets: positive integer
├── repRange: { min: positive integer, max: positive integer }   // min <= max
├── primaryMuscles: MuscleGroup[]
└── secondaryMuscles: MuscleGroup[]

Goal value: positive multiple of 0.5 (for example 10 or 4.5)

MuscleGroup (fixed list, exactly these 10 values, in this order):
  Chest, Lats, Upper back, Biceps, Triceps, Shoulders, Abs, Quads, Hamstrings, Calves
```

## Functional requirements

1. **Session form.** The user can create a session template: add exercises, edit them, remove them, and reorder them. A session has no name.
2. **Exercise fields.** For each exercise the user sets the name, the number of sets, the rep range, the primary muscle groups, and the secondary muscle groups.
3. **Muscle group choices.** Primary and secondary muscle groups come only from the fixed `MuscleGroup` list above. Users cannot add custom muscle groups.
4. **Live volume panel.** A panel always shows the session's volume for each muscle group and updates on every edit. No submit or refresh step is needed.
5. **Reorder exercises.** Each exercise card has a drag handle. Dragging it with a mouse or by touch moves the exercise to a new position. When the handle has keyboard focus, the ↑ and ↓ arrow keys move the exercise up or down one place, and focus stays on the moved exercise's handle. Order does not affect volume.
6. **Volume goals.** A "Set goals" button in the volume panel opens a dialog with one number field per muscle group, in `MuscleGroup` order. The user can set, change, or clear (empty the field) a goal for any muscle. Every goal is optional. Changes apply live as the user types. A "Done" button, Escape, or a click outside the dialog closes it; there is no Save/Cancel step. An invalid value shows an error next to its field and is not applied.
7. **Volume relative to goals.** In the volume list, a muscle with a goal shows its volume against the goal (for example `7 / 10`), a bar whose full length is the goal (see **Direct and indirect volume** for how it fills), and a text status: **under**, **met**, or **over**. A muscle without a goal is shown exactly as before. The body map keeps its absolute heat colours; goals do not change it.
8. **Export session.** An "Export" button downloads the current session (exercises in order, and goals) as a JSON file named `gym-session-YYYY-MM-DD.json`, using today's local date. Export is refused while any exercise is invalid: nothing is downloaded, and a message names the first invalid exercise (for example `Fix exercise 2 before exporting.`). A session with no exercises can be exported.
9. **Import session.** An "Import" button opens a file picker for `.json` files. A valid file **replaces** the whole current session (exercises and goals). If the current session has any exercise or goal, the user is asked to confirm the replacement first; declining changes nothing. A file that is not valid JSON or does not match the session file format is **rejected as a whole**: the session does not change, and one error message says what is wrong (for example `Exercise 2: unknown muscle group "Glutes".`).
10. **Direct and indirect volume.** In the volume list, each muscle's bar has two stacked segments: **direct** volume (from exercises where it is a primary muscle) first, then **indirect** volume (from exercises where it is a secondary muscle). Direct is solid accent orange, like a selected primary chip; indirect is a soft orange fill with an orange outline, like a selected secondary chip. The bar no longer uses heat colours; the body map keeps them. A small "Direct / Indirect" key sits above the list (hidden on mobile, where bars are hidden). Each row still shows one number: the total, or `total / goal`. The split is shown as text in the readout (for example `Triceps 5 sets (3 direct · 2 indirect) · 2 exercises`, or `Triceps 5 / 4 sets (3 direct · 2 indirect) · over · 2 exercises` with a goal), always naming both parts even when one is 0, and in a visually hidden text inside each row button for screen readers.

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
progress = min(volume / goal, 1)   // bar fill, 0 to 1
```

- A muscle with no goal has no status. It is never shown as under.
- Volume and goal are both multiples of 0.5, so an exact equality comparison is safe.
- Status is always shown as text next to the bar. Colour alone is not enough.

### Worked example (use as a test case)

Using the volume from the volume worked example above, with goals Chest **7**, Triceps **4**, Lats **6**, Quads **8**:

| Muscle  | Volume | Goal | Shown      | Status | Progress |
|---------|--------|------|------------|--------|----------|
| Chest   | 7      | 7    | `7 / 7`    | met    | 1        |
| Triceps | 5      | 4    | `5 / 4`    | over   | 1        |
| Lats    | 3      | 6    | `3 / 6`    | under  | 0.5      |
| Quads   | 0      | 8    | `0 / 8`    | under  | 0        |
| Biceps  | 1.5    | —    | `1.5`      | —      | —        |

## Direct and indirect volume (business rule)

For each muscle group:

```
direct(muscle)   = Σ sets         over exercises where muscle ∈ primaryMuscles
indirect(muscle) = Σ sets × 0.5   over exercises where muscle ∈ secondaryMuscles
volume(muscle)   = direct(muscle) + indirect(muscle)
```

- Indirect is **counted volume** (half sets), not raw secondary sets, so the two parts always add up to the volume.
- Goal status still compares the total volume to the goal.

The bar fills **direct first**, on the same scale for both segments:

```
scale         = goal, or 10 when the muscle has no goal
directFill    = min(direct / scale, 1)
indirectFill  = min(indirect / scale, 1 − directFill)   // cut off at the end of the bar
```

If direct alone reaches the scale, the bar is all direct.

### Worked example (use as a test case)

Using the volume worked example and the goal worked example above:

| Muscle     | Direct | Indirect | Goal | Scale | Direct fill | Indirect fill |
|------------|--------|----------|------|-------|-------------|---------------|
| Chest      | 7      | 0        | 7    | 7     | 1           | 0             |
| Triceps    | 3      | 2        | 4    | 4     | 0.75        | 0.25          |
| Lats       | 3      | 0        | 6    | 6     | 0.5         | 0             |
| Quads      | 0      | 0        | 8    | 8     | 0           | 0             |
| Shoulders  | 0      | 3.5      | —    | 10    | 0           | 0.35          |
| Biceps     | 0      | 1.5      | —    | 10    | 0           | 0.15          |
| Upper back | 0      | 1.5      | —    | 10    | 0           | 0.15          |

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
- **Validate input:** exercise names must not be empty, sets ≥ 1, rep range `min ≤ max`, goals are a positive multiple of 0.5 (an empty field clears the goal).
- **Keep goal status in a pure function**, separate from the UI (for example `goalStatus(volume, goal) → { status, progress } | null`). Unit-test it, including the goal worked example above. Compute it on render; never store status or progress.
- **The goals dialog uses the native `<dialog>` element**, with no library.
- **Keep reordering logic pure.** Moving an exercise is a pure function on the exercise list (for example `moveExercise(exercises, from, to) → Exercise[]`), unit-tested separately from the drag UI.
- **Drag and drop uses pointer events, with no dependencies.** Do not use the native HTML5 drag API (unreliable on touch) or a library.
- **Keep the session file logic pure**, separate from the UI: for example `serializeSession(session) → string` and `parseSession(text) → { session } | { error }`. Reuse `validateExercise`, `validateGoal`, and `MUSCLE_GROUPS`; do not duplicate the rules. Unit-test the round trip (with the volume worked example and the goal worked example) and every rejection case.
- **File I/O uses browser built-ins only:** a `Blob` with an `<a download>` link for export, a hidden `<input type="file" accept=".json,application/json">` for import, and the native `confirm()` for the replace prompt. No libraries.

## Decided

- **Volume goals** (2026-10-09): a single target per muscle, not a range. Volume above the goal is flagged as **over**. Goals are part of the single in-memory session; they are not persisted, like the rest of the session. The body map stays on absolute heat colours.
- **Session import/export** (2026-10-09): one session per JSON file, with exercises and goals. Import replaces the whole session after a confirmation (asked only when the current session is not empty). Export is blocked until every exercise is valid. An invalid file is rejected as a whole. The file name is `gym-session-YYYY-MM-DD.json`. This is a manual, user-triggered file exchange; the app still keeps nothing between page loads.
- **Direct and indirect volume** (2026-10-09): indirect volume is counted volume (secondary sets × 0.5), so direct + indirect = volume. The volume-list bar shows two stacked segments, direct first, coloured like the primary and secondary chips; heat colours stay on the body map only. When volume exceeds the bar's scale, direct fills first and indirect is cut off. Rows show only the total; the split appears in the readout and in screen-reader text. Goals, the session file format, and the body map are unchanged.

## Open decisions (ask the user before deciding)

- **Tech stack.** It is not chosen yet. Propose the simplest option that works (for example, a single static page with no build step, or a minimal framework) and get approval before you scaffold.
- **Persistence.** It is unspecified whether sessions are saved (in memory only, `localStorage`, or a backend). The MVP default is in memory only, unless the user says otherwise.
- **Same muscle as primary and secondary.** It is unspecified whether one exercise can list a muscle as both. The recommended default is to prevent it in the UI.
- **Exercises with no primary muscle.** It is unspecified whether an exercise may have zero primary muscle groups.
- **Multiple sessions.** It is unspecified whether the MVP supports several sessions or a program made of sessions. The default is a single session.

## Out of scope for the MVP

Authentication, multiple users, exercise libraries or presets, weight/RPE tracking, scheduling, and analytics beyond per-muscle set volume (with its direct/indirect split) and per-muscle volume goals. Goal presets or templates, and goal ranges (min–max), are out of scope. For import/export: automatic saving, merging or appending an imported session, partial imports, several sessions per file, migrating other file versions, and other formats (CSV and so on) are out of scope.
