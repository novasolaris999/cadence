import { Outlet, useMatches } from 'react-router';
import { AppHeader } from './components/AppHeader';
import { TabBar } from './components/TabBar';

/** App shell: fixed header and tab bar around the current screen. */
export function App() {
  const matches = useMatches();
  const title =
    [...matches].reverse().map((m) => (m.handle as { title?: string } | undefined)?.title).find(Boolean) ??
    'Cadence';
  return (
    <div className="min-h-dvh">
      <AppHeader subtitle={title} />
      <main className="pt-[calc(3.5rem+env(safe-area-inset-top,0px))] pb-[calc(4rem+env(safe-area-inset-bottom,0px))]">
        <Outlet />
      </main>
      <TabBar />
    </div>
  );
}
