/**
 * Bundles the service worker: src/sw/index.ts to public/sw.js (git-ignored).
 *
 * Runs as `postbuild`, after `next build`, because two things are injected:
 *
 *   __SW_BUILD_ID__   `<contentRev>-<hash of the Next build id>`. Any change to either
 *                     changes the bytes of sw.js, which is what makes a browser install
 *                     the new worker.
 *   __SW_ASSETS__     every file under `<distDir>/static`, so install can precache the
 *                     whole build, lazy chunks included, and activate can drop old ones.
 *
 * `pnpm dev` does not run this: there is no service worker in development.
 *
 *   pnpm exec tsx scripts/build-sw.ts
 */
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { build } from 'esbuild';

// Resolved from the working directory, like the other scripts.
const ROOT = process.cwd();

export interface BuildInputs {
  /** `contentRev` of public/content/v1/manifest.json, or null before the first content build. */
  contentRev: string | null;
  /** Contents of `<distDir>/BUILD_ID`, or null when Next has not built. */
  nextBuildId: string | null;
}

/** Deterministic, short, and safe in a cache name or a log line. */
export function composeBuildId({ contentRev, nextBuildId }: BuildInputs): string {
  const content = contentRev ?? 'nocontent';
  if (nextBuildId === null) return `${content}-nobuild`;
  const hash = createHash('sha256').update(nextBuildId.trim()).digest('hex').slice(0, 10);
  return `${content}-${hash}`;
}

async function readIfPresent(file: string): Promise<string | null> {
  return existsSync(file) ? readFile(file, 'utf8') : null;
}

export async function readBuildInputs(root: string, distDir: string): Promise<BuildInputs> {
  const manifest = await readIfPresent(path.join(root, 'public/content/v1/manifest.json'));
  const contentRev = manifest ? (JSON.parse(manifest) as { contentRev?: string }).contentRev : null;
  const nextBuildId = await readIfPresent(path.join(root, distDir, 'BUILD_ID'));
  return { contentRev: contentRev ?? null, nextBuildId };
}

/** `/_next/static/...` for every file of the build. Source maps are never requested by a learner. */
export async function listBuildAssets(root: string, distDir: string): Promise<string[]> {
  const base = path.join(root, distDir, 'static');
  if (!existsSync(base)) return [];
  const entries = await readdir(base, { recursive: true, withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && !entry.name.endsWith('.map'))
    .map((entry) => path.relative(base, path.join(entry.parentPath, entry.name)))
    .map((file) => `/_next/static/${file.split(path.sep).map(encodeURIComponent).join('/')}`)
    .sort();
}

export interface WorkerBuild {
  buildId: string;
  assets: string[];
  code: string;
}

export async function buildServiceWorker(
  options: { root?: string; distDir?: string; buildId?: string } = {},
): Promise<WorkerBuild> {
  const root = options.root ?? ROOT;
  const distDir = options.distDir ?? process.env.NEXT_DIST_DIR ?? '.next';
  const buildId = options.buildId ?? composeBuildId(await readBuildInputs(root, distDir));
  const assets = await listBuildAssets(root, distDir);

  const bundle = await build({
    entryPoints: [path.join(ROOT, 'src/sw/index.ts')],
    bundle: true,
    write: false,
    format: 'iife',
    platform: 'browser',
    target: 'es2022',
    minify: true,
    legalComments: 'none',
    charset: 'ascii',
    tsconfig: path.join(ROOT, 'src/sw/tsconfig.json'),
    define: {
      __SW_BUILD_ID__: JSON.stringify(buildId),
      __SW_ASSETS__: JSON.stringify(assets),
    },
    logLevel: 'silent',
  });
  const code = bundle.outputFiles[0]?.text;
  if (code === undefined) throw new Error('esbuild produced no output for the service worker');
  return { buildId, assets, code };
}

async function main(): Promise<void> {
  const { buildId, assets, code } = await buildServiceWorker();
  const out = path.join(ROOT, 'public/sw.js');
  await mkdir(path.dirname(out), { recursive: true });
  await writeFile(out, code);
  console.log(
    `sw: public/sw.js, build ${buildId}, ${assets.length} build files, ${(code.length / 1024).toFixed(1)} KB`,
  );
}

// Run as a script, not when a test imports the functions above.
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(ROOT, 'scripts/build-sw.ts')
) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
