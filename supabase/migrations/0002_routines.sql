-- Cadence 0002: routines and quick habits.
-- Paste into Supabase > SQL Editor > New query, and run once (after 0001).
--
-- A routine groups habits that run together, like a superset: "Sleep routine" = brush teeth,
-- retinol, magnesium, read. The routine owns the days and start time; the app copies them onto
-- each habit in it, so every habit still gets its own blocks and its own streak and hit rate.
--
-- Quick habits take no time slot (duration 0). Habits inside a routine may also use 5-minute steps
-- (10 minutes of sun); the routine's block on the timeline is rounded up to the 15-minute grid.
-- Habits on their own stay on the 15-minute grid, or are quick.
--
-- In the app, a "habit" is a row of `targets` (the table keeps its original name).

-- ---------- Routines ----------

create table public.routines (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  category_id uuid,
  name text not null check (length(trim(name)) between 1 and 80),
  icon text check (length(icon) <= 40),
  frequency_per_week smallint not null check (frequency_per_week between 1 and 7),
  -- ISO weekdays, 1 = Monday ... 7 = Sunday. Empty = spread frequency_per_week across the week.
  preferred_days smallint[] not null default '{}'
    check (preferred_days <@ array[1, 2, 3, 4, 5, 6, 7]::smallint[]),
  preferred_start time not null check (extract(minute from preferred_start)::int % 15 = 0 and extract(second from preferred_start) = 0),
  protected boolean not null default false,
  active boolean not null default true, -- false = archived
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (cardinality(preferred_days) in (0, frequency_per_week)),
  unique (id, user_id),
  foreign key (category_id, user_id) references public.categories (id, user_id) on delete set null (category_id)
);

create trigger routines_updated_at before update on public.routines for each row execute function public.set_updated_at();

-- ---------- Habits join routines ----------

alter table public.targets
  add column routine_id uuid,
  add column routine_order smallint not null default 0,
  -- A habit can only join a routine of the same owner. Deleting the routine keeps its habits.
  add foreign key (routine_id, user_id) references public.routines (id, user_id) on delete set null (routine_id);

create index targets_routine on public.targets (routine_id) where routine_id is not null;

-- ---------- Quick habits and 5-minute steps ----------
-- 0001 named these checks automatically after their column.

alter table public.targets drop constraint targets_duration_min_check;
alter table public.targets add constraint targets_duration_min_check
  check (duration_min between 0 and 720 and duration_min % 5 = 0);
-- On their own, habits are quick (0) or on the 15-minute grid. Inside a routine, 5-minute steps are fine.
alter table public.targets add constraint targets_grid_outside_routine
  check (routine_id is not null or duration_min % 15 = 0);

alter table public.blocks drop constraint blocks_duration_min_check;
alter table public.blocks add constraint blocks_duration_min_check
  check (duration_min between 0 and 1440 and duration_min % 5 = 0);

-- ---------- Security ----------

revoke all on public.routines from anon;
grant select, insert, update, delete on public.routines to authenticated;
alter table public.routines enable row level security;
create policy "own rows" on public.routines for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
