import { useMemo, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router';
import { cx } from '../../components/cx';
import { Fab } from '../../components/Fab';
import { Icon } from '../../components/Icon';
import { Page } from '../../components/Page';
import { useBlockViews, type BlockView } from '../../components/blockView';
import { Ring } from '../../charts/Ring';
import { useBlocks, useCategories, useTargets, useToggleBlockDone } from '../../data/queries';
import { dayProgress } from '../../domain/metrics';
import {
  addDays,
  formatDateSpan,
  formatDayLong,
  formatDayShort,
  isoWeekNumber,
  isoWeekday,
  startOfWeek,
  weekDates,
  weekdayInitial,
} from '../../domain/time';
import type { ISODate } from '../../domain/types';
import { useNow } from '../../theme/useNow';
import { periodOf } from '../today/layout';
import { WeeklyCard } from './WeeklyCard';

const PERIODS = ['Morning', 'Afternoon', 'Evening'] as const;

/** Weekly: seven days split into morning, afternoon, and evening (weekly-light.html). */
export function WeeklyScreen() {
  const now = useNow();
  const [params, setParams] = useSearchParams();
  const monday = startOfWeek(params.get('week') ?? now.today);
  const dates = weekDates(monday);
  const sunday = dates[6]!;
  const goToWeek = (d: ISODate) => setParams(startOfWeek(d) === startOfWeek(now.today) ? {} : { week: startOfWeek(d) }, { replace: true });

  const [filter, setFilter] = useState<string>('all');
  const { data: blocks } = useBlocks(monday, sunday);
  const { data: categories = [] } = useCategories();
  const { data: targets = [] } = useTargets();
  const toggle = useToggleBlockDone();
  const views = useBlockViews(blocks);

  const visible = useMemo(
    () => (filter === 'all' ? views : views.filter((v) => v.category?.id === filter)),
    [views, filter],
  );
  const byDate = useMemo(() => {
    const map = new Map<ISODate, BlockView[]>(dates.map((d) => [d, []]));
    for (const v of visible) map.get(v.block.date)?.push(v);
    return map;
  }, [visible, dates]);

  const activeTargets = targets.filter((t) => t.active);
  const generated = (blocks ?? []).filter((b) => b.origin === 'generated');
  const movedCount = generated.filter((b) => b.moved).length;

  return (
    <Page wide>
      <section className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <Icon name="date_range" className="text-primary" />
          <h1 className="text-headline-md font-bold">Week {isoWeekNumber(monday)}</h1>
          <span className="text-body-sm text-muted">· {formatDateSpan(monday, sunday)}</span>
        </div>
        <div className="flex items-center">
          <button aria-label="Previous week" onClick={() => goToWeek(addDays(monday, -7))} className="rounded-full p-1 text-faint hover:bg-surface-2 hover:text-text">
            <Icon name="chevron_left" />
          </button>
          <button aria-label="Next week" onClick={() => goToWeek(addDays(monday, 7))} className="rounded-full p-1 text-faint hover:bg-surface-2 hover:text-text">
            <Icon name="chevron_right" />
          </button>
        </div>
      </section>

      {/* Day rings */}
      <section className="mt-3 grid grid-cols-7 gap-1.5">
        {dates.map((d) => {
          const p = dayProgress((blocks ?? []).filter((b) => b.date === d));
          const isToday = d === now.today;
          const future = d > now.today;
          const color = isToday ? 'var(--c-primary)' : p.pct === 100 ? 'var(--c-hit)' : future ? 'var(--c-text-faint)' : 'var(--c-hit)';
          return (
            <a
              key={d}
              href={`#day-${d}`}
              className={cx(
                'flex flex-col items-center rounded-xl border py-2 transition-colors',
                isToday ? 'border-primary bg-primary/10' : 'border-border bg-surface shadow-card hover:border-faint',
              )}
            >
              <span className={cx('text-label-sm font-semibold uppercase', isToday ? 'text-primary-ink' : 'text-faint')}>
                {weekdayInitial(isoWeekday(d))}
              </span>
              <div className="my-1">
                <Ring value={p.total ? p.done / p.total : 0} size={32} color={color}>
                  <span className={cx('text-label-md font-bold', isToday ? 'text-primary-ink' : 'text-text')}>{Number(d.slice(8))}</span>
                </Ring>
              </div>
              <span className={cx('text-[10px] font-bold', p.pct === 100 ? 'text-hit-ink' : isToday ? 'text-primary-ink' : 'text-faint')}>
                {p.total && !future ? `${p.pct}%` : '–'}
              </span>
            </a>
          );
        })}
      </section>

      {/* Scheduler status */}
      <section className="mt-4 rounded-xl border border-border bg-surface p-3 shadow-card">
        <div className="flex items-start gap-2.5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Icon name="autorenew" size={22} />
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="flex items-center gap-1.5 text-label-lg font-bold">
              Weekly schedule <span className="h-2 w-2 rounded-full bg-hit" />
            </span>
            <p className="text-body-sm text-muted">
              <strong className="font-semibold text-text">{activeTargets.length} active targets</strong> placed as{' '}
              {generated.length} blocks this week. {movedCount > 0 && `${movedCount} moved by hand stay put on re-run.`}
            </p>
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between border-t border-border pt-2">
          <span className="text-label-md text-faint">Protected blocks never move.</span>
          <button className="flex h-8 items-center gap-1 rounded-full border border-primary/20 bg-primary/10 px-3 text-label-md font-semibold text-primary-ink active:scale-95">
            <Icon name="sync" size={16} /> Re-run
          </button>
        </div>
      </section>

      {/* Category filter */}
      <section className="no-scrollbar -mx-4 mt-4 flex gap-2 overflow-x-auto px-4 pb-1">
        <FilterPill active={filter === 'all'} onClick={() => setFilter('all')}>
          All ({views.length})
        </FilterPill>
        {categories.map((c) => (
          <FilterPill key={c.id} active={filter === c.id} onClick={() => setFilter(c.id)}>
            {c.name}
          </FilterPill>
        ))}
      </section>

      {/* Days */}
      <section className="mt-4 grid gap-6 lg:grid-cols-7 lg:gap-3">
        {dates.map((d) => (
          <DaySection
            key={d}
            date={d}
            today={now.today}
            views={byDate.get(d) ?? []}
            allOnDay={(blocks ?? []).filter((b) => b.date === d)}
            onToggle={(id) => toggle.mutate(id)}
          />
        ))}
      </section>

      <Fab label="Add block" />
    </Page>
  );
}

function DaySection({
  date,
  today,
  views,
  allOnDay,
  onToggle,
}: {
  date: ISODate;
  today: ISODate;
  views: BlockView[];
  allOnDay: { status: string }[];
  onToggle: (id: string) => void;
}) {
  const isToday = date === today;
  const isTomorrow = date === addDays(today, 1);
  const done = allOnDay.filter((b) => b.status === 'done').length;
  return (
    <div id={`day-${date}`} className={cx('flex scroll-mt-20 flex-col gap-2', date < today && 'opacity-80')}>
      <div className="flex items-center justify-between gap-2 lg:flex-col lg:items-start lg:gap-0.5">
        <div className="flex min-w-0 items-center gap-1.5">
          <span className={cx('h-2.5 w-2.5 shrink-0 rounded-full', isToday ? 'bg-primary' : 'bg-surface-3')} />
          <h2 className="truncate text-headline-sm font-bold">
            <span className="lg:hidden">{formatDayLong(date)}</span>
            <span className="hidden lg:inline">{formatDayShort(date)}</span>
          </h2>
          {(isToday || isTomorrow) && (
            <span
              className={cx(
                'rounded-full px-2 py-0.5 text-label-sm font-bold',
                isToday ? 'bg-primary/10 text-primary-ink' : 'bg-surface-2 text-muted',
              )}
            >
              {isToday ? 'Today' : 'Tomorrow'}
            </span>
          )}
        </div>
        <span className="shrink-0 text-label-sm text-muted">
          {allOnDay.length ? `${done} of ${allOnDay.length} done` : ''}
        </span>
      </div>
      {views.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border px-3 py-3 text-body-sm text-faint">Nothing scheduled</p>
      ) : (
        PERIODS.map((p) => {
          const inPeriod = views.filter((v) => periodOf(v.block.start) === p);
          if (inPeriod.length === 0) return null;
          return (
            <div key={p} className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <span className="text-label-sm font-bold uppercase tracking-wider text-faint">{p}</span>
                <span className="h-px flex-1 bg-border" />
              </div>
              {inPeriod.map((v) => (
                <WeeklyCard key={v.block.id} view={v} missed={date < today && v.block.status === 'planned'} onToggle={() => onToggle(v.block.id)} />
              ))}
            </div>
          );
        })
      )}
    </div>
  );
}

function FilterPill({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cx(
        'shrink-0 whitespace-nowrap rounded-full px-3.5 py-1.5 text-label-md font-semibold transition-colors',
        active ? 'bg-primary text-on-primary shadow-card' : 'border border-border bg-surface text-muted hover:text-text',
      )}
    >
      {children}
    </button>
  );
}
