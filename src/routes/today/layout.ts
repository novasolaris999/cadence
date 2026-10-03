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

/** Visible span: from the wake anchor (or earliest block) to the sleep anchor (or latest end). */
export function daySpan(
  blocks: Pick<Block, 'start' | 'durationMin'>[],
  wakeAnchor: Minutes,
  sleepAnchor: Minutes,
): { from: Minutes; to: Minutes } {
  // A sleep anchor after midnight (e.g. 00:30) still ends the timeline at 24:00.
  const sleepEnd = sleepAnchor < 12 * 60 ? 24 * 60 : sleepAnchor;
  const from = Math.min(wakeAnchor, ...blocks.map((b) => b.start));
  const to = Math.max(sleepEnd, ...blocks.map((b) => b.start + b.durationMin));
  return { from: floorTo(from, 60), to: Math.min(24 * 60, ceilTo(to, 60)) };
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

export function periodOf(min: Minutes): 'Morning' | 'Afternoon' | 'Evening' {
  if (min < 12 * 60) return 'Morning';
  if (min < 17 * 60) return 'Afternoon';
  return 'Evening';
}
