/**
 * Where the browser finds the type-checker worker.
 *
 * scripts/build-typecheck.ts writes public/typescript/checker.<hash>.js (about 1 MB
 * compressed: the compiler and its library files) and checker.json, which names it.
 * Both are git-ignored, like public/pyodide. The hash is in the name, so the service
 * worker keeps the file for good; checker.json is small and revalidated, so a new build
 * reaches a learner on their next visit.
 */
export const CHECKER_BASE_URL = '/typescript/';
export const CHECKER_MANIFEST_URL = `${CHECKER_BASE_URL}checker.json`;

export interface CheckerManifest {
  /** The worker file's name, `checker.<hash>.js`. */
  file: string;
  /** The compiler version inside it, for the record. */
  typescript: string;
}

/** A file name only, so a tampered manifest cannot point the worker anywhere else. */
const FILE = /^checker\.[0-9a-f]{8,64}\.js$/;

export function parseManifest(value: unknown): CheckerManifest | null {
  if (typeof value !== 'object' || value === null) return null;
  const { file, typescript } = value as Record<string, unknown>;
  if (typeof file !== 'string' || !FILE.test(file) || typeof typescript !== 'string') return null;
  return { file, typescript };
}

interface ManifestResponse {
  ok: boolean;
  json(): Promise<unknown>;
}

/** The worker's URL, from the manifest. Rejects when either cannot be had. */
export async function checkerWorkerUrl(
  fetchFile: (url: string) => Promise<ManifestResponse> = (url) => fetch(url),
): Promise<string> {
  const response = await fetchFile(CHECKER_MANIFEST_URL);
  if (!response.ok) throw new Error('The type checker is not available.');
  const manifest = parseManifest(await response.json());
  if (!manifest) throw new Error('The type checker manifest is not valid.');
  return `${CHECKER_BASE_URL}${manifest.file}`;
}
