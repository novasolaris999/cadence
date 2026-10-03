// Timeline layout for Today: which stretches of the day are shown as 15-minute rows,
// which long empty stretches collapse into a single "Free" row, and how overlapping
// blocks share the width. Pure functions so they can be unit tested.

import type { Block, Minutes } from '../../domain/types';

export const SLOT = 15;
/** Empty stretches at least this long collapse. */
export const COLLAPSE_MIN = 90;

export type Segment =
  | { kind: 'rows'; from: Minutes; to: Minutes }
  | { kind: 'gap'; from: Minutes; to: Minutes };

const floorTo = (m: number, step: number) => Math.floor(m / step) * step;
const ceilTo = (m: number, step: number) => Math.ceil(m / step) * step;

/**
 * Visible span: from the wake anchor (or earliest block) to the sleep anchor (or latest end).
 * `showEarly` / `showLate` extend it to 00:00 / 24:00 (the timeline's edge toggles).
 */
export function daySpan(
  blocks: Pick<Block, 'start' | 'durationMin'>[],
  wakeAnchor: Minutes,
  sleepAnchor: Minutes,
  opts: { showEarly?: boolean; showLate?: boolean } = {},
): { from: Minutes; to: Minutes } {
  // A sleep anchor after midnight (e.g. 00:30) still ends the timeline at 24:00.
  const sleepEnd = sleepAnchor < 12 * 60 ? 24 * 60 : sleepAnchor;
  const from = Math.min(wakeAnchor, ...blocks.map((b) => b.start));
  const to = Math.max(sleepEnd, ...blocks.map((b) => b.start + b.durationMin));
  return {
    from: opts.showEarly ? 0 : floorTo(from, 60),
    to: opts.showLate ? 24 * 60 : Math.min(24 * 60, ceilTo(to, 60)),
  };
}

/**
 * Splits the span into row segments and collapsible gaps.
 * A free stretch keeps one 15-minute row of breathing room next to any block, and never hides
 * the current time. `expanded` holds the `from` of gaps the user tapped open.
 */
export function segments(
  blocks: Pick<Block, 'start' | 'durationMin'>[],
  span: { from: Minutes; to: Minutes },
  now: Minutes | null,
  expanded: ReadonlySet<Minutes> = new Set(),
): Segment[] {
  const busy = (slot: Minutes) =>
    blocks.some((b) => b.start < slot + SLOT && b.start + b.durationMin > slot) ||
    (now !== null && now >= slot - SLOT && now < slot + 2 * SLOT);

  const out: Segment[] = [];
  const pushRows = (from: Minutes, to: Minutes) => {
    const last = out[out.length - 1];
    if (last?.kind === 'rows' && last.to === from) last.to = to;
    else out.push({ kind: 'rows', from, to });
  };

  let slot = span.from;
  while (slot < span.to) {
    if (busy(slot)) {
      pushRows(slot, slot + SLOT);
      slot += SLOT;
      continue;
    }
    // Measure the free run.
    let end = slot;
    while (end < span.to && !busy(end)) end += SLOT;
    const padStart = slot === span.from ? 0 : SLOT;
    const padEnd = end === span.to ? 0 : SLOT;
    const gapFrom = slot + padStart;
    const gapTo = end - padEnd;
    if (gapTo - gapFrom >= COLLAPSE_MIN - 2 * SLOT && end - slot >= COLLAPSE_MIN && !expanded.has(gapFrom)) {
      if (padStart) pushRows(slot, gapFrom);
      out.push({ kind: 'gap', from: gapFrom, to: gapTo });
      if (padEnd) pushRows(gapTo, end);
    } else {
      pushRows(slot, end);
    }
    slot = end;
  }
  return out;
}

/** Lane assignment for overlapping blocks: each gets a lane index and the lane count of its cluster. */
export function lanes<T extends Pick<Block, 'id' | 'start' | 'durationMin'>>(
  blocks: T[],
): Map<string, { lane: number; of: number }> {
  const sorted = [...blocks].sort((a, b) => a.start - b.start || b.durationMin - a.durationMin);
  const result = new Map<string, { lane: number; of: number }>();
  let cluster: T[] = [];
  let laneEnds: number[] = [];
  let clusterEnd = -1;

  const flush = () => {
    for (const b of cluster) result.get(b.id)!.of = laneEnds.length;
    cluster = [];
    laneEnds = [];
  };

  for (const b of sorted) {
    if (b.start >= clusterEnd) flush();
    let lane = laneEnds.findIndex((end) => end <= b.start);
    if (lane === -1) lane = laneEnds.push(0) - 1;
    laneEnds[lane] = b.start + b.durationMin;
    clusterEnd = Math.max(clusterEnd, b.start + b.durationMin);
    cluster.push(b);
    result.set(b.id, { lane, of: 1 });
  }
  flush();
  return result;
}

/** Label for a timeline section header. Before 05:00 is night, not morning. */
export function sectionLabel(min: Minutes): string {
  return min < 5 * 60 ? 'Night' : periodOf(min);
}

/** Morning / afternoon / evening, used to group Weekly. */
export function periodOf(min: Minutes): 'Morning' | 'Afternoon' | 'Evening' {
  if (min < 12 * 60) return 'Morning';
  if (min < 17 * 60) return 'Afternoon';
  return 'Evening';
}

// ---------- Pixel layout ----------
// The timeline is drawn from this model, and drag positions are converted back with it,
// so drawing and dragging can never disagree.

export const ROW = 32; // px per 15-minute row
export const PX = ROW / SLOT; // px per minute
export const HEADER_H = 24; // "07:00 · Morning" label above a run of rows
export const GAP_H = 44; // a collapsed "Free · 2h" row

export interface Placed {
  kind: 'rows' | 'gap';
  from: Minutes;
  to: Minutes;
  /** y of the first row (or of the gap), below any header. */
  top: number;
  height: number;
  header: boolean;
  /** Height of each 15-minute row in this piece (ROW unless stretched). */
  rowH: number;
}

/**
 * A stretch of time that needs more room than its rows give, e.g. a 30-minute routine with six
 * habits. Its rows grow (time labels stay the same) so the card fits without clipping.
 */
export interface Tall {
  from: Minutes;
  to: Minutes;
  /** Pixels the stretch needs in total. */
  minPx: number;
}

/** Height of the 15-minute row starting at `slot`. */
export type RowHeight = (slot: Minutes) => number;

export const uniformRows: RowHeight = () => ROW;

/** Row heights that give every tall stretch its room, spread evenly over its rows. */
export function rowHeights(talls: Tall[]): RowHeight {
  if (talls.length === 0) return uniformRows;
  return (slot) => {
    let h = ROW;
    for (const t of talls) {
      if (slot >= t.from && slot < t.to) h = Math.max(h, Math.ceil(t.minPx / Math.max(1, (t.to - t.from) / SLOT)));
    }
    return h;
  };
}

export function place(segs: Segment[], rowH: RowHeight = uniformRows): { items: Placed[]; height: number } {
  let y = 0;
  const items: Placed[] = [];
  segs.forEach((s, i) => {
    if (s.kind === 'gap') {
      items.push({ ...s, top: y, height: GAP_H, header: false, rowH: ROW });
      y += GAP_H;
      return;
    }
    const header = i === 0 || segs[i - 1]?.kind === 'gap';
    if (header) y += HEADER_H;
    // Split the run into pieces of equal row height; only the first piece carries the header.
    let from = s.from;
    while (from < s.to) {
      const h = rowH(from);
      let to = from + SLOT;
      while (to < s.to && rowH(to) === h) to += SLOT;
      const height = ((to - from) / SLOT) * h;
      items.push({ kind: 'rows', from, to, top: y, height, header: header && from === s.from, rowH: h });
      y += height;
      from = to;
    }
  });
  return { items, height: y };
}

/** y position of a minute. Inside a collapsed gap, proportional; outside the span, clamped. */
export function yOf(items: Placed[], m: Minutes): number {
  if (items.length === 0) return 0;
  for (const it of items) {
    if (m < it.to) {
      if (m <= it.from) return it.top;
      return it.kind === 'rows' ? it.top + (m - it.from) * (it.rowH / SLOT) : it.top + ((m - it.from) / (it.to - it.from)) * it.height;
    }
  }
  const last = items[items.length - 1]!;
  return last.top + last.height;
}

/** The minute at a y position (inverse of yOf). */
export function minuteAt(items: Placed[], y: number): Minutes {
  if (items.length === 0) return 0;
  for (const it of items) {
    if (y < it.top + it.height) {
      if (y <= it.top) return it.from;
      return it.kind === 'rows' ? it.from + (y - it.top) / (it.rowH / SLOT) : it.from + ((y - it.top) / it.height) * (it.to - it.from);
    }
  }
  return items[items.length - 1]!.to;
}
