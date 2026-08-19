import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Panel API'si ayri bir Express sureci (src/panel/server.ts) - dev'de /api istekleri ona proxy'lenir.
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
    },
  },
});
