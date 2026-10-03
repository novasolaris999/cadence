import { useEffect, useRef } from 'react';
import { Outlet, useMatches } from 'react-router';
import { AppHeader } from './components/AppHeader';
import { TabBar } from './components/TabBar';
import { Toaster } from './components/Toaster';
import { useAuth } from './data/auth';
import { useDemoMode } from './data/index';
import { useSettings, useSetup, useUpdateSettings } from './data/queries';
import { SignInScreen } from './routes/auth/SignInScreen';
import { useTheme } from './theme/ThemeProvider';

/**
 * App shell: sign-in gate, first-run setup, then the fixed header and tab bar around the
 * current screen.
 */
export function App() {
  const auth = useAuth();
  const demo = useDemoMode();
  const ready = auth.status === 'signedIn' || auth.status === 'demo';
  const setup = useSetup(ready);
  const matches = useMatches();
  const title =
    [...matches].reverse().map((m) => (m.handle as { title?: string } | undefined)?.title).find(Boolean) ??
    'Cadence';

  if (auth.status === 'loading') return <Splash />;
  if (auth.status === 'signedOut') return <SignInScreen />;
  if (setup.isError) return <Splash message={`Could not load your data: ${setup.error.message}`} onRetry={() => setup.refetch()} />;
  if (!setup.data) return <Splash />;

  return (
    <div className="min-h-dvh">
      <ThemeSync />
      <AppHeader subtitle={title} />
      {/* Keyed by mode: switching demo mode rebuilds every screen, so each reads from the new source. */}
      <main key={demo ? 'demo' : 'real'} className="pt-[calc(3.5rem+env(safe-area-inset-top,0px))] pb-[calc(4rem+env(safe-area-inset-bottom,0px))]">
        <Outlet />
      </main>
      <TabBar />
      <Toaster />
    </div>
  );
}

/**
 * Keeps the theme choice in your real settings so it follows you across devices.
 * On first load the saved choice is applied once; after that, only changes you make are saved.
 * Demo mode is skipped entirely: its sample settings never touch your theme.
 */
function ThemeSync() {
  const { pref, setPref } = useTheme();
  const demo = useDemoMode();
  const { data: settings } = useSettings();
  const update = useUpdateSettings();
  const adopted = useRef(false);
  const lastSaved = useRef(pref);

  // Apply the saved choice once, from real settings.
  useEffect(() => {
    if (demo || !settings || adopted.current) return;
    adopted.current = true;
    lastSaved.current = settings.theme;
    if (settings.theme !== pref) setPref(settings.theme);
  }, [settings, demo]);

  // Save when you change it (not when the server and this device merely disagree).
  useEffect(() => {
    if (demo || !adopted.current || pref === lastSaved.current) return;
    lastSaved.current = pref;
    update.mutate({ theme: pref });
  }, [pref, demo]);

  return null;
}

function Splash({ message, onRetry }: { message?: string; onRetry?: () => void }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-bg px-6 text-center">
      <img src="/logo.svg" alt="" className={message ? 'h-10 w-10' : 'h-10 w-10 animate-pulse'} />
      {message && <p className="max-w-sm text-body-md text-muted">{message}</p>}
      {onRetry && (
        <button onClick={onRetry} className="rounded-full bg-primary px-4 py-2 text-label-lg font-semibold text-on-primary">
          Try again
        </button>
      )}
    </div>
  );
}
