import type { DayLog, ISODate, Settings } from '../domain/types';
import { normalizeSleep } from '../domain/insights';
import { formatTime, isoWeekday, weekdayInitial } from '../domain/time';

interface Props {
  dates: ISODate[]; // 7 dates, oldest first (the last 7 days)
  logs: DayLog[];
  settings: Settings;
  today: ISODate;
}

const W = 320;
const H = 150;
/** Each band shows its anchor +/- this many minutes; values beyond are pinned to the edge. */
const RANGE = 120;
const WAKE_BAND = { top: 8, bottom: 58 };
const SLEEP_BAND = { top: 76, bottom: 126 };

/**
 * 7-day regularity, drawn as two zoomed bands instead of one 24-hour axis:
 * the top band is wake time around its anchor, the bottom band is bedtime around its anchor.
 * On a single full-day axis a 30-minute slip is a few pixels; zoomed bands make drift visible.
 * A thin line links each day's wake and bedtime. Off-corridor dots use warning colors.
 */
export function RegularityChart({ dates, logs, settings, today }: Props) {
  const byDate = new Map(logs.map((l) => [l.date, l]));
  const tol = settings.onTimeToleranceMin;
  const wakeA = settings.wakeAnchor;
  const sleepA = normalizeSleep(settings.sleepAnchor);
  const colW = (W - 36) / 7;
  const x = (i: number) => 36 + colW * i + colW / 2;
  const yIn = (band: { top: number; bottom: number }, anchor: number, v: number) => {
    const clamped = Math.max(anchor - RANGE, Math.min(anchor + RANGE, v));
    return band.top + ((clamped - (anchor - RANGE)) / (2 * RANGE)) * (band.bottom - band.top);
  };
  const yWake = (v: number) => yIn(WAKE_BAND, wakeA, v);
  const ySleep = (v: number) => yIn(SLEEP_BAND, sleepA, v);

  const corridor = (y: (v: number) => number, anchor: number, color: string, label: string) => (
    <g>
      <rect x={36} y={y(anchor - tol)} width={W - 36} height={y(anchor + tol) - y(anchor - tol)} rx={4} fill={color} opacity={0.12} />
      <line x1={36} x2={W} y1={y(anchor)} y2={y(anchor)} stroke={color} strokeDasharray="2 3" opacity={0.7} />
      <text x={0} y={y(anchor) + 3} fontSize={9} fill="var(--c-text-faint)">{label}</text>
      <text x={0} y={y(anchor) - 9} fontSize={8} fill="var(--c-text-faint)" opacity={0.7}>earlier</text>
      <text x={0} y={y(anchor) + 15} fontSize={8} fill="var(--c-text-faint)" opacity={0.7}>later</text>
    </g>
  );

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-40 w-full" role="img" aria-label="Wake and bedtimes over the last 7 days compared with your anchors">
      {corridor(yWake, wakeA, 'var(--c-hit)', formatTime(wakeA))}
      {corridor(ySleep, sleepA, 'var(--c-primary)', formatTime(sleepA))}

      {dates.map((d, i) => {
        const l = byDate.get(d);
        const wake = l?.wake ?? null;
        const sleep = l?.sleep != null ? normalizeSleep(l.sleep) : null;
        const wakeOk = wake !== null && Math.abs(wake - wakeA) <= tol;
        const sleepOk = sleep !== null && Math.abs(sleep - sleepA) <= tol;
        const isToday = d === today;
        return (
          <g key={d}>
            {wake !== null && sleep !== null && (
              <line x1={x(i)} x2={x(i)} y1={yWake(wake)} y2={ySleep(sleep)} stroke="var(--c-text-faint)" strokeWidth={1.5} opacity={0.35} />
            )}
            {wake !== null && (
              <circle cx={x(i)} cy={yWake(wake)} r={4.5} fill={wakeOk ? 'var(--c-hit)' : 'var(--c-warn)'} stroke="var(--c-surface)" strokeWidth={2}>
                <title>{`Woke ${formatTime(wake)}`}</title>
              </circle>
            )}
            {sleep !== null && (
              <circle cx={x(i)} cy={ySleep(sleep)} r={4.5} fill={sleepOk ? 'var(--c-primary)' : 'var(--c-miss)'} stroke="var(--c-surface)" strokeWidth={2}>
                <title>{`Slept ${formatTime(sleep)}`}</title>
              </circle>
            )}
            <text
              x={x(i)}
              y={H - 4}
              textAnchor="middle"
              fontSize={10}
              fontWeight={isToday ? 700 : 600}
              fill={isToday ? 'var(--c-primary)' : 'var(--c-text-muted)'}
            >
              {weekdayInitial(isoWeekday(d))}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
