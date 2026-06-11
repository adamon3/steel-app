import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png'],
      workbox: {
        clientsClaim: true,
        navigateFallback: '/index.html',
        // Don't precache the source map and our self-written sw.js.
        globIgnores: ['**/sw.js', '**/workbox-*.js'],
        runtimeCaching: [
          {
            // Supabase REST GET — feed, profile, exercises, workouts.
            // NetworkFirst with 4s timeout means: online users get fresh data
            // (cache updates in background), offline users get the last good
            // response. POST/PATCH/DELETE bypass this and 503 when offline.
            urlPattern: ({ url, request }) =>
              url.origin === 'https://tkrwctmzftnmdspioohw.supabase.co'
              && url.pathname.startsWith('/rest/')
              && request.method === 'GET',
            handler: 'NetworkFirst',
            options: {
              cacheName: 'sb-rest-v1',
              networkTimeoutSeconds: 4,
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 14 }, // 14 days
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // Supabase Storage — avatars, photos. CacheFirst (long-lived URLs).
            urlPattern: ({ url }) =>
              url.origin === 'https://tkrwctmzftnmdspioohw.supabase.co'
              && url.pathname.startsWith('/storage/'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'sb-storage-v1',
              expiration: { maxEntries: 300, maxAgeSeconds: 60 * 60 * 24 * 30 }, // 30 days
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // Google Fonts CSS
            urlPattern: ({ url }) => url.origin === 'https://fonts.googleapis.com',
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'gfonts-css' },
          },
          {
            // Google Fonts files
            urlPattern: ({ url }) => url.origin === 'https://fonts.gstatic.com',
            handler: 'CacheFirst',
            options: {
              cacheName: 'gfonts-files',
              expiration: { maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // OSM tiles for the gym map.
            urlPattern: ({ url }) => /tile\.openstreetmap\.org/.test(url.hostname),
            handler: 'CacheFirst',
            options: {
              cacheName: 'osm-tiles',
              expiration: { maxEntries: 400, maxAgeSeconds: 60 * 60 * 24 * 14 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      manifest: {
        name: 'Steel',
        short_name: 'Steel',
        description: "The gym doesn't have to be a solo sport.",
        start_url: '/',
        theme_color: '#FAFAFA',
        background_color: '#FAFAFA',
        display: 'standalone',
        orientation: 'portrait',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
});
