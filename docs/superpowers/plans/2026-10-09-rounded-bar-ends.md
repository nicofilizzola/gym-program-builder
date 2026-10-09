# Rounded Bar Ends Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the filled part of every volume-list bar read as one rounded pill. Its outer ends are fully rounded, the indirect outline follows those rounded ends, and the direct/indirect join stays straight.

**Architecture:** Today the track `.bar` (`style.css:700`) is a rounded pill with `overflow: hidden`, and its two segments are plain rectangles. The track's clip rounds the fill's left end, but the fill's right end stays square wherever it stops. Where the fill does reach the track's end, the clip cuts the indirect segment's inset outline. The fix gives the segments their own radii: direct rounds its left end and indirect rounds its right end. `refresh()` in `src/app.js` toggles two classes on `.bar`, `no-direct` and `no-indirect`, from the existing `barSegments` result. With those classes, CSS fully rounds the only visible segment. The radius sits on the segment itself, so its `box-shadow: inset` outline follows the curve.

**Tech Stack:** HTML, CSS, vanilla JS ES modules, `node:test` on Node 22. No dependencies, no build step.

**Spec:** `AGENTS.md`: functional requirement 10 and the "Rounded bar ends" entry under "Decided".

## Global Constraints

- No runtime or dev dependencies; no build step.
- Visual only. Do not change `barSegments`, `computeVolumeSplit`, the fill widths, the colours, the goal logic, the readout, the split screen-reader text, or the body map.
- Radius value: `999px`, the same as the track's, so the fill's ends match the track's ends.
- Left end of the fill = left end of the first segment with a width above 0. Right end of the fill = right end of the last segment with a width above 0. The direct/indirect join has no radius.
- It applies to every bar: direct only, indirect only, both, and full (`direct + indirect` fill = 1).
- Keep the `transition: width 250ms ease` on the segments. Hiding a segment with `display: none` would break it, so use classes, not `hidden`.
- Bars stay hidden on mobile (≤ 760px). The change needs no mobile work.
- Rows are built once in `renderPanel()`. Only `refresh()` changes, so hover and selection state survive.

## Review Focus

There is no pure logic to unit-test. The decision is `fill.direct === 0` and `fill.indirect === 0` on values `barSegments` already returns, and its tests already cover them. Each line below is checked by hand in Task 1 Step 3.

1. **Direct and indirect both present, under the scale** (Triceps from the worked example, no goal: 3 direct, 2 indirect, scale 10): rounded left end on the direct segment, straight join, rounded right end with its outline on the indirect segment.
2. **Full bar with indirect at the end** (Triceps with goal 4: fills 0.75 + 0.25): the indirect's right end is rounded and its orange outline goes all the way around the curve, with no clipped corner.
3. **Indirect only** (Shoulders: 0 direct, 3.5 indirect): the indirect segment is a full pill, rounded and outlined on both ends.
4. **Direct only** (Lats: 3 direct, 0 indirect): the direct segment is a full pill with a rounded right end.
5. **Live change through 0** (remove the only secondary exercise for a muscle, then add it back): the corners switch between pill and split shapes on every edit, with no stale square corner.

---

### Task 1: Round the fill's outer ends

**Files:**
- Modify: `src/app.js` (in `refresh()`, after the two `style.width` lines, about lines 205-207)
- Modify: `style.css` (the `.volume-row .bar-direct` and `.volume-row .bar-indirect` rules, about lines 715-722)

**Interfaces:**
- Consumes: `barSegments(direct, indirect, scale) → { direct: number, indirect: number }` from `src/volume.js` (existing, unchanged).
- Produces: classes `no-direct` and `no-indirect` on each `.volume-row .bar`, present exactly when that segment's fill is `0`.

- [ ] **Step 1: Toggle the classes in `refresh()`**

In `src/app.js`, right after the two width assignments that use `fill`, run `bar.classList.toggle('no-direct', fill.direct === 0)` and `bar.classList.toggle('no-indirect', fill.indirect === 0)` on the row's `.bar` element.

- [ ] **Step 2: Add the radii in `style.css`**

Exact rules, placed right after the existing `.volume-row .bar-indirect` rule:

```css
/* The fill reads as one pill: round its outer ends, keep the direct/indirect join straight. */
.volume-row .bar-direct {
  border-radius: 999px 0 0 999px;
}

.volume-row .bar-indirect {
  border-radius: 0 999px 999px 0;
}

.volume-row .bar.no-indirect .bar-direct,
.volume-row .bar.no-direct .bar-indirect {
  border-radius: 999px;
}
```

Leave the existing `background` and `box-shadow` declarations and the track's `overflow: hidden` as they are.

- [ ] **Step 3: Run the tests, then check by hand**

Run: `npm test`
Expected: every test passes, with the same count as before this task. No test file changes.

Run: `npm start`, then open the printed URL at desktop width (≥ 1024px). Add the volume worked example from `AGENTS.md`: Bench press 4 sets, Chest / Triceps, Shoulders; Dips 3 sets, Chest, Triceps / Shoulders; Pull-ups 3 sets, Lats / Biceps, Upper back. Zoom to 200% or more to inspect the corners. Then:
- Review Focus 1: the Triceps bar has a solid rounded left end, a straight join, and a soft indirect segment with a rounded, outlined right end.
- Review Focus 3: the Shoulders, Biceps, and Upper back bars are indirect-only pills, rounded and outlined on both ends.
- Review Focus 4: the Chest and Lats bars are solid pills with rounded right ends.
- Review Focus 2: set goals Triceps 4 and Chest 7. The Triceps bar is full and its outline follows the right curve. The Chest bar is a full solid pill.
- Review Focus 5: remove Pull-ups. The Biceps and Upper back rows disappear (requirement 12) and Lats goes away. Add an exercise with sets 2, Biceps primary and Lats secondary. The Biceps bar is a direct-only pill and the Lats bar an indirect-only pill. Change Lats to primary: the Lats bar switches to a direct-only pill on that edit.
- At 375px width the volume chips show no bars, unchanged.

- [ ] **Step 4: Commit**

```bash
git add src/app.js style.css AGENTS.md docs/superpowers/plans/2026-10-09-rounded-bar-ends.md
git commit -m "fix: round the outer ends of the volume bar fill"
```
