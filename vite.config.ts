import { cloudflare } from '@cloudflare/vite-plugin'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// E2E はシード済みの専用ディレクトリを使い、開発用のローカル D1 を汚さない
const persistDir = process.env.DADADA_PERSIST_DIR

export default defineConfig({
  plugins: [
    react(),
    cloudflare({
      configPath: 'wrangler.jsonc',
      persistState: persistDir ? { path: persistDir } : true,
    }),
  ],
  server: {
    port: 5173,
    strictPort: true,
  },
})
