import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

export default defineConfig({
  resolve: {
    alias: {
      '@/engine': resolve(__dirname, 'src/engine'),
      '@/data': resolve(__dirname, 'src/data'),
      '@/server': resolve(__dirname, 'server'),
    },
  },
  test: {
    environment: 'node',
    include: ['server/**/*.{test,spec}.ts'],
    testTimeout: 15_000,
    pool: 'forks',
  },
});
