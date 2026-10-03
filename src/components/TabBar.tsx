import { NavLink } from 'react-router';
import { cx } from './cx';
import { Icon, type IconName } from './Icon';

const TABS: { to: string; label: string; icon: IconName }[] = [
  { to: '/today', label: 'Today', icon: 'view_day' },
  { to: '/weekly', label: 'Weekly', icon: 'calendar_view_week' },
  { to: '/goals', label: 'Goals', icon: 'grid_view' },
  { to: '/insights', label: 'Insights', icon: 'monitoring' },
];

export function TabBar() {
  return (
    <nav
      aria-label="Main"
      className="pb-safe fixed inset-x-0 bottom-0 z-50 border-t border-border/60 bg-bg/90 backdrop-blur-xl"
    >
      <div className="mx-auto flex h-16 max-w-xl items-center justify-around px-2">
        {TABS.map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            className={({ isActive }) =>
              cx(
                'flex min-h-11 min-w-16 flex-col items-center justify-center gap-0.5 transition-colors',
                isActive ? 'text-primary' : 'text-faint hover:text-text',
              )
            }
          >
            {({ isActive }) => (
              <>
                <Icon name={t.icon} size={22} filled={isActive} />
                <span className="text-label-sm uppercase tracking-wide">{t.label}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
