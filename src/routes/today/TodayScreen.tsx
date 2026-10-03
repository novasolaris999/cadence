import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { BlockSheet, type BlockSheetMode } from '../../components/BlockSheet';
import { Fab } from '../../components/Fab';
import { Icon } from '../../components/Icon';
import { MoveScopeSheet, type PendingMove } from '../../components/MoveScopeSheet';
import { Page } from '../../components/Page';
import { useBlockViews, type BlockView } from '../../components/blockView';
import { usePersistentToggle } from '../../components/usePersistentToggle';
import { useBlocks, useDayLogs, useSettings, useToggleBlockDone, useUpdateBlock } from '../../data/queries';
import { dayProgress } from '../../domain/metrics';
import { formatDayShort, formatTime } from '../../domain/time';
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

  const { data: settings } = useSettings();
  const { data: blocks } = useBlocks(date, date);
  const { data: logs = [] } = useDayLogs(date, date);
  const toggle = useToggleBlockDone();
  const update = useUpdateBlock();
  const views = useBlockViews(blocks);
  const progress = dayProgress(blocks ?? []);
  const log = logs[0];

  const [showEarly, setShowEarly] = usePersistentToggle('cadence.timeline.showEarly');
  const [showLate, setShowLate] = usePersistentToggle('cadence.timeline.showLate');
  const [sheet, setSheet] = useState<BlockSheetMode | null>(null);
  const [pending, setPending] = useState<PendingMove | null>(null);

  // While the scope question is open, show the block at its new time.
  const shown = useMemo(
    () =>
      pending
        ? views.map((v) => (v.block.id === pending.block.id ? { ...v, block: { ...v.block, start: pending.newStart } } : v))
        : views,
    [views, pending],
  );

  /** Target blocks still planned ask how far the move reaches; anything else just moves. */
  const requestMove = (view: Pick<BlockView, 'block' | 'target'>, newStart: Minutes) => {
    if (view.target && view.block.status === 'planned') {
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

      <LogChip icon="wb_sunny" label="Woke" value={log?.wake ?? null} />

      {settings && (
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
            const block = blocks?.find((b) => b.id === id);
            if (block) toggle.mutate({ block });
          }}
          onOpen={(view) => setSheet({ kind: 'edit', view })}
          onAddAt={(start) => setSheet({ kind: 'add', date, start })}
          onDrop={requestMove}
        />
      )}

      <LogChip icon="bedtime" label="Slept" value={log?.sleep ?? null} />

      <Fab label="Add block" onClick={() => setSheet({ kind: 'add', date, start: nextSlot() })} />

      <BlockSheet
        mode={sheet}
        onClose={() => setSheet(null)}
        onMove={(block: Block, newStart) => requestMove({ block, target: views.find((v) => v.block.id === block.id)?.target ?? null }, newStart)}
      />
      <MoveScopeSheet pending={pending} onDone={() => setPending(null)} />
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
