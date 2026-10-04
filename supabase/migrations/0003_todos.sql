-- Cadence 0003: to-do lists.
-- Paste into Supabase > SQL Editor > New query, and run once (after 0001 and 0002).
--
-- To-dos are their own records, not blocks: habit rates and streaks are computed from blocks only, so a
-- chore never counts as a missed habit. A to-do may have a day (it shows on that day's list) and a time
-- (it shows on the timeline). Unfinished to-dos roll over to today when the app draws the screen; their
-- stored day is never rewritten.

-- ---------- Lists (Shopping, Errands, People, and any you add) ----------

create table public.todo_lists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 40),
  icon text check (length(icon) <= 40),
  sort_order smallint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, name),
  unique (id, user_id)
);

-- ---------- To-dos ----------

create table public.todos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  list_id uuid,
  title text not null check (coalesce(length(trim(title)), 0) between 1 and 200),
  note text check (length(note) <= 500),
  -- Urgent and important: shown together in the Priority view, whatever the list.
  starred boolean not null default false,
  -- The day it is planned for (local date). Empty = someday.
  due_date date,
  -- Optional local time on the 15-minute grid, with a length: then it sits on the timeline.
  due_time time check (due_time is null or (extract(minute from due_time)::int % 15 = 0 and extract(second from due_time) = 0)),
  duration_min smallint check (duration_min is null or (duration_min between 15 and 720 and duration_min % 15 = 0)),
  completed_at timestamp, -- local wall clock, like blocks.completed_at; empty = still to do
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- A time needs a day, and a time comes with a length (and only then).
  check (due_time is null or due_date is not null),
  check ((due_time is null) = (duration_min is null)),
  unique (id, user_id),
  -- A to-do can only be in a list of the same owner. Deleting the list keeps its to-dos (list cleared).
  foreign key (list_id, user_id) references public.todo_lists (id, user_id) on delete set null (list_id)
);

create index todos_due on public.todos (user_id, due_date) where completed_at is null;

create trigger todo_lists_updated_at before update on public.todo_lists for each row execute function public.set_updated_at();
create trigger todos_updated_at before update on public.todos for each row execute function public.set_updated_at();

-- ---------- Security ----------

revoke all on public.todo_lists, public.todos from anon;
grant select, insert, update, delete on public.todo_lists, public.todos to authenticated;
alter table public.todo_lists enable row level security;
alter table public.todos enable row level security;
create policy "own rows" on public.todo_lists for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "own rows" on public.todos for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
