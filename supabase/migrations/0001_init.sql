-- Cadence 0001: initial schema.
-- Paste into Supabase > SQL Editor > New query, and run once.
--
-- Principles (see SPEC.md):
-- * Dates are local `date`, times are local `time`. No UTC conversion for schedule data.
-- * Nothing derived is stored: no percentages, streaks, or hit/miss counts.
-- * Every row belongs to a user (user_id), and row level security only ever shows you your own rows.

-- ---------- Types ----------

create type public.block_status as enum ('planned', 'done', 'skipped');
create type public.block_origin as enum ('generated', 'manual');
create type public.theme_pref as enum ('system', 'light', 'dark');

-- ---------- Helpers ----------

-- Keeps updated_at current on every update.
create function public.set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------- Tables ----------

create table public.settings (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  wake_anchor time not null default '07:00',
  sleep_anchor time not null default '23:00',
  theme public.theme_pref not null default 'system',
  on_time_tolerance_min smallint not null default 30 check (on_time_tolerance_min between 5 and 120),
  updated_at timestamptz not null default now()
);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 40),
  -- A palette key, not a hex color: each key has a tuned light and dark value in the app.
  color text not null check (color in ('cat-1', 'cat-2', 'cat-3', 'cat-4', 'cat-5', 'cat-6', 'cat-7', 'cat-8')),
  sort_order smallint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, name),
  unique (id, user_id) -- lets other tables point at a category *and* its owner
);

create table public.targets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  category_id uuid,
  name text not null check (length(trim(name)) between 1 and 80),
  description text check (length(description) <= 200),
  icon text check (length(icon) <= 40),
  duration_min smallint not null check (duration_min between 15 and 720 and duration_min % 15 = 0),
  frequency_per_week smallint not null check (frequency_per_week between 1 and 7),
  -- ISO weekdays, 1 = Monday ... 7 = Sunday. Empty = spread frequency_per_week across the week.
  preferred_days smallint[] not null default '{}'
    check (preferred_days <@ array[1, 2, 3, 4, 5, 6, 7]::smallint[]),
  preferred_start time not null check (extract(minute from preferred_start)::int % 15 = 0 and extract(second from preferred_start) = 0),
  window_end time check (window_end is null or window_end > preferred_start),
  protected boolean not null default false,
  active boolean not null default true, -- false = archived
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Picked days decide the frequency.
  check (cardinality(preferred_days) in (0, frequency_per_week)),
  unique (id, user_id),
  -- A target can only use a category of the same owner. Deleting the category clears it.
  foreign key (category_id, user_id) references public.categories (id, user_id) on delete set null (category_id)
);

create table public.blocks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  target_id uuid, -- null = one-off block
  title text check (length(title) <= 80), -- required for one-offs; optional override otherwise
  category_id uuid, -- for one-offs; target blocks use their target's category
  date date not null,
  start_time time not null check (extract(minute from start_time)::int % 15 = 0 and extract(second from start_time) = 0),
  duration_min smallint not null check (duration_min between 15 and 1440 and duration_min % 15 = 0),
  status public.block_status not null default 'planned',
  completed_at timestamp, -- local wall clock, deliberately without time zone
  note text check (length(note) <= 500),
  origin public.block_origin not null default 'manual',
  scheduled_for date, -- the day the scheduler assigned; never changes when the block is moved
  moved boolean not null default false, -- changed by hand; re-run leaves it alone
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (target_id is not null or coalesce(length(trim(title)), 0) > 0),
  check ((status = 'done') = (completed_at is not null)),
  check (origin = 'manual' or (target_id is not null and scheduled_for is not null)),
  check (extract(epoch from start_time) / 60 + duration_min <= 1440), -- ends by midnight
  foreign key (target_id, user_id) references public.targets (id, user_id) on delete set null (target_id),
  foreign key (category_id, user_id) references public.categories (id, user_id) on delete set null (category_id)
);

-- Reading a day or a week is the hot path.
create index blocks_user_date on public.blocks (user_id, date);
create index blocks_target_date on public.blocks (target_id, date);
-- The scheduler can never create the same target slot twice, even from two tabs at once.
create unique index blocks_one_generated_slot on public.blocks (target_id, scheduled_for) where origin = 'generated';

create table public.day_logs (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  date date not null,
  wake_time time,
  -- Bedtime for the night that starts on `date`. Values before 12:00 mean after midnight.
  sleep_time time,
  updated_at timestamptz not null default now(),
  primary key (user_id, date)
);

-- "This week's blocks have been generated", so deleted blocks do not come back on the next visit.
create table public.week_plans (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  week_start date not null check (extract(isodow from week_start) = 1),
  generated_at timestamptz not null default now(),
  primary key (user_id, week_start)
);

create trigger settings_updated_at before update on public.settings for each row execute function public.set_updated_at();
create trigger categories_updated_at before update on public.categories for each row execute function public.set_updated_at();
create trigger targets_updated_at before update on public.targets for each row execute function public.set_updated_at();
create trigger blocks_updated_at before update on public.blocks for each row execute function public.set_updated_at();
create trigger day_logs_updated_at before update on public.day_logs for each row execute function public.set_updated_at();

-- ---------- Security ----------
-- The app's browser key is public by design. These rules are what keep your data private:
-- signed-in users can only see and change rows whose user_id is their own; signed-out
-- visitors (the `anon` role) can do nothing at all.

revoke all on public.settings, public.categories, public.targets, public.blocks, public.day_logs, public.week_plans from anon;
grant select, insert, update, delete on public.settings, public.categories, public.targets, public.blocks, public.day_logs, public.week_plans to authenticated;

alter table public.settings enable row level security;
alter table public.categories enable row level security;
alter table public.targets enable row level security;
alter table public.blocks enable row level security;
alter table public.day_logs enable row level security;
alter table public.week_plans enable row level security;

create policy "own rows" on public.settings for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "own rows" on public.categories for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "own rows" on public.targets for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "own rows" on public.blocks for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "own rows" on public.day_logs for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "own rows" on public.week_plans for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
