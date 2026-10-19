import { defineConfig } from 'vitest/config'

// Configuración propia para no cargar los plugins de Vite (PWA, Tailwind) en los tests.
export default defineConfig({
  define: { __APP_VERSION__: JSON.stringify('test') },
  test: { include: ['test/**/*.test.{ts,tsx}'] },
})
