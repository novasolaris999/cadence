import { cx } from './cx';
import { Icon } from './Icon';

/** Floating + button. With `expanded` it turns into a close (×) for the speed dial it opened. */
export function Fab({
  onClick,
  label,
  expanded,
  controls,
}: {
  onClick?: () => void;
  label: string;
  expanded?: boolean;
  /** Id of the menu it opens, for screen readers. */
  controls?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-expanded={expanded}
      aria-controls={controls}
      className={cx(
        'fixed right-4 bottom-[calc(5rem+env(safe-area-inset-bottom,0px))] flex h-12 w-12 items-center justify-center rounded-full bg-primary text-on-primary shadow-float transition-transform active:scale-90 lg:right-[max(1rem,calc(50%-18rem))]',
        // Above its speed dial's scrim while open; otherwise below the tab bar and dragged cards, as before.
        expanded ? 'z-[56]' : 'z-40',
      )}
    >
      <Icon name="add" size={24} className={cx('transition-transform duration-200 motion-reduce:transition-none', expanded && 'rotate-45')} />
    </button>
  );
}
