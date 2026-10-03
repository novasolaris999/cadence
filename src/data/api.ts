// The contract between screens and storage. Two implementations exist:
// - supabaseApi: your real data in Supabase (used when the Supabase env vars are set)
// - sampleApi:   in-memory sample data (used when they are not, e.g. screenshot checks in the
//                build container). The header shows a "Demo data" badge in this mode.
// Screens never import either directly; they use the hooks in queries.ts.

import type { MovePlan } from '../domain/moves';
import type { Block, Category, DayLog, ISODate, Settings, Target } from '../domain/types';

export interface DataApi {
  mode: 'supabase' | 'demo';
  /** First sign-in: create the settings row and default categories if missing. */
  ensureSetup(): Promise<void>;

  getSettings(): Promise<Settings>;
  updateSettings(patch: Partial<Settings>): Promise<void>;

  listCategories(): Promise<Category[]>;
  saveCategory(c: Category): Promise<void>;
  deleteCategory(id: string): Promise<void>;

  listTargets(): Promise<Target[]>;
  /** Insert or update by id. */
  saveTarget(t: Target): Promise<void>;

  /** Blocks with from <= date <= to, ordered by date then start. */
  listBlocks(from: ISODate, to: ISODate): Promise<Block[]>;
  /** One target's blocks on or after a date (for "move the rest of the week / all future"). */
  listTargetBlocks(targetId: string, from: ISODate): Promise<Block[]>;
  createBlock(b: Block): Promise<void>;
  updateBlock(id: string, patch: Partial<Omit<Block, 'id'>>): Promise<void>;
  deleteBlock(id: string): Promise<void>;
  applyMove(plan: MovePlan): Promise<void>;
  /** Inserts many blocks; a slot that already exists (another tab got there first) is skipped. */
  insertBlocks(blocks: Block[]): Promise<void>;
  deleteBlocks(ids: string[]): Promise<void>;

  /** Mondays of weeks already filled from targets, on or after `from`. */
  listPlannedWeeks(from: ISODate): Promise<ISODate[]>;
  /** Records that a week has been filled, so deleted blocks do not come back on the next visit. */
  markWeekPlanned(weekStart: ISODate): Promise<void>;

  listDayLogs(from: ISODate, to: ISODate): Promise<DayLog[]>;
  /** Creates or replaces the wake/sleep row for one date. */
  saveDayLog(log: DayLog): Promise<void>;
}

export const DEFAULT_CATEGORIES: Pick<Category, 'name' | 'color' | 'sortOrder'>[] = [
  { name: 'Fitness', color: 'cat-1', sortOrder: 0 },
  { name: 'Health', color: 'cat-3', sortOrder: 1 },
  { name: 'People', color: 'cat-2', sortOrder: 2 },
  { name: 'Mind', color: 'cat-4', sortOrder: 3 },
];

export const newId = () => crypto.randomUUID();

/** The database defaults, used on screen until (or if) your saved settings load. */
export const DEFAULT_SETTINGS: Settings = {
  wakeAnchor: 7 * 60,
  sleepAnchor: 23 * 60,
  theme: 'system',
  onTimeToleranceMin: 30,
};
