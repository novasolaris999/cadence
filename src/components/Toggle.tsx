import { cx } from './cx';

interface Props {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}

/** On/off switch (targets-light.html style). */
export function Toggle({ checked, onChange, label }: Props) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cx(
        'flex h-6 w-11 shrink-0 items-center rounded-full px-0.5 transition-colors',
        checked ? 'bg-hit' : 'bg-surface-3',
      )}
    >
      <span
        className={cx(
          'h-5 w-5 rounded-full bg-white shadow-md transition-transform',
          checked ? 'translate-x-5' : 'translate-x-0',
        )}
      />
    </button>
  );
}
