import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";
import { rosterPlugin } from "./build/roster";

export default defineConfig({
  base: "/",
  build: {
    target: "es2022",
    cssMinify: "lightningcss",
    sourcemap: false,
    // Inline anything under 4kB (the favicon, the noise SVG) to save round trips.
    assetsInlineLimit: 4096,
    reportCompressedSize: false,
    modulePreload: { polyfill: false },
  },
  css: {
    transformer: "lightningcss",
    lightningcss: {
      targets: {
        // Matches the es2022 JS target: evergreen browsers only.
        chrome: 111 << 16,
        firefox: 113 << 16,
        safari: (16 << 16) | (4 << 8),
      },
    },
  },
  plugins: [
    rosterPlugin(),
    VitePWA({
      registerType: "prompt",
      manifest: {
        name: "ApeXNOS Gaming Clan",
        short_name: "ApeXNOS",
        description: "ApeXNOS — a group of friends who happen to be really good at games.",
        start_url: "/",
        scope: "/",
        id: "/",
        display: "standalone",
        background_color: "#050505",
        theme_color: "#050505",
        orientation: "any",
        lang: "en",
        dir: "ltr",
        categories: ["games", "entertainment", "social"],
        icons: [
          { src: "logo-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "logo-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
          { src: "logo-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
        shortcuts: [
          {
            name: "View Squad",
            short_name: "Squad",
            description: "View the ApeXNOS squad",
            url: "/#roster",
            icons: [{ src: "logo-192.png", sizes: "192x192" }],
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,webp,avif,woff2}"],
        // Portraits are cached on first view instead of precached — see
        // runtimeCaching below. og.jpg is only ever fetched by link scrapers,
        // so it has no business in an offline install.
        globIgnores: ["**/members/**", "**/og.jpg"],
        navigateFallback: "/index.html",
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.startsWith("/members/"),
            handler: "CacheFirst",
            options: {
              cacheName: "apexnos-portraits",
              expiration: { maxEntries: 40, maxAgeSeconds: 60 * 60 * 24 * 60 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
});
