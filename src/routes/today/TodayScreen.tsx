import { useSearchParams } from 'react-router';
import { Fab } from '../../components/Fab';
import { Icon } from '../../components/Icon';
import { Page } from '../../components/Page';
import { useBlockViews } from '../../components/blockView';
import { useBlocks, useDayLogs, useSettings, useToggleBlockDone } from '../../data/queries';
import { dayProgress } from '../../domain/metrics';
import { formatDayShort, formatTime } from '../../domain/time';
import type { ISODate, Minutes } from '../../domain/types';
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

  const { data: settings } = useSettings();
  const { data: blocks } = useBlocks(date, date);
  const { data: logs = [] } = useDayLogs(date, date);
  const toggle = useToggleBlockDone();
  const views = useBlockViews(blocks);
  const progress = dayProgress(blocks ?? []);
  const log = logs[0];

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

      <LogChip icon="wb_sunny" label="Woke" value={log?.wake ?? null} />

      {settings && (
        <Timeline
          views={views}
          wakeAnchor={settings.wakeAnchor}
          sleepAnchor={settings.sleepAnchor}
          now={isToday ? now.minutes : null}
          past={date < now.today}
          onToggle={(id) => toggle.mutate(id)}
        />
      )}

      <LogChip icon="bedtime" label="Slept" value={log?.sleep ?? null} />

      <Fab label="Add block" />
    </Page>
  );
}

/** Tap-to-log wake and sleep time. Logging is wired to the database in phase 3. */
function LogChip({ icon, label, value }: { icon: 'wb_sunny' | 'bedtime'; label: string; value: Minutes | null }) {
  return (
    <div className="my-2 flex justify-center">
      <button
        type="button"
        className="flex items-center gap-1.5 rounded-full border border-dashed border-border bg-surface px-3 py-1 text-label-md text-muted hover:text-text"
      >
        <Icon name={icon} size={16} className={icon === 'wb_sunny' ? 'text-warn' : 'text-primary'} />
        {label} {value === null ? '· tap to log' : formatTime(value)}
      </button>
    </div>
  );
}
