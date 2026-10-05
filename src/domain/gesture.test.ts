import { describe, expect, it } from 'vitest';
import { swipeStep, type Touch } from './gesture';

const t = (p: Partial<Touch>): Touch => ({ dx: 0, dy: 0, ms: 250, holdMs: 30, startX: 200, width: 400, ...p });

describe('swipeStep', () => {
  it('moves a day for a quick sideways flick', () => {
    expect(swipeStep(t({ dx: -90 }))).toBe(1);
    expect(swipeStep(t({ dx: 90, dy: 20 }))).toBe(-1);
  });
  it('ignores short, slanted, and slow moves (scrolling)', () => {
    expect(swipeStep(t({ dx: -40 }))).toBe(0);
    expect(swipeStep(t({ dx: -90, dy: 80 }))).toBe(0);
    expect(swipeStep(t({ dx: -90, ms: 900 }))).toBe(0);
  });
  it('leaves press-and-hold to block dragging', () => {
    expect(swipeStep(t({ dx: -120, holdMs: 300 }))).toBe(0);
  });
  it('leaves screen-edge swipes to the phone (back gesture)', () => {
    expect(swipeStep(t({ dx: 120, startX: 10 }))).toBe(0);
    expect(swipeStep(t({ dx: -120, startX: 390 }))).toBe(0);
  });
});
