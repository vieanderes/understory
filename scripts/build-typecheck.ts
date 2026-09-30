/**
 * Bundles the type-checker worker (src/adapters/typecheck/worker.ts) with the TypeScript
 * compiler, the standard library files its `lib` setting reaches and content/harness.d.ts:
 *
 *   public/typescript/checker.<hash>.js   the worker, about 4 MB, 1 MB compressed
 *   public/typescript/checker.json        names it, for the page (src/adapters/typecheck/assets.ts)
 *
 * Git-ignored output, like public/pyodide: the lockfile pins the compiler. Runs before
 * `dev` and `build`. The hash is of the bundle, so any change to the compiler, the
 * options or the worker gives a new name, and a service worker that keeps the old file
 * for good never serves it for the new manifest.
 *
 *   pnpm build:typecheck
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { mkdir, readdir, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { build, type Plugin } from 'esbuild';
import { CHECKER_COMPILER_OPTIONS } from '../src/core/typecheck/options';

const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, 'public/typescript');

function typescriptDir(root: string): string {
  return path.dirname(createRequire(path.join(root, 'package.json')).resolve('typescript'));
}

/** `lib.es2023.d.ts` and every file it references, down to `lib.es5.d.ts`. */
export function collectLibs(libDir: string): Record<string, string> {
  const libs: Record<string, string> = {};
  const queue = CHECKER_COMPILER_OPTIONS.lib.map((name) => `lib.${name}.d.ts`);
  for (let name = queue.shift(); name !== undefined; name = queue.shift()) {
    if (name in libs) continue;
    const text = readFileSync(path.join(libDir, name), 'utf8');
    libs[name] = text;
    for (const match of text.matchAll(/^\/\/\/\s*<reference lib="([\w.]+)"\s*\/>/gm)) {
      queue.push(`lib.${match[1]?.toLowerCase()}.d.ts`);
    }
  }
  return libs;
}

function virtualModules(root: string): Plugin {
  const modules: Record<string, () => string> = {
    'understory:typescript-libs': () =>
      `export default ${JSON.stringify(collectLibs(typescriptDir(root)))};`,
    'understory:checker-harness': () =>
      `export default ${JSON.stringify(readFileSync(path.join(root, 'content/harness.d.ts'), 'utf8'))};`,
  };
  return {
    name: 'understory-virtual',
    setup(builder) {
      builder.onResolve({ filter: /^understory:/ }, (args) => ({
        path: args.path,
        namespace: 'virtual',
      }));
      builder.onLoad({ filter: /.*/, namespace: 'virtual' }, (args) => {
        const make = modules[args.path];
        if (!make) throw new Error(`Unknown virtual module ${args.path}`);
        return { contents: make(), loader: 'js' };
      });
    },
  };
}

export interface CheckerBuild {
  file: string;
  code: string;
  typescript: string;
}

export async function buildChecker(root: string = ROOT): Promise<CheckerBuild> {
  const bundle = await build({
    entryPoints: [path.join(root, 'src/adapters/typecheck/worker.ts')],
    bundle: true,
    write: false,
    format: 'iife',
    platform: 'browser',
    target: 'es2022',
    minify: true,
    legalComments: 'none',
    charset: 'ascii',
    alias: { '@': path.join(root, 'src') },
    plugins: [virtualModules(root)],
    logLevel: 'silent',
  });
  const code = bundle.outputFiles[0]?.text;
  if (code === undefined) throw new Error('esbuild produced no output for the checker worker');
  const hash = createHash('sha256').update(code).digest('hex').slice(0, 16);
  const pkg = JSON.parse(
    readFileSync(path.join(typescriptDir(root), '../package.json'), 'utf8'),
  ) as {
    version: string;
  };
  return { file: `checker.${hash}.js`, code, typescript: pkg.version };
}

async function main(): Promise<void> {
  const { file, code, typescript } = await buildChecker();
  await mkdir(OUT_DIR, { recursive: true });
  // One checker at a time: an older bundle would otherwise ship alongside the new one.
  for (const entry of await readdir(OUT_DIR)) {
    if (entry !== file) await rm(path.join(OUT_DIR, entry));
  }
  await writeFile(path.join(OUT_DIR, file), code);
  await writeFile(path.join(OUT_DIR, 'checker.json'), `${JSON.stringify({ file, typescript })}\n`);
  console.log(
    `typecheck: public/typescript/${file}, ${(code.length / 1024 / 1024).toFixed(1)} MB, TypeScript ${typescript}`,
  );
}

// Run as a script, not when a test imports the functions above.
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(ROOT, 'scripts/build-typecheck.ts')
) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
