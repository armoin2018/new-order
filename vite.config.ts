import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@/engine': resolve(__dirname, 'src/engine'),
      '@/ui': resolve(__dirname, 'src/ui'),
      '@/data': resolve(__dirname, 'src/data'),
      '@/workers': resolve(__dirname, 'src/workers'),
      '@/assets': resolve(__dirname, 'src/assets'),
    },
  },
  build: {
    target: 'es2022',
  },
  worker: {
    format: 'es',
  },
  // Serve models/ directory as static assets at /models
  server: {
    fs: {
      allow: ['.', 'models'],
    },
    proxy: {
      // Proxy Ollama API calls to avoid CORS issues with local Ollama
      '/ollama-proxy': {
        target: 'http://localhost:11434',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/ollama-proxy/, ''),
      },
    },
  },
});
