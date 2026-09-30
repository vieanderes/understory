/*
 * The globals that the Understory test harness gives to every tests.ts file. This file
 * only declares their types, so that `tsc -p tsconfig.content.json` can check lesson code.
 * The implementation is the harness string in src/core/running/harness.ts.
 *
 * A tests.ts file imports the code under test from './solution'. At run time the runner
 * binds that import to whatever is being checked: the learner's code in the browser, and
 * the reference solution and then the starter in the CI gate.
 */

interface Matchers {
  /** Same value or same object, compared with `Object.is`. */
  toBe(expected: unknown): void;
  /** Same structure, compared deeply. */
  toEqual(expected: unknown): void;
  toBeTruthy(): void;
  toBeFalsy(): void;
  /** The function under test throws. A string or pattern must match the message. */
  toThrow(expected?: string | RegExp): void;
  /** An array contains the item, or a string contains the text. */
  toContain(item: unknown): void;
  /** Equal to `digits` decimal places. The default is 2. */
  toBeCloseTo(expected: number, digits?: number): void;
  toHaveLength(length: number): void;
  toBeNull(): void;
  toBeUndefined(): void;
  toBeDefined(): void;
  toBeInstanceOf(expected: abstract new (...args: never[]) => unknown): void;
  /** A string matches the pattern, or contains the text. */
  toMatch(pattern: string | RegExp): void;
  toBeGreaterThan(expected: number): void;
  toBeGreaterThanOrEqual(expected: number): void;
  toBeLessThan(expected: number): void;
  toBeLessThanOrEqual(expected: number): void;
}

declare function describe(name: string, fn: () => void): void;
declare function it(name: string, fn: () => void | Promise<void>): void;

interface Expectation extends Matchers {
  not: Matchers;
}

declare function test(name: string, fn: () => void | Promise<void>): void;
declare function expect(actual: unknown): Expectation;
/** The lines the learner's code printed so far, as they appear in the output. */
declare function printed(): string[];
