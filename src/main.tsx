import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { MutationCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { toast } from './components/Toaster';
import { RouterProvider } from 'react-router';
import '@fontsource-variable/inter';
import '@fontsource-variable/plus-jakarta-sans';
import './styles/index.css';
import { AuthProvider } from './data/auth';
import { router } from './router';
import { ThemeProvider } from './theme/ThemeProvider';

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, refetchOnWindowFocus: true } },
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

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <RouterProvider router={router} />
        </AuthProvider>
      </QueryClientProvider>
    </ThemeProvider>
  </StrictMode>,
);
