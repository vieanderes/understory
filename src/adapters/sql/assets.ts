/**
 * Where the browser finds the SQL worker.
 *
 * scripts/build-sql.ts writes public/sql/<pglite version>/ (PGlite's wasm and data files,
 * about 5.4 MB compressed, and engine.<hash>.js, the worker) and public/sql/engine.json,
 * which names the worker. All git-ignored, like public/pyodide. The version and the hash
 * are in the path, so the service worker keeps the files for good; engine.json is small
 * and revalidated, so a new build reaches a learner on their next visit.
 */
export const SQL_BASE_URL = '/sql/';
export const SQL_MANIFEST_URL = `${SQL_BASE_URL}engine.json`;

export interface SqlManifest {
  /** The worker's path under /sql/: `<pglite version>/engine.<hash>.js`. */
  file: string;
  /** The PGlite version inside it, for the record. */
  pglite: string;
}

/** A version directory and a file name only, so a tampered manifest cannot point elsewhere. */
const FILE = /^\d+\.\d+\.\d+\/engine\.[0-9a-f]{8,64}\.js$/;

export function parseSqlManifest(value: unknown): SqlManifest | null {
  if (typeof value !== 'object' || value === null) return null;
  const { file, pglite } = value as Record<string, unknown>;
  if (typeof file !== 'string' || !FILE.test(file) || typeof pglite !== 'string') return null;
  return { file, pglite };
}

interface ManifestResponse {
  ok: boolean;
  json(): Promise<unknown>;
}

/** The worker's URL, from the manifest. Rejects when either cannot be had. */
export async function sqlWorkerUrl(
  fetchFile: (url: string) => Promise<ManifestResponse> = (url) => fetch(url),
): Promise<string> {
  const response = await fetchFile(SQL_MANIFEST_URL);
  if (!response.ok) throw new Error('The database is not available.');
  const manifest = parseSqlManifest(await response.json());
  if (!manifest) throw new Error('The database manifest is not valid.');
  return `${SQL_BASE_URL}${manifest.file}`;
}
