import { formatPeriod, type Period, type Scope } from '../domain/time';
import { Icon } from './Icon';
import { SegmentedControl } from './SegmentedControl';

export const SCOPES: { value: Scope; label: string }[] = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'yearly', label: 'Yearly' },
];

/**
 * Scope switch plus arrows to step back through past periods (offset 0 = the current one;
 * the future is never shown). Used by the Habits tab and every history view.
 */
export function PeriodNav({
  scope,
  offset,
  period,
  onChange,
}: {
  scope: Scope;
  offset: number;
  period: Period;
  onChange: (scope: Scope, offset: number) => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <SegmentedControl label="Scope" value={scope} options={SCOPES} onChange={(s) => onChange(s, 0)} />
      <div className="flex items-center justify-between">
        <button
          type="button"
          aria-label="Previous period"
          onClick={() => onChange(scope, offset - 1)}
          className="rounded-full p-1 text-faint hover:bg-surface-2 hover:text-text"
        >
          <Icon name="chevron_left" />
        </button>
        <span className="text-label-lg font-semibold">{formatPeriod(period)}</span>
        <button
          type="button"
          aria-label="Next period"
          disabled={offset === 0}
          onClick={() => onChange(scope, offset + 1)}
          className="rounded-full p-1 text-faint hover:bg-surface-2 hover:text-text disabled:opacity-30"
        >
          <Icon name="chevron_right" />
        </button>
      </div>
    </div>
  );
}
