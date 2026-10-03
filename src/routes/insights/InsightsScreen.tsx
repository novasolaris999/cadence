import { useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { cx } from '../../components/cx';
import { catBg, catSoft, catVar } from '../../components/categoryColor';
import { Icon, isIconName } from '../../components/Icon';
import { Page } from '../../components/Page';
import { SegmentedControl } from '../../components/SegmentedControl';
import { Donut } from '../../charts/Donut';
import { RegularityChart } from '../../charts/RegularityChart';
import { RoutineIcon } from '../../components/RoutineParts';
import { DEFAULT_SETTINGS } from '../../data/api';
import { useBlocks, useCategories, useDayLogs, useRoutines, useSettings, useTargets } from '../../data/queries';
import { routineCellsForRange, routineDays } from '../../domain/history';
import { CELL } from '../goals/HitGrid';
import {
  categoryBalance,
  lateNights,
  MIN_RESOLVED,
  missPattern,
  onTimeStats,
  rollingWindow,
  STRUGGLE_RATE,
  struggles,
  wakeDrift,
  wins,
  type OnTime,
} from '../../domain/insights';
import { pct, tally } from '../../domain/metrics';
import { addDays, dateRange, formatDayShort, formatDuration, formatTime, isoWeekday, weekdayLong, weekdayShort } from '../../domain/time';
import type { Minutes } from '../../domain/types';
import { useNow } from '../../theme/useNow';

type Range = '7' | '30';

/**
 * Insights: sleep/wake regularity, routines, struggles, wins, and category balance (insights-light.html).
 * Windows are rolling (last 7 or 30 days, compared with the same length before), so they are never empty
 * on a Monday. All rules live in src/domain/insights.ts and history.ts.
 */
export function InsightsScreen() {
  const now = useNow();
  const [range, setRange] = useState<Range>('7');
  const [balanceBy, setBalanceBy] = useState<'minutes' | 'count'>('minutes');
  const win = rollingWindow(now.today, Number(range));
  const period = { from: win.from };
  const to = win.to;
  const prevTo = win.prevTo;

  // Fall back to the default anchors so the tab never goes blank if settings are slow or fail.
  const settings = useSettings().data ?? DEFAULT_SETTINGS;
  const { data: targets = [] } = useTargets();
  const { data: routines = [] } = useRoutines();
  const { data: categories = [] } = useCategories();
  const { data: logs = [] } = useDayLogs(win.prevFrom, to);
  const { data: blocks = [] } = useBlocks(addDays(now.today, -366), now.today);

  const periodBlocks = useMemo(() => blocks.filter((b) => b.date >= period.from && b.date <= to), [blocks, period.from, to]);
  const periodLogs = logs.filter((l) => l.date >= period.from);
  const prevLogs = logs.filter((l) => l.date <= prevTo);
  const active = targets.filter((t) => t.active);
  const routineOf = (t: { routineId: string | null }) => routines.find((r) => r.id === t.routineId) ?? null;
  // The regularity chart is always the last 7 days, today last.
  const week = dateRange(addDays(now.today, -6), now.today);
  const activeRoutines = routines.filter((r) => r.active);

  const wake = onTimeStats(periodLogs, settings, 'wake');
  const sleep = onTimeStats(periodLogs, settings, 'sleep');
  const wakePrev = onTimeStats(prevLogs, settings, 'wake');
  const sleepPrev = onTimeStats(prevLogs, settings, 'sleep');
  const weekLogs = logs.filter((l) => week.includes(l.date));
  const drift = wakeDrift(weekLogs);
  const late = lateNights(weekLogs, settings);
  const struggleList = struggles(active, periodBlocks, blocks, now.today);
  const winList = wins(active, periodBlocks, blocks, now.today);
  const balance = categoryBalance(periodBlocks, targets, categories, balanceBy);
  // Without enough finished results, "nothing to flag" would be a false all-clear.
  const enoughResults = active.some((t) => {
    const r = tally(periodBlocks.filter((b) => b.targetId === t.id), now.today);
    return r.hits + r.misses >= MIN_RESOLVED;
  });

  return (
    <Page>
      <div className="flex flex-col gap-6">
        <section className="flex flex-col gap-2">
          <span className="text-label-sm font-bold uppercase tracking-wider text-hit-ink">
            {formatDayShort(period.from)} to today, vs the {range} days before
          </span>
          <h1 className="text-headline-lg font-bold">Cadence check</h1>
          <SegmentedControl<Range>
            label="Range"
            value={range}
            onChange={setRange}
            options={[
              { value: '7', label: 'Last 7 days' },
              { value: '30', label: 'Last 30 days' },
            ]}
          />
        </section>

        {/* Sleep and wake */}
        <section className="flex flex-col gap-3">
          <SectionHeader icon="bedtime" title="Sleep & wake" />
          <div className="grid grid-cols-2 gap-3">
            <OnTimeCard icon="wb_sunny" label="On-time wake" anchor={settings.wakeAnchor} stats={wake} prev={wakePrev} tone="hit" />
            <OnTimeCard icon="nightlight" label="On-time sleep" anchor={settings.sleepAnchor} stats={sleep} prev={sleepPrev} tone="primary" />
          </div>
          <Card>
            <div className="flex items-start justify-between gap-2">
              <div className="flex flex-col">
                <span className="text-label-lg font-semibold">7-day regularity</span>
                <span className="text-body-sm text-muted">Last 7 days, today on the right</span>
                <span className="text-body-sm text-muted">Bands show anchor ± {settings.onTimeToleranceMin} min</span>
              </div>
              <div className="flex gap-3 text-label-md text-muted">
                <Legend color="bg-hit">Wake</Legend>
                <Legend color="bg-primary">Sleep</Legend>
              </div>
            </div>
            <RegularityChart dates={week} logs={weekLogs} settings={settings} today={now.today} />
            <div className="flex items-center justify-between text-label-md">
              <span className="flex items-center gap-1 font-medium text-hit-ink">
                <Icon name="verified" size={16} />
                {drift === null ? 'Log Woke on Today for 2+ days to see drift' : `Wake drift ±${drift} min`}
              </span>
              {late.length > 0 && (
                <span className="font-medium text-miss-ink">
                  {late.length} late night{late.length > 1 ? 's' : ''} ({late.map((d) => weekdayShort(isoWeekday(d))).join(', ')})
                </span>
              )}
            </div>
          </Card>
        </section>

        {/* Routines: how many days each one was fully done */}
        {activeRoutines.length > 0 && (
          <section className="flex flex-col gap-3">
            <SectionHeader icon="event_repeat" title="Routines" />
            <Card>
              {activeRoutines.map((r) => {
                const ids = new Set(targets.filter((t) => t.routineId === r.id).map((t) => t.id));
                const mine = periodBlocks.filter((b) => b.targetId && ids.has(b.targetId));
                const d = routineDays(mine, period.from, to, now.today);
                const scheduled = d.full + d.partial + d.missed;
                const cells = routineCellsForRange(mine, period.from, to, now.today);
                const cat = categories.find((c) => c.id === r.categoryId) ?? null;
                return (
                  <Link key={r.id} to={`/goals/routine/${r.id}`} className="flex flex-col gap-1.5 rounded-lg p-1 hover:bg-surface-2">
                    <span className="flex items-center gap-2.5">
                      <RoutineIcon icon={r.icon} category={cat} size={32} />
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate text-label-lg font-semibold">{r.name}</span>
                        <span className="text-body-sm text-muted">
                          {scheduled === 0
                            ? 'No finished days yet'
                            : `All done on ${d.full} of ${scheduled} day${scheduled === 1 ? '' : 's'}${d.partial ? ` · ${d.partial} partial` : ''}`}
                        </span>
                      </span>
                      <Icon name="chevron_right" size={18} className="text-faint" />
                    </span>
                    <span className="grid" style={{ gridTemplateColumns: `repeat(${cells.length}, minmax(0, 1fr))`, gap: cells.length > 10 ? 2 : 4 }}>
                      {cells.map((c) => (
                        <span key={c.date} title={`${formatDayShort(c.date)}: ${c.state}`} className={cx('h-2.5 rounded-[2px]', CELL[c.state])} />
                      ))}
                    </span>
                  </Link>
                );
              })}
              <p className="text-label-sm text-faint">Green: every habit done. Yellow: some. Red: none. Today stays open until it ends.</p>
            </Card>
          </section>
        )}

        {/* Struggles */}
        <section className="flex flex-col gap-3">
          <SectionHeader
            icon="troubleshoot"
            iconClass="text-warn"
            title="Struggles"
            badge={
              struggleList.length > 0 ? (
                <span className="rounded-full bg-miss/15 px-2 py-0.5 text-label-md font-semibold text-miss-ink">
                  {struggleList.length} below {Math.round(STRUGGLE_RATE * 100)}%
                </span>
              ) : null
            }
          />
          {struggleList.length === 0 ? (
            <Card>
              <p className="text-body-md text-muted">
                {enoughResults
                  ? `Every habit is at ${Math.round(STRUGGLE_RATE * 100)}% or better. Nothing to flag.`
                  : `Not enough results yet. A habit needs ${MIN_RESOLVED} finished days in this range to be judged.`}
              </p>
            </Card>
          ) : (
            struggleList.map((s) => {
              const cat = categories.find((c) => c.id === s.target.categoryId) ?? null;
              return (
                <Link
                  key={s.target.id}
                  to={`/goals/${s.target.id}`}
                  className="flex flex-col gap-2.5 rounded-xl border border-warn/40 bg-warn/5 p-4 shadow-card hover:border-warn"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <div className={cx('flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-text', catSoft(cat))}>
                        <Icon name={isIconName(s.target.icon) ? s.target.icon : 'check_circle'} />
                      </div>
                      <div className="min-w-0">
                        <h3 className="truncate text-headline-sm font-semibold">{s.target.name}</h3>
                        <p className="truncate text-body-sm text-muted">
                          {s.hits} of {s.resolved} done{routineOf(s.target) ? ` · ${routineOf(s.target)!.name}` : ''}
                        </p>
                      </div>
                    </div>
                    <span className="shrink-0 rounded-full bg-miss/15 px-2 py-0.5 text-label-md font-semibold text-miss-ink">
                      {pct(s.rate)}
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-warn/20">
                    <div className="h-full rounded-full bg-warn" style={{ width: `${s.rate * 100}%` }} />
                  </div>
                  <p className="flex items-start gap-1.5 rounded-lg bg-surface p-2.5 text-body-sm">
                    <Icon name="error" size={16} className="mt-0.5 text-warn-ink" />
                    {missPattern(s.clusterDays) === 'days' ? (
                      <span>
                        <strong className="font-semibold text-warn-ink">Pattern:</strong> misses cluster on{' '}
                        {joinWords(s.clusterDays.map((d) => `${weekdayLong(d)}s`))} (last 8 weeks). Moving those days may help.
                      </span>
                    ) : missPattern(s.clusterDays) === 'most' ? (
                      <span>
                        <strong className="font-semibold text-warn-ink">Missed on most days:</strong> the habit needs a change (time,
                        length, or size), not the day.
                      </span>
                    ) : (
                      <span>
                        <strong className="font-semibold text-warn-ink">No weekday pattern:</strong> misses are spread out.
                      </span>
                    )}
                  </p>
                </Link>
              );
            })
          )}
        </section>

        {/* Wins */}
        <section className="flex flex-col gap-2">
          <SectionHeader icon="workspace_premium" iconClass="text-hit-ink" title="Wins" />
          {winList.length === 0 ? (
            <Card>
              <p className="text-body-md text-muted">No perfect habits yet in this range.</p>
            </Card>
          ) : (
            winList.map((w) => (
              <Link
                key={w.target.id}
                to={`/goals/${w.target.id}`}
                className="flex items-center justify-between gap-2 rounded-lg border border-border bg-surface p-2.5 shadow-card hover:border-faint"
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-hit/15 text-hit-ink">
                    <Icon name={isIconName(w.target.icon) ? w.target.icon : 'check_circle'} size={18} />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-body-md font-semibold">{w.target.name}</p>
                    <p className="truncate text-body-sm text-muted">
                      {w.kind === 'perfect' ? `${w.hits} of ${w.hits} done` : `${w.streak} in a row`}
                      {routineOf(w.target) ? ` · ${routineOf(w.target)!.name}` : ''}
                    </p>
                  </div>
                </div>
                <span className="flex shrink-0 items-center gap-1 rounded-full bg-hit/15 px-2.5 py-1 text-label-md font-bold text-hit-ink">
                  {w.streak >= 7 && <Icon name="local_fire_department" size={15} className="text-warn" />}
                  {w.streak >= 7 ? `${w.streak}` : '100%'}
                </span>
              </Link>
            ))
          )}
        </section>

        {/* Category balance */}
        <Card>
          <div className="flex items-start justify-between gap-2">
            <div className="flex flex-col">
              <h2 className="text-headline-md font-semibold">Category balance</h2>
              <span className="text-body-sm text-muted">
                {balance.totalMinutes === 0
                  ? 'Where your completed habits went'
                  : balanceBy === 'minutes'
                    ? `Across ${formatDuration(balance.totalMinutes)} of completed time`
                    : `Across ${balance.totalMinutes} completed habit${balance.totalMinutes === 1 ? '' : 's'}`}
              </span>
            </div>
            <div className="w-32 shrink-0">
              <SegmentedControl<'minutes' | 'count'>
                label="Measure"
                value={balanceBy}
                onChange={setBalanceBy}
                options={[
                  { value: 'minutes', label: 'Time' },
                  { value: 'count', label: 'Done' },
                ]}
              />
            </div>
          </div>
          {balance.slices.length === 0 ? (
            <p className="text-body-md text-muted">
              {balanceBy === 'minutes'
                ? 'Nothing timed completed yet in this range. Quick habits count under Done.'
                : 'Nothing completed yet in this range.'}
            </p>
          ) : (
          <div className="flex items-center gap-4">
            <Donut
              slices={balance.slices.map((s) => ({
                key: s.category?.id ?? 'none',
                share: s.share,
                color: catVar(s.category),
                label: s.category?.name ?? 'Uncategorized',
              }))}
            >
              <span className="font-display text-headline-lg font-bold leading-none">{balance.slices.length}</span>
              <span className="text-[10px] font-bold uppercase text-faint">Areas</span>
            </Donut>
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              {balance.slices.map((s) => (
                <div key={s.category?.id ?? 'none'} className="flex flex-col">
                  <div className="flex items-center justify-between text-label-md">
                    <span className="flex min-w-0 items-center gap-1.5">
                      <span className={cx('h-2 w-2 shrink-0 rounded-full', catBg(s.category))} />
                      <span className="truncate text-muted">{s.category?.name ?? 'Uncategorized'}</span>
                    </span>
                    <span className="font-bold">{Math.round(s.share * 100)}%</span>
                  </div>
                  <div className="mt-0.5 h-1.5 overflow-hidden rounded-full bg-surface-3">
                    <div className={cx('h-full rounded-full', catBg(s.category))} style={{ width: `${s.share * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
          )}
          {balanceBy === 'minutes' && balance.slices.length > 0 && (
            <p className="text-label-sm text-faint">Quick habits take no time, so they only count under Done.</p>
          )}
        </Card>
      </div>
    </Page>
  );
}

function OnTimeCard({
  icon,
  label,
  anchor,
  stats,
  prev,
  tone,
}: {
  icon: 'wb_sunny' | 'nightlight';
  label: string;
  anchor: Minutes;
  stats: OnTime;
  prev: OnTime;
  tone: 'hit' | 'primary';
}) {
  const delta = stats.rate !== null && prev.rate !== null ? Math.round((stats.rate - prev.rate) * 100) : null;
  return (
    <div className="flex flex-col justify-between gap-3 rounded-xl border border-border bg-surface p-3.5 shadow-card">
      <div className="flex items-start justify-between">
        <div className={cx('flex h-8 w-8 items-center justify-center rounded-full', tone === 'hit' ? 'bg-hit/15 text-hit-ink' : 'bg-primary/15 text-primary-ink')}>
          <Icon name={icon} size={18} />
        </div>
        {delta !== null && (
          <span className={cx('rounded-full px-1.5 py-0.5 text-label-sm font-semibold', delta >= 0 ? 'bg-hit/15 text-hit-ink' : 'bg-miss/15 text-miss-ink')}>
            {delta >= 0 ? '+' : ''}
            {delta} pts
          </span>
        )}
      </div>
      <div>
        <span className="block text-label-sm font-bold uppercase text-faint">{label}</span>
        {stats.logged === 0 ? (
          <p className="mt-1 text-body-sm text-muted">
            No logs yet. Tap <strong className="font-semibold text-text">{icon === 'wb_sunny' ? 'Woke' : 'Slept'}</strong> on Today.
          </p>
        ) : (
          <div className="mt-0.5 flex items-baseline gap-1.5">
            <span className="font-display text-metric font-bold">{pct(stats.rate)}</span>
            <span className="text-body-sm text-muted">
              {stats.onTime} of {stats.logged} day{stats.logged === 1 ? '' : 's'}
            </span>
          </div>
        )}
        <p className="mt-1 text-body-sm text-muted">
          Anchor <span className="font-semibold text-text">{formatTime(anchor)}</span>
        </p>
      </div>
    </div>
  );
}

function SectionHeader({ icon, title, badge, iconClass = 'text-primary' }: { icon: 'bedtime' | 'troubleshoot' | 'workspace_premium' | 'event_repeat'; title: string; badge?: ReactNode; iconClass?: string }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-1.5">
        <Icon name={icon} filled className={iconClass} />
        <h2 className="text-headline-md font-semibold">{title}</h2>
      </div>
      {badge}
    </div>
  );
}

function Card({ children }: { children: ReactNode }) {
  return <section className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4 shadow-card">{children}</section>;
}

function Legend({ color, children }: { color: string; children: ReactNode }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={cx('h-2.5 w-2.5 rounded-full', color)} />
      {children}
    </span>
  );
}

function joinWords(words: string[]): string {
  if (words.length <= 1) return words.join('');
  return `${words.slice(0, -1).join(', ')} and ${words.at(-1)}`;
}
