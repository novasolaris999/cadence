// Turns targets into blocks, using the pure rules in domain/schedule.ts and the DataApi for storage.
// Works the same for Supabase and demo data.

import type { DayMovePlan, GroupDayMovePlan } from '../domain/moves';
import { withRoutine } from '../domain/routines';
import { isUpcoming, planFill, planRerun, planTargetReplan, type PlanContext, type RerunPlan } from '../domain/schedule';
import { addDays, minutesOfDay, startOfWeek, today } from '../domain/time';
import type { Block, ISODate, Routine, Target } from '../domain/types';
import type { DataApi } from './api';
import { newId } from './api';

export const planContext = (now = new Date()): PlanContext => ({ today: today(now), nowMin: minutesOfDay(now), newId });

/**
 * Fills a week from your targets the first time it is opened. The week is marked planned only after
 * its blocks are saved, so a dropped connection means "try again next time", never an empty week.
 * Past weeks are never filled. Returns true if blocks were added.
 */
export async function ensureWeek(api: DataApi, weekStart: ISODate, ctx = planContext()): Promise<boolean> {
  if (addDays(weekStart, 6) < ctx.today) return false;
  const planned = await api.listPlannedWeeks(weekStart);
  if (planned.includes(weekStart)) return false;
  const [targets, blocks] = await Promise.all([api.listTargets(), api.listBlocks(weekStart, addDays(weekStart, 6))]);
  const fresh = planFill(targets, weekStart, blocks, ctx);
  await api.insertBlocks(fresh);
  await api.markWeekPlanned(weekStart);
  return fresh.length > 0;
}

/**
 * Everything that should happen when a target is saved: make sure this week and next exist (so a new
 * routine created late in the week still shows up next week), then line up its blocks.
 * Returns its next upcoming block, for the confirmation message.
 */
export async function afterTargetSaved(api: DataApi, target: Target, ctx = planContext()): Promise<Block | null> {
  if (target.active) {
    const thisWeek = startOfWeek(ctx.today);
    await ensureWeek(api, thisWeek, ctx);
    await ensureWeek(api, addDays(thisWeek, 7), ctx);
  }
  await syncTarget(api, target, ctx);
  const upcoming = (await api.listTargetBlocks(target.id, ctx.today))
    .filter((b) => b.status === 'planned' && isUpcoming(b.date, b.start, ctx))
    .sort((a, b) => (a.date === b.date ? a.start - b.start : a.date < b.date ? -1 : 1));
  return upcoming[0] ?? null;
}

/**
 * After a target is created, edited, archived, or restored: brings its upcoming blocks in this week and
 * every already-planned week in line with its rules. Moved, finished, and skipped blocks are kept.
 */
export async function syncTarget(api: DataApi, target: Target, ctx = planContext()): Promise<void> {
  const [weeks, blocks] = await Promise.all([
    api.listPlannedWeeks(startOfWeek(ctx.today)),
    api.listTargetBlocks(target.id, ctx.today),
  ]);
  const plan = planTargetReplan(target, blocks, weeks, ctx);
  // Delete first: a re-timed block reuses its slot, and a slot can exist only once.
  await api.deleteBlocks(plan.deleteIds);
  await api.insertBlocks(plan.insert);
}

/**
 * Re-run for one week. The plan is worked out again from fresh data at the moment you apply it, so it
 * is right even if something changed since the preview (another device, another tab).
 */
export async function rerunWeek(api: DataApi, weekStart: ISODate, ctx = planContext()): Promise<RerunPlan> {
  const [targets, blocks] = await Promise.all([api.listTargets(), api.listBlocks(weekStart, addDays(weekStart, 6))]);
  const plan = planRerun(targets, blocks, weekStart, ctx);
  // Delete first: a reset block reuses its slot, and a slot can exist only once.
  await api.deleteBlocks(plan.deleteIds);
  await api.insertBlocks(plan.insert);
  return plan;
}

/** Moves a block to another day. For "every week", the target's days change and later weeks follow. */
export async function applyDayMove(api: DataApi, plan: DayMovePlan, ctx = planContext()): Promise<void> {
  const { id, ...patch } = plan.block;
  await api.updateBlock(id, patch);
  if (!plan.target) return;
  const current = (await api.listTargets()).find((t) => t.id === plan.target!.id);
  if (!current) return;
  const next: Target = { ...current, ...plan.target };
  await api.saveTarget(next);
  await syncTarget(api, next, ctx);
}

/**
 * Saves a routine and its habits in order. Each habit gets the routine's days, start, and protected
 * flag; habits taken out of the routine are archived (their history stays). Then every habit's blocks
 * are lined up, exactly as when a single habit is saved. Returns the routine's next upcoming block.
 */
export async function saveRoutine(
  api: DataApi,
  routine: Routine,
  habits: Target[],
  removed: Target[],
  ctx = planContext(),
): Promise<Block | null> {
  await api.saveRoutine(routine);
  const saved = habits.map((h, i) => withRoutine(h, routine, i));
  const dropped = removed.map((h) => ({ ...h, routineId: null, active: false }));
  for (const h of [...saved, ...dropped]) await api.saveTarget(h);
  if (routine.active) {
    const thisWeek = startOfWeek(ctx.today);
    await ensureWeek(api, thisWeek, ctx);
    await ensureWeek(api, addDays(thisWeek, 7), ctx);
  }
  for (const h of [...saved, ...dropped]) await syncTarget(api, h, ctx);
  const upcoming = (await Promise.all(saved.map((h) => api.listTargetBlocks(h.id, ctx.today))))
    .flat()
    .filter((b) => b.status === 'planned' && isUpcoming(b.date, b.start, ctx))
    .sort((a, b) => (a.date === b.date ? a.start - b.start : a.date < b.date ? -1 : 1));
  return upcoming[0] ?? null;
}

/** Moves a routine card to another day. For "every week", the routine's days change and its habits follow. */
export async function applyGroupDayMove(api: DataApi, plan: GroupDayMovePlan, ctx = planContext()): Promise<void> {
  for (const { id, ...patch } of plan.blocks) await api.updateBlock(id, patch);
  if (!plan.routine) return;
  const [routines, targets] = await Promise.all([api.listRoutines(), api.listTargets()]);
  const current = routines.find((r) => r.id === plan.routine!.id);
  if (!current) return;
  const next: Routine = { ...current, ...plan.routine };
  const habits = targets.filter((t) => t.routineId === next.id && t.active).sort((a, b) => a.routineOrder - b.routineOrder);
  await saveRoutine(api, next, habits, [], ctx);
}
