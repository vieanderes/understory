/**
 * The one program both checkers build: the worker in the browser and the content gate in
 * Node. Options are written as in a tsconfig file, so core names them without importing
 * the compiler; the adapter converts them.
 *
 * They repeat tsconfig.content.json, which already type-checks every lesson file, plus
 * `moduleDetection: force`: the learner's file is always a module, so a top-level `name`
 * or `total` never collides with a global. No DOM library: the sandbox worker has no
 * document, and a checker that allowed `document` would pass code the tests then crash
 * on. A unit test keeps the two option sets in step.
 */
export const CHECKER_COMPILER_OPTIONS = {
  target: 'es2022',
  lib: ['es2023'],
  types: [],
  skipLibCheck: true,
  strict: true,
  noUncheckedIndexedAccess: true,
  noImplicitOverride: true,
  noFallthroughCasesInSwitch: true,
  noEmit: true,
  module: 'esnext',
  moduleResolution: 'bundler',
  isolatedModules: true,
  moduleDetection: 'force',
} as const;

/** Names in the checker's virtual file system. Every relative import resolves to the learner's file, as in the harness. */
export const CHECKER_FILES = {
  code: '/solution.ts',
  tests: '/tests.ts',
  harness: '/harness.d.ts',
  sandbox: '/sandbox.d.ts',
  /** Where the standard library files live, for example `/lib/lib.es5.d.ts`. */
  libDir: '/lib/',
} as const;

/**
 * What the sandbox gives learner code beyond the language (docs/SANDBOX.md, "The worker"):
 * the console the harness captures, timers and `queueMicrotask`. The standard library
 * has none of them, and without them a learner's `console.log` would be underlined.
 */
export const SANDBOX_GLOBALS = `
interface Console {
  log(...data: unknown[]): void;
  info(...data: unknown[]): void;
  warn(...data: unknown[]): void;
  error(...data: unknown[]): void;
  debug(...data: unknown[]): void;
  table(data: unknown): void;
}
declare var console: Console;
declare function setTimeout(handler: (...args: any[]) => void, timeout?: number, ...args: any[]): number;
declare function clearTimeout(id: number | undefined): void;
declare function setInterval(handler: (...args: any[]) => void, timeout?: number, ...args: any[]): number;
declare function clearInterval(id: number | undefined): void;
declare function queueMicrotask(callback: () => void): void;
declare function structuredClone<T>(value: T): T;
`;
