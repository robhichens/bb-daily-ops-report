import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'node:path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    // PWA (Phase 1: installable). Silent auto-update on each deploy; the plugin
    // generates + auto-registers the service worker. It precaches the app shell
    // only (JS/CSS/HTML + icons); Firestore uses its own transport and is never
    // intercepted. Manifest is inline here — the live app's palette is the source
    // of truth (background #fafaf5 = --background cream, theme #f08782 = coral).
    VitePWA({
      registerType: 'autoUpdate',
      // Precache the loader/favicon mark so it renders offline too.
      includeAssets: ['brand/bb-tree.png'],
      manifest: {
        name: 'Bright Beginnings Daily Ops Report',
        short_name: 'Daily Ops',
        description:
          'Log and review daily operations across Bright Beginnings campuses — attendance, enrollment, staffing, and safety.',
        id: '/',
        start_url: '/',
        display: 'standalone',
        theme_color: '#f08782',
        background_color: '#fafaf5',
        lang: 'en',
        icons: [
          { src: '/icons/pwa-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icons/pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          {
            src: '/icons/pwa-512-maskable.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // App shell only. Large brand PNGs are deliberately left out of the install
        // precache (keeps first install fast on flaky wifi) and cached on demand below.
        globPatterns: ['**/*.{js,css,html,svg,woff,woff2}', 'icons/*.png'],
        navigateFallback: '/index.html',
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        runtimeCaching: [
          {
            // Same-origin brand imagery (logo, celebration birds): populate the cache
            // on first online view so they survive offline, without bloating precache.
            urlPattern: /\/brand\/[^/]+\.png$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'bb-brand-images',
              expiration: { maxEntries: 12, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
        ],
      },
      // Keep the SW off in `vite dev` (avoids stale-cache surprises while developing);
      // it is active in the production build, which is what gets deployed + tested.
      devOptions: { enabled: false },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    chunkSizeWarningLimit: 700, // the firebase SDK chunk is inherently large
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return
          if (id.includes('firebase') || id.includes('@firebase')) return 'firebase'
          if (id.includes('framer-motion') || id.includes('motion-')) return 'motion'
          if (id.includes('/react') || id.includes('react-dom') || id.includes('react-router')) return 'react'
        },
      },
    },
  },
})
