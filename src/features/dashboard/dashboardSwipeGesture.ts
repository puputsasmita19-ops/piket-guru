/** Pointer gesture threshold shared by touch and mouse Flash Info navigation.
 * Vertical movement is always left to native scrolling; no timers or layout reads. */
export interface SwipeStart { x: number; y: number }
export type SwipeIntent = 'horizontal' | 'vertical' | 'pending';

export function getSwipeIntent(start: SwipeStart, x: number, y: number): SwipeIntent {
  const dx = Math.abs(x - start.x), dy = Math.abs(y - start.y);
  if (Math.max(dx, dy) < 10) return 'pending';
  if (dx > dy * 1.3) return 'horizontal';
  if (dy > dx * 1.3) return 'vertical';
  return 'pending';
}

export function getSwipeDirection(start: SwipeStart, x: number, y: number): -1 | 0 | 1 {
  const dx = x - start.x, dy = y - start.y;
  if (Math.abs(dx) < 40 || Math.abs(dx) <= Math.abs(dy) * 1.3) return 0;
  return dx < 0 ? 1 : -1;
}
