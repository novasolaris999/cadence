// Moving a block to a new time, with a scope chosen by you:
// - 'day':    only this block.
// - 'week':   this block and this target's later planned blocks in the same week.
// - 'future': this block and every later planned block of this target, and the target's
//             preferred start (and window) shift too, so future weeks generate at the new time.
//
// Pure planning only: returns what to change. The data layer applies it.

import type { Block, ISODate, Minutes, Target, Weekday } from './types';
import { startOfWeek, addDays, isoWeekday } from './time';
import { targetDays } from './schedule';

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

// ----- Moving a block to another day (Weekly) -----
// - 'once':   only this block moves; it is marked moved, so Re-run leaves it there.
// - 'weekly': the target's days change too (the block's day is swapped for the new one), so later
//             weeks follow. The block then matches its rules again and counts as unmoved, unless its
//             time was also changed by hand.

export type DayScope = 'once' | 'weekly';

export interface DayMovePlan {
  block: { id: string; date: ISODate; scheduledFor: ISODate | null; moved: boolean };
  /** Present only for 'weekly': the target's new days. Picked days decide the frequency. */
  target?: Pick<Target, 'id' | 'preferredDays' | 'frequencyPerWeek'>;
}

/** The weekday a block stands for: the day the scheduler gave it, not where it sits now. */
const slotWeekday = (b: Block): Weekday => isoWeekday(b.scheduledFor ?? b.date);

/**
 * 'weekly' only makes sense for a planned target block that stands for one of the target's days,
 * moving to a weekday the target does not already use.
 */
export function canMoveWeekly(block: Block, toDate: ISODate, target: Target | null): boolean {
  if (!target || block.targetId !== target.id || block.status !== 'planned') return false;
  const days = targetDays(target);
  return days.includes(slotWeekday(block)) && !days.includes(isoWeekday(toDate));
}

/** `weekBlocks` = the target's blocks in the block's week (to keep each day's slot unique). */
export function planDayMove(block: Block, toDate: ISODate, scope: DayScope, target: Target | null, weekBlocks: Block[]): DayMovePlan {
  if (scope === 'once' || !canMoveWeekly(block, toDate, target)) {
    // Dragging a block back to its own day and time undoes the move.
    const home = target !== null && toDate === block.scheduledFor && block.start === target.preferredStart;
    return { block: { id: block.id, date: toDate, scheduledFor: block.scheduledFor, moved: !home } };
  }
  const t = target!;
  const days = [...targetDays(t).filter((d) => d !== slotWeekday(block)), isoWeekday(toDate)].sort((a, b) => a - b);
  // The block takes over the new day's slot, unless another block already holds it (say a done one).
  const slotFree = !weekBlocks.some((b) => b.id !== block.id && b.targetId === t.id && b.scheduledFor === toDate);
  return {
    block: slotFree
      ? { id: block.id, date: toDate, scheduledFor: toDate, moved: block.start !== t.preferredStart }
      : { id: block.id, date: toDate, scheduledFor: block.scheduledFor, moved: true },
    target: { id: t.id, preferredDays: days, frequencyPerWeek: days.length },
  };
}
