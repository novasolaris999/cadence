// The contract between screens and storage. Two implementations exist:
// - supabaseApi: your real data in Supabase (used when the Supabase env vars are set)
// - sampleApi:   in-memory sample data (used when they are not, e.g. screenshot checks in the
//                build container). The header shows a "Demo data" badge in this mode.
// Screens never import either directly; they use the hooks in queries.ts.

import type { MovePlan } from '../domain/moves';
import type { Block, Category, DayLog, ISODate, Routine, Settings, Target, Todo, TodoList } from '../domain/types';

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

  listRoutines(): Promise<Routine[]>;
  /** Insert or update by id. Habits are saved separately (see saveRoutine in scheduling.ts). */
  saveRoutine(r: Routine): Promise<void>;

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

  /** Your to-do lists. The first time, creates the defaults (Shopping, Errands, People). */
  listTodoLists(): Promise<TodoList[]>;
  saveTodoList(l: TodoList): Promise<void>;
  /** The list's to-dos are kept, with no list. */
  deleteTodoList(id: string): Promise<void>;
  /** Every to-do, done or not (a personal list stays small). */
  listTodos(): Promise<Todo[]>;
  /** Insert or update by id. */
  saveTodo(t: Todo): Promise<void>;
  updateTodo(id: string, patch: Partial<Omit<Todo, 'id'>>): Promise<void>;
  deleteTodos(ids: string[]): Promise<void>;

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

/** Created the first time your lists are read. */
export const DEFAULT_TODO_LISTS: Pick<TodoList, 'name' | 'icon' | 'sortOrder'>[] = [
  { name: 'Shopping', icon: 'shopping_cart', sortOrder: 0 },
  { name: 'Errands', icon: 'directions_car', sortOrder: 1 },
  { name: 'People', icon: 'group', sortOrder: 2 },
];
