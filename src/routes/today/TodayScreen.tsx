import { useMemo, useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router';
import { NewSheet } from '../../components/NewSheet';
import { BlockSheet, type BlockSheetMode } from '../../components/BlockSheet';
import { Fab } from '../../components/Fab';
import { DayLogSheet, type DayLogTarget } from '../../components/DayLogSheet';
import { Icon } from '../../components/Icon';
import { MoveScopeSheet, type PendingMove } from '../../components/MoveScopeSheet';
import { Page } from '../../components/Page';
import { todoView, TODO_PREFIX, useBlockViews, useDayItems, type BlockView } from '../../components/blockView';
import { TodoDayList } from '../../components/TodoDayList';
import { TodoSheet, type TodoSheetMode } from '../../components/TodoSheet';
import { AnytimeList, RoutineSheet } from '../../components/RoutineParts';
import { usePersistentToggle } from '../../components/usePersistentToggle';
import { DEFAULT_SETTINGS } from '../../data/api';
import { useBlocks, useDayLogs, useEnsureWeek, useSettings, useTargets, useTodoLists, useTodos, useToggleBlockDone, useToggleTodo, useUpdateBlock, useUpdateTodo } from '../../data/queries';
import { dayProgress } from '../../domain/metrics';
import { todosForDay } from '../../domain/todos';
import { addDays, formatDayShort, formatTime, startOfWeek } from '../../domain/time';
import type { Block, ISODate, Minutes } from '../../domain/types';
import { useNow } from '../../theme/useNow';
import { Timeline } from './Timeline';
import { WeekStrip } from './WeekStrip';

/** Today: one day's timeline (today-dark.html). The selected day lives in the URL (?date=). */
export function TodayScreen() {
  const now = useNow();
  const [params, setParams] = useSearchParams();
  const date = params.get('date') ?? now.today;
  const isToday = date === now.today;
  const select = (d: ISODate) => setParams(d === now.today ? {} : { date: d }, { replace: true });

  // Fall back to the default anchors so the timeline never goes blank if settings are slow or fail.
  const settings = useSettings().data ?? DEFAULT_SETTINGS;
  const { data: blocks } = useBlocks(date, date);
  // Bedtime is logged against the night it started: before noon, "Slept" means last night.
  const sleepDate = isToday && now.minutes < 12 * 60 ? addDays(date, -1) : date;
  const { data: logs = [] } = useDayLogs(addDays(date, -1), date);
  const { data: targets = [] } = useTargets();
  // First visit to this week: create its blocks from your routines.
  useEnsureWeek(startOfWeek(date));
  const toggle = useToggleBlockDone();
  const update = useUpdateBlock();
  const views = useBlockViews(blocks);
  // Routine habits sharing a time become one card; quick habits outside routines go to "Anytime".
  const { items: habitItems, anytime } = useDayItems(views);
  // To-dos: timed ones sit on the timeline next to habits; the rest (and today's rollover) get a checklist.
  const { data: todos = [] } = useTodos();
  const { data: todoLists = [] } = useTodoLists();
  const dayTodos = useMemo(() => todosForDay(todos, date, now.today), [todos, date, now.today]);
  const items = useMemo(() => [...habitItems, ...dayTodos.timed.map((t) => todoView(t))], [habitItems, dayTodos.timed]);
  const toggleTodo = useToggleTodo();
  const updateTodo = useUpdateTodo();
  const [todoSheet, setTodoSheet] = useState<TodoSheetMode | null>(null);
  // The + asks what you are adding; habit and routine forms come back here after saving.
  const [choosing, setChoosing] = useState(false);
  const location = useLocation();
  const [routineOpen, setRoutineOpen] = useState<string | null>(null);
  const openRoutine = items.find((v) => v.block.id === routineOpen) ?? null;
  const progress = dayProgress(blocks ?? []);
  const wakeLog = logs.find((l) => l.date === date) ?? null;
  const sleepLog = logs.find((l) => l.date === sleepDate) ?? null;
  const [logTarget, setLogTarget] = useState<DayLogTarget | null>(null);

  const [showEarly, setShowEarly] = usePersistentToggle('cadence.timeline.showEarly');
  const [showLate, setShowLate] = usePersistentToggle('cadence.timeline.showLate');
  const [sheet, setSheet] = useState<BlockSheetMode | null>(null);
  const [pending, setPending] = useState<PendingMove | null>(null);

  // While the scope question is open, show the block at its new time.
  const shown = useMemo(
    () =>
      pending
        ? items.map((v) => (v.block.id === pending.block.id ? { ...v, block: { ...v.block, start: pending.newStart } } : v))
        : items,
    [items, pending],
  );

  /** Target blocks still planned ask how far the move reaches; anything else just moves. */
  const requestMove = (view: Pick<BlockView, 'block' | 'target' | 'group' | 'todo'>, newStart: Minutes) => {
    if (view.todo) {
      updateTodo.mutate(view.todo.id, { dueTime: newStart });
    } else if (view.group) {
      const { routine, members } = view.group;
      setPending({ block: view.block, target: null, newStart, group: { routine, members: members.map((m) => m.block) } });
    } else if (view.target && view.block.status === 'planned') {
      setPending({ block: view.block, target: view.target, newStart });
    } else {
      update.mutate({ id: view.block.id, patch: { start: newStart, moved: true } });
    }
  };

  const nextSlot = () => {
    const base = isToday ? Math.ceil((now.minutes + 1) / 15) * 15 : (settings?.wakeAnchor ?? 9 * 60);
    return Math.min(base, 23 * 60 + 30);
  };

  return (
    <Page>
      <div className="mb-3 flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-baseline gap-2">
            <h1 className="text-headline-lg font-semibold tracking-tight">{formatDayShort(date)}</h1>
            {isToday ? (
              <span className="rounded-full bg-hit/15 px-2 py-0.5 text-label-sm text-hit-ink">Today</span>
            ) : (
              <button onClick={() => select(now.today)} className="rounded-full bg-primary/15 px-2 py-0.5 text-label-sm text-primary-ink">
                Back to today
              </button>
            )}
          </div>
          <div className="flex items-center gap-1.5 rounded-full bg-surface-2 px-2.5 py-1 text-label-sm text-muted">
            <span className="h-1.5 w-1.5 rounded-full bg-hit" />
            {progress.done} of {progress.total} done · {progress.pct}%
          </div>
        </div>
        <WeekStrip selected={date} today={now.today} onSelect={select} />
      </div>

      <LogChip
        icon="wb_sunny"
        label="Woke"
        value={wakeLog?.wake ?? null}
        onClick={() => setLogTarget({ kind: 'wake', date, existing: wakeLog })}
      />

      <AnytimeList views={anytime} past={date < now.today} />

      <TodoDayList
        todos={dayTodos.untimed}
        lists={todoLists}
        today={now.today}
        onOpen={(todo) => setTodoSheet({ kind: 'edit', todo })}
        onAdd={() => setTodoSheet({ kind: 'new', date })}
      />

      {blocks && blocks.length === anytime.length && dayTodos.timed.length + dayTodos.untimed.length === 0 && (
        <EmptyDay hasTargets={targets.some((t) => t.active)} onAdd={() => setSheet({ kind: 'add', date, start: nextSlot() })} />
      )}

      <Timeline
        views={shown}
        wakeAnchor={settings.wakeAnchor}
        sleepAnchor={settings.sleepAnchor}
        now={isToday ? now.minutes : null}
        past={date < now.today}
        showEarly={showEarly}
        showLate={showLate}
        onShowEarly={setShowEarly}
        onShowLate={setShowLate}
        onToggle={(id) => {
          if (id.startsWith(TODO_PREFIX)) {
            const todo = todos.find((t) => TODO_PREFIX + t.id === id);
            if (todo) toggleTodo(todo);
            return;
          }
          const block = blocks?.find((b) => b.id === id);
          if (block) toggle.mutate({ block });
        }}
        onOpen={(view) =>
          view.todo ? setTodoSheet({ kind: 'edit', todo: view.todo }) : view.group ? setRoutineOpen(view.block.id) : setSheet({ kind: 'edit', view })
        }
        onAddAt={(start) => setSheet({ kind: 'add', date, start })}
        onDrop={requestMove}
      />

      <LogChip
        icon="bedtime"
        label={sleepDate !== date ? 'Slept last night' : 'Slept'}
        value={sleepLog?.sleep ?? null}
        onClick={() => setLogTarget({ kind: 'sleep', date: sleepDate, existing: sleepLog })}
      />

      <Fab label="Add" onClick={() => setChoosing(true)} />
      <NewSheet
        open={choosing}
        onClose={() => setChoosing(false)}
        title="Add"
        back={location.pathname + location.search}
        onTodo={() => setTodoSheet({ kind: 'new', date })}
        onBlock={() => setSheet({ kind: 'add', date, start: nextSlot() })}
      />

      <BlockSheet
        mode={sheet}
        onClose={() => setSheet(null)}
        onTodo={(p) => setTodoSheet({ kind: 'new', title: p.title, date: p.date, time: p.time, duration: p.duration })}
        onMove={(block: Block, newStart) => requestMove({ block, target: views.find((v) => v.block.id === block.id)?.target ?? null }, newStart)}
      />
      <MoveScopeSheet pending={pending} onDone={() => setPending(null)} />
      <RoutineSheet
        card={openRoutine?.group ?? null}
        category={openRoutine?.category ?? null}
        date={openRoutine?.block.date ?? null}
        today={now.today}
        onClose={() => setRoutineOpen(null)}
      />
      <DayLogSheet target={logTarget} onClose={() => setLogTarget(null)} />
      <TodoSheet mode={todoSheet} today={now.today} onClose={() => setTodoSheet(null)} />
    </Page>
  );
}

/** Tap to log the time you woke up or went to sleep. */
function LogChip({
  icon,
  label,
  value,
  onClick,
}: {
  icon: 'wb_sunny' | 'bedtime';
  label: string;
  value: Minutes | null;
  onClick: () => void;
}) {
  return (
    <div className="my-2 flex justify-center">
      <button
        type="button"
        onClick={onClick}
        className={
          value === null
            ? 'flex items-center gap-1.5 rounded-full border border-dashed border-border bg-surface px-3 py-1 text-label-md text-muted hover:text-text'
            : 'flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1 text-label-md text-text'
        }
      >
        <Icon name={icon} size={16} className={icon === 'wb_sunny' ? 'text-warn' : 'text-primary'} />
        {label} {value === null ? '· tap to log' : formatTime(value)}
      </button>
    </div>
  );
}

/** Shown when the day has no blocks: points to routines, or to adding something for today. */
function EmptyDay({ hasTargets, onAdd }: { hasTargets: boolean; onAdd: () => void }) {
  return (
    <div className="mb-3 flex flex-col items-center gap-2 rounded-xl border border-dashed border-border px-4 py-5 text-center">
      <p className="text-body-md text-muted">
        {hasTargets
          ? 'Nothing scheduled for this day.'
          : 'No habits yet. Add the things you want to do every week, and they will appear here.'}
      </p>
      <div className="flex gap-2">
        {!hasTargets && (
          <Link to="/goals/new" className="rounded-full bg-primary px-4 py-2 text-label-lg font-semibold text-on-primary">
            New habit
          </Link>
        )}
        <button
          type="button"
          onClick={onAdd}
          className="rounded-full border border-border px-4 py-2 text-label-lg font-semibold text-muted hover:text-text"
        >
          Add to this day
        </button>
      </div>
    </div>
  );
}
