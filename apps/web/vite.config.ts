import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'
import pkg from './package.json' with { type: 'json' }

// Tauri carga este mismo build; en escritorio no registramos service worker.
const isTauri = Boolean(process.env.TAURI_ENV_PLATFORM)

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      disable: isTauri,
      registerType: 'autoUpdate',
      // Iconos de `index.html` (los del manifiesto ya entran solos): la pestaña lleva el logo también sin conexión.
      includeAssets: ['favicon.ico', 'favicon.svg', 'apple-touch-icon.png'],
      // Avisos Web Push (ADR-0040): `public/push-sw.js` solo escucha `push` y `notificationclick`.
      workbox: { importScripts: ['push-sw.js'] },
      manifest: {
        id: '/',
        scope: '/',
        name: 'Muninn',
        short_name: 'Muninn',
        description: 'Tu sistema operativo personal',
        lang: 'es',
        categories: ['productivity', 'finance'],
        theme_color: '#0C0D10',
        background_color: '#0C0D10',
        display: 'standalone',
        start_url: '/',
        // Generados desde el logo (`scripts/icons.mjs`). Los `maskable` llenan el cuadrado: el sistema los recorta.
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          {
            src: '/icon-maskable-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'maskable',
          },
          {
            src: '/icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
    }),
  ],
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  clearScreen: false,
  server: { port: 5173, strictPort: true },
  envPrefix: ['VITE_', 'TAURI_ENV_'],
  build: {
    target: 'es2023',
    rolldownOptions: {
      output: {
        // Vendors estables en chunks propios: cambian poco y el navegador los mantiene en caché
        // entre versiones. Solo lo que usa el shell: un grupo arrastra al chunk inicial todo lo que
        // casa con `test`, aunque solo lo use una pantalla diferida (por eso Radix y zod no están).
        codeSplitting: {
          groups: [
            { name: 'react', test: /node_modules[/](react|react-dom|scheduler)[/]/ },
            // `query-persist-client-core` y la hidratación de query-core son de la caché sin conexión (diferida, lib/offline.ts): fuera del grupo.
            {
              name: 'tanstack',
              test: /node_modules[/]@tanstack[/](?!query-persist-client-core|.*[/]hydration)/,
            },
            // De Phosphor solo entra la base (`IconBase`): los trazos se generan en @muninn/ui (ADR-0058).
            {
              name: 'ui-vendor',
              test: /node_modules[/](sonner|@phosphor-icons|tailwind-merge|clsx|class-variance-authority)[/]/,
            },
            // Diferido: lo pide el loader de la ruta raíz (lib/muninn.ts).
            { name: 'core', test: /packages[/]core[/]|node_modules[/]zod[/]/ },
          ],
        },
      },
    },
  },
})
