import type { BlockStatus } from '../domain/types';
import { cx } from './cx';
import { Icon } from './Icon';

/** One-tap complete. Filled check when done; empty ring otherwise. */
export function CheckButton({
  status,
  onToggle,
  title,
  size = 24,
}: {
  status: BlockStatus;
  onToggle: () => void;
  title: string;
  size?: number;
}) {
  const done = status === 'done';
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      aria-pressed={done}
      aria-label={done ? `Mark ${title} not done` : `Mark ${title} done`}
      className={cx(
        'flex shrink-0 items-center justify-center rounded-full transition-transform active:scale-90',
        done ? 'text-hit' : 'text-faint hover:text-primary',
      )}
      style={{ width: size + 8, height: size + 8 }}
    >
      {done ? (
        <Icon name="check_circle" filled size={size} />
      ) : (
        <span className="rounded-full border-2 border-current" style={{ width: size - 4, height: size - 4 }} />
      )}
    </button>
  );
}
