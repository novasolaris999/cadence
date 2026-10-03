import { Icon } from './Icon';

/** Floating + button. Adding blocks is wired up in phase 3. */
export function Fab({ onClick, label }: { onClick?: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="fixed right-4 bottom-[calc(5rem+env(safe-area-inset-bottom,0px))] z-40 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-on-primary shadow-float transition-transform active:scale-90 lg:right-[max(1rem,calc(50%-18rem))]"
    >
      <Icon name="add" size={24} />
    </button>
  );
}
