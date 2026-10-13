import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { devStorefront } from './dev-storefront.ts'

// The browser only ever talks to this dev server: /api is proxied to the
// FastAPI backend (so it needs no CORS setup), and /storefront/token is
// answered by the dev storefront plugin.
const proxy = {
  '/api': {
    target: process.env.AGENT_SERVICE_URL ?? 'http://localhost:8000',
    changeOrigin: true,
    rewrite: (path: string) => path.replace(/^\/api/, ''),
  },
}

export default defineConfig({
  plugins: [react(), devStorefront()],
  server: { proxy },
  preview: { proxy },
})
