import { cx } from '../../components/cx';
import { Icon, type IconName } from '../../components/Icon';
import { Sheet } from '../../components/Sheet';
import { useRerunWeek } from '../../data/queries';
import type { RerunChange, RerunPlan } from '../../domain/schedule';
import { formatDayShort, formatTime } from '../../domain/time';
import type { ISODate, Target } from '../../domain/types';

const KIND: Record<RerunChange['kind'], { icon: IconName; verb: string; tone: string }> = {
  restore: { icon: 'add', verb: 'Restore', tone: 'bg-hit/15 text-hit-ink' },
  reset: { icon: 'schedule', verb: 'Back to its usual time', tone: 'bg-primary/10 text-primary-ink' },
  remove: { icon: 'close', verb: 'Remove', tone: 'bg-miss/15 text-miss-ink' },
};

/**
 * Re-run preview: shows exactly what will change before anything does.
 * `plan` is worked out from what is on screen; applying works it out again from fresh data.
 */
export function RerunSheet({
  open,
  plan,
  weekStart,
  targets,
  onClose,
}: {
  open: boolean;
  plan: RerunPlan;
  weekStart: ISODate;
  targets: Target[];
  onClose: () => void;
}) {
  const rerun = useRerunWeek();
  const name = (id: string) => targets.find((t) => t.id === id)?.name ?? 'Target';
  const n = plan.changes.length;

  return (
    <Sheet open={open} onClose={onClose} title="Re-run this week?">
      {n === 0 ? (
        <p className="text-body-md text-muted">Your week already matches your targets. Nothing to change.</p>
      ) : (
        <>
          <p className="-mt-1 mb-3 text-body-sm text-muted">
            {n} change{n === 1 ? '' : 's'} to bring the rest of the week back in line with your targets:
          </p>
          <ul className="flex max-h-[40vh] flex-col gap-1.5 overflow-y-auto">
            {plan.changes.map((c, i) => {
              const k = KIND[c.kind];
              return (
                <li key={i} className="flex items-center gap-2.5 rounded-xl border border-border bg-surface-2 px-3 py-2">
                  <span className={cx('flex h-7 w-7 shrink-0 items-center justify-center rounded-full', k.tone)}>
                    <Icon name={k.icon} size={16} />
                  </span>
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate text-label-lg font-semibold">
                      {name(c.targetId)}, {formatDayShort(c.date)} · {formatTime(c.start)}
                    </span>
                    <span className="text-body-sm text-muted">
                      {c.kind === 'reset' ? `${k.verb} (now ${formatTime(c.fromStart)})` : k.verb}
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
        </>
      )}
      <p className="mt-3 text-label-sm text-faint">
        {plan.keptMoved > 0 && `Kept as you set them: ${plan.keptMoved} moved by hand. `}
        Earlier days, done and skipped blocks, one-offs, and protected blocks never change.
      </p>
      <div className="mt-4 flex flex-col gap-2">
        {n > 0 && (
          <button
            type="button"
            onClick={() => rerun.mutate(weekStart, { onSuccess: onClose })}
            disabled={rerun.isPending}
            className="flex w-full items-center justify-center gap-1.5 rounded-full bg-primary py-3 text-label-lg font-semibold text-on-primary shadow-card active:scale-[0.98] disabled:opacity-60"
          >
            <Icon name="sync" size={18} /> {rerun.isPending ? 'Applying…' : `Apply ${n} change${n === 1 ? '' : 's'}`}
          </button>
        )}
        <button type="button" onClick={onClose} className="rounded-full py-2 text-label-lg font-semibold text-muted hover:text-text">
          {n > 0 ? 'Cancel' : 'Close'}
        </button>
      </div>
    </Sheet>
  );
}
