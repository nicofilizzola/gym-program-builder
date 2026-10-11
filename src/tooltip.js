/** Space between a button and its tooltip, in px. */
export const TOOLTIP_GAP = 6;

/** Smallest distance between a tooltip and the window's edges, in px. */
export const TOOLTIP_MARGIN = 8;

const clamp = (value, min, max) => Math.max(min, Math.min(value, max));

/**
 * Where a tooltip goes: below its button with right edges aligned, flipped above when only that side fits,
 * otherwise on the roomier side; always kept inside the window.
 * @param {{ top: number, right: number, bottom: number }} anchor the button's rect, in viewport px
 * @param {{ width: number, height: number }} tip
 * @param {{ width: number, height: number }} viewport
 * @returns {{ top: number, left: number, placement: 'below' | 'above' }}
 */
export function tooltipPosition(anchor, tip, viewport) {
  const left = clamp(anchor.right - tip.width, TOOLTIP_MARGIN, viewport.width - TOOLTIP_MARGIN - tip.width);
  const roomBelow = viewport.height - TOOLTIP_MARGIN - (anchor.bottom + TOOLTIP_GAP);
  const roomAbove = anchor.top - TOOLTIP_GAP - TOOLTIP_MARGIN;
  const placement = tip.height <= roomBelow ? 'below'
    : tip.height <= roomAbove ? 'above'
    : roomBelow >= roomAbove ? 'below' : 'above';
  const top = placement === 'below' ? anchor.bottom + TOOLTIP_GAP : anchor.top - TOOLTIP_GAP - tip.height;
  // Clamp to the bottom first, so the top margin wins when the tip is taller than the window.
  return { top: Math.max(TOOLTIP_MARGIN, Math.min(top, viewport.height - TOOLTIP_MARGIN - tip.height)), left, placement };
}
