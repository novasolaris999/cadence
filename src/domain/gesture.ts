// Swipe between days on Today: when a touch counts as a sideways flick. Pure, so the rule is tested on its own.

export interface Touch {
  /** Horizontal and vertical travel, px (positive = right / down). */
  dx: number;
  dy: number;
  /** From touch start to release, ms. */
  ms: number;
  /** From touch start until the finger first moved 10 px; a long pause means press-and-hold (a block drag). */
  holdMs: number;
  /** Where the touch started, and the screen width: edge swipes belong to the phone's back gesture. */
  startX: number;
  width: number;
}

const MIN_DISTANCE = 60;
const MAX_TIME = 700;
const HOLD = 200;
const EDGE = 24;

/** +1 = next day (finger moved left), -1 = previous day (moved right), 0 = not a day swipe. */
export function swipeStep(t: Touch): -1 | 0 | 1 {
  if (t.startX < EDGE || t.startX > t.width - EDGE) return 0;
  if (t.holdMs > HOLD || t.ms > MAX_TIME) return 0;
  if (Math.abs(t.dx) < MIN_DISTANCE || Math.abs(t.dx) < 1.5 * Math.abs(t.dy)) return 0;
  return t.dx < 0 ? 1 : -1;
}
