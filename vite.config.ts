import path from 'node:path'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig, loadEnv } from 'vite'
import pkg from './package.json' with { type: 'json' }

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  return {
    plugins: [react(), tailwindcss()],
    // The rail shows it; one place to bump at a release.
    define: { __APP_VERSION__: JSON.stringify(pkg.version) },
    resolve: {
      alias: { '@': path.resolve(__dirname, 'src') },
    },
    server: {
      port: 5173,
      // Hybrid mode (VITE_LIVE_API): the mocks let the routes apps/api serves through
      // (src/shared/api/live.ts) and the dev server forwards them, so the browser never needs CORS.
      proxy:
        env.VITE_LIVE_API === 'true' || env.VITE_LIVE_PRODUCTS === 'true'
          ? {
              '/api': {
                target: env.VITE_LIVE_API_URL || 'http://localhost:3001',
                rewrite: (p: string) => p.replace(/^\/api/, ''),
              },
            }
          : undefined,
    },
  }
})
