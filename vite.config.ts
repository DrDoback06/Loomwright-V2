import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { fileURLToPath } from 'node:url';

// Deployed to GitHub Pages at https://<owner>.github.io/Loomwright-V2/
const BASE = process.env.LW_BASE ?? '/Loomwright-V2/';

export default defineConfig({
  base: BASE,
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/loomwright.svg'],
      manifest: {
        name: 'Loomwright',
        short_name: 'Loomwright',
        description: 'Local-first writing and worldbuilding. Shape the book. Track the world.',
        theme_color: '#f4ecd8',
        background_color: '#f4ecd8',
        display: 'standalone',
        scope: BASE,
        start_url: BASE,
        icons: [
          {
            src: 'icons/loomwright.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,woff2}'],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        navigateFallback: `${BASE}index.html`,
      },
    }),
  ],
  build: {
    target: 'es2022',
    sourcemap: true,
  },
});
