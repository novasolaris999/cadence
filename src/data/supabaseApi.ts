// Real implementation: reads and writes your Supabase project.
// Row level security on every table means these queries only ever see your own rows, so
// there is no "where user_id = me" here: the database adds it. New rows get user_id from
// the signed-in session through the column default (auth.uid()).

import type { SupabaseClient } from '@supabase/supabase-js';
import type { DataApi } from './api';
import { DEFAULT_CATEGORIES, newId } from './api';
import {
  blockFromRow,
  blockPatchToRow,
  blockToRow,
  categoryFromRow,
  categoryToRow,
  dayLogFromRow,
  dayLogToRow,
  settingsFromRow,
  settingsToRow,
  targetFromRow,
  targetToRow,
  type BlockRow,
  type CategoryRow,
  type DayLogRow,
  type SettingsRow,
  type TargetRow,
} from './mappers';
import { formatTime } from '../domain/time';

/** Throws Supabase errors so TanStack Query can show and retry them. */
function check(res: { error: { message: string } | null }): void {
  if (res.error) throw new Error(res.error.message);
}

/** Like check, for reads: returns the data, which is never null after a successful select. */
function read<T>(res: { data: T | null; error: { message: string } | null }): T {
  check(res);
  if (res.data === null) throw new Error('No data returned');
  return res.data;
}

/** The signed-in user's id, from the locally stored session (no network call). */
async function currentUserId(db: SupabaseClient): Promise<string> {
  const { data } = await db.auth.getSession();
  const id = data.session?.user.id;
  if (!id) throw new Error('Not signed in');
  return id;
}

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
      const rows = read(
        await db
          .from('targets')
          .select('id, category_id, name, description, icon, duration_min, frequency_per_week, preferred_days, preferred_start, window_end, protected, active, created_at')
          .order('preferred_start')
          .returns<TargetRow[]>(),
      );
      return rows.map(targetFromRow);
    },
    async saveTarget(t) {
      check(await db.from('targets').upsert(targetToRow(t)));
    },

    async listBlocks(from, to) {
      const rows = read(
        await db.from('blocks').select(BLOCK_COLUMNS).gte('date', from).lte('date', to).order('date').order('start_time').returns<BlockRow[]>(),
      );
      return rows.map(blockFromRow);
    },
    async listTargetBlocks(targetId, from) {
      const rows = read(
        await db.from('blocks').select(BLOCK_COLUMNS).eq('target_id', targetId).gte('date', from).order('date').returns<BlockRow[]>(),
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
      if (plan.target) {
        const { id, preferredStart, windowEnd } = plan.target;
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

    async listDayLogs(from, to) {
      const rows = read(
        await db.from('day_logs').select('date, wake_time, sleep_time').gte('date', from).lte('date', to).order('date').returns<DayLogRow[]>(),
      );
      return rows.map(dayLogFromRow);
    },
  };
}
