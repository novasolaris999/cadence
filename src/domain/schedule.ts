// Scheduling rules: plain rules, no optimization, no AI (SPEC "Scheduling").
//
// This file is the seam for a future optimizing scheduler: anything that can answer
// "which days and times should this target land on this week" can replace these functions
// without touching the screens or the database.
//
// Rules:
// - A week is filled with the missing blocks of every active target, on its days at its preferred time.
// - Only slots still ahead of you are created: a later day, or today at or after the current time.
//   Starting mid-week never creates instant misses.
// - A slot is identified by (target, scheduled_for date). A slot that already has a block, even one
//   you moved, finished, skipped, or that the scheduler made earlier, is never created twice.
// - Replanning one target (after you edit or archive it) removes only its upcoming, unmoved, still
//   planned, scheduler-made blocks that no longer match its rules, then fills what is missing.

import type { Block, ISODate, Minutes, Target, Weekday } from './types';
import { addDays } from './time';

/**
 * When a target has no preferred days, its weekly frequency is spread with this fixed table.
 * Chosen to leave recovery gaps between sessions where possible.
 */
export const SPREAD: Record<number, Weekday[]> = {
  1: [1],
  2: [2, 4],
  3: [1, 3, 5],
  4: [1, 2, 4, 5],
  5: [1, 2, 3, 4, 5],
  6: [1, 2, 3, 4, 5, 6],
  7: [1, 2, 3, 4, 5, 6, 7],
};

/** The weekdays a target is scheduled on. Preferred days win; otherwise the spread table. */
export function targetDays(t: Pick<Target, 'preferredDays' | 'frequencyPerWeek'>): Weekday[] {
  if (t.preferredDays.length > 0) return [...t.preferredDays].sort((a, b) => a - b);
  const n = Math.min(7, Math.max(1, Math.round(t.frequencyPerWeek)));
  return SPREAD[n]!;
}

export interface PlanContext {
  today: ISODate;
  /** Current minute of the day. */
  nowMin: Minutes;
  newId: () => string;
}

/** True for a slot that has not started yet. */
export const isUpcoming = (date: ISODate, start: Minutes, ctx: Pick<PlanContext, 'today' | 'nowMin'>) =>
  date > ctx.today || (date === ctx.today && start >= ctx.nowMin);

/** The dates and time a target should occupy in the week starting on Monday `weekStart`. */
export function targetSlots(t: Target, weekStart: ISODate): { date: ISODate; start: Minutes }[] {
  return targetDays(t).map((w) => ({ date: addDays(weekStart, w - 1), start: t.preferredStart }));
}

const slotKey = (targetId: string, date: ISODate) => `${targetId}|${date}`;

/** New blocks needed so every active target has its upcoming slots in this week. */
export function planFill(targets: Target[], weekStart: ISODate, existing: Block[], ctx: PlanContext): Block[] {
  const taken = new Set(
    existing.filter((b) => b.targetId && b.scheduledFor).map((b) => slotKey(b.targetId!, b.scheduledFor!)),
  );
  const out: Block[] = [];
  for (const t of targets) {
    if (!t.active) continue;
    for (const slot of targetSlots(t, weekStart)) {
      if (!isUpcoming(slot.date, slot.start, ctx) || taken.has(slotKey(t.id, slot.date))) continue;
      taken.add(slotKey(t.id, slot.date));
      out.push({
        id: ctx.newId(),
        targetId: t.id,
        title: null,
        categoryId: null,
        date: slot.date,
        start: slot.start,
        durationMin: t.durationMin,
        status: 'planned',
        completedAt: null,
        note: null,
        origin: 'generated',
        scheduledFor: slot.date,
        moved: false,
      });
    }
  }
  return out;
}

/**
 * Brings one target's upcoming blocks in line with its rules, across the weeks already planned.
 * `targetBlocks` must include all of the target's blocks from today on.
 */
export function planTargetReplan(
  target: Target,
  targetBlocks: Block[],
  plannedWeeks: ISODate[],
  ctx: PlanContext,
): { deleteIds: string[]; insert: Block[] } {
  const wanted = new Set(
    target.active ? plannedWeeks.flatMap((w) => targetSlots(target, w).map((s) => s.date)) : [],
  );
  const stale = targetBlocks.filter(
    (b) =>
      b.targetId === target.id &&
      b.origin === 'generated' &&
      !b.moved &&
      b.status === 'planned' &&
      isUpcoming(b.date, b.start, ctx) &&
      // Keep it if it is exactly what the rules ask for now.
      !(
        b.scheduledFor !== null &&
        wanted.has(b.scheduledFor) &&
        b.date === b.scheduledFor &&
        b.start === target.preferredStart &&
        b.durationMin === target.durationMin
      ),
  );
  const staleIds = new Set(stale.map((b) => b.id));
  const remaining = targetBlocks.filter((b) => !staleIds.has(b.id));
  const insert = target.active ? plannedWeeks.flatMap((w) => planFill([target], w, remaining, ctx)) : [];
  return { deleteIds: stale.map((b) => b.id), insert };
}

export type RerunChange =
  /** A missing slot is created again (for example a block you deleted). */
  | { kind: 'restore'; targetId: string; date: ISODate; start: Minutes }
  /** A block that no longer matches its rules is put back at the target's day and time. */
  | { kind: 'reset'; targetId: string; date: ISODate; start: Minutes; fromDate: ISODate; fromStart: Minutes }
  /** A block whose day is no longer in the rules (or whose target is archived) is removed. */
  | { kind: 'remove'; targetId: string; date: ISODate; start: Minutes };

export interface RerunPlan {
  deleteIds: string[];
  insert: Block[];
  /** The same plan in words, ordered by date and time, for the preview. */
  changes: RerunChange[];
  /** Upcoming target blocks you moved by hand: Re-run leaves them where you put them. */
  keptMoved: number;
}

/**
 * Re-run for one week: rebuilds the rest of the week from every target's current rules.
 *
 * - Only upcoming slots change. Earlier days, done and skipped blocks, one-offs, and blocks you
 *   moved by hand are never touched.
 * - Blocks that drifted from their target's rules are reset; slots with no block are restored, so a
 *   deleted block comes back (a normal visit keeps deletions; Re-run is the explicit "fill it again").
 * - Protected targets' existing blocks are never changed. Their missing slots are still restored,
 *   because restoring is not moving.
 *
 * `weekBlocks` must be every block in the week.
 */
export function planRerun(targets: Target[], weekBlocks: Block[], weekStart: ISODate, ctx: PlanContext): RerunPlan {
  const deleteIds: string[] = [];
  const insert: Block[] = [];
  const changes: RerunChange[] = [];

  for (const t of targets) {
    const own = weekBlocks.filter((b) => b.targetId === t.id);
    const plan = t.protected
      ? { deleteIds: [], insert: t.active ? planFill([t], weekStart, own, ctx) : [] }
      : planTargetReplan(t, own, [weekStart], ctx);
    const added = new Map(plan.insert.map((b) => [b.scheduledFor, b]));
    for (const id of plan.deleteIds) {
      const old = own.find((b) => b.id === id)!;
      const replacement = old.scheduledFor ? added.get(old.scheduledFor) : undefined;
      if (replacement) {
        changes.push({ kind: 'reset', targetId: t.id, date: replacement.date, start: replacement.start, fromDate: old.date, fromStart: old.start });
        added.delete(old.scheduledFor);
      } else {
        changes.push({ kind: 'remove', targetId: t.id, date: old.date, start: old.start });
      }
    }
    for (const b of added.values()) changes.push({ kind: 'restore', targetId: t.id, date: b.date, start: b.start });
    deleteIds.push(...plan.deleteIds);
    insert.push(...plan.insert);
  }

  changes.sort((a, b) => (a.date === b.date ? a.start - b.start : a.date < b.date ? -1 : 1));
  const keptMoved = weekBlocks.filter(
    (b) => b.targetId && b.moved && b.status === 'planned' && isUpcoming(b.date, b.start, ctx),
  ).length;
  return { deleteIds, insert, changes, keptMoved };
}
