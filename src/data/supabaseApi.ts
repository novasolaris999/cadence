// Real implementation: reads and writes your Supabase project.
// Row level security on every table means these queries only ever see your own rows, so
// there is no "where user_id = me" here: the database adds it. New rows get user_id from
// the signed-in session through the column default (auth.uid()).

import type { SupabaseClient } from '@supabase/supabase-js';
import type { DataApi } from './api';
import { DEFAULT_CATEGORIES, DEFAULT_TODO_LISTS, newId } from './api';
import {
  blockFromRow,
  blockPatchToRow,
  blockToRow,
  categoryFromRow,
  categoryToRow,
  dayLogFromRow,
  dayLogToRow,
  routineFromRow,
  routineToRow,
  todoFromRow,
  todoListFromRow,
  todoListToRow,
  todoPatchToRow,
  todoToRow,
  settingsFromRow,
  settingsToRow,
  targetFromRow,
  targetToRow,
  type BlockRow,
  type CategoryRow,
  type DayLogRow,
  type RoutineRow,
  type TodoListRow,
  type TodoRow,
  type SettingsRow,
  type TargetRow,
} from './mappers';
import { formatTime } from '../domain/time';
import type { CaptureReply } from '../domain/capture';

const SUPABASE_KEY = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? import.meta.env.VITE_SUPABASE_ANON_KEY) as string | undefined;

/** Throws Supabase errors so TanStack Query can show and retry them. */
function check(res: { error: { message: string; code?: string } | null }): void {
  if (res.error) throw new Error(res.error.message);
}

/** Like check, for reads: returns the data, which is never null after a successful select. */
function read<T>(res: { data: T | null; error: { message: string } | null }): T {
  check(res);
  if (res.data === null) throw new Error('No data returned');
  return res.data;
}

/**
 * Supabase returns at most 1000 rows per request, silently. Reads that can be longer (a year of
 * history) fetch page after page until a short page says there is no more. The query must have a
 * stable order (id last) so pages never overlap or skip rows.
 */
const PAGE = 1000;
async function readAll<T>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  const all: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const rows = read(await page(from, from + PAGE - 1));
    all.push(...rows);
    if (rows.length < PAGE) return all;
  }
}

/** The signed-in user's id, from the locally stored session (no network call). */
async function currentUserId(db: SupabaseClient): Promise<string> {
  const { data } = await db.auth.getSession();
  const id = data.session?.user.id;
  if (!id) throw new Error('Not signed in');
  return id;
}

const TARGET_COLUMNS =
  'id, category_id, name, description, icon, duration_min, frequency_per_week, preferred_days, preferred_start, window_end, protected, active, created_at';

/**
 * Codes for "that column or table does not exist": the database has not had migration 0002 yet.
 * Until it has, the app keeps working without routines and shows a notice (see schemaNotice).
 */
const MISSING = new Set(['42703', '42P01', 'PGRST204', 'PGRST205']);
let routinesMissing = false;
/** True when the database still needs migration 0002 (routines). */
export const needsRoutinesMigration = () => routinesMissing;
let todosMissing = false;
/** True when the database still needs migration 0003 (to-dos). */
export const needsTodosMigration = () => todosMissing;
const NEEDS_0003 = 'Database update needed: run migration 0003 (to-dos) in Supabase first.';

const BLOCK_COLUMNS =
  'id, target_id, title, category_id, date, start_time, duration_min, status, completed_at, note, origin, scheduled_for, moved';

export function supabaseApi(db: SupabaseClient): DataApi {
  return {
    mode: 'supabase',

    async ensureSetup() {
      const userId = await currentUserId(db);
      check(await db.from('settings').upsert({ user_id: userId }, { onConflict: 'user_id', ignoreDuplicates: true }));
      const existing = read(await db.from('categories').select('id').limit(1));
      if (existing.length === 0) {
        check(
          await db.from('categories').upsert(
            DEFAULT_CATEGORIES.map((c) => ({ id: newId(), name: c.name, color: c.color, sort_order: c.sortOrder })),
            { onConflict: 'user_id,name', ignoreDuplicates: true },
          ),
        );
      }
    },

    async getSettings() {
      const row = read(
        await db.from('settings').select('wake_anchor, sleep_anchor, theme, on_time_tolerance_min').single<SettingsRow>(),
      );
      return settingsFromRow(row);
    },
    async updateSettings(patch) {
      check(await db.from('settings').update(settingsToRow(patch)).eq('user_id', await currentUserId(db)));
    },

    async listCategories() {
      const rows = read(await db.from('categories').select('id, name, color, sort_order').order('sort_order').returns<CategoryRow[]>());
      return rows.map(categoryFromRow);
    },
    async saveCategory(c) {
      check(await db.from('categories').upsert(categoryToRow(c)));
    },
    async deleteCategory(id) {
      check(await db.from('categories').delete().eq('id', id));
    },

    async listTargets() {
      const res = await db
        .from('targets')
        .select(`${TARGET_COLUMNS}, routine_id, routine_order`)
        .order('preferred_start')
        .returns<TargetRow[]>();
      if (res.error && MISSING.has(res.error.code)) {
        routinesMissing = true;
        const old = read(await db.from('targets').select(TARGET_COLUMNS).order('preferred_start').returns<TargetRow[]>());
        return old.map(targetFromRow);
      }
      return read(res).map(targetFromRow);
    },
    async saveTarget(t) {
      const row = targetToRow(t);
      if (routinesMissing) {
        delete row.routine_id;
        delete row.routine_order;
      }
      check(await db.from('targets').upsert(row));
    },

    async listRoutines() {
      const res = await db
        .from('routines')
        .select('id, category_id, name, icon, frequency_per_week, preferred_days, preferred_start, protected, active, created_at')
        .order('preferred_start')
        .returns<RoutineRow[]>();
      if (res.error && MISSING.has(res.error.code)) {
        routinesMissing = true;
        return [];
      }
      return read(res).map(routineFromRow);
    },
    async saveRoutine(r) {
      if (routinesMissing) throw new Error('Database update needed: run migration 0002 in Supabase first.');
      check(await db.from('routines').upsert(routineToRow(r)));
    },

    async listBlocks(from, to) {
      const rows = await readAll((lo, hi) =>
        db
          .from('blocks')
          .select(BLOCK_COLUMNS)
          .gte('date', from)
          .lte('date', to)
          .order('date')
          .order('start_time')
          .order('id')
          .range(lo, hi)
          .returns<BlockRow[]>(),
      );
      return rows.map(blockFromRow);
    },
    async listTargetBlocks(targetId, from) {
      const rows = await readAll((lo, hi) =>
        db
          .from('blocks')
          .select(BLOCK_COLUMNS)
          .eq('target_id', targetId)
          .gte('date', from)
          .order('date')
          .order('id')
          .range(lo, hi)
          .returns<BlockRow[]>(),
      );
      return rows.map(blockFromRow);
    },
    async createBlock(b) {
      check(await db.from('blocks').insert(blockToRow(b)));
    },
    async updateBlock(id, patch) {
      check(await db.from('blocks').update(blockPatchToRow(patch)).eq('id', id));
    },
    async deleteBlock(id) {
      check(await db.from('blocks').delete().eq('id', id));
    },
    async applyMove(plan) {
      // Most moves set the same time on every block, so group them: one request per distinct change.
      const groups = new Map<string, string[]>();
      for (const c of plan.blocks) {
        const k = `${c.start}|${c.moved}`;
        groups.set(k, [...(groups.get(k) ?? []), c.id]);
      }
      for (const [k, ids] of groups) {
        const [start, moved] = k.split('|');
        check(await db.from('blocks').update({ start_time: `${formatTime(Number(start))}:00`, moved: moved === 'true' }).in('id', ids));
      }
      for (const { id, preferredStart, windowEnd } of plan.targets ?? []) {
        check(
          await db
            .from('targets')
            .update({
              preferred_start: `${formatTime(preferredStart)}:00`,
              window_end: windowEnd === null ? null : `${formatTime(windowEnd)}:00`,
            })
            .eq('id', id),
        );
      }
      if (plan.routine) {
        check(await db.from('routines').update({ preferred_start: `${formatTime(plan.routine.preferredStart)}:00` }).eq('id', plan.routine.id));
      }
    },

    async insertBlocks(blocks) {
      if (blocks.length === 0) return;
      const res = await db.from('blocks').insert(blocks.map(blockToRow));
      // 23505 = a slot already exists (two tabs filled the same week). Retry one by one, skipping those.
      if (res.error?.code === '23505') {
        for (const b of blocks) {
          const one = await db.from('blocks').insert(blockToRow(b));
          if (one.error && one.error.code !== '23505') throw new Error(one.error.message);
        }
        return;
      }
      check(res);
    },
    async deleteBlocks(ids) {
      if (ids.length === 0) return;
      check(await db.from('blocks').delete().in('id', ids));
    },

    async listPlannedWeeks(from) {
      const rows = read(
        await db.from('week_plans').select('week_start').gte('week_start', from).order('week_start').returns<{ week_start: string }[]>(),
      );
      return rows.map((r) => r.week_start);
    },
    async markWeekPlanned(weekStart) {
      check(
        await db
          .from('week_plans')
          .upsert({ user_id: await currentUserId(db), week_start: weekStart }, { onConflict: 'user_id,week_start', ignoreDuplicates: true }),
      );
    },

    async saveDayLog(log) {
      check(
        await db.from('day_logs').upsert({ user_id: await currentUserId(db), ...dayLogToRow(log) }, { onConflict: 'user_id,date' }),
      );
    },

    async listTodoLists() {
      const select = () => db.from('todo_lists').select('id, name, icon, sort_order').order('sort_order').returns<TodoListRow[]>();
      const res = await select();
      if (res.error && MISSING.has(res.error.code)) {
        todosMissing = true;
        return [];
      }
      let rows = read(res);
      if (rows.length === 0) {
        check(
          await db.from('todo_lists').upsert(
            DEFAULT_TODO_LISTS.map((l) => ({ id: newId(), name: l.name, icon: l.icon, sort_order: l.sortOrder })),
            { onConflict: 'user_id,name', ignoreDuplicates: true },
          ),
        );
        rows = read(await select());
      }
      return rows.map(todoListFromRow);
    },
    async saveTodoList(l) {
      if (todosMissing) throw new Error(NEEDS_0003);
      check(await db.from('todo_lists').upsert(todoListToRow(l)));
    },
    async deleteTodoList(id) {
      check(await db.from('todo_lists').delete().eq('id', id));
    },
    async listTodos() {
      const res = await db
        .from('todos')
        .select('id, list_id, title, note, starred, due_date, due_time, duration_min, completed_at, sort_order, created_at')
        .order('created_at')
        .order('id')
        .returns<TodoRow[]>();
      if (res.error && MISSING.has(res.error.code)) {
        todosMissing = true;
        return [];
      }
      return read(res).map(todoFromRow);
    },
    async saveTodo(t) {
      if (todosMissing) throw new Error(NEEDS_0003);
      check(await db.from('todos').upsert(todoToRow(t)));
    },
    async updateTodo(id, patch) {
      check(await db.from('todos').update(todoPatchToRow(patch)).eq('id', id));
    },
    async deleteTodos(ids) {
      if (ids.length === 0) return;
      check(await db.from('todos').delete().in('id', ids));
    },

    // Capture runs on the app's own server (api/capture.ts on Vercel), which holds the Claude key. It checks
    // who you are with this sign-in token, so it is sent along; the database is not involved.
    async capture(req) {
      const { data } = await db.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error('Sign in to use capture.');
      let res: Response;
      try {
        res = await fetch('/api/capture', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, apikey: SUPABASE_KEY ?? '' },
          body: JSON.stringify(req),
        });
      } catch {
        throw new Error('Could not reach capture. Check your connection and try again.');
      }
      const body = (await res.json().catch(() => null)) as (CaptureReply & { error?: string }) | null;
      if (res.ok && body && Array.isArray(body.actions)) return body;
      if (res.status === 404) throw new Error('Capture is not available on this version of the app yet.');
      throw new Error(body?.error ?? `Capture failed (${res.status}).`);
    },

    async listDayLogs(from, to) {
      const rows = read(
        await db.from('day_logs').select('date, wake_time, sleep_time').gte('date', from).lte('date', to).order('date').returns<DayLogRow[]>(),
      );
      return rows.map(dayLogFromRow);
    },
  };
}
