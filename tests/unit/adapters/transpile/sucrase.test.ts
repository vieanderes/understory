import vm from 'node:vm';
import { describe, expect, it } from 'vitest';
import { loadTranspiler } from '@/adapters/transpile/sucrase';
import { TranspileError } from '@/core/running/transpile-error';

/** Runs transpiled output as a plain script and returns what it exported. */
function evaluate(js: string): Record<string, unknown> {
  const context = vm.createContext({ exports: {} });
  vm.runInContext(js, context);
  return context.exports as Record<string, unknown>;
}

function caught(run: () => unknown): unknown {
  try {
    run();
  } catch (error) {
    return error;
  }
  return undefined;
}

describe('sucrase transpiler', () => {
  it('loads once and hands out the same instance', async () => {
    expect(await loadTranspiler()).toBe(await loadTranspiler());
  });

  it('strips TypeScript types, interfaces, generics and enums', async () => {
    const transpiler = await loadTranspiler();
    const js = transpiler.strip(
      `interface Point { x: number }
type Id = string | number;
enum Colour { Red, Green }
function first<T>(items: readonly T[]): T | undefined { return items[0]; }
const p: Point = { x: first<number>([4, 5]) as number };
exports.result = [p.x, Colour.Green];`,
      'ts',
    );
    expect(js).not.toMatch(/interface|: number|<T>|as number/);
    expect(evaluate(js).result).toEqual([4, 1]);
  });

  it('turns tsx into calls to the automatic JSX runtime, keeping every line', async () => {
    const transpiler = await loadTranspiler();
    const src = [
      'type Props = { name: string };',
      'export function Hello({ name }: Props) {',
      '  return (',
      '    <p className="greeting">',
      '      Hello {name}',
      '    </p>',
      '  );',
      '}',
      'exports.after = 1;',
    ].join('\n');
    const js = transpiler.strip(src, 'tsx');
    expect(js).toContain('require("react/jsx-runtime")');
    expect(js).not.toMatch(/<p|Props =|jsxDEV/);
    const lines = js.split('\n');
    expect(lines).toHaveLength(src.split('\n').length);
    expect(lines[8]).toContain('exports.after = 1');
    const calls: unknown[][] = [];
    const context = vm.createContext({
      exports: {},
      require: () => {
        const record = (...args: unknown[]) => calls.push(args);
        return { jsx: record, jsxs: record };
      },
    });
    vm.runInContext(js, context);
    (context.exports as { Hello: (props: object) => unknown }).Hello({ name: 'Ada' });
    expect(calls[0]?.[0]).toBe('p');
    expect(calls[0]?.[1]).toMatchObject({ className: 'greeting', children: ['Hello ', 'Ada'] });
  });

  it('reads angle brackets in plain ts as type assertions, not JSX', async () => {
    const transpiler = await loadTranspiler();
    expect(evaluate(transpiler.strip('exports.n = <number>(1 as unknown);', 'ts')).n).toBe(1);
  });

  it('keeps every statement on its line, so runtime line numbers stay true', async () => {
    const transpiler = await loadTranspiler();
    const src =
      'interface A {\n  a: number;\n}\n\nexport function f(a: A): number {\n  return a.a;\n}';
    const js = transpiler.strip(src, 'ts');
    expect(js.split('\n')).toHaveLength(src.split('\n').length);
    expect(js.split('\n')[5]).toContain('return a.a');
  });

  it('turns exports into a plain script that still declares top-level names', async () => {
    const transpiler = await loadTranspiler();
    const js = transpiler.strip(
      `export function add(a, b) { return a + b; }
export const two = 2;
export class Box {}
const hidden = 1;
export { hidden as shown };
export default function main() { return 'main'; }`,
      'js',
    );
    expect(js).not.toMatch(/^\s*export\s/m);
    const exported = evaluate(`${js}\nexports.viaTopLevel = add(two, 1) + (typeof Box) + main();`);
    expect(Object.keys(exported).sort()).toEqual([
      'Box',
      'add',
      'default',
      'shown',
      'two',
      'viaTopLevel',
    ]);
    expect(exported.viaTopLevel).toBe('3functionmain');
  });

  it('handles export default of an expression', async () => {
    const transpiler = await loadTranspiler();
    expect(evaluate(transpiler.strip('export default 6 * 7;', 'js')).default).toBe(42);
  });

  it('does not touch the word export inside strings and templates', async () => {
    const transpiler = await loadTranspiler();
    const src = 'exports.text = `\nexport const a = 1;\n` + "export default";';
    expect(evaluate(transpiler.strip(src, 'js')).text).toBe(
      '\nexport const a = 1;\nexport default',
    );
  });

  it('rewrites import to require, which the harness answers', async () => {
    const transpiler = await loadTranspiler();
    const js = transpiler.strip("import { add } from './solution';\nadd(1, 2);", 'ts');
    expect(js).toContain("require('./solution')");
    expect(js).not.toMatch(/^import /m);
  });

  it('leaves modern syntax alone', async () => {
    const transpiler = await loadTranspiler();
    const js = transpiler.strip(
      'class A { #n = 1; get n() { return this.#n ?? 0; } }\nconst v = new A()?.n;',
      'js',
    );
    expect(js).toContain('#n = 1');
    expect(js).toContain('?.n');
  });

  it('reports a syntax error as a TranspileError with the line and a clean message', async () => {
    const transpiler = await loadTranspiler();
    const error = caught(() => transpiler.strip('const a: number = 1;\nfunction ( {', 'ts'));
    expect(error).toBeInstanceOf(TranspileError);
    expect(error).toMatchObject({ name: 'TranspileError', line: 2, message: 'Unexpected token' });
  });

  it('rejects TypeScript syntax in a JavaScript file', async () => {
    const transpiler = await loadTranspiler();
    const error = caught(() => transpiler.strip('const a = 1;\n\nconst b: number = 2;', 'js'));
    expect(error).toBeInstanceOf(TranspileError);
    expect(error).toMatchObject({ line: 3 });
  });
});
