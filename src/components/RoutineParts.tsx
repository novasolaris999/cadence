// Building blocks for drawing routines (supersets of habits) and quick habits.

import { Link } from 'react-router';
import { useSetBlocksStatus, useToggleBlockDone } from '../data/queries';
import { habitLength } from '../domain/routines';
import { targetDays } from '../domain/schedule';
import { formatDays, formatTimeRange } from '../domain/time';
import type { Block, Category, ISODate } from '../domain/types';
import type { BlockView, RoutineCard } from './blockView';
import { catBg, catSoft } from './categoryColor';
import { cx } from './cx';
import { CHECK_SIZE } from './CheckButton';
import { Icon, isIconName } from './Icon';
import { Sheet } from './Sheet';

/** The routine's icon in a soft category-colored tile. */
export function RoutineIcon({ icon, category, size = 36 }: { icon: string | null; category: Category | null; size?: number }) {
  return (
    <span
      className={cx('flex shrink-0 items-center justify-center rounded-lg text-text', catSoft(category))}
      style={{ width: size, height: size }}
    >
      <Icon name={isIconName(icon) ? icon : 'event_repeat'} size={Math.round(size * 0.5)} />
    </span>
  );
}

/** One segment per habit, filled when done: a superset's sets at a glance. */
export function Pips({ blocks, category, className }: { blocks: Block[]; category: Category | null; className?: string }) {
  return (
    <span className={cx('flex items-center gap-[3px]', className)} aria-hidden>
      {blocks.map((b) => (
        <span
          key={b.id}
          className={cx(
            'h-1.5 w-3 rounded-full',
            b.status === 'done' ? catBg(category) : b.status === 'skipped' ? 'bg-miss/40' : 'bg-text/15',
          )}
        />
      ))}
    </span>
  );
}

/** A habit as a tappable pill: tap to tick it off. */
export function HabitPill({
  view,
  onToggle,
  missed,
  compact,
}: {
  view: BlockView;
  onToggle: () => void;
  missed?: boolean;
  /** Slimmer, for short routine cards on the timeline. */
  compact?: boolean;
}) {
  const done = view.block.status === 'done';
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      // A mouse press on a pill is a tick, never the start of a drag (the drag would end in a click here).
      onMouseDown={(e) => e.stopPropagation()}
      aria-pressed={done}
      aria-label={done ? `Mark ${view.title} not done` : `Mark ${view.title} done`}
      className={cx(
        'flex max-w-full shrink-0 items-center gap-1.5 rounded-full border pl-1 font-semibold transition-colors active:scale-95',
        compact ? 'h-6 pr-2 text-label-sm' : 'h-7 pr-2.5 text-label-md',
        done
          ? 'border-transparent bg-hit/15 text-hit-ink'
          : missed
            ? 'border-miss/40 bg-surface text-miss-ink'
            : 'border-border bg-surface text-text hover:border-primary',
      )}
    >
      <span
        className={cx(
          'flex shrink-0 items-center justify-center rounded-full',
          compact ? 'h-4 w-4' : 'h-5 w-5',
          done ? 'bg-hit text-on-primary' : 'border-2 border-current opacity-50',
        )}
      >
        {done && <Icon name="check" size={compact ? 12 : 14} />}
      </span>
      <span className={cx('truncate', done && 'line-through decoration-1 opacity-80')}>{view.title}</span>
    </button>
  );
}

/** "Anytime" habits on Today: quick ticks with no time slot. */
export function AnytimeList({ views, past }: { views: BlockView[]; past: boolean }) {
  const toggle = useToggleBlockDone();
  if (views.length === 0) return null;
  const done = views.filter((v) => v.block.status === 'done').length;
  return (
    <section className="mb-2 rounded-xl bg-surface p-3 shadow-card" aria-label="Anytime today">
      <div className="mb-2 flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-label-md font-semibold uppercase tracking-wider text-muted">
          <Icon name="bolt" size={16} className="text-primary" /> Anytime
        </span>
        <span className="text-label-sm text-faint">
          {done} of {views.length}
        </span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {views.map((v) => (
          <HabitPill key={v.block.id} view={v} missed={past && v.block.status === 'planned'} onToggle={() => toggle.mutate({ block: v.block })} />
        ))}
      </div>
    </section>
  );
}

/**
 * A routine as a superset: numbered habits joined by a rail, each with its own check,
 * plus "Complete all". Opens from a routine card on Today or Weekly.
 */
export function RoutineSheet({
  card,
  category,
  date,
  today,
  onClose,
}: {
  card: RoutineCard | null;
  category: Category | null;
  date: ISODate | null;
  today: ISODate;
  onClose: () => void;
}) {
  const toggle = useToggleBlockDone();
  const setAll = useSetBlocksStatus();
  if (!card || !date) return null;
  const { routine, members, minutes } = card;
  // Read live status from the members passed in (they update with the cache).
  const done = members.filter((m) => m.block.status === 'done').length;
  const all = done === members.length;
  const past = date < today;
  const start = members[0]?.block.start ?? routine.preferredStart;

  return (
    <Sheet open onClose={onClose} title={routine.name}>
      <div className="-mt-1 flex items-center gap-3">
        <RoutineIcon icon={routine.icon} category={category} size={48} />
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="text-body-sm text-muted">
            {formatDays(targetDays(routine), routine.frequencyPerWeek)} · {formatTimeRange(start, minutes)}
          </span>
          <span className="text-body-sm text-muted">
            {members.length} habit{members.length === 1 ? '' : 's'} · {minutes ? habitLength(minutes) : 'all quick'}
          </span>
        </div>
        <div className="flex flex-col items-end">
          <span className="font-display text-headline-md font-bold">
            {done}
            <span className="text-body-md text-faint">/{members.length}</span>
          </span>
          <Pips blocks={members.map((m) => m.block)} category={category} />
        </div>
      </div>

      <ol className="relative mt-4 flex flex-col gap-2">
        {/* The superset rail joining the habits */}
        <span className={cx('absolute top-5 bottom-5 left-[19px] w-0.5 rounded-full opacity-40', catBg(category))} aria-hidden />
        {members.map((m, i) => {
          const isDone = m.block.status === 'done';
          const missed = past && m.block.status === 'planned';
          return (
            <li key={m.block.id}>
              <button
                type="button"
                onClick={() => toggle.mutate({ block: m.block })}
                aria-pressed={isDone}
                className={cx(
                  'relative flex w-full items-center gap-3 rounded-xl border p-2 pr-3 text-left transition-colors',
                  isDone ? 'border-transparent bg-hit/10' : 'border-border bg-surface-2 hover:border-primary',
                )}
              >
                <span
                  className={cx(
                    'z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full font-mono text-label-sm font-bold ring-4 ring-surface',
                    isDone ? 'bg-hit text-on-primary' : cx(catBg(category), 'text-on-primary'),
                  )}
                  style={{ marginLeft: 4 }}
                >
                  {isDone ? <Icon name="check" size={14} /> : i + 1}
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className={cx('truncate text-label-lg font-semibold', isDone && 'text-muted line-through')}>{m.title}</span>
                  {missed && <span className="text-label-sm font-semibold text-miss-ink">Missed</span>}
                  {m.block.status === 'skipped' && <span className="text-label-sm text-muted">Skipped</span>}
                </span>
                <span
                  className={cx(
                    'shrink-0 rounded-full px-2 py-0.5 text-label-sm font-semibold',
                    m.block.durationMin === 0 ? 'bg-primary/10 text-primary-ink' : 'bg-surface-3 text-muted',
                  )}
                >
                  {m.block.durationMin === 0 && <Icon name="bolt" size={12} className="mr-0.5 inline align-[-2px]" />}
                  {habitLength(m.block.durationMin)}
                </span>
                <span className={cx('flex h-7 w-7 shrink-0 items-center justify-center rounded-full', isDone ? 'text-hit' : 'text-faint')}>
                  {isDone ? <Icon name="check_circle" filled size={26} /> : <span className="h-5 w-5 rounded-full border-2 border-current" />}
                </span>
              </button>
            </li>
          );
        })}
      </ol>

      <div className="mt-4 flex flex-col gap-2">
        <button
          type="button"
          onClick={() => setAll.mutate({ blocks: members.map((m) => m.block), status: all ? 'planned' : 'done' })}
          className={cx(
            'flex w-full items-center justify-center gap-1.5 rounded-full py-3 text-label-lg font-semibold active:scale-[0.98]',
            all ? 'border border-border text-muted' : 'bg-primary text-on-primary shadow-card',
          )}
        >
          <Icon name={all ? 'close' : 'check'} size={18} /> {all ? 'Undo all' : `Complete all ${members.length}`}
        </button>
        <Link
          to={`/goals/routine/${routine.id}`}
          onClick={onClose}
          className="flex items-center justify-center gap-1 rounded-full py-2 text-label-lg font-semibold text-muted hover:text-text"
        >
          <Icon name="edit" size={16} /> Edit routine
        </Link>
      </div>
    </Sheet>
  );
}

/** Height of one habit row in a routine checklist. The timeline uses it to give routine cards room. */
export const CHECK_ROW_H = 28;

/**
 * A routine's habits as a vertical checklist joined by a rail, the superset look on cards.
 * Tap a row to tick that habit.
 */
export function RoutineChecklist({
  members,
  category,
  missed,
  onToggleId,
}: {
  members: BlockView[];
  category: Category | null;
  /** The card's day is over: unticked habits read as missed. */
  missed?: boolean;
  onToggleId: (id: string) => void;
}) {
  return (
    <ul className="relative flex flex-col">
      <span
        className={cx('absolute left-[9px] w-0.5 rounded-full opacity-30', catBg(category))}
        style={{ top: CHECK_ROW_H / 2, bottom: CHECK_ROW_H / 2 }}
        aria-hidden
      />
      {members.map((m) => {
        const isDone = m.block.status === 'done';
        const isMissed = missed && m.block.status === 'planned';
        return (
          <li key={m.block.id}>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggleId(m.block.id);
              }}
              // A mouse press here is a tick, never the start of a drag (the drag would end in a click).
              onMouseDown={(e) => e.stopPropagation()}
              aria-pressed={isDone}
              aria-label={isDone ? `Mark ${m.title} not done` : `Mark ${m.title} done`}
              className="flex w-full items-center gap-2 rounded-md pr-1 text-left hover:bg-text/5"
              style={{ height: CHECK_ROW_H }}
            >
              <span
                className={cx(
                  'z-10 flex shrink-0 items-center justify-center rounded-full ring-2 ring-[var(--ring-bg)]',
                  isDone ? 'bg-hit text-on-primary' : isMissed ? 'border-2 border-miss bg-surface' : 'border-2 border-faint bg-surface',
                )}
                style={{ marginLeft: 1, width: CHECK_SIZE, height: CHECK_SIZE }}
              >
                {isDone && <Icon name="check" size={12} />}
              </span>
              <span
                className={cx(
                  'min-w-0 flex-1 truncate text-body-sm',
                  isDone ? 'text-faint line-through' : isMissed ? 'text-miss-ink' : 'text-text',
                )}
              >
                {m.title}
              </span>
              <span className={cx('shrink-0 text-label-sm', m.block.durationMin === 0 ? 'text-primary-ink' : 'text-faint')}>
                {habitLength(m.block.durationMin)}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
