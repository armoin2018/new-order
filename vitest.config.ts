import { defineConfig, mergeConfig } from 'vitest/config';
import viteConfig from './vite.config';

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: 'happy-dom',
      include: ['src/**/*.{test,spec}.{ts,tsx}'],
      setupFiles: ['src/test/setup.ts'],
      testTimeout: 10_000,
      coverage: {
        provider: 'v8',
        reporter: ['text', 'text-summary', 'lcov', 'json-summary'],
        reportsDirectory: 'coverage',
        include: ['src/**/*.{ts,tsx}'],
        exclude: [
          'src/**/*.test.{ts,tsx}',
          'src/**/*.spec.{ts,tsx}',
          'src/test/**',
          'src/vite-env.d.ts',
          'src/**/index.ts',
          // React hooks are UI-layer bindings, not core simulation logic.
          // They require @testing-library/react for proper testing (NFR-501
          // applies to core simulation logic only).
          'src/engine/hooks.ts',
        ],
        thresholds: {
          'src/engine/**': {
            lines: 90,
            functions: 90,
            branches: 85,
          },
        },
      },
    },
  }),
);
