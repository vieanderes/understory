/**
 * Copies the Pyodide files the browser needs from node_modules/pyodide into
 * public/pyodide/<version>/, where src/adapters/pyodide/assets.ts fetches them, and next
 * to them the wheels of the packages challenges may import (numpy, pandas, pydantic and
 * their dependencies), from the wheel cache that src/adapters/pyodide/wheels.ts fills
 * and checks against the lock file's SHA-256s. The first build fetches the wheels once.
 *
 * Git-ignored output, like public/content: 25 MB of binaries do not belong in history,
 * and the lock files already pin the exact bytes. Runs before `dev` and `build`.
 *
 *   pnpm build:pyodide
 */
import { copyFile, mkdir, readdir, rm, stat } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { PYODIDE_FILES, PYODIDE_VERSION } from '../src/adapters/pyodide/assets';
import { ensureWheels } from '../src/adapters/pyodide/wheels';
import { PYTHON_PACKAGES } from '../src/core/running/python-packages';

const ROOT = process.cwd();
const OUT_ROOT = path.join(ROOT, 'public/pyodide');

async function main(): Promise<void> {
  const source = path.dirname(createRequire(path.join(ROOT, 'package.json')).resolve('pyodide'));
  const out = path.join(OUT_ROOT, PYODIDE_VERSION);
  await mkdir(out, { recursive: true });

  let bytes = 0;
  for (const name of Object.values(PYODIDE_FILES)) {
    await copyFile(path.join(source, name), path.join(out, name));
    bytes += (await stat(path.join(out, name))).size;
  }
  const wheels = await ensureWheels(PYTHON_PACKAGES, { root: ROOT });
  let wheelBytes = 0;
  for (const { fileName } of wheels.files) {
    await copyFile(path.join(wheels.dir, fileName), path.join(out, fileName));
    wheelBytes += (await stat(path.join(out, fileName))).size;
  }
  // After an upgrade the old version would otherwise ship alongside the new one.
  for (const entry of await readdir(OUT_ROOT)) {
    if (entry !== PYODIDE_VERSION) await rm(path.join(OUT_ROOT, entry), { recursive: true });
  }
  const mb = (n: number): string => (n / 1024 / 1024).toFixed(1);
  console.log(
    `pyodide: public/pyodide/${PYODIDE_VERSION}, ${mb(bytes)} MB, packages ${mb(wheelBytes)} MB in ${wheels.files.length} wheels (${wheels.downloaded} downloaded)`,
  );
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
