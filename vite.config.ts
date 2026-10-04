import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  // The app's code is ~160 KB compressed (mostly the Supabase client). It is cached on the phone by the
  // service worker, so one file is fine; this only quiets Vite's generic size notice.
  build: { chunkSizeWarningLimit: 700 },
  plugins: [
    react(),
    tailwindcss(),
    // Makes Cadence installable (Chrome: "Install app") and opens it instantly from the home screen.
    // The service worker keeps the app's own files on the phone; your data always comes live from
    // Supabase, never from this cache.
    VitePWA({
      registerType: 'autoUpdate', // a new version replaces the old one on the next launch, no prompt
      includeAssets: ['favicon.svg', 'logo.svg', 'avatar.svg', 'icons/apple-touch-icon.png'],
      manifest: {
        id: '/',
        name: 'Cadence',
        short_name: 'Cadence',
        description: 'Daily routines and goals',
        start_url: '/today',
        scope: '/',
        display: 'standalone',
        orientation: 'any',
        background_color: '#4f46e5', // splash screen while the app starts
        theme_color: '#4f46e5',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        // Only the Latin font files are kept offline; other alphabets still load if ever needed.
        globIgnores: ['**/*-{cyrillic,cyrillic-ext,greek,greek-ext,vietnamese}-*.woff2'],
        navigateFallback: '/index.html', // every app URL (e.g. /goals/123) opens the app offline too
        navigateFallbackDenylist: [/^\/api\//], // server functions (capture) are never answered by the app shell
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
      },
    }),
  ],
});
