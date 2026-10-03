import { useMemo, useState } from 'react';
import { cx } from '../../components/cx';
import type { BlockView } from '../../components/blockView';
import { formatDuration, formatTime } from '../../domain/time';
import type { Minutes } from '../../domain/types';
import { daySpan, lanes, periodOf, segments, SLOT } from './layout';
import { TimelineBlock } from './TimelineBlock';

const ROW = 32; // px per 15-minute slot
const PX = ROW / SLOT; // px per minute
const GUTTER = 52; // px reserved for time labels

interface Props {
  views: BlockView[];
  wakeAnchor: Minutes;
  sleepAnchor: Minutes;
  /** Current minute when showing today, otherwise null (no now line). */
  now: Minutes | null;
  /** True when the day shown is in the past: unfinished blocks there are misses. */
  past: boolean;
  onToggle: (id: string) => void;
}

/** Vertical day timeline in 15-minute rows, with long empty stretches collapsed. */
export function Timeline({ views, wakeAnchor, sleepAnchor, now, past, onToggle }: Props) {
  const [expanded, setExpanded] = useState<Set<Minutes>>(new Set());
  const blocks = useMemo(() => views.map((v) => v.block), [views]);
  const span = useMemo(() => daySpan(blocks, wakeAnchor, sleepAnchor), [blocks, wakeAnchor, sleepAnchor]);
  const nowInSpan = now !== null && now >= span.from && now < span.to ? now : null;
  const segs = useMemo(() => segments(blocks, span, nowInSpan, expanded), [blocks, span, nowInSpan, expanded]);
  const laneMap = useMemo(() => lanes(blocks), [blocks]);

  return (
    <div className="rounded-xl bg-surface p-2 shadow-card">
      {segs.map((seg, i) => {
        if (seg.kind === 'gap') {
          return (
            <button
              key={`gap-${seg.from}`}
              type="button"
              onClick={() => setExpanded((s) => new Set(s).add(seg.from))}
              className="my-1 flex w-full items-center gap-2 py-2 text-faint hover:text-muted"
              aria-label={`Show free time ${formatTime(seg.from)} to ${formatTime(seg.to)}`}
            >
              <span className="h-px flex-1 bg-border" />
              <span className="font-mono text-label-sm uppercase tracking-wider">
                Free · {formatDuration(seg.to - seg.from)}
              </span>
              <span className="h-px flex-1 bg-border" />
            </button>
          );
        }

        const rows: Minutes[] = [];
        for (let m = seg.from; m < seg.to; m += SLOT) rows.push(m);
        const inSeg = views.filter((v) => v.block.start >= seg.from && v.block.start < seg.to);
        const showHeader = i === 0 || segs[i - 1]?.kind === 'gap';

        return (
          <div key={`rows-${seg.from}`}>
            {showHeader && (
              <div className="px-1 py-1 font-mono text-label-sm uppercase tracking-wider text-faint">
                {formatTime(seg.from)} · {periodOf(seg.from)}
              </div>
            )}
            <div className="relative" style={{ height: rows.length * ROW }}>
              {rows.map((m) => (
                <div key={m} className="absolute inset-x-0 grid items-center" style={{ top: (m - seg.from) * PX, height: ROW, gridTemplateColumns: `${GUTTER - 4}px 1fr` }}>
                  <span
                    className={cx(
                      'font-mono text-label-sm',
                      m % 60 === 0 ? 'text-text' : 'text-faint/70',
                      nowInSpan !== null && Math.abs(nowInSpan - (m + SLOT / 2)) < 12 && 'invisible',
                    )}
                  >
                    {formatTime(m)}
                  </span>
                  <span className={cx('h-px w-full', m % 60 === 0 ? 'bg-border' : 'bg-border/50')} />
                </div>
              ))}

              {inSeg.map((v) => {
                const { lane, of } = laneMap.get(v.block.id) ?? { lane: 0, of: 1 };
                const end = v.block.start + v.block.durationMin;
                const nowIn = now !== null && now >= v.block.start && now < end ? now : null;
                return (
                  <div
                    key={v.block.id}
                    className="absolute z-10 p-0.5"
                    style={{
                      top: (v.block.start - seg.from) * PX,
                      height: v.block.durationMin * PX,
                      left: `calc(${GUTTER}px + (100% - ${GUTTER + 4}px) * ${lane / of})`,
                      width: `calc((100% - ${GUTTER + 4}px) / ${of})`,
                    }}
                  >
                    <TimelineBlock view={v} nowInBlock={nowIn} missed={past && v.block.status === 'planned'} onToggle={() => onToggle(v.block.id)} />
                  </div>
                );
              })}

              {nowInSpan !== null && nowInSpan >= seg.from && nowInSpan < seg.to && (
                <div
                  className="pointer-events-none absolute inset-x-0 z-20 grid items-center"
                  style={{ top: (nowInSpan - seg.from) * PX - 1, gridTemplateColumns: `${GUTTER - 4}px 1fr` }}
                  aria-label={`Now, ${formatTime(nowInSpan)}`}
                >
                  <span className="font-mono text-label-sm font-bold text-now">{formatTime(nowInSpan)}</span>
                  <div className="relative flex h-0.5 items-center bg-now">
                    <span className="absolute -left-1.5 h-3 w-3 rounded-full bg-now" />
                    <span className="ml-auto rounded-full bg-now px-1.5 font-mono text-[10px] font-semibold text-white">NOW</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
