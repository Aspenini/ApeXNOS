import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  base: "/",
  build: {
    target: "es2022",
    cssMinify: true,
    sourcemap: false,
    assetsInlineLimit: 4096,
    rollupOptions: {
      output: {
        manualChunks: undefined,
      },
    },
  },
  plugins: [
    VitePWA({
      registerType: "prompt",
      includeAssets: ["favicon.ico", "logo.png", "logo-192.png", "logo-512.png", "CNAME"],
      manifest: {
        name: "ApeXNOS Gaming Clan",
        short_name: "ApeXNOS",
        description:
          "ApeXNOS — a group of friends who happen to be really good at games.",
        start_url: "/",
        display: "standalone",
        background_color: "#050505",
        theme_color: "#050505",
        orientation: "portrait-primary",
        lang: "en",
        categories: ["games", "entertainment", "social"],
        icons: [
          {
            src: "logo-192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "logo-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "logo-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
        shortcuts: [
          {
            name: "View Squad",
            short_name: "Squad",
            description: "View the ApeXNOS squad",
            url: "/#roster",
            icons: [{ src: "logo-192.png", sizes: "192x192" }],
          },
          {
            name: "About Us",
            short_name: "About",
            description: "Learn about ApeXNOS",
            url: "/#about",
            icons: [{ src: "logo-192.png", sizes: "192x192" }],
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg}"],
      },
    }),
  ],
});
