import { describe, expect, it } from 'vitest';
import { buildEngine, PGLITE_FILES, pgliteDir, pgliteVersion } from '../../../../scripts/build-sql';
import { parseSqlManifest } from '@/adapters/sql/assets';
import { existsSync } from 'node:fs';
import path from 'node:path';

describe('the SQL worker build', () => {
  it('bundles one module a browser can load: no Node import left, a name the manifest accepts', async () => {
    const { file, code, version } = await buildEngine();
    expect(version).toBe(pgliteVersion());
    expect(parseSqlManifest({ file, pglite: version })).not.toBeNull();
    // A bare specifier cannot resolve in a worker; the Node-only modules are stubbed.
    expect(code).not.toMatch(/\bfrom\s*"(node:)?(fs|path|zlib|stream|module|url|util|crypto)"/);
    expect(code).not.toMatch(
      /\bimport\s*\(\s*"(node:)?(fs|path|zlib|stream|module|url|util|crypto)/,
    );
    // PGlite finds its files beside the worker, from its own URL.
    expect(code).toContain('import.meta.url');
  }, 60_000);

  it('copies the files PGlite fetches, all present in the installed package', () => {
    for (const name of PGLITE_FILES) expect(existsSync(path.join(pgliteDir(), name))).toBe(true);
  });
});
