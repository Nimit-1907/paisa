/** How wide each button a swipe uncovers is, and so how far a row parks. */
export const SWIPE_ACTION_WIDTH = 88;

/**
 * Where a row comes to rest when the finger lifts.
 *
 * `left` and `right` count the buttons parked against each edge: a swipe
 * right (a positive offset) uncovers the left edge's. Past half the
 * buttons' width the row parks fully open, short of it the row closes,
 * and a side with no buttons never opens.
 */
export function settleSwipe(
  offset: number,
  counts: { left: number; right: number },
): number {
  const leftWidth = counts.left * SWIPE_ACTION_WIDTH;
  const rightWidth = counts.right * SWIPE_ACTION_WIDTH;

  if (leftWidth > 0 && offset >= leftWidth / 2) return leftWidth;
  if (rightWidth > 0 && offset <= -rightWidth / 2) return -rightWidth;
  return 0;
}
