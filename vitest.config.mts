import path from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

const alias = { '@': path.resolve(import.meta.dirname, 'src') };
const PROCESS_TESTS = 'tests/unit/scripts/content/cli.test.ts';

/**
 * Three projects, matching the architecture's layers:
 *  - core:     pure domain rules, node environment, strict TDD, high coverage floor
 *  - adapters: IndexedDB (fake-indexeddb), runners, file stores, scripts
 *  - ui:       React components in jsdom with Testing Library
 * and a fourth, `processes`, for tests that start whole validator and build runs. Each
 * of those runs every challenge in worker threads, so beside the others they starve the
 * machine and honest tests time out. `pnpm test` runs it after the rest, on its own.
 */
export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      include: ['src/core/**/*.ts'],
      exclude: ['src/core/**/index.ts', 'src/core/ports/**'],
      thresholds: { statements: 95, branches: 90, functions: 95, lines: 95 },
    },
    projects: [
      {
        resolve: { alias },
        test: { name: 'core', environment: 'node', include: ['tests/unit/core/**/*.test.ts'] },
      },
      {
        resolve: { alias },
        test: {
          name: 'adapters',
          environment: 'node',
          include: ['tests/unit/adapters/**/*.test.ts', 'tests/unit/scripts/**/*.test.ts'],
          exclude: [PROCESS_TESTS],
        },
      },
      {
        resolve: { alias },
        test: { name: 'processes', environment: 'node', include: [PROCESS_TESTS] },
      },
      {
        plugins: [react()],
        resolve: { alias },
        test: {
          name: 'ui',
          environment: 'jsdom',
          include: ['tests/unit/ui/**/*.test.{ts,tsx}'],
          setupFiles: ['tests/unit/ui/setup.ts'],
        },
      },
    ],
  },
});
