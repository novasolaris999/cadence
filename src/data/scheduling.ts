// Turns targets into blocks, using the pure rules in domain/schedule.ts and the DataApi for storage.
// Works the same for Supabase and demo data.

import { isUpcoming, planFill, planTargetReplan, type PlanContext } from '../domain/schedule';
import { addDays, minutesOfDay, startOfWeek, today } from '../domain/time';
import type { Block, ISODate, Target } from '../domain/types';
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
 * After a target is created, edited, archived, or restored: brings its upcoming blocks in this week and
 * every already-planned week in line with its rules. Moved, finished, and skipped blocks are kept.
 */
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
