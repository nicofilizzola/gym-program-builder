# Program review dock and compact week agenda

Status: design approved by the user on 2026-10-31 through an interactive mockup review; written specification approved on 2026-10-31. No implementation is approved yet. The next step is an implementation plan (writing-plans), then plan review.

This builds on [Program hypertrophy analysis v1](2026-10-31-program-analysis-design.md). It changes only where and how the program report is presented, the Week layout and the review trigger. Analysis behavior, input, prompts, limits and the report contract are unchanged.

## Intent and agreed scope

The current program report is a floating 480px panel anchored over the page. It covers the program while open, and its typography is larger and looser than the rest of the compact desktop interface. The user wants to read the analysis while still seeing and using the sessions and weekly volume, similar to the Gemini side panel in Google Docs.

The user approved:

- A slim AI review panel docked to the right edge of the program page. The page makes room for it, so no menu or panel is covered.
- Denser report typography and spacing.
- A single-column Week agenda (one row per weekday) as the normal Week layout, whether or not the review is open, so opening the review never rearranges the days.
- An "AI review" panel toggle at the far right of the program header, with a distinctive AI treatment (sparkle, warm gradient, restrained motion).
- A full-screen review on phones and narrow tablets. The user delegated this choice; desktop is the priority.

Success means a user on a 1366×768 laptop can open the review and read it beside the agenda and volume panel, with body figures at full size, no horizontal overflow and no rearrangement of the week.

## Mockups

The approved mockup is a disposable study built from copies of the real CSS and browser modules with synthetic data (no API, saving or AI). Its source, capture script and measurements are in the ignored folder `.superpowers/brainstorm/2916-1793475062/` (`content/scene.html`, `content/review-gallery-v3.html`, `content/agenda-preview.*`, `content/ai-button.css`, `DESIGN-NOTE.md`, `verification.json`). Report copy in the mockup is illustrative.

Reference screenshots (sample data, final button treatment):

- [1366×768, review open](2026-10-31-program-review-dock/1366-open.png)
- [1440×900, review open](2026-10-31-program-review-dock/1440-open.png)
- [1440×900, review closed](2026-10-31-program-review-dock/1440-closed.png)
- [1920×1080, review open](2026-10-31-program-review-dock/1920-open.png)
- [Button, closed](2026-10-31-program-review-dock/button-closed.png) and [open](2026-10-31-program-review-dock/button-open.png)

The screenshots show layout and styling only. Where they differ from this text, this text governs.

## Desktop layout

Follow [the design system](../../design-system/README.md) and its Feature design and review checklist.

```text
┌ app navigation ───────────────────────────────────────────────┬──────────────┐
│ Programs / Upper / Lower                                       │ ✦ AI review ✕│
│ PROGRAM [name]    [Program context][Import][Export]  [✦ AI REVIEW]│ Hypertrophy… │
│ SESSIONS  Week|Sequence     │ WEEKLY VOLUME                   │ Assessment   │
│ Mon │ Upper A · 5 ex · ~53m │  body map    volume rows        │ Strengths    │
│     │ Core    · 1 ex · ~14m │  (180/200px)                    │ Improvements │
│ Tue │ Lower A               │                                 │ Limits       │
│ Wed │ Rest day              │                                 │  (scrolls)   │
│ …   │                       │                                 │──────────────│
│ Unscheduled │ Shoulders…    │                                 │ Analyze again│
└────────────────────────────────────────────────────────────────┴──────────────┘
```

### Review dock

- A full-height column on the right edge, below the global application navigation. It is part of the page layout, not an overlay: when it opens, the program content area narrows to make room; when it closes, the content area regains the width.
- Width 340px, or 360px at 1600px viewport width and above. Separated from the page by a thin border using existing tokens; no drop shadow or floating card.
- Internal structure: a fixed header (sparkle/review identity, "AI review" heading, "Hypertrophy · AI-generated" caption, close action button), an independently scrolling report region (snapshot scope line, status, staleness, report), and a fixed footer with the generation controls (Analyze again, Stop, Retry, Jump to latest, as applicable). Header and footer remain visible while the report scrolls.
- The dock stays within the viewport height (sticky beside normal page scrolling) so its footer controls are always reachable.

### Report typography and spacing

Use relative units so enlarged text still scales. Target values at default text size:

| Element | Current popup | Dock |
|---|---:|---:|
| Report heading | 20px | 16px |
| Opening assessment paragraph | 17px | 14px (no larger lead) |
| Report body | 15px / 1.6 | 14px / 1.45 |
| Space above section headings | 20px | 12–16px |
| Panel width | up to 480px | 340px / 360px |

Report sections stay Assessment, Strengths, Improvements and Limits, all visible without extra disclosures. Reuse the existing safe report renderer.

### Program content beside the dock

- The weekly volume panel keeps its existing width (460px, or 520px at 1600px and above). Body figures keep 180px (200px at 1600px and above); never shrink, crop or hide them to fit the dock.
- The sessions column takes the remaining width. At 1366×768 with the review open, a six-session populated week needs a little page scrolling to reach Unscheduled; this is accepted. At 1440×900 and 1920×1080 the sample fits vertically.
- Normal document scrolling only; no new internal scroll areas apart from the dock's report region.

## Compact Week agenda

Week always uses a single-column agenda at every width, replacing the current multi-column weekday grid. Sequence keeps its existing ordered sessions and rest entries.

- One row per weekday, Monday to Sunday, followed by an Unscheduled row. Day labels sit in a fixed left column; that day's sessions stack in the right column.
- Multiple sessions per day stack within their day row. An empty weekday shows the existing "Rest day" placeholder and remains a valid drop target.
- Session cards are compact: the session name, exercise count and duration (for example "Upper A · 5 exercises · ~53 min") share one line where space permits and wrap naturally with long names or enlarged text. Existing card actions (Reorder, duplicate, remove) stay visible at the right of the card.
- Tighter row gaps than the current grid. Keep touch targets and readable text.
- Preserve all existing behavior: whole-card dragging, touch press-and-hold, Reorder actions/menus, keyboard Up/Down and Alt+Up/Down day changes, highlighting of contributing workouts from the volume panel, canonical order, day assignments, Week/Sequence toggling and hidden Sequence rest entries in Week.
- On narrow screens the day label may move above its sessions when the side-by-side row no longer fits; content wraps rather than overflowing.

## AI review toggle

- A single labeled "AI review" button replaces the current "Analyze program" trigger. It sits at the far right of the program header actions, separated by 16px from the Program context / Import / Export group, so it reads as the control for the adjacent panel rather than a file action. The label stays "AI review" in every state.
- It is a toggle: `aria-expanded` reflects whether the review is open and `aria-controls` points to the dock (or full-screen review). Unavailable/disabled behavior and messaging from the current trigger are preserved.
- Visual identity (clearly AI, even when closed), using only the existing orange accent family — no second accent colour:
  - Inline sparkle SVG (currentColor) before the label.
  - Warm orange gradient border and a tinted fill when closed; a stronger fill and keyline when open.
  - Fine-pointer hover only (`(hover: hover) and (pointer: fine)`): one 450ms light sweep across the button per hover. No sweep on touch.
  - Keyboard focus: the standard static orange focus outline, no sweep.
  - While a report is generating: the sparkle icon alone breathes (opacity/scale, 1600ms cycle) until generation stops. This replaces the current "Analyzing" label change. Idle buttons never animate, and nothing animates on initial page render.
  - Reduced motion disables the sweep and the breath; the colour treatment remains.
- Compact 32px height on fine-pointer desktop without a coarse pointer; at least 44px on touch and hybrid devices.

## Interaction, motion and accessibility

- **First open** starts an analysis of the current snapshot, as the Analyze program action does today. **Reopening** shows the existing report (complete, streaming, stopped or errored) without regenerating; Analyze again and Retry remain explicit.
- **Open/close motion:** the layout's dock column width, the dock's horizontal translation and its opacity transition over 180ms ease-out, so the program content glides to its new width. Use explicit properties, never `transition: all`. Reduced motion settles immediately. Initial rendering (page load, route entry, rerenders) never animates.
- **Rapid reversal:** reopening during the closing transition reverses smoothly; no stale completion callback may hide, tear down or refocus anything.
- **Focus:** opening moves focus to the report heading. Close button and Escape (while focus is inside the review) close it and return focus to the AI review toggle.
- **Closed state:** the dock becomes inert and `aria-hidden` immediately after focus is restored, while its exiting visual finishes through CSS. Its DOM, report and report scroll position persist for reopening.
- The dock is non-modal on desktop: the program stays fully editable while it is open. Edits continue to mark the report stale exactly as today.
- Status announcements stay separate from streamed prose. Long names, errors and report text wrap.

### Report lifecycle (unchanged)

Keep the existing program-analysis lifecycle: idle, connecting, streaming, complete, stopped and error states; independent "Program changed" staleness and exact-revert clearing; closing preserves the report and lets generation continue; route navigation (including entering a session editor) cancels the request and discards the report; routine rerenders preserve the controller, report and dock state; existing error messages and no automatic retries.

## Phones and narrow tablets

Where the dock does not fit (below 1280px; see Follow-up decisions), the review opens as a full-screen native modal, extending the existing ≤760px full-screen analysis pattern, with safe-area padding, the same fixed header/footer and scrolling report. Closing returns to the same program position with focus on the AI review toggle, and the report keeps its text and reading position. This surface was not mocked up; reuse the existing modal motion (180ms opacity and 4px translation, backdrop fade, preserved exit surface) and reduced-motion behavior.

## Unchanged and out of scope

- Analysis input, snapshot rules, `POST /api/analysis/program`, limits, prompt, provider settings, report contract and program context storage.
- Standalone session analysis keeps its current anchored popup and full-screen mobile modal; this design is program-scoped.
- Palette, Barlow typography, existing control sizing rules and the volume panel's content.
- Out of scope: a resizable or detachable dock, remembering open/closed state across page loads, chat/follow-ups, saved reports, a multi-column calendar week, and any analysis behavior change.

## Follow-up decisions

These were settled after the design session; the user accepted the recommended defaults on 2026-10-31.

1. **Dock breakpoint.** The mockup verified 1366px and wider; the desktop compact layout begins at 1100px, where a 340px dock plus the 460px volume panel would leave too little room for sessions. The dock applies at viewport widths of 1280px and above; below that, the review is full-screen.
2. **Program context while the review is open.** The v1 spec dismisses the analysis surface when the context dialog opens, to avoid stacked overlays. The dock is part of the layout, not an overlay, so it stays open behind the modal context dialog. At full-screen review widths, keep the existing dismiss-then-reopen behavior.
3. **Volume panel stickiness with the dock open.** Keep the existing sticky-rail-when-it-fits / flow-fallback behavior unchanged.

## Verification and acceptance

Implementation must run `npm test`, `npm run test:e2e` and `npm run build`. Update authoritative values in `style.css` first and update `docs/design-system/README.md` in the same change (dock, agenda, AI toggle identity and motion, report typography; the "Session analysis overlay" section must stop describing program reports).

Automated coverage should include:

- Week renders one agenda row per weekday plus Unscheduled, with multiple same-day sessions, empty-day placeholders and unchanged drag/keyboard/Reorder behavior, day changes and Week/Sequence toggling.
- Toggle `aria-expanded`/`aria-controls`, first-open generation, reopen without regeneration, generating breath state, and unavailable states.
- Dock open/close focus movement, Escape, inert/`aria-hidden` when closed, report and scroll retention, rapid reversal without stale callbacks, and reduced motion.
- Dock layout: no horizontal overflow, body figures at least 180px, footer within the viewport, report text 14px, at 1366×768, 1440×900 and 1920×1080.
- Full-screen review below the dock breakpoint, including breakpoint changes while open.
- Existing program analysis lifecycle, staleness, navigation cancellation and standalone session analysis unchanged.

Inspect populated screens in a real browser at 1366×768, 1440×900 and 1920×1080, plus mobile/tablet widths, 200% text and touch/hybrid input. Play open/close, rapid toggles, keyboard focus, hover sweep, generating motion, reduced motion, long session names, long reports during streaming and editing while the dock is open. Report what was inspected and any gaps; screenshots alone cannot verify motion.
