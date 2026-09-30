import { existsSync } from 'node:fs';
import path from 'node:path';
import react from '@vitejs/plugin-react';
import type { Plugin } from 'vite';
import { defineConfig } from 'vitest/config';

const KATAS = path.resolve(import.meta.dirname, 'katas');

/**
 * Tests always import from `../src/...`, so they type-check against the starter you edit.
 * With KATA_TARGET=solution this resolver swaps those imports for the matching file in
 * `solution/`. One set of tests, two targets, and no copy of the tests to drift.
 */
function kataTarget(): Plugin {
  return {
    name: 'kata-target',
    enforce: 'pre',
    async resolveId(source, importer, options) {
      if (process.env.KATA_TARGET !== 'solution' || !importer) return null;
      const fromTests =
        importer.startsWith(KATAS) && importer.includes(`${path.sep}tests${path.sep}`);
      if (!fromTests) return null;
      const resolved = await this.resolve(source, importer, { ...options, skipSelf: true });
      if (!resolved) return null;
      const marker = `${path.sep}src${path.sep}`;
      const index = resolved.id.lastIndexOf(marker);
      if (!resolved.id.startsWith(KATAS) || index === -1) return null;
      const swapped = `${resolved.id.slice(0, index)}${path.sep}solution${path.sep}${resolved.id.slice(index + marker.length)}`;
      if (!existsSync(swapped)) {
        throw new Error(`No reference file for ${resolved.id}. Expected ${swapped}.`);
      }
      return swapped;
    },
  };
}

export default defineConfig({
  plugins: [kataTarget(), react()],
  test: {
    include: ['katas/**/tests/**/*.test.{ts,tsx}'],
    // React katas opt into jsdom with a docblock; everything else runs in plain Node.
    environment: 'node',
    restoreMocks: true,
    setupFiles: ['./vitest.setup.ts'],
  },
});
