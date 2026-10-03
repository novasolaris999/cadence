// Moving a block to a new time, with a scope chosen by you:
// - 'day':    only this block.
// - 'week':   this block and this target's later planned blocks in the same week.
// - 'future': this block and every later planned block of this target, and the target's
//             preferred start (and window) shift too, so future weeks generate at the new time.
//
// Pure planning only: returns what to change. The data layer applies it.

import type { Block, ISODate, Minutes, Target } from './types';
import { startOfWeek, addDays } from './time';

export type MoveScope = 'day' | 'week' | 'future';

export interface BlockChange {
  id: string;
  start: Minutes;
  moved: boolean;
}

export interface MovePlan {
  blocks: BlockChange[];
  /** Present only for 'future': the target's new preferred time and window. */
  target?: Pick<Target, 'id' | 'preferredStart' | 'windowEnd'>;
}

/** Keeps a block inside the day: it may not start before 00:00 or end after 24:00. */
export function clampStart(start: Minutes, durationMin: number): Minutes {
  return Math.max(0, Math.min(24 * 60 - durationMin, start));
}

/** Later planned blocks of the same target that a wider scope would also move. */
export function siblingsInScope(
  block: Block,
  all: Block[],
  scope: MoveScope,
): Block[] {
  if (scope === 'day' || !block.targetId) return [];
  const weekEnd: ISODate = addDays(startOfWeek(block.date), 6);
  return all.filter(
    (b) =>
      b.id !== block.id &&
      b.targetId === block.targetId &&
      b.status === 'planned' &&
      b.date > block.date &&
      (scope === 'future' || b.date <= weekEnd),
  );
}

export function planMove(
  block: Block,
  newStart: Minutes,
  scope: MoveScope,
  all: Block[],
  target: Target | null,
): MovePlan {
  const start = clampStart(newStart, block.durationMin);
  // A one-off block has no siblings and no target to update.
  const effective: MoveScope = block.targetId && target ? scope : 'day';

  if (effective !== 'future') {
    const ids = [block, ...siblingsInScope(block, all, effective)];
    return { blocks: ids.map((b) => ({ id: b.id, start: clampStart(start, b.durationMin), moved: true })) };
  }

  // 'future': the target itself moves, so its blocks match the target again and count as
  // unmoved, unless they were also moved to another day by hand (keep those protected from re-run).
  const delta = start - target!.preferredStart;
  const affected = [block, ...siblingsInScope(block, all, 'future')];
  return {
    blocks: affected.map((b) => ({
      id: b.id,
      start: clampStart(start, b.durationMin),
      moved: b.scheduledFor !== null && b.scheduledFor !== b.date,
    })),
    target: {
      id: target!.id,
      preferredStart: start,
      windowEnd: target!.windowEnd === null ? null : Math.min(24 * 60, Math.max(start, target!.windowEnd + delta)),
    },
  };
}
