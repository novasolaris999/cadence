import { useMemo, useState, type ReactNode } from 'react';
import { cx } from '../../components/cx';
import { catBg, catSoft, catVar } from '../../components/categoryColor';
import { Icon, isIconName } from '../../components/Icon';
import { Page } from '../../components/Page';
import { SegmentedControl } from '../../components/SegmentedControl';
import { Donut } from '../../charts/Donut';
import { RegularityChart } from '../../charts/RegularityChart';
import { useBlocks, useCategories, useDayLogs, useSettings, useTargets } from '../../data/queries';
import {
  categoryBalance,
  lateNights,
  onTimeStats,
  STRUGGLE_RATE,
  struggles,
  wakeDrift,
  wins,
  type OnTime,
} from '../../domain/insights';
import { pct } from '../../domain/metrics';
import {
  addDays,
  daysBetween,
  formatDuration,
  formatTime,
  isoWeekday,
  periodContaining,
  weekDates,
  weekdayLong,
  weekdayShort,
} from '../../domain/time';
import type { Minutes } from '../../domain/types';
import { useNow } from '../../theme/useNow';

type Range = 'week' | 'month';

/** Insights: sleep/wake regularity, struggles, wins, and category balance (insights-light.html). */
export function InsightsScreen() {
  const now = useNow();
  const [range, setRange] = useState<Range>('week');
  const period = periodContaining(range === 'week' ? 'weekly' : 'monthly', now.today);
  const to = period.to < now.today ? period.to : now.today; // only days that have happened
  const days = daysBetween(period.from, to) + 1;
  const prevFrom = addDays(period.from, -days);
  const prevTo = addDays(period.from, -1);

  const { data: settings } = useSettings();
  const { data: targets = [] } = useTargets();
  const { data: categories = [] } = useCategories();
  const { data: logs = [] } = useDayLogs(prevFrom, to);
  const { data: blocks = [] } = useBlocks(addDays(now.today, -366), now.today);

  const periodBlocks = useMemo(() => blocks.filter((b) => b.date >= period.from && b.date <= to), [blocks, period.from, to]);
  const periodLogs = logs.filter((l) => l.date >= period.from);
  const prevLogs = logs.filter((l) => l.date <= prevTo);
  const active = targets.filter((t) => t.active);
  const week = weekDates(now.today);

  if (!settings) return null;

  const wake = onTimeStats(periodLogs, settings, 'wake');
  const sleep = onTimeStats(periodLogs, settings, 'sleep');
  const wakePrev = onTimeStats(prevLogs, settings, 'wake');
  const sleepPrev = onTimeStats(prevLogs, settings, 'sleep');
  const weekLogs = logs.filter((l) => week.includes(l.date));
  const drift = wakeDrift(weekLogs);
  const late = lateNights(weekLogs, settings);
  const struggleList = struggles(active, periodBlocks, blocks, now.today);
  const winList = wins(active, periodBlocks, blocks, now.today);
  const balance = categoryBalance(periodBlocks, targets, categories);

  return (
    <Page>
      <div className="flex flex-col gap-6">
        <section className="flex flex-col gap-2">
          <span className="text-label-sm font-bold uppercase tracking-wider text-hit-ink">
            {range === 'week' ? 'This week' : 'This month'} so far
          </span>
          <h1 className="text-headline-lg font-bold">Cadence check</h1>
          <SegmentedControl<Range>
            label="Range"
            value={range}
            onChange={setRange}
            options={[
              { value: 'week', label: 'This week' },
              { value: 'month', label: 'This month' },
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
                {drift === null ? 'Not enough data' : `Wake drift ±${drift} min`}
              </span>
              {late.length > 0 && (
                <span className="font-medium text-miss-ink">
                  {late.length} late night{late.length > 1 ? 's' : ''} ({late.map((d) => weekdayShort(isoWeekday(d))).join(', ')})
                </span>
              )}
            </div>
          </Card>
        </section>

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
              <p className="text-body-md text-muted">Every target is at {Math.round(STRUGGLE_RATE * 100)}% or better. Nothing to flag.</p>
            </Card>
          ) : (
            struggleList.map((s) => {
              const cat = categories.find((c) => c.id === s.target.categoryId) ?? null;
              return (
                <div key={s.target.id} className="flex flex-col gap-2.5 rounded-xl border border-warn/40 bg-warn/5 p-4 shadow-card">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <div className={cx('flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-text', catSoft(cat))}>
                        <Icon name={isIconName(s.target.icon) ? s.target.icon : 'check_circle'} />
                      </div>
                      <div className="min-w-0">
                        <h3 className="truncate text-headline-sm font-semibold">{s.target.name}</h3>
                        <p className="text-body-sm text-muted">{s.hits} of {s.resolved} done</p>
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
                    {s.clusterDays.length > 0 ? (
                      <span>
                        <strong className="font-semibold text-warn-ink">Pattern:</strong> misses cluster on{' '}
                        {joinWords(s.clusterDays.map((d) => `${weekdayLong(d)}s`))} (last 8 weeks).
                      </span>
                    ) : (
                      <span>
                        <strong className="font-semibold text-warn-ink">No weekday pattern:</strong> misses are spread out.
                      </span>
                    )}
                  </p>
                </div>
              );
            })
          )}
        </section>

        {/* Wins */}
        <section className="flex flex-col gap-2">
          <SectionHeader icon="workspace_premium" iconClass="text-hit-ink" title="Wins" />
          {winList.length === 0 ? (
            <Card>
              <p className="text-body-md text-muted">No perfect targets yet in this range.</p>
            </Card>
          ) : (
            winList.map((w) => (
              <div key={w.target.id} className="flex items-center justify-between gap-2 rounded-lg border border-border bg-surface p-2.5 shadow-card">
                <div className="flex min-w-0 items-center gap-2.5">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-hit/15 text-hit-ink">
                    <Icon name={isIconName(w.target.icon) ? w.target.icon : 'check_circle'} size={18} />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-body-md font-semibold">{w.target.name}</p>
                    <p className="text-body-sm text-muted">
                      {w.kind === 'perfect' ? `${w.hits} of ${w.hits} done` : `${w.streak} in a row`}
                    </p>
                  </div>
                </div>
                <span className="flex shrink-0 items-center gap-1 rounded-full bg-hit/15 px-2.5 py-1 text-label-md font-bold text-hit-ink">
                  {w.streak >= 7 && <Icon name="local_fire_department" size={15} className="text-warn" />}
                  {w.streak >= 7 ? `${w.streak}` : '100%'}
                </span>
              </div>
            ))
          )}
        </section>

        {/* Category balance */}
        <Card>
          <div className="flex flex-col">
            <h2 className="text-headline-md font-semibold">Category balance</h2>
            <span className="text-body-sm text-muted">Across {formatDuration(balance.totalMinutes)} of completed blocks</span>
          </div>
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
        <div className="mt-0.5 flex items-baseline gap-1.5">
          <span className="font-display text-metric font-bold">{pct(stats.rate)}</span>
          <span className="text-body-sm text-muted">
            {stats.onTime} / {stats.logged} d
          </span>
        </div>
        <p className="mt-1 text-body-sm text-muted">
          Anchor <span className="font-semibold text-text">{formatTime(anchor)}</span>
        </p>
      </div>
    </div>
  );
}

function SectionHeader({ icon, title, badge, iconClass = 'text-primary' }: { icon: 'bedtime' | 'troubleshoot' | 'workspace_premium'; title: string; badge?: ReactNode; iconClass?: string }) {
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
