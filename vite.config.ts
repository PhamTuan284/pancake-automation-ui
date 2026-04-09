import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/** Fallback when `VITE_API_BASE_URL` is unset: proxy `/api` → local API (default port 4001). */
const apiPort = process.env.PANCAKE_API_PORT || '4001';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: `http://127.0.0.1:${apiPort}`,
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
});
