import path from 'node:path'
import react from '@vitejs/plugin-react'
import { configDefaults, defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    // e2e/ is Playwright's (visual regression), not Vitest's.
    exclude: [...configDefaults.exclude, 'e2e/**'],
    // Only the token sheet is let through, so tokens.test.ts can read it with ?raw.
    css: { include: [/src\/index\.css/] },
  },
})
