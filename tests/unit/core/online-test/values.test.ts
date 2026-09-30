import { describe, expect, it } from 'vitest';
import {
  canonicalJson,
  changedLines,
  clipDisplay,
  formatArgs,
  formatJson,
  formatValue,
  generateArgs,
  hashJson,
  hashValue,
  isValueOf,
  mulberry32,
  sizeOf,
  inputHint,
  parseInput,
  parseLine,
  signatureLine,
  starterCode,
  isTaskLanguage,
  caseProgram,
  type Signature,
} from '@/core/online-test';

describe('values', () => {
  it('checks a value against its declared type', () => {
    expect(isValueOf('int', 3)).toBe(true);
    expect(isValueOf('int', 3.5)).toBe(false);
    expect(isValueOf('bool', false)).toBe(true);
    expect(isValueOf('string', 'a')).toBe(true);
    expect(isValueOf('int[]', [1, 2])).toBe(true);
    expect(isValueOf('int[]', [1, 'a'])).toBe(false);
    expect(isValueOf('string[]', ['a'])).toBe(true);
    expect(isValueOf('int[][]', [[1], []])).toBe(true);
    expect(isValueOf('int[][]', [1])).toBe(false);
  });

  it('writes undefined, which JSON cannot, as a word', () => {
    expect(canonicalJson(undefined)).toBe('undefined');
    expect(canonicalJson([1, 'a'])).toBe('[1,"a"]');
  });

  it('hashes UTF-8 bytes, so astral and accented text hash like Python', () => {
    expect(hashJson('"é"')).not.toBe(hashJson('"e"'));
    expect(hashJson('"😀"')).toHaveLength(16);
    expect(hashJson('"ह"')).toHaveLength(16);
    expect(hashValue([1, 2])).toBe(hashJson('[1,2]'));
  });

  it('prints values as the platform does', () => {
    expect(formatValue([1, 3, 6])).toBe('[1, 3, 6]');
    expect(formatValue("it's")).toBe("'it\\'s'");
    expect(formatValue(undefined)).toBe('undefined');
    expect(formatValue(null)).toBe('null');
    expect(formatValue({ a: 1 })).toBe('{"a":1}');
    expect(formatValue(true)).toBe('true');
    expect(formatArgs([[1, 2]])).toBe('[1, 2]');
    expect(formatArgs([[3, 8], 3])).toBe('([3, 8], 3)');
  });

  it('prints a cut JSON result as far as it goes', () => {
    expect(formatJson('[1,2,3]', true)).toBe('[1, 2, 3]');
    expect(formatJson('undefined', true)).toBe('undefined');
    expect(formatJson('None', true)).toBe('None');
    expect(formatJson('["a,b","c\\"d', false)).toBe("['a,b', 'c\\\"d...");
    expect(clipDisplay('x'.repeat(10), 5)).toBe('xx...');
    expect(clipDisplay('short')).toBe('short');
  });
});

describe('signatures and starters', () => {
  const sig: Signature = {
    params: [
      { name: 'A', type: 'int[]' },
      { name: 'K', type: 'int' },
    ],
    returns: 'int[]',
  };

  it('writes the signature per language', () => {
    expect(signatureLine(sig, 'js')).toBe('function solution(A, K);');
    expect(signatureLine(sig, 'ts')).toBe('function solution(A: number[], K: number): number[];');
    expect(signatureLine(sig, 'python')).toBe('def solution(A, K)');
    expect(signatureLine({ params: [{ name: 'S', type: 'string' }], returns: 'bool' }, 'ts')).toBe(
      'function solution(S: string): boolean;',
    );
    expect(
      signatureLine({ params: [{ name: 'P', type: 'int[][]' }], returns: 'string[]' }, 'ts'),
    ).toBe('function solution(P: number[][]): string[];');
  });

  it('opens the editor with the platform comment lines', () => {
    expect(starterCode(sig, 'js')).toContain("// console.log('this is a debug message');");
    expect(starterCode(sig, 'ts')).toContain(
      'function solution(A: number[], K: number): number[] {',
    );
    expect(starterCode(sig, 'python')).toContain(
      'def solution(A, K):\n    # Implement your solution here\n    pass',
    );
    expect(isTaskLanguage('python')).toBe(true);
    expect(isTaskLanguage('java')).toBe(false);
  });
});

describe('test-input.txt', () => {
  const one = [{ name: 'A', type: 'int[]' as const }];
  const two = [
    { name: 'A', type: 'int[]' as const },
    { name: 'K', type: 'int' as const },
  ];

  it('reads one argument bare or wrapped, and several as a tuple', () => {
    expect(parseLine('[1, 3, 6]', one)).toEqual({
      ok: true,
      source: '[1, 3, 6]',
      args: [[1, 3, 6]],
    });
    expect(parseLine('([])', one)).toMatchObject({ ok: true, args: [[]] });
    expect(parseLine('([3, 8, 9], 3)', two)).toMatchObject({ ok: true, args: [[3, 8, 9], 3] });
    expect(parseLine('[−1, -3]', one)).toMatchObject({ ok: true, args: [[-1, -3]] });
  });

  it('reads strings, booleans and nested lists', () => {
    expect(parseLine("'{[()]}'", [{ name: 'S', type: 'string' }])).toMatchObject({
      args: ['{[()]}'],
    });
    expect(parseLine('"a\\"b"', [{ name: 'S', type: 'string' }])).toMatchObject({ args: ['a"b'] });
    expect(parseLine('True', [{ name: 'B', type: 'bool' }])).toMatchObject({ args: [true] });
    expect(parseLine('false', [{ name: 'B', type: 'bool' }])).toMatchObject({ args: [false] });
    expect(parseLine('[[1, 2], []]', [{ name: 'P', type: 'int[][]' }])).toMatchObject({
      args: [[[1, 2], []]],
    });
    expect(parseLine("['a', 'b']", [{ name: 'W', type: 'string[]' }])).toMatchObject({
      args: [['a', 'b']],
    });
  });

  it('explains a bad line in the platform wording', () => {
    expect(parseLine('[abc]', one)).toEqual({
      ok: false,
      source: '[abc]',
      message: "invalid input, unexpected 'abc', expecting integer",
    });
    expect(parseLine('[1, 2', one)).toMatchObject({
      ok: false,
      message: expect.stringContaining("expecting ',' or ']'"),
    });
    expect(parseLine('[1] 2', one)).toMatchObject({
      ok: false,
      message: expect.stringContaining('end of line'),
    });
    expect(parseLine('[99999999999999999999]', one)).toMatchObject({
      ok: false,
      message: expect.stringContaining('out of range'),
    });
    expect(parseLine("'open", [{ name: 'S', type: 'string' }])).toMatchObject({
      ok: false,
      message: 'invalid input, unterminated string',
    });
    expect(parseLine('maybe', [{ name: 'B', type: 'bool' }])).toMatchObject({
      ok: false,
      message: expect.stringContaining('boolean'),
    });
    expect(parseLine('1', [{ name: 'S', type: 'string' }])).toMatchObject({
      ok: false,
      message: expect.stringContaining('string'),
    });
    expect(parseLine('[1], 2', two)).toMatchObject({
      ok: false,
      message: expect.stringContaining("'('"),
    });
  });

  it('keeps ten lines, skips blank ones and counts the rest', () => {
    const text = ['', ...Array.from({ length: 12 }, (_, i) => `[${i}]`), '  '].join('\n');
    const parsed = parseInput(text, one);
    expect(parsed.cases).toHaveLength(10);
    expect(parsed.ignored).toBe(2);
    expect(inputHint('[1, 2]')).toContain('10 maximum');
  });
});

describe('generators', () => {
  it('is deterministic for a seed', () => {
    const a = mulberry32(1);
    const b = mulberry32(1);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
    expect(a()).toBeLessThan(1);
  });

  it('builds each kind within its bounds', () => {
    const [ints, sorted, perm, text, rep, pairs, one, range, constant, value, repeatText] =
      generateArgs({
        seed: 5,
        args: [
          { kind: 'ints', n: 100, min: -3, max: 3 },
          { kind: 'sorted', n: 50, min: 0, max: 9 },
          { kind: 'permutation', n: 10, drop: 1 },
          { kind: 'string', n: 8, alphabet: 'ab' },
          { kind: 'repeat', times: 2, unit: [4, 5] },
          { kind: 'pairs', n: 3, min: 0, max: 5 },
          { kind: 'int', min: 7, max: 7 },
          { kind: 'range', n: 3, start: 1, step: 2 },
          { kind: 'constant', n: 2, value: 9 },
          { kind: 'value', value: [1] },
          { kind: 'repeat', times: 3, unit: 'ab' },
        ],
      });
    expect((ints as number[]).every((v) => v >= -3 && v <= 3)).toBe(true);
    expect(sorted).toEqual([...(sorted as number[])].sort((x, y) => x - y));
    expect(perm).toHaveLength(9);
    expect(new Set(perm as number[]).size).toBe(9);
    expect(text).toMatch(/^[ab]{8}$/);
    expect(rep).toEqual([4, 5, 4, 5]);
    expect((pairs as number[][]).every(([a = 0, b = 0]) => a <= b)).toBe(true);
    expect(one).toBe(7);
    expect(range).toEqual([1, 3, 5]);
    expect(constant).toEqual([9, 9]);
    expect(value).toEqual([1]);
    expect(repeatText).toBe('ababab');
    expect(sizeOf([[1, 2, 3], 'ab', 7])).toBe(3);
  });
});

describe('bug-fix line count', () => {
  const starter = 'a\nb\nc\n';
  it('counts an edit once, and ignores blank lines and trailing spaces', () => {
    expect(changedLines(starter, starter)).toBe(0);
    expect(changedLines(starter, 'a\nB\nc\n')).toBe(1);
    expect(changedLines(starter, 'a  \n\nb\nc')).toBe(0);
    expect(changedLines(starter, 'a\nb\nc\nd\n')).toBe(1);
    expect(changedLines(starter, 'a\nc\n')).toBe(1);
    expect(changedLines(starter, 'x\ny\nz\nw')).toBe(4);
  });
});

describe('case programs', () => {
  it('embeds literal arguments as JSON, and generated ones as a seed and a spec', () => {
    const literal = caseProgram('python', { args: [[1, 2], 'a"b'] });
    expect(literal).toContain('__ot_json.loads("[[1,2],\\"a\\\\\\"b\\"]")');
    expect(literal).toContain('__ot_r = solution(*__ot_args)');
    const generated = caseProgram('python', {
      generate: { seed: 3, args: [{ kind: 'int', min: 1, max: 2 }] },
    });
    expect(generated).toContain('__ot_gen(3, __ot_json.loads(');
    expect(
      caseProgram('js', { generate: { seed: 3, args: [{ kind: 'int', min: 1, max: 2 }] } }),
    ).toContain('__ot_gen(3, JSON.parse(');
    expect(caseProgram('ts', { args: [1] })).toContain('var __ot_args = [1];');
  });
});
