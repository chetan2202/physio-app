import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

// The app is served from a GitHub Pages project path:
//   https://chetan2202.github.io/physio-app/
// so asset URLs must be relative to that base.
const BASE = "/physio-app/";

// `@sync-module` resolves to the vendored closed sync module when present (run `npm run
// pull-sync`), or to the local-only stub otherwise — so the public build always works.
const vendored = fileURLToPath(new URL("./src/sync/vendor/index.ts", import.meta.url));
const syncModule = existsSync(vendored) ? vendored : fileURLToPath(new URL("./src/sync/stub.ts", import.meta.url));

export default defineConfig({
  base: BASE,
  resolve: { alias: { "@sync-module": syncModule } },
  plugins: [
    VitePWA({
      registerType: "prompt",
      includeAssets: ["icons/icon-192.png", "icons/icon-512.png"],
      manifest: {
        name: "Physio",
        short_name: "Physio",
        description: "Physio — patients, attendance, and fees for a physiotherapy center. Offline, installable.",
        start_url: BASE,
        scope: BASE,
        display: "standalone",
        orientation: "portrait",
        background_color: "#f4f6f6",
        theme_color: "#0d9488",
        icons: [
          { src: "icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any maskable" },
          { src: "icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any maskable" },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,json,png,svg,ico,webmanifest}"],
      },
      devOptions: { enabled: false },
    }),
  ],
  build: {
    outDir: "dist",
    target: "es2022",
  },
});
