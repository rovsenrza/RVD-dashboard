import path from 'node:path'
import react from '@vitejs/plugin-react'
import { configDefaults, defineConfig } from 'vitest/config'
import pkg from './package.json' with { type: 'json' }

export default defineConfig({
  plugins: [react()],
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    // e2e/ is Playwright's (visual regression), not Vitest's.
    exclude: [...configDefaults.exclude, 'e2e/**', 'e2e-live/**'],
    // Only the token sheet is let through, so tokens.test.ts can read it with ?raw.
    css: { include: [/src\/index\.css/] },
  },
})
