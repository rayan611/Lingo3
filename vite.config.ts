import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import pkg from './package.json'

/**
 * Is this the beta build?
 *
 * One environment variable rather than a branch of its own in the source:
 * `beta` and `main` then differ by nothing at all, so merging one into the
 * other can never conflict and the beta can never drift into being a
 * different app. Vercel sets VITE_BETA=1 on the beta project only.
 */
const IS_BETA = process.env.VITE_BETA === '1'

export default defineConfig({
  // Baked in at build time and shown at the bottom of Settings. Without a
  // version on screen there is no way to tell, from a phone, whether the
  // service worker has actually picked up a new deploy.
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __BUILD_DATE__: JSON.stringify(new Date().toISOString().slice(0, 10)),
    __IS_BETA__: JSON.stringify(IS_BETA),
  },
  plugins: [
    react(),
    // The beta lives on a real domain, so it has to say so to a crawler as
    // well as to a reader. A meta tag rather than a header in vercel.json:
    // that file is shared by both branches, and a header the production
    // build also carried would quietly delist the real site.
    {
      name: 'beta-noindex',
      transformIndexHtml(html: string) {
        if (!IS_BETA) return html
        return html.replace(
          '</head>',
          '  <meta name="robots" content="noindex, nofollow" />\n  </head>',
        )
      },
    },
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: IS_BETA
          ? 'Lingo3 beta'
          : 'Lingo3 — learn up to 3 languages',
        // What appears under the icon on a home screen, where there is room
        // for about twelve characters and no more.
        short_name: IS_BETA ? 'Lingo3 \u03b2' : 'Lingo3',
        description: 'Learn up to 3 languages at once, from your own words',
        // The tile's own violet, so the splash screen and the Android
        // task-switcher bar match the icon exactly. The mark is flat now, so
        // there is no longer a lighter and a darker end to choose between —
        // which is one fewer thing that can leave a seam.
        theme_color: '#7A52A8',
        background_color: '#ffffff',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // App shell is precached, so review works with no network at all.
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        navigateFallback: '/index.html',
        // Without these, a bad shell cached by an older service worker (for
        // example a login wall served while deployment protection was on)
        // keeps being served forever and the app looks dead. These make a new
        // deploy take over the page immediately and bin the old caches.
        skipWaiting: true,
        clientsClaim: true,
        cleanupOutdatedCaches: true,
        // The fallback is for page navigations only; it must never swallow an
        // API call and hand back HTML.
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [
          {
            // Never cache model calls — they must hit the network or fail
            // into the pending queue.
            urlPattern: /\/api\//,
            handler: 'NetworkOnly',
          },
        ],
      },
    }),
  ],
})
