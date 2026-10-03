import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router';
import { BlockSheet, type BlockSheetMode } from '../../components/BlockSheet';
import { cx } from '../../components/cx';
import { Fab } from '../../components/Fab';
import { Icon } from '../../components/Icon';
import { MoveScopeSheet, type PendingMove } from '../../components/MoveScopeSheet';
import { Page } from '../../components/Page';
import { useBlockViews, type BlockView } from '../../components/blockView';
import { Ring } from '../../charts/Ring';
import { useBlocks, useCategories, useTargets, useToggleBlockDone, useUpdateBlock } from '../../data/queries';
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
import type { Block, ISODate, Minutes } from '../../domain/types';
import { useNow } from '../../theme/useNow';
import { periodOf } from '../today/layout';
import { WeeklyCard } from './WeeklyCard';

const PERIODS = ['Morning', 'Afternoon', 'Evening'] as const;

/**
 * Weekly: seven days split into morning, afternoon, and evening (weekly-light.html).
 * Phones: one day per screen, swipe sideways; the ring strip highlights the day in view.
 * 768px and wider (fold inner screen, tablet, desktop): all seven days side by side.
 * Tapping a ring highlights that day (and on phones slides it into view).
 */
export function WeeklyScreen() {
  const now = useNow();
  const [params, setParams] = useSearchParams();
  const monday = startOfWeek(params.get('week') ?? now.today);
  const dates = useMemo(() => weekDates(monday), [monday]);
  const sunday = dates[6]!;
  const thisWeek = monday === startOfWeek(now.today);
  const goToWeek = (d: ISODate) =>
    setParams(startOfWeek(d) === startOfWeek(now.today) ? {} : { week: startOfWeek(d) }, { replace: true });

  const [selected, setSelected] = useState<ISODate>(thisWeek ? now.today : monday);
  useEffect(() => setSelected(thisWeek ? now.today : monday), [monday, thisWeek, now.today]);

  const [filter, setFilter] = useState<string>('all');
  const { data: blocks } = useBlocks(monday, sunday);
  const { data: categories = [] } = useCategories();
  const { data: targets = [] } = useTargets();
  const toggle = useToggleBlockDone();
  const update = useUpdateBlock();
  const views = useBlockViews(blocks);
  const [sheet, setSheet] = useState<BlockSheetMode | null>(null);
  const [pending, setPending] = useState<PendingMove | null>(null);

  const visible = useMemo(
    () => (filter === 'all' ? views : views.filter((v) => v.category?.id === filter)),
    [views, filter],
  );
  const byDate = useMemo(() => {
    const map = new Map<ISODate, BlockView[]>(dates.map((d) => [d, []]));
    for (const v of visible) map.get(v.block.date)?.push(v);
    return map;
  }, [visible, dates]);

  // ----- Horizontal day scroller (phones) -----
  const scroller = useRef<HTMLDivElement>(null);
  const columns = useRef(new Map<ISODate, HTMLElement>());
  const programmatic = useRef(false);

  /** Slides a day into view on phones. On wide screens the scroller does not scroll, so this is a no-op. */
  const reveal = (d: ISODate, smooth = true) => {
    const box = scroller.current;
    const col = columns.current.get(d);
    if (!box || !col || box.scrollWidth <= box.clientWidth) return;
    programmatic.current = true;
    box.scrollTo({ left: col.offsetLeft - box.offsetLeft - 16, behavior: smooth ? 'smooth' : 'auto' });
    window.setTimeout(() => (programmatic.current = false), 500);
  };

  // Start on the selected day when the week changes.
  useEffect(() => reveal(selected, false), [monday]);

  // When you swipe, highlight the day that is now in view.
  useEffect(() => {
    const box = scroller.current;
    if (!box) return;
    let timer = 0;
    const onScroll = () => {
      if (programmatic.current) return;
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        let best: ISODate | null = null;
        let bestDist = Infinity;
        for (const [d, el] of columns.current) {
          const dist = Math.abs(el.offsetLeft - box.offsetLeft - 16 - box.scrollLeft);
          if (dist < bestDist) {
            bestDist = dist;
            best = d;
          }
        }
        if (best) setSelected(best);
      }, 80);
    };
    box.addEventListener('scroll', onScroll, { passive: true });
    return () => box.removeEventListener('scroll', onScroll);
  }, []);

  const pick = (d: ISODate) => {
    setSelected(d);
    reveal(d);
  };

  const requestMove = (block: Block, newStart: Minutes) => {
    const target = targets.find((t) => t.id === block.targetId) ?? null;
    if (target && block.status === 'planned') setPending({ block, target, newStart });
    else update.mutate({ id: block.id, patch: { start: newStart, moved: true } });
  };

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
          {!thisWeek && (
            <button onClick={() => goToWeek(now.today)} className="mr-1 rounded-full bg-primary/10 px-2.5 py-1 text-label-sm font-semibold text-primary-ink">
              This week
            </button>
          )}
          <button aria-label="Previous week" onClick={() => goToWeek(addDays(monday, -7))} className="rounded-full p-1 text-faint hover:bg-surface-2 hover:text-text">
            <Icon name="chevron_left" />
          </button>
          <button aria-label="Next week" onClick={() => goToWeek(addDays(monday, 7))} className="rounded-full p-1 text-faint hover:bg-surface-2 hover:text-text">
            <Icon name="chevron_right" />
          </button>
        </div>
      </section>

      {/* Day rings: tap to highlight a day */}
      <section className="mt-3 grid grid-cols-7 gap-1.5 md:gap-2">
        {dates.map((d) => {
          const p = dayProgress((blocks ?? []).filter((b) => b.date === d));
          const isToday = d === now.today;
          const isSel = d === selected;
          const future = d > now.today;
          const color = isToday ? 'var(--c-primary)' : future ? 'var(--c-text-faint)' : 'var(--c-hit)';
          return (
            <button
              key={d}
              type="button"
              onClick={() => pick(d)}
              aria-pressed={isSel}
              aria-label={`${formatDayLong(d)}, ${p.done} of ${p.total} done`}
              className={cx(
                'flex flex-col items-center rounded-xl border py-2 transition-all',
                isSel ? 'border-primary bg-primary/10 shadow-card' : 'border-border bg-surface hover:border-faint',
              )}
            >
              <span className={cx('text-label-sm font-semibold uppercase', isSel || isToday ? 'text-primary-ink' : 'text-faint')}>
                {weekdayInitial(isoWeekday(d))}
              </span>
              <div className="my-1">
                <Ring value={p.total ? p.done / p.total : 0} size={32} color={color}>
                  <span className={cx('text-label-md font-bold', isSel ? 'text-primary-ink' : 'text-text')}>{Number(d.slice(8))}</span>
                </Ring>
              </div>
              <span className={cx('text-[10px] font-bold', p.pct === 100 && !future ? 'text-hit-ink' : isSel ? 'text-primary-ink' : 'text-faint')}>
                {p.total && !future ? `${p.pct}%` : '–'}
              </span>
              {isToday && <span className="mt-0.5 h-1 w-1 rounded-full bg-primary" aria-hidden />}
            </button>
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

      {/* Days: a swipeable row on phones, seven columns from 768px */}
      <section
        ref={scroller}
        className="no-scrollbar -mx-4 mt-3 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 pb-2 md:mx-0 md:grid md:snap-none md:grid-cols-7 md:gap-2 md:overflow-visible md:px-0"
      >
        {dates.map((d) => (
          <div
            key={d}
            ref={(el) => {
              if (el) columns.current.set(d, el);
            }}
            className="w-[86%] shrink-0 snap-start md:w-auto"
          >
            <DaySection
              date={d}
              today={now.today}
              selected={d === selected}
              views={byDate.get(d) ?? []}
              allOnDay={(blocks ?? []).filter((b) => b.date === d)}
              onSelect={() => setSelected(d)}
              onToggle={(id) => {
                const block = blocks?.find((b) => b.id === id);
                if (block) toggle.mutate({ block });
              }}
              onOpen={(view) => setSheet({ kind: 'edit', view })}
            />
          </div>
        ))}
      </section>

      <Fab label="Add block" onClick={() => setSheet({ kind: 'add', date: selected, start: 9 * 60 })} />
      <BlockSheet mode={sheet} onClose={() => setSheet(null)} onMove={requestMove} />
      <MoveScopeSheet pending={pending} onDone={() => setPending(null)} />
    </Page>
  );
}

function DaySection({
  date,
  today,
  selected,
  views,
  allOnDay,
  onSelect,
  onToggle,
  onOpen,
}: {
  date: ISODate;
  today: ISODate;
  selected: boolean;
  views: BlockView[];
  allOnDay: Block[];
  onSelect: () => void;
  onToggle: (id: string) => void;
  onOpen: (view: BlockView) => void;
}) {
  const isToday = date === today;
  const isTomorrow = date === addDays(today, 1);
  const done = allOnDay.filter((b) => b.status === 'done').length;
  return (
    <div
      onClick={onSelect}
      className={cx(
        'flex min-h-full flex-col gap-2 rounded-2xl border p-2 transition-colors md:p-1.5',
        selected ? 'border-primary/40 bg-primary/5' : 'border-transparent',
      )}
    >
      <div className="flex items-center justify-between gap-2 px-1 md:flex-col md:items-start md:gap-0.5">
        <div className="flex min-w-0 items-center gap-1.5">
          <span className={cx('h-2.5 w-2.5 shrink-0 rounded-full', selected ? 'bg-primary' : isToday ? 'bg-primary/50' : 'bg-surface-3')} />
          <h2 className={cx('truncate text-headline-sm font-bold md:text-label-lg', selected && 'text-primary-ink')}>
            <span className="md:hidden">{formatDayLong(date)}</span>
            <span className="hidden md:inline">{formatDayShort(date)}</span>
          </h2>
          {(isToday || isTomorrow) && (
            <span
              className={cx(
                'rounded-full px-2 py-0.5 text-label-sm font-bold md:hidden xl:inline',
                isToday ? 'bg-primary/10 text-primary-ink' : 'bg-surface-2 text-muted',
              )}
            >
              {isToday ? 'Today' : 'Tomorrow'}
            </span>
          )}
        </div>
        <span className="shrink-0 text-label-sm text-muted">{allOnDay.length ? `${done} of ${allOnDay.length} done` : ''}</span>
      </div>
      {views.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border px-3 py-3 text-body-sm text-faint">Nothing scheduled</p>
      ) : (
        PERIODS.map((p) => {
          const inPeriod = views.filter((v) => periodOf(v.block.start) === p);
          if (inPeriod.length === 0) return null;
          return (
            <div key={p} className="flex flex-col gap-2">
              <div className="flex items-center gap-2 px-1">
                <span className="text-label-sm font-bold uppercase tracking-wider text-faint">{p}</span>
                <span className="h-px flex-1 bg-border" />
              </div>
              {inPeriod.map((v) => (
                <WeeklyCard
                  key={v.block.id}
                  view={v}
                  missed={date < today && v.block.status === 'planned'}
                  onToggle={() => onToggle(v.block.id)}
                  onOpen={() => onOpen(v)}
                />
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
