import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { MutationCache, QueryClient, onlineManager } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { OFFLINE_CACHE_VERSION, OFFLINE_MAX_AGE, offlinePersister, shouldKeepMutation, shouldKeepQuery } from './data/offlineCache';
import { registerOfflineSaves } from './data/queries';
import { toast } from './components/Toaster';
import { RouterProvider } from 'react-router';
import '@fontsource-variable/inter';
import '@fontsource-variable/plus-jakarta-sans';
import './styles/index.css';
import { AuthProvider } from './data/auth';
import { router } from './router';
import './pwa/install'; // catches Chrome's install offer at startup, for Settings > Install app
import { ThemeProvider } from './theme/ThemeProvider';

const queryClient = new QueryClient({
  // gcTime must be at least the offline copy's age, or restored data would be dropped right away.
  defaultOptions: { queries: { staleTime: 30_000, refetchOnWindowFocus: true, gcTime: OFFLINE_MAX_AGE } },
  // Any save that fails (offline, server error) is undone on screen and explained here.
  mutationCache: new MutationCache({
    onError: (error) =>
      toast(
        navigator.onLine
          ? `Could not save: ${error instanceof Error ? error.message : 'unknown error'}`
          : 'You are offline, so that change was not saved.',
      ),
  }),
});

// TanStack Query assumes it starts online and only listens for changes. Opened with no signal, it would
// try to send waiting saves at once, fail, and drop them; so start from the device's real state.
onlineManager.setOnline(navigator.onLine);

// Saves made offline wait on the device; these say how to send them after a restart.
registerOfflineSaves(queryClient);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      {/* Restores the offline copy of recent data on start, and keeps it current (src/data/offlineCache.ts). */}
      <PersistQueryClientProvider
        client={queryClient}
        persistOptions={{
          persister: offlinePersister,
          maxAge: OFFLINE_MAX_AGE,
          buster: OFFLINE_CACHE_VERSION,
          dehydrateOptions: { shouldDehydrateQuery: shouldKeepQuery, shouldDehydrateMutation: shouldKeepMutation },
        }}
        // Send any saves that were waiting when the app was last closed.
        onSuccess={() => queryClient.resumePausedMutations()}
      >
        <AuthProvider>
          <RouterProvider router={router} />
        </AuthProvider>
      </PersistQueryClientProvider>
    </ThemeProvider>
  </StrictMode>,
);
