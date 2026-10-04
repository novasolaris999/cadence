// Applies every migration to a real Postgres engine (PGlite, Postgres compiled to WebAssembly)
// and checks the security rules and data constraints. This is how we know the SQL you paste into
// Supabase works, without access to your Supabase project from the build container.

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { beforeAll, describe, expect, it } from 'vitest';

const ALICE = '00000000-0000-4000-8000-00000000000a';
const BOB = '00000000-0000-4000-8000-00000000000b';

// The parts of Supabase that exist before our migrations run: the auth schema, its users table,
// auth.uid() (reads the signed-in user's id from the request), the two API roles, and Supabase's
// default grants on the public schema.
const SUPABASE_STUBS = `
  create schema auth;
  create table auth.users (id uuid primary key);
  create role anon nologin;
  create role authenticated nologin;
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema auth, public to anon, authenticated;
  grant execute on function auth.uid() to anon, authenticated;
  alter default privileges in schema public grant all on tables to anon, authenticated;
  insert into auth.users values ('${ALICE}'), ('${BOB}');
`;

let db: PGlite;

/** Runs SQL as a signed-in user (or as an anonymous visitor when user is null). */
async function as<T>(user: string | null, sql: string, params: unknown[] = []) {
  await db.exec(`reset role; select set_config('request.jwt.claim.sub', '${user ?? ''}', false);`);
  await db.exec(`set role ${user ? 'authenticated' : 'anon'};`);
  try {
    return await db.query<T>(sql, params);
  } finally {
    await db.exec('reset role;');
  }
}

beforeAll(async () => {
  db = new PGlite();
  await db.exec(SUPABASE_STUBS);
  const dir = join(__dirname, 'migrations');
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()) {
    await db.exec(readFileSync(join(dir, file), 'utf8'));
  }
});

describe('row level security', () => {
  it('fills user_id from the signed-in user and shows you only your own rows', async () => {
    await as(ALICE, `insert into public.categories (name, color) values ('Fitness', 'cat-1')`);
    await as(BOB, `insert into public.categories (name, color) values ('Fitness', 'cat-2')`);
    const alice = await as<{ user_id: string; color: string }>(ALICE, 'select user_id, color from public.categories');
    expect(alice.rows).toEqual([{ user_id: ALICE, color: 'cat-1' }]);
  });

  it('refuses rows written for someone else', async () => {
    await expect(
      as(BOB, `insert into public.categories (user_id, name, color) values ('${ALICE}', 'Sneaky', 'cat-3')`),
    ).rejects.toThrow(/row-level security/);
  });

  it('cannot update or delete another user’s rows (they are invisible)', async () => {
    const upd = await as(BOB, `update public.categories set name = 'Hacked' where user_id = '${ALICE}'`);
    const del = await as(BOB, `delete from public.categories where user_id = '${ALICE}'`);
    expect(upd.affectedRows).toBe(0);
    expect(del.affectedRows).toBe(0);
  });

  it('gives signed-out visitors no access at all', async () => {
    await expect(as(null, 'select * from public.targets')).rejects.toThrow(/permission denied/);
  });

  it('will not link a block to another user’s target', async () => {
    const t = await as<{ id: string }>(
      ALICE,
      `insert into public.targets (name, duration_min, frequency_per_week, preferred_start) values ('Gym', 60, 3, '11:30') returning id`,
    );
    const targetId = t.rows[0]!.id;
    await expect(
      as(BOB, `insert into public.blocks (target_id, date, start_time, duration_min) values ($1, '2026-10-05', '11:30', 60)`, [targetId]),
    ).rejects.toThrow(/foreign key/);
  });
});

describe('constraints', () => {
  const target = (cols: string, vals: string) =>
    as(ALICE, `insert into public.targets (name, duration_min, frequency_per_week, preferred_start${cols}) values ('T', 60, 3, '09:00'${vals})`);

  it('keeps times and durations on the 15-minute grid', async () => {
    await expect(target(', preferred_days', ", '{1,3,5}'")).resolves.toBeDefined();
    await expect(as(ALICE, `insert into public.targets (name, duration_min, frequency_per_week, preferred_start) values ('T', 50, 3, '09:00')`)).rejects.toThrow(/check/);
    await expect(as(ALICE, `insert into public.targets (name, duration_min, frequency_per_week, preferred_start) values ('T', 60, 3, '09:10')`)).rejects.toThrow(/check/);
  });

  it('requires picked days to match the frequency', async () => {
    await expect(target(', preferred_days', ", '{1,3}'")).rejects.toThrow(/check/);
    await expect(target(', preferred_days', ", '{0,8,9}'")).rejects.toThrow(/check/);
  });

  it('ties completed_at to status done', async () => {
    const ins = (status: string, completed: string) =>
      as(ALICE, `insert into public.blocks (title, date, start_time, duration_min, status, completed_at) values ('X', '2026-10-05', '09:00', 30, '${status}', ${completed})`);
    await expect(ins('done', "'2026-10-05 09:31'")).resolves.toBeDefined();
    await expect(ins('done', 'null')).rejects.toThrow(/check/);
    await expect(ins('planned', "'2026-10-05 09:31'")).rejects.toThrow(/check/);
  });

  it('needs a title for one-off blocks and keeps blocks inside the day', async () => {
    await expect(as(ALICE, `insert into public.blocks (date, start_time, duration_min) values ('2026-10-05', '09:00', 30)`)).rejects.toThrow(/check/);
    await expect(as(ALICE, `insert into public.blocks (title, date, start_time, duration_min) values ('Late', '2026-10-05', '23:30', 60)`)).rejects.toThrow(/check/);
  });

  it('allows only one generated block per target slot', async () => {
    const t = await as<{ id: string }>(ALICE, `select id from public.targets where name = 'Gym'`);
    const gen = () =>
      as(ALICE, `insert into public.blocks (target_id, date, start_time, duration_min, origin, scheduled_for) values ($1, '2026-10-05', '11:30', 60, 'generated', '2026-10-05')`, [t.rows[0]!.id]);
    await expect(gen()).resolves.toBeDefined();
    await expect(gen()).rejects.toThrow(/duplicate key/);
  });

  it('only accepts Monday as a week start', async () => {
    await expect(as(ALICE, `insert into public.week_plans (week_start) values ('2026-10-05')`)).resolves.toBeDefined();
    await expect(as(ALICE, `insert into public.week_plans (week_start) values ('2026-10-06')`)).rejects.toThrow(/check/);
  });

  it('creates settings with sensible defaults', async () => {
    await as(ALICE, 'insert into public.settings default values');
    const s = await as<{ wake_anchor: string; sleep_anchor: string; theme: string }>(ALICE, 'select wake_anchor, sleep_anchor, theme from public.settings');
    expect(s.rows).toEqual([{ wake_anchor: '07:00:00', sleep_anchor: '23:00:00', theme: 'system' }]);
  });
});

describe('routines (0002)', () => {
  const routine = (user: string, name = 'Sleep') =>
    as<{ id: string }>(user, `insert into public.routines (name, frequency_per_week, preferred_days, preferred_start) values ('${name}', 7, '{1,2,3,4,5,6,7}', '22:00') returning id`);
  const habit = (user: string, routineId: string | null, duration: number) =>
    as(
      user,
      `insert into public.targets (name, duration_min, frequency_per_week, preferred_start, routine_id) values ('H', ${duration}, 7, '22:00', ${routineId ? `'${routineId}'` : 'null'})`,
    );

  it('keeps routines private like every other table', async () => {
    await routine(ALICE);
    expect((await as(BOB, 'select * from public.routines')).rows).toEqual([]);
    await expect(as(null, 'select * from public.routines')).rejects.toThrow(/permission denied/);
  });

  it('allows quick habits (0 min) anywhere, and 5-minute steps only inside a routine', async () => {
    const r = (await routine(ALICE, 'Morning')).rows[0]!.id;
    await expect(habit(ALICE, null, 0)).resolves.toBeDefined();
    await expect(habit(ALICE, r, 10)).resolves.toBeDefined();
    await expect(habit(ALICE, null, 10)).rejects.toThrow(/check/);
    await expect(habit(ALICE, r, 7)).rejects.toThrow(/check/);
  });

  it('will not put a habit into another user’s routine', async () => {
    const r = (await routine(BOB, 'Bob routine')).rows[0]!.id;
    await expect(habit(ALICE, r, 0)).rejects.toThrow(/foreign key/);
  });

  it('accepts quick blocks (0 min)', async () => {
    await expect(
      as(ALICE, `insert into public.blocks (title, date, start_time, duration_min) values ('Vitamin D', '2026-10-05', '00:00', 0)`),
    ).resolves.toBeDefined();
  });

  it('keeps the habits when a routine is deleted', async () => {
    const r = (await routine(ALICE, 'Temp')).rows[0]!.id;
    await habit(ALICE, r, 0);
    await as(ALICE, `delete from public.routines where id = '${r}'`);
    const left = await as<{ n: number }>(ALICE, `select count(*)::int as n from public.targets where routine_id is null and duration_min = 0`);
    expect(left.rows[0]!.n).toBeGreaterThanOrEqual(2);
  });
});

describe('to-dos (0003)', () => {
  const list = async (user: string, name: string) =>
    (await as<{ id: string }>(user, `insert into public.todo_lists (name) values ('${name}') returning id`)).rows[0]!.id;
  const todo = (user: string, cols: string, vals: string) => as(user, `insert into public.todos (title${cols}) values ('Milk'${vals})`);

  it('keeps lists and to-dos private', async () => {
    const shop = await list(ALICE, 'Shopping');
    await todo(ALICE, ', list_id', `, '${shop}'`);
    expect((await as(BOB, 'select * from public.todos')).rows).toEqual([]);
    expect((await as(BOB, 'select * from public.todo_lists')).rows).toEqual([]);
    await expect(as(null, 'select * from public.todos')).rejects.toThrow(/permission denied/);
  });

  it('will not put a to-do into another user’s list', async () => {
    const bobs = await list(BOB, 'Bob list');
    await expect(todo(ALICE, ', list_id', `, '${bobs}'`)).rejects.toThrow(/foreign key/);
  });

  it('needs a title, a day before a time, and a length with a time (on the 15-minute grid)', async () => {
    await expect(as(ALICE, `insert into public.todos (title) values ('  ')`)).rejects.toThrow(/check/);
    await expect(todo(ALICE, ', due_time, duration_min', `, '10:00', 60`)).rejects.toThrow(/check/);
    await expect(todo(ALICE, ', due_date, due_time', `, '2026-10-10', '10:00'`)).rejects.toThrow(/check/);
    await expect(todo(ALICE, ', due_date, due_time, duration_min', `, '2026-10-10', '10:10', 60`)).rejects.toThrow(/check/);
    await expect(todo(ALICE, ', due_date, due_time, duration_min', `, '2026-10-10', '10:15', 60`)).resolves.toBeDefined();
    await expect(todo(ALICE, ', due_date', `, '2026-10-10'`)).resolves.toBeDefined();
  });

  it('keeps the to-dos when their list is deleted', async () => {
    const tmp = await list(ALICE, 'Temp');
    await as(ALICE, `insert into public.todos (title, list_id) values ('Keep me', '${tmp}')`);
    await as(ALICE, `delete from public.todo_lists where id = '${tmp}'`);
    const left = await as<{ list_id: string | null }>(ALICE, `select list_id from public.todos where title = 'Keep me'`);
    expect(left.rows).toEqual([{ list_id: null }]);
  });
});

