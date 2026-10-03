import type { BlockStatus } from '../domain/types';
import { cx } from './cx';
import { Icon } from './Icon';

/** Visible size of every check circle in the app (blocks, routine checklists), in px. */
export const CHECK_SIZE = 18;

/**
 * One-tap complete. The same 18px circle everywhere: an empty ring, or filled green with a check.
 * The tap area around it is 32px, so it stays easy to hit.
 */
export function CheckButton({
  status,
  onToggle,
  title,
}: {
  status: BlockStatus;
  onToggle: () => void;
  title: string;
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
      className="group flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-transform active:scale-90"
    >
      <span
        className={cx(
          'flex items-center justify-center rounded-full',
          done ? 'bg-hit text-on-primary' : 'border-2 border-faint group-hover:border-primary',
        )}
        style={{ width: CHECK_SIZE, height: CHECK_SIZE }}
      >
        {done && <Icon name="check" size={12} />}
      </span>
    </button>
  );
}
