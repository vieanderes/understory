/**
 * Where the browser finds Pyodide, and how the parent page loads it for the sandbox.
 *
 * The files are copied from the `pyodide` package into public/pyodide/<version>/ by
 * scripts/copy-pyodide.ts (git-ignored, like the content bundle). The path carries the
 * version, so the files are immutable and a service worker may keep them for good.
 *
 * The parent fetches them, not the frame. The frame has an opaque origin and
 * `default-src 'none'`, so it can fetch nothing, and a request from an opaque origin
 * would miss the app's service worker anyway (docs/SANDBOX.md, "Offline"). Fetched here,
 * on the app origin, they come from the worker's cache offline.
 */

import { packageFiles, type PyodideLock } from '@/core/running/python-packages';

/** Kept equal to the installed package by tests/unit/adapters/pyodide/assets.test.ts. */
export const PYODIDE_VERSION = '0.27.8';

export const PYODIDE_BASE_URL = `/pyodide/${PYODIDE_VERSION}/`;

/**
 * The five files a start needs. The wheels of numpy, pandas and pydantic sit next to them
 * and are fetched by `fetchPythonPackages` when a run first imports one.
 */
export const PYODIDE_FILES = {
  loader: 'pyodide.js',
  runtime: 'pyodide.asm.js',
  wasm: 'pyodide.asm.wasm',
  stdlib: 'python_stdlib.zip',
  lock: 'pyodide-lock.json',
} as const;

export type PyodideFileKey = keyof typeof PYODIDE_FILES;

export type PythonAssets = { version: string } & Record<PyodideFileKey, ArrayBuffer>;

interface FileResponse {
  ok: boolean;
  status: number;
  arrayBuffer(): Promise<ArrayBuffer>;
}

export async function fetchPythonAssets(
  fetchFile: (url: string) => Promise<FileResponse> = (url) => fetch(url),
): Promise<PythonAssets> {
  const keys = ['loader', 'runtime', 'wasm', 'stdlib', 'lock'] as const;
  const buffers = await Promise.all(
    keys.map(async (key) => {
      const response = await fetchFile(`${PYODIDE_BASE_URL}${PYODIDE_FILES[key]}`);
      if (!response.ok) throw new Error(`Python could not be loaded (${response.status}).`);
      return response.arrayBuffer();
    }),
  );
  const [loader, runtime, wasm, stdlib, lock] = buffers;
  if (!loader || !runtime || !wasm || !stdlib || !lock) {
    throw new Error('Python could not be loaded.');
  }
  return { version: PYODIDE_VERSION, loader, runtime, wasm, stdlib, lock };
}

/**
 * The wheels the named packages need, by file name, except those in `have` (the frame
 * already holds them). The lock file tells which: it is one of the five start files, so
 * the service worker answers it from its cache. The wheels are cached the same way, under
 * the same versioned folder, after their first use.
 */
export async function fetchPythonPackages(
  names: readonly string[],
  have: ReadonlySet<string>,
  fetchFile: (url: string) => Promise<FileResponse> = (url) => fetch(url),
): Promise<Record<string, ArrayBuffer>> {
  const failed = (status: number): Error =>
    new Error(`${names.join(', ')} could not be loaded (${status}).`);
  const lockResponse = await fetchFile(`${PYODIDE_BASE_URL}${PYODIDE_FILES.lock}`);
  if (!lockResponse.ok) throw failed(lockResponse.status);
  const lock = JSON.parse(
    new TextDecoder().decode(await lockResponse.arrayBuffer()),
  ) as PyodideLock;
  const wanted = packageFiles(lock, names).filter((file) => !have.has(file.fileName));
  const entries = await Promise.all(
    wanted.map(async ({ fileName }) => {
      const response = await fetchFile(`${PYODIDE_BASE_URL}${fileName}`);
      if (!response.ok) throw failed(response.status);
      return [fileName, await response.arrayBuffer()] as const;
    }),
  );
  return Object.fromEntries(entries);
}
