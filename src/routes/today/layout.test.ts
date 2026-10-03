import { describe, expect, it } from 'vitest';
import { daySpan, GAP_H, HEADER_H, lanes, minuteAt, place, PX, ROW, segments, yOf } from './layout';

const b = (id: string, start: number, durationMin: number) => ({ id, start, durationMin });

describe('daySpan', () => {
  it('runs from the wake anchor to the sleep anchor, widened by blocks', () => {
    expect(daySpan([], 420, 1380)).toEqual({ from: 420, to: 1380 });
    expect(daySpan([b('a', 375, 30)], 420, 1380)).toEqual({ from: 360, to: 1380 });
    expect(daySpan([], 420, 30)).toEqual({ from: 420, to: 1440 });
  });

  it('extends to midnight on either edge when toggled', () => {
    expect(daySpan([], 420, 1380, { showEarly: true })).toEqual({ from: 0, to: 1380 });
    expect(daySpan([], 420, 1380, { showLate: true })).toEqual({ from: 420, to: 1440 });
  });
});

describe('segments', () => {
  it('collapses a long empty stretch, keeping one row of padding', () => {
    const blocks = [b('a', 420, 60), b('b', 720, 60)]; // 07:00-08:00, 12:00-13:00
    const segs = segments(blocks, { from: 420, to: 780 }, null);
    expect(segs).toEqual([
      { kind: 'rows', from: 420, to: 495 },
      { kind: 'gap', from: 495, to: 705 },
      { kind: 'rows', from: 705, to: 780 },
    ]);
  });

  it('keeps short gaps as rows', () => {
    const segs = segments([b('a', 420, 30), b('b', 510, 30)], { from: 420, to: 540 }, null);
    expect(segs).toEqual([{ kind: 'rows', from: 420, to: 540 }]);
  });

  it('never hides the current time and respects expanded gaps', () => {
    const blocks = [b('a', 420, 60), b('b', 900, 60)];
    const withNow = segments(blocks, { from: 420, to: 960 }, 660);
    expect(withNow.some((s) => s.kind === 'gap' && s.from <= 660 && s.to > 660)).toBe(false);
    const firstGap = segments(blocks, { from: 420, to: 960 }, null).find((s) => s.kind === 'gap')!;
    const open = segments(blocks, { from: 420, to: 960 }, null, new Set([firstGap.from]));
    expect(open).toEqual([{ kind: 'rows', from: 420, to: 960 }]);
  });
});

describe('lanes', () => {
  it('puts overlapping blocks side by side', () => {
    const l = lanes([b('a', 600, 60), b('b', 630, 30), b('c', 720, 30)]);
    expect(l.get('a')).toEqual({ lane: 0, of: 2 });
    expect(l.get('b')).toEqual({ lane: 1, of: 2 });
    expect(l.get('c')).toEqual({ lane: 0, of: 1 });
  });
});

describe('pixel layout', () => {
  const segs = [
    { kind: 'rows' as const, from: 420, to: 495 }, // 5 rows
    { kind: 'gap' as const, from: 495, to: 705 },
    { kind: 'rows' as const, from: 705, to: 780 }, // 5 rows
  ];
  const { items, height } = place(segs);

  it('stacks headers, rows, and gaps', () => {
    expect(items.map((i) => [i.kind, i.top, i.height, i.header])).toEqual([
      ['rows', HEADER_H, 5 * ROW, true],
      ['gap', HEADER_H + 5 * ROW, GAP_H, false],
      ['rows', HEADER_H + 5 * ROW + GAP_H + HEADER_H, 5 * ROW, true],
    ]);
    expect(height).toBe(2 * HEADER_H + 10 * ROW + GAP_H);
  });

  it('maps minutes to y and back', () => {
    for (const m of [420, 450, 494, 600, 705, 750]) expect(minuteAt(items, yOf(items, m))).toBeCloseTo(m);
    expect(yOf(items, 430)).toBe(HEADER_H + 10 * PX);
  });
});
