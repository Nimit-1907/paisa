/** How far a held finger may wander before it is a scroll, in px. */
export const HOLD_SLOP = 10;

/**
 * Whether a press can start a hold: the primary button of the primary
 * pointer. A right-button hold (whose context menu a chip suppresses) or a
 * second finger would otherwise save a record nobody meant to.
 */
export function holdStarts(event: {
  button: number;
  isPrimary: boolean;
}): boolean {
  return event.button === 0 && event.isPrimary;
}

/**
 * Whether the pointer has travelled far enough to be a scroll rather than
 * a hold. On touch the browser sends no pointerleave until release, so a
 * finger resting on a chip and then sliding along the row is caught here.
 */
export function movedPastSlop(
  start: { x: number; y: number },
  now: { x: number; y: number },
): boolean {
  return Math.hypot(now.x - start.x, now.y - start.y) > HOLD_SLOP;
}
