import { cx } from './cx';

interface Props<T extends string> {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  label: string;
  className?: string;
}

/** Pill switch used for Goals scope, Insights period, and the theme setting. */
export function SegmentedControl<T extends string>({ value, options, onChange, label, className }: Props<T>) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cx('flex w-full gap-1 rounded-full bg-sunken p-1 shadow-inner', className)}
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={cx(
              'flex-1 rounded-full px-2 py-1.5 text-label-sm font-semibold uppercase transition-colors',
              active ? 'bg-primary text-on-primary shadow-card' : 'text-muted hover:text-text',
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
