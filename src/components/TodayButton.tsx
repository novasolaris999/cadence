import { useLocation, useNavigate } from 'react-router';
import { formatDayShort } from '../domain/time';
import { useNow } from '../theme/useNow';

/**
 * In the top bar on every tab: a small calendar showing today's date. Tap it to open the Today tab on today.
 * Already there? It scrolls to the "now" line instead, so the current hour is always one tap away.
 */
export function TodayButton() {
  const now = useNow();
  const navigate = useNavigate();
  const location = useLocation();
  const onToday = location.pathname === '/today' && !new URLSearchParams(location.search).get('date');

  const go = () => {
    if (!onToday) {
      navigate('/today');
      window.scrollTo({ top: 0 });
      return;
    }
    const line = document.querySelector('[data-now-line]');
    if (line) line.scrollIntoView({ block: 'center', behavior: 'smooth' });
    else window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <button
      type="button"
      onClick={go}
      aria-label={`Go to today, ${formatDayShort(now.today)}`}
      title="Today"
      className="flex h-9 items-center gap-1.5 rounded-full bg-surface-2 px-1.5 text-text hover:bg-surface-3 sm:pr-3"
    >
      {/* A tiny calendar page: a colored top band and today's date number. */}
      <span aria-hidden className="flex h-6 w-6 flex-col overflow-hidden rounded-md border border-border bg-surface">
        <span className="h-1.5 shrink-0 bg-primary" />
        <span className="flex flex-1 items-center justify-center text-[11px] leading-none font-bold">{Number(now.today.slice(8))}</span>
      </span>
      <span className="hidden text-label-md font-semibold sm:inline">Today</span>
    </button>
  );
}
