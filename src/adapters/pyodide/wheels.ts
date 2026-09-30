/**
 * The package wheels, on disk, for the build and the Node gate (docs/SANDBOX.md,
 * "Packages"). Node only.
 *
 * The `pyodide` npm package carries the interpreter and the standard library, not the
 * wheels. They come from the same release on jsDelivr, which serves the Pyodide
 * distribution file for file, and each is checked against the SHA-256 in the lock file
 * the npm package ships, so the bytes are pinned as exactly as the interpreter's. They
 * are kept in node_modules/.cache: a second build, the gate and the tests read them from
 * there and need no network.
 */
import { createHash } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { packageFiles, type PackageFile, type PyodideLock } from '@/core/running/python-packages';
import { PYODIDE_FILES, PYODIDE_VERSION } from './assets';

export const WHEEL_SOURCE = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`;

export function wheelCacheDir(root = process.cwd()): string {
  return path.join(root, 'node_modules/.cache/understory-pyodide', PYODIDE_VERSION);
}

export async function readPyodideLock(root = process.cwd()): Promise<PyodideLock> {
  const pkg = createRequire(path.join(root, 'package.json')).resolve('pyodide');
  const text = await readFile(path.join(path.dirname(pkg), PYODIDE_FILES.lock), 'utf8');
  return JSON.parse(text) as PyodideLock;
}

const sha256 = (data: Uint8Array): string => createHash('sha256').update(data).digest('hex');

async function matches(file: string, expected: string): Promise<boolean> {
  try {
    return sha256(await readFile(file)) === expected;
  } catch {
    return false;
  }
}

export interface EnsuredWheels {
  dir: string;
  files: PackageFile[];
  /** How many were fetched now rather than found in the cache. */
  downloaded: number;
}

/**
 * Makes sure every wheel the packages need is in the cache with the pinned bytes, and
 * fetches those that are not. A file reaches its final name only once its hash matches.
 */
export async function ensureWheels(
  names: readonly string[],
  options: { root?: string; dir?: string; fetchFile?: (url: string) => Promise<Response> } = {},
): Promise<EnsuredWheels> {
  const dir = options.dir ?? wheelCacheDir(options.root);
  const fetchFile = options.fetchFile ?? ((url: string) => fetch(url));
  const files = packageFiles(await readPyodideLock(options.root), names);
  await mkdir(dir, { recursive: true });
  let downloaded = 0;
  for (const file of files) {
    const target = path.join(dir, file.fileName);
    if (await matches(target, file.sha256)) continue;
    const response = await fetchFile(`${WHEEL_SOURCE}${file.fileName}`);
    if (!response.ok) {
      throw new Error(`${file.fileName} could not be downloaded (${response.status}).`);
    }
    const data = new Uint8Array(await response.arrayBuffer());
    if (sha256(data) !== file.sha256) {
      throw new Error(`${file.fileName} does not match the SHA-256 in the Pyodide lock file.`);
    }
    const partial = `${target}.${process.pid}.partial`;
    await writeFile(partial, data);
    await rename(partial, target);
    downloaded += 1;
  }
  return { dir, files, downloaded };
}
