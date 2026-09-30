import vm from 'node:vm';
import { describe, expect, it } from 'vitest';
import { HARNESS_V1 } from '@/core/running/harness';
import { LIMITS, LOG_TRUNCATION_NOTICE } from '@/core/running/limits';
import { messageOf, runHarness } from './run-harness';

describe('harness source', () => {
  it('stays free of the two sequences a String.raw template cannot hold', () => {
    expect(HARNESS_V1).not.toContain('`');
    expect(HARNESS_V1).not.toContain('${');
  });

  it('uses nothing from a browser or from Node', () => {
    // An empty context has ECMAScript built-ins only. Evaluation must not throw.
    const context = vm.createContext({});
    expect(() => vm.runInContext(HARNESS_V1, context)).not.toThrow();
    expect(HARNESS_V1).not.toMatch(/\b(window|document|self|process|require\(')\b/);
  });

  it('repeats the limits of limits.ts exactly', () => {
    const constant = (name: string): string | undefined =>
      new RegExp(`var ${name} = ([^;]+);`).exec(HARNESS_V1)?.[1];
    expect(constant('MAX_LOG_LINES')).toBe(String(LIMITS.maxLogLines));
    expect(constant('MAX_LOG_BYTES')).toBe(String(LIMITS.maxLogBytes));
    expect(constant('MAX_LOG_LINE_LENGTH')).toBe(String(LIMITS.maxLogLineLength));
    expect(constant('MAX_TESTS')).toBe(String(LIMITS.maxTests));
    expect(constant('MAX_NAME_LENGTH')).toBe(String(LIMITS.maxTestNameLength));
    expect(constant('MAX_MESSAGE_LENGTH')).toBe(String(LIMITS.maxMessageLength));
    expect(constant('TRUNCATION_NOTICE')).toBe(`'${LOG_TRUNCATION_NOTICE}'`);
  });

  it('takes the host log sink off the global object', async () => {
    const { globals } = await runHarness('', "test('t', () => {});");
    expect(globals).not.toContain('__hostLog');
    expect(globals).toEqual(expect.arrayContaining(['test', 'it', 'describe', 'expect']));
  });
});

describe('running tests', () => {
  it('lets tests call the top-level functions of the code', async () => {
    const { report } = await runHarness(
      'function add(a, b) { return a + b; }\nconst twice = (n) => n * 2;\nclass Box { constructor(v) { this.v = v; } }',
      `test('function', () => { expect(add(1, 2)).toBe(3); });
       test('const', () => { expect(twice(4)).toBe(8); });
       test('class', () => { expect(new Box(1).v).toBe(1); });`,
    );
    expect(report).toEqual({
      status: 'passed',
      tests: [
        { name: 'function', passed: true },
        { name: 'const', passed: true },
        { name: 'class', passed: true },
      ],
      logs: [],
    });
  });

  it('runs tests in order and a throwing test does not stop later ones', async () => {
    const { report } = await runHarness(
      '',
      `test('first', () => { throw new TypeError('boom'); });
       test('second', () => { expect(1).toBe(2); });
       test('third', () => { throw 'a string'; });
       test('fourth', () => {});`,
    );
    expect(report.status).toBe('failed');
    expect(report.tests).toEqual([
      { name: 'first', passed: false, message: 'TypeError: boom' },
      { name: 'second', passed: false, message: 'Expected 2, received 1' },
      { name: 'third', passed: false, message: 'Thrown: "a string"' },
      { name: 'fourth', passed: true },
    ]);
  });

  it('awaits async tests, one after the other', async () => {
    const { report } = await runHarness(
      'const order = [];\nconst wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));',
      `test('slow', async () => { await wait(20); order.push('slow'); });
       test('fast', async () => { order.push('fast'); expect(order).toEqual(['slow', 'fast']); });
       test('rejects', async () => { await wait(1); throw new Error('late'); });
       test('thenable', () => ({ then: (resolve) => resolve() }));`,
    );
    expect(report.tests.map((t) => [t.name, t.passed, t.message])).toEqual([
      ['slow', true, undefined],
      ['fast', true, undefined],
      ['rejects', false, 'Error: late'],
      ['thenable', true, undefined],
    ]);
  });

  it('prefixes names with describe blocks and accepts it() as an alias', async () => {
    const { report } = await runHarness(
      '',
      "describe('add', () => { describe('edge', () => { it('zero', () => {}); }); test('one', () => {}); });",
    );
    expect(report.tests.map((t) => t.name)).toEqual(['add > edge > zero', 'add > one']);
  });

  it('reports zero registered tests as an error, never as a pass', async () => {
    const { report } = await runHarness('const a = 1;', '');
    expect(report.status).toBe('error');
    expect(report.error).toEqual({ name: 'NoTests', message: 'No tests were registered.' });
  });

  it('fails a test whose body is not a function, and refuses nested registration', async () => {
    const { report } = await runHarness(
      '',
      "test('no body'); test('outer', () => { test('inner', () => {}); });",
    );
    expect(report.tests).toEqual([
      {
        name: 'no body',
        passed: false,
        message: 'Error: test() needs a function as its second argument',
      },
      { name: 'outer', passed: false, message: 'Error: test() cannot be called inside a test' },
    ]);
  });

  it('bounds the number of tests and the length of names and messages', async () => {
    const { report } = await runHarness(
      '',
      `for (let i = 0; i < 300; i++) test('n'.repeat(500) + i, () => { throw new Error('m'.repeat(5000)); });`,
    );
    expect(report.tests).toHaveLength(LIMITS.maxTests);
    expect(report.tests[0]?.name).toHaveLength(LIMITS.maxTestNameLength);
    expect(report.tests[0]?.message).toHaveLength(LIMITS.maxMessageLength);
  });
});

describe('load errors', () => {
  it('reports a runtime error in the code with its line', async () => {
    const { report } = await runHarness(
      'const a = 1;\nconst b = null;\nb.length;',
      "test('t', () => {});",
    );
    expect(report.status).toBe('error');
    expect(report.tests).toEqual([]);
    expect(report.error?.name).toBe('TypeError');
    expect(report.error?.line).toBe(3);
  });

  it('reports the line of the innermost learner frame', async () => {
    const { report } = await runHarness(
      'function f() {\n  return undefinedName;\n}\n\nf();',
      "test('t', () => {});",
    );
    expect(report.error).toMatchObject({ name: 'ReferenceError', line: 2 });
  });

  it('places an error in the tests in the message, not in the line', async () => {
    const { report } = await runHarness(
      'const a = 1;\nconst b = 2;',
      "test('t', () => {});\nmissing();",
    );
    expect(report.error?.line).toBeUndefined();
    expect(report.error?.message).toBe('missing is not defined (tests, line 2)');
  });

  it('catches a syntax error instead of dying', async () => {
    const { report } = await runHarness('let a;\nlet a;', "test('t', () => {});");
    expect(report.status).toBe('error');
    expect(report.error?.name).toBe('SyntaxError');
  });

  it('describes a thrown non-error', async () => {
    const { report } = await runHarness('throw { code: 7 };', '');
    expect(report.error).toEqual({ name: 'Error', message: 'Thrown: {code: 7}' });
  });

  it('runs the code in strict mode, as a module would', async () => {
    const { report } = await runHarness('undeclared = 1;', "test('t', () => {});");
    expect(report.error?.name).toBe('ReferenceError');
  });

  it('keeps logs printed before the error', async () => {
    const { report } = await runHarness('console.log("before");\nthrow new Error("stop");', '');
    expect(report.logs).toEqual(['before']);
    expect(report.error).toMatchObject({ name: 'Error', message: 'stop', line: 2 });
  });
});

describe('module shims', () => {
  it('collects CommonJS exports and hands them to a relative require', async () => {
    const { report } = await runHarness(
      'function add(a, b) { return a + b; } exports.add = add; exports.default = add;',
      `const mod = require('./solution');
       test('named', () => { expect(mod.add(1, 1)).toBe(2); });
       test('default', () => { expect(mod.default).toBe(add); });
       test('module.exports', () => { expect(module.exports).toBe(mod); });`,
    );
    expect(report.status).toBe('passed');
  });

  it('refuses a package import with a plain message', async () => {
    const { report } = await runHarness("const fs = require('fs');", '');
    expect(report.error?.message).toBe('Imports are not available here: "fs"');
  });
});

describe('matchers', () => {
  const cases: [body: string, message: string | null][] = [
    // toBe
    ['expect(3).toBe(3)', null],
    ['expect("21").toBe(3)', 'Expected 3, received "21"'],
    ['expect(NaN).toBe(NaN)', null],
    ['expect(0).toBe(-0)', 'Expected -0, received 0'],
    [
      'expect([1]).toBe([1])',
      'Expected [1], received [1] (equal content, but not the same object: use toEqual)',
    ],
    ['expect(1).not.toBe(2)', null],
    ['expect(1).not.toBe(1)', 'Expected anything but 1'],
    ['expect(undefined).toBe(null)', 'Expected null, received undefined'],
    ['expect(10n).toBe(11n)', 'Expected 11n, received 10n'],
    // toEqual
    ['expect([1, [2, { a: 3 }]]).toEqual([1, [2, { a: 3 }]])', null],
    ['expect([1, 2]).toEqual([1, 3])', 'Expected [1, 3], received [1, 2]'],
    ['expect([1, 2]).toEqual([1, 2, 3])', 'Expected [1, 2, 3], received [1, 2]'],
    ['expect({ a: 1, b: undefined }).toEqual({ a: 1 })', null],
    ['expect({ a: 1 }).toEqual({ a: 1, b: 2 })', 'Expected {a: 1, b: 2}, received {a: 1}'],
    [
      'expect({ a: 1, c: 2 }).toEqual({ a: 1, b: 2 })',
      'Expected {a: 1, b: 2}, received {a: 1, c: 2}',
    ],
    ['expect({ "a-b": NaN }).toEqual({ "a-b": NaN })', null],
    ['expect(new Map([[1, { a: [NaN] }]])).toEqual(new Map([[1, { a: [NaN] }]]))', null],
    ['expect(new Map([[{ k: 1 }, 1]])).toEqual(new Map([[{ k: 1 }, 1]]))', null],
    [
      'expect(new Map([[1, 2]])).toEqual(new Map([[1, 3]]))',
      'Expected Map {1 => 3}, received Map {1 => 2}',
    ],
    ['expect(new Map([[1, 2]])).toEqual(new Map())', 'Expected Map {}, received Map {1 => 2}'],
    ['expect(new Set([1, [2]])).toEqual(new Set([[2], 1]))', null],
    [
      'expect(new Set([1, 2])).toEqual(new Set([1, 3]))',
      'Expected Set {1, 3}, received Set {1, 2}',
    ],
    ['expect(new Date(5)).toEqual(new Date(5))', null],
    [
      'expect(new Date(0)).toEqual(new Date(1))',
      'Expected Date(1970-01-01T00:00:00.001Z), received Date(1970-01-01T00:00:00.000Z)',
    ],
    ['expect(new Date(NaN)).toEqual(new Date(NaN))', null],
    ['expect(/a/g).toEqual(/a/g)', null],
    ['expect(/a/g).toEqual(/a/i)', 'Expected /a/i, received /a/g'],
    ['expect(new Error("x")).toEqual(new Error("x"))', null],
    ['expect(new Error("x")).toEqual(new Error("y"))', 'Expected Error: y, received Error: x'],
    ['expect([1]).toEqual({ 0: 1 })', 'Expected {"0": 1}, received [1]'],
    ['expect(new Uint8Array([1, 2])).toEqual(new Uint8Array([1, 2]))', null],
    [
      'expect(new Uint8Array([1])).toEqual(new Uint8Array([2]))',
      'Expected Uint8Array [2], received Uint8Array [1]',
    ],
    ['expect(null).toEqual({})', 'Expected {}, received null'],
    ['expect(1).toEqual("1")', 'Expected "1", received 1'],
    ['expect({ a: 1 }).not.toEqual({ a: 1 })', 'Expected a value not equal to {a: 1}'],
    [
      'class P { constructor() { this.x = 1; } } expect(new P()).toEqual({ x: 1 })',
      'Expected {x: 1}, received P {x: 1}',
    ],
    ['const a = { n: 1 }; a.self = a; const b = { n: 1 }; b.self = b; expect(a).toEqual(b)', null],
    [
      'const a = { n: 1 }; a.self = a; expect(a).toEqual({ n: 1, self: { n: 2 } })',
      'Expected {n: 1, self: {n: 2}}, received {n: 1, self: [Circular]}',
    ],
    // truthiness and friends
    ['expect(1).toBeTruthy()', null],
    ['expect(0).toBeTruthy()', 'Expected a truthy value, received 0'],
    ['expect("").toBeFalsy()', null],
    ['expect("a").toBeFalsy()', 'Expected a falsy value, received "a"'],
    ['expect(1).not.toBeTruthy()', 'Expected a falsy value, received 1'],
    ['expect(null).toBeNull()', null],
    ['expect(0).toBeNull()', 'Expected null, received 0'],
    ['expect(undefined).toBeUndefined()', null],
    ['expect(0).toBeUndefined()', 'Expected undefined, received 0'],
    ['expect(0).toBeDefined()', null],
    ['expect(undefined).toBeDefined()', 'Expected a defined value, received undefined'],
    ['expect([]).toBeInstanceOf(Array)', null],
    ['expect({}).toBeInstanceOf(Array)', 'Expected an instance of Array, received {}'],
    ['expect({}).toBeInstanceOf("Array")', 'toBeInstanceOf needs a class, received "Array"'],
    // toContain, toMatch, toHaveLength
    ['expect([1, 2]).toContain(2)', null],
    ['expect([1, 2]).toContain(3)', 'Expected [1, 2] to contain 3'],
    ['expect([NaN]).toContain(NaN)', null],
    ['expect("hello").toContain("ell")', null],
    ['expect("hello").toContain("z")', 'Expected "hello" to contain "z"'],
    ['expect(new Set([1])).toContain(1)', null],
    ['expect(null).toContain(1)', 'Expected null to contain 1'],
    ['expect(5).toContain(1)', 'Expected 5 to contain 1'],
    ['expect([1]).not.toContain(1)', 'Expected [1] not to contain 1'],
    ['expect("abc").toMatch(/b/)', null],
    ['expect("abc").toMatch("bc")', null],
    ['expect("abc").toMatch(/z/)', 'Expected "abc" to match /z/'],
    ['expect(1).toMatch(/z/)', 'toMatch needs a string, received 1'],
    ['expect([1, 2]).toHaveLength(2)', null],
    ['expect("ab").toHaveLength(3)', 'Expected length 3, received length 2 for "ab"'],
    ['expect(5).toHaveLength(1)', 'toHaveLength needs a value with a length, received 5'],
    ['expect([1]).not.toHaveLength(1)', 'Expected a length other than 1'],
    // numbers
    ['expect(0.1 + 0.2).toBeCloseTo(0.3)', null],
    ['expect(0.35).toBeCloseTo(0.3)', 'Expected 0.3 to 2 decimal places, received 0.35'],
    ['expect(0.35).toBeCloseTo(0.3, 0)', null],
    ['expect(Infinity).toBeCloseTo(Infinity)', null],
    ['expect("1").toBeCloseTo(1)', 'toBeCloseTo compares numbers, received "1" and 1'],
    ['expect(1).not.toBeCloseTo(1)', 'Expected a value not close to 1, received 1'],
    ['expect(3).toBeGreaterThan(2)', null],
    ['expect(2).toBeGreaterThan(3)', 'Expected a value greater than 3, received 2'],
    ['expect(2).toBeGreaterThanOrEqual(2)', null],
    ['expect(1).toBeGreaterThanOrEqual(2)', 'Expected a value of at least 2, received 1'],
    ['expect(2).toBeLessThan(3)', null],
    ['expect(3).toBeLessThan(2)', 'Expected a value less than 2, received 3'],
    ['expect(2).toBeLessThanOrEqual(2)', null],
    ['expect(3).toBeLessThanOrEqual(2)', 'Expected a value of at most 2, received 3'],
    ['expect("3").toBeGreaterThan(2)', 'toBeGreaterThan compares numbers, received "3" and 2'],
    ['expect(3).not.toBeLessThan(5)', 'Expected a value not less than 5, received 3'],
    // toThrow
    ['expect(() => { throw new Error("no") }).toThrow()', null],
    ['expect(() => 5).toThrow()', 'Expected the function to throw, but it returned 5'],
    ['expect(() => { throw new Error("bad input") }).toThrow("input")', null],
    ['expect(() => { throw new Error("bad input") }).toThrow(/^bad/)', null],
    [
      'expect(() => { throw new Error("bad") }).toThrow("good")',
      'Expected the function to throw an error matching "good", but it threw Error: bad',
    ],
    ['expect(() => { throw new RangeError("r") }).toThrow(RangeError)', null],
    [
      'expect(() => { throw new RangeError("r") }).toThrow(TypeError)',
      'Expected the function to throw a TypeError, but it threw RangeError: r',
    ],
    [
      'expect(() => 1).toThrow(TypeError)',
      'Expected the function to throw a TypeError, but it returned 1',
    ],
    ['expect(() => { throw "text" }).toThrow("tex")', null],
    ['expect(() => 1).not.toThrow()', null],
    [
      'expect(() => { throw new Error("x") }).not.toThrow()',
      'Expected the function not to throw, but it threw Error: x',
    ],
    [
      'expect(5).toThrow()',
      'toThrow needs a function. Wrap the call: expect(() => run()).toThrow()',
    ],
  ];

  it.each(cases)('%s', async (body, message) => {
    expect(await messageOf(body)).toBe(message);
  });
});

describe('formatting', () => {
  const cases: [value: string, shown: string][] = [
    ['function named() {}', '[Function named]'],
    ['() => {}', '[Function anonymous]'],
    ['Symbol("s")', 'Symbol(s)'],
    ['true', 'true'],
    ['[]', '[]'],
    ['Object.create(null)', '{}'],
    ['new Date(NaN)', 'Date(Invalid)'],
    ['{ a: { b: { c: { d: { e: { f: 1 } } } } } }', '{a: {b: {c: {d: {e: [Object]}}}}}'],
    ['[[[[[[1]]]]]]', '[[[[[[Array]]]]]]'],
    [
      'Array.from({ length: 60 }, (_, i) => i).slice(45)',
      '[45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59]',
    ],
    ['new Proxy({}, { ownKeys() { throw new Error("trap"); } })', '[Unformattable value]'],
  ];

  it.each(cases)('%s', async (value, shown) => {
    expect(await messageOf(`expect(${value}).toBe(0)`)).toBe(`Expected 0, received ${shown}`);
  });

  it('shortens long collections and long values', async () => {
    const list = await messageOf('expect(Array.from({ length: 60 }, (_, i) => i)).toBe(0)');
    expect(list).toContain('49, ... 10 more]');
    const map = await messageOf(
      'expect(new Map(Array.from({ length: 51 }, (_, i) => [i, i]))).toBe(0)',
    );
    expect(map).toContain('... 1 more}');
    const set = await messageOf('expect(new Set(Array.from({ length: 52 }, (_, i) => i))).toBe(0)');
    expect(set).toContain('... 2 more}');
    const object = await messageOf(
      'expect(Object.fromEntries(Array.from({ length: 53 }, (_, i) => ["k" + i, i]))).toBe(0)',
    );
    expect(object).toContain('... 3 more}');
    const text = await messageOf('expect("x".repeat(5000)).toBe(0)');
    expect(text?.length).toBeLessThan(600);
    expect(text).toMatch(/\.\.\.$/);
  });
});

describe('console capture', () => {
  it('lets tests read what the learner printed, so a first challenge needs no function', async () => {
    const { report } = await runHarness(
      'console.log("Hello");\nconsole.log(2 + 3);',
      'test("prints", () => { expect(printed()).toEqual(["Hello", "5"]); });',
    );
    expect(report.status).toBe('passed');
  });

  it('gives tests a copy of the printed lines, which they cannot change', async () => {
    const { report } = await runHarness(
      'console.log("one");',
      'test("copy", () => { printed().push("x"); expect(printed()).toEqual(["one"]); });',
    );
    expect(report.status).toBe('passed');
  });

  it('captures every level, formats values and streams to the host', async () => {
    const { report, streamed } = await runHarness(
      `console.log('text', 1, { a: [1, 'two'] }, null, undefined);
       console.info('info'); console.debug('debug');
       console.warn('careful'); console.error(new TypeError('bad'));
       console.log('two\\nlines');
       console.table([1]); console.group('g'); console.groupEnd(); console.time('t'); console.timeEnd('t'); console.trace('x');
       console.assert(true, 'fine'); console.assert(false, 'wrong', 2);`,
      "test('t', () => { console.log('inside a test'); });",
    );
    expect(report.logs).toEqual([
      'text 1 {a: [1, "two"]} null undefined',
      'info',
      'debug',
      'warn: careful',
      'error: TypeError: bad',
      'two',
      'lines',
      '[1]',
      'error: Assertion failed wrong 2',
      'inside a test',
    ]);
    expect(streamed).toEqual(report.logs);
  });

  it('caps the log at 200 lines and says so once', async () => {
    const { report, streamed } = await runHarness(
      'for (let i = 0; i < 1000; i++) console.log("line " + i);',
      "test('t', () => {});",
    );
    expect(report.logs).toHaveLength(LIMITS.maxLogLines + 1);
    expect(report.logs[199]).toBe('line 199');
    expect(report.logs[200]).toBe(LOG_TRUNCATION_NOTICE);
    expect(streamed).toHaveLength(LIMITS.maxLogLines + 1);
  });

  it('caps the log at 64 KB', async () => {
    const { report } = await runHarness(
      'for (let i = 0; i < 100; i++) console.log("x".repeat(3000));',
      "test('t', () => {});",
    );
    const size = report.logs.reduce((sum, line) => sum + line.length + 1, 0);
    expect(size).toBeLessThanOrEqual(LIMITS.maxLogBytes + LOG_TRUNCATION_NOTICE.length + 1);
    expect(report.logs.at(-1)).toBe(LOG_TRUNCATION_NOTICE);
    expect(report.logs.length).toBeLessThan(30);
  });

  it('clips one very long line', async () => {
    const { report } = await runHarness('console.log("y".repeat(10000));', "test('t', () => {});");
    expect(report.logs[0]).toHaveLength(LIMITS.maxLogLineLength);
  });

  it('survives a host sink that throws', async () => {
    const context = vm.createContext({
      __hostLog: () => {
        throw new Error('sink down');
      },
    });
    vm.runInContext(HARNESS_V1, context);
    (context.__load as (code: string, tests: string) => void)(
      'console.log("still here");',
      "test('t', () => {});",
    );
    const report = (await (context.__run as () => Promise<unknown>)()) as { logs: string[] };
    expect(report.logs).toEqual(['still here']);
  });

  it('works when the host appends code instead of calling __load', async () => {
    const context = vm.createContext({});
    vm.runInContext(
      `${HARNESS_V1}\nfunction add(a, b) { return a + b; }\ntest('t', () => { expect(add(1, 1)).toBe(2); });`,
      context,
    );
    const report = (await (context.__run as () => Promise<unknown>)()) as { status: string };
    expect(report.status).toBe('passed');
  });
});

describe('host hooks', () => {
  it('takes every hook off the global object', async () => {
    const { globals } = await runHarness('', "test('t', () => {});", {
      modules: {},
      matchers: {},
      afterEach: () => undefined,
    });
    for (const hook of ['__hostModules', '__hostMatchers', '__hostAfterEach']) {
      expect(globals).not.toContain(hook);
    }
  });

  it('resolves a package import to a module the host provides', async () => {
    const { report } = await runHarness(
      "var lib = require('lib'); exports.twice = function (n) { return lib.double(n); };",
      "test('t', () => { expect(require('./solution').twice(2)).toBe(4); });",
      { modules: { lib: { double: (n: number) => n * 2 } } },
    );
    expect(report.status).toBe('passed');
  });

  it('still refuses a package the host does not provide', async () => {
    const { report } = await runHarness("require('other');", "test('t', () => {});", {
      modules: { lib: {} },
    });
    expect(report.error?.message).toBe('Imports are not available here: "other"');
  });

  it('adds host matchers to expect, with both messages', async () => {
    const matchers = {
      toBeEven: (actual: unknown) => ({
        pass: typeof actual === 'number' && actual % 2 === 0,
        message: `Expected ${String(actual)} to be even`,
        negatedMessage: `Expected ${String(actual)} to be odd`,
      }),
    };
    const { report } = await runHarness(
      '',
      `test('plain', () => { expect(2).toBeEven(); });
       test('fails', () => { expect(3).toBeEven(); });
       test('negated', () => { expect(2).not.toBeEven(); });`,
      { matchers },
    );
    expect(report.tests).toEqual([
      { name: 'plain', passed: true },
      { name: 'fails', passed: false, message: 'Expected 3 to be even' },
      { name: 'negated', passed: false, message: 'Expected 2 to be odd' },
    ]);
  });

  it('never lets a host matcher replace a built-in one', async () => {
    const { report } = await runHarness('', "test('t', () => { expect(1).toBe(1); });", {
      matchers: {
        toBe: () => ({ pass: false, message: 'replaced', negatedMessage: 'replaced' }),
      },
    });
    expect(report.status).toBe('passed');
  });

  it('runs the host clean-up after every test, and a failing clean-up fails that test', async () => {
    let calls = 0;
    const { report } = await runHarness(
      '',
      "test('a', () => {}); test('b', () => {}); test('c', () => { throw new Error('own'); });",
      {
        afterEach: () => {
          calls += 1;
          if (calls === 2) throw new Error('left a mess');
        },
      },
    );
    expect(calls).toBe(3);
    expect(report.tests).toEqual([
      { name: 'a', passed: true },
      { name: 'b', passed: false, message: 'Error: left a mess' },
      { name: 'c', passed: false, message: 'Error: own' },
    ]);
  });
});

describe('separate scopes', () => {
  it('keeps names declared by the code and by the tests apart', async () => {
    const { report } = await runHarness(
      'var _lib = { value: 2 }; exports.value = _lib.value - 1;',
      "var _lib = require('./solution'); test('t', () => { expect(_lib.value).toBe(1); });",
      { separateScopes: true },
    );
    expect(report.status).toBe('passed');
  });

  it('hides the top-level names of the code from the tests', async () => {
    const { report } = await runHarness(
      'function add(a, b) { return a + b; }',
      "test('t', () => { expect(typeof add).toBe('undefined'); });",
      { separateScopes: true },
    );
    expect(report.status).toBe('passed');
  });

  it('keeps the line of a load error in the code', async () => {
    const { report } = await runHarness(
      'const a = 1;\nconst b = null;\nb.length;',
      "test('t', () => {});",
      { separateScopes: true },
    );
    expect(report.error).toMatchObject({ name: 'TypeError', line: 3 });
  });
});

describe('console substitution', () => {
  it('fills %s, %d and %o placeholders as browsers do', async () => {
    const { report } = await runHarness(
      "console.log('%s has %d items%s', 'cart', 3.7, '.'); console.error('%o and %%', { a: 1 }); console.log('100%', 'done');",
      "test('t', () => {});",
    );
    expect(report.logs).toEqual(['cart has 3 items.', 'error: {a: 1} and %', '100% done']);
  });
});

describe('console completeness', () => {
  it('offers every standard console method, so a library probing the host console does not break', async () => {
    const { report } = await runHarness(
      '',
      `test('t', () => {
  for (const name of ['log', 'info', 'debug', 'warn', 'error', 'table', 'dir', 'trace', 'group', 'groupCollapsed', 'groupEnd', 'time', 'timeEnd', 'timeLog', 'count', 'countReset', 'timeStamp', 'profile', 'profileEnd', 'assert']) {
    expect(typeof console[name]).toBe('function');
  }
});`,
    );
    expect(report.status).toBe('passed');
  });
});
