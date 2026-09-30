import path from 'node:path';
import vm from 'node:vm';
import { beforeAll, describe, expect, it } from 'vitest';
import { createNodeProgramChecker } from '@/adapters/typecheck/node';
import { buildChecker, collectLibs, type CheckerBuild } from '../../../../scripts/build-typecheck';

/** Runs the bundled worker in a bare context, as a browser worker would, and asks it once. */
function ask(code: string, request: unknown): Promise<unknown> {
  return new Promise((resolve) => {
    const listeners: ((event: { data: unknown }) => void)[] = [];
    const self = {
      postMessage: resolve,
      addEventListener: (_: string, listener: (event: { data: unknown }) => void) =>
        listeners.push(listener),
    };
    const context = vm.createContext({ self });
    vm.runInContext(code, context);
    for (const listener of listeners) listener({ data: request });
  });
}

let built: CheckerBuild;

beforeAll(async () => {
  built = await buildChecker();
}, 30_000);

describe('the checker worker bundle', () => {
  it('is named by the hash of its bytes, the same on every build', async () => {
    expect(built.file).toMatch(/^checker\.[0-9a-f]{16}\.js$/);
    expect((await buildChecker()).file).toBe(built.file);
  });

  it('answers as the Node checker does, with no file system and no network', async () => {
    const request = {
      code: 'export function f(n: number): string {\n  return n;\n}\nconsole.log([1].at(-1));\n',
      tests: "import { f } from './solution';\ntest('f', () => expect(f(1)).toBe('1'));\n",
    };
    const reply = await ask(built.code, { v: 1, id: 7, ...request });
    expect(reply).toEqual({ v: 1, id: 7, diagnostics: createNodeProgramChecker()(request) });
    expect((reply as { diagnostics: { code: number }[] }).diagnostics.map((d) => d.code)).toEqual([
      2322,
    ]);
  }, 30_000);

  it('ignores a message that is not a request', async () => {
    const reply = await Promise.race([
      ask(built.code, { hello: 'there' }),
      new Promise((resolve) => setTimeout(() => resolve('no reply'), 200)),
    ]);
    expect(reply).toBe('no reply');
  });
});

describe('collectLibs', () => {
  it('follows the references from ES2023 down to ES5', () => {
    const dir = path.dirname(require.resolve('typescript'));
    const libs = Object.keys(collectLibs(dir));
    expect(libs).toContain('lib.es2023.d.ts');
    expect(libs).toContain('lib.es5.d.ts');
    expect(libs).toContain('lib.es2015.promise.d.ts');
    expect(libs.some((name) => name.includes('dom'))).toBe(false);
  });
});
