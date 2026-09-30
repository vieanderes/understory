/**
 * Builds what a sql step needs in the browser:
 *
 *   public/sql/<pglite version>/pglite.wasm, pglite.data, initdb.wasm   copied from npm
 *   public/sql/<pglite version>/engine.<hash>.js   src/adapters/sql/worker.ts, bundled
 *   public/sql/engine.json                         names the worker, for the page
 *
 * The worker is a module worker in the same directory as PGlite's files, because PGlite
 * fetches them relative to its own `import.meta.url`. Git-ignored output, like
 * public/pyodide: the lockfile pins PGlite exactly. Runs before `dev` and `build`.
 *
 *   pnpm build:sql
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { copyFile, mkdir, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { build, type Plugin } from 'esbuild';

const ROOT = process.cwd();
const OUT_ROOT = path.join(ROOT, 'public/sql');

/** PGlite's files beside its JavaScript. The worker bundles the JavaScript. */
export const PGLITE_FILES = ['pglite.wasm', 'pglite.data', 'initdb.wasm'] as const;

export function pgliteDir(root: string = ROOT): string {
  return path.dirname(
    createRequire(path.join(root, 'package.json')).resolve('@electric-sql/pglite'),
  );
}

export function pgliteVersion(root: string = ROOT): string {
  const pkg = JSON.parse(readFileSync(path.join(pgliteDir(root), '../package.json'), 'utf8')) as {
    version: string;
  };
  return pkg.version;
}

/**
 * PGlite imports Node's modules for when it runs in Node, some of them at the top level.
 * A browser cannot resolve them, so they become empty modules: the code that uses them
 * never runs in a worker.
 */
const NODE_ONLY =
  /^(node:)?(fs|fs\/promises|path|url|zlib|stream|stream\/promises|crypto|module|child_process|os|util)$/;

const nodeStubs: Plugin = {
  name: 'node-stubs',
  setup(builder) {
    builder.onResolve({ filter: NODE_ONLY }, (args) => ({
      path: args.path,
      namespace: 'node-stub',
    }));
    builder.onLoad({ filter: /.*/, namespace: 'node-stub' }, () => ({
      contents: 'export default {};',
      loader: 'js',
    }));
  },
};

export interface EngineBuild {
  file: string;
  code: string;
  version: string;
}

export async function buildEngine(root: string = ROOT): Promise<EngineBuild> {
  const bundle = await build({
    entryPoints: [path.join(root, 'src/adapters/sql/worker.ts')],
    bundle: true,
    write: false,
    format: 'esm',
    platform: 'browser',
    target: 'es2022',
    minify: true,
    legalComments: 'none',
    charset: 'ascii',
    alias: { '@': path.join(root, 'src') },
    plugins: [nodeStubs],
    logLevel: 'silent',
  });
  const code = bundle.outputFiles[0]?.text;
  if (code === undefined) throw new Error('esbuild produced no output for the SQL worker');
  const hash = createHash('sha256').update(code).digest('hex').slice(0, 16);
  const version = pgliteVersion(root);
  return { file: `${version}/engine.${hash}.js`, code, version };
}

async function main(): Promise<void> {
  const { file, code, version } = await buildEngine();
  const out = path.join(OUT_ROOT, version);
  await mkdir(out, { recursive: true });
  // After an upgrade or a new worker, older files would otherwise ship alongside.
  for (const entry of await readdir(OUT_ROOT)) {
    if (entry !== version && entry !== 'engine.json')
      await rm(path.join(OUT_ROOT, entry), { recursive: true });
  }
  for (const entry of await readdir(out)) {
    if (entry.startsWith('engine.') && `${version}/${entry}` !== file)
      await rm(path.join(out, entry));
  }
  let bytes = code.length;
  for (const name of PGLITE_FILES) {
    await copyFile(path.join(pgliteDir(), name), path.join(out, name));
    bytes += (await stat(path.join(out, name))).size;
  }
  await writeFile(path.join(OUT_ROOT, file), code);
  await writeFile(
    path.join(OUT_ROOT, 'engine.json'),
    `${JSON.stringify({ file, pglite: version })}\n`,
  );
  console.log(
    `sql: public/sql/${file}, ${(bytes / 1024 / 1024).toFixed(1)} MB with PGlite ${version}`,
  );
}

// Run as a script, not when a test imports the functions above.
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(ROOT, 'scripts/build-sql.ts')
) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
