import { describe, expect, it } from 'vitest';
import type { RawDiagnostic } from '@/core/ports/type-checker';
import {
  MAX_DIAGNOSTICS,
  MAX_DIAGNOSTIC_MESSAGE,
  describeDiagnostics,
  normaliseDiagnostics,
} from '@/core/typecheck/diagnostics';

const CODE = 'const a: number = "x";\nconst b = a +;\n';

function raw(overrides: Partial<RawDiagnostic> = {}): RawDiagnostic {
  return {
    file: 'code',
    start: 6,
    length: 1,
    code: 2322,
    category: 'error',
    message: "Type 'string' is not assignable to type 'number'.",
    ...overrides,
  };
}

describe('normaliseDiagnostics', () => {
  it('turns an offset into a range with a 1-based line and column', () => {
    expect(normaliseDiagnostics([raw()], CODE)).toEqual([
      {
        from: 6,
        to: 7,
        line: 1,
        column: 7,
        code: 2322,
        message: "Type 'string' is not assignable to type 'number'.",
      },
    ]);
  });

  it('counts lines and columns after a line break', () => {
    const [d] = normaliseDiagnostics([raw({ start: 29, length: 1, code: 1109 })], CODE);
    expect(d).toMatchObject({ line: 2, column: 7, from: 29, to: 30 });
  });

  it("keeps only errors in the learner's file: the tests and the libraries are context", () => {
    const found = normaliseDiagnostics(
      [
        raw({ file: 'tests', message: 'in the tests' }),
        raw({ file: 'other', message: 'in a library' }),
        raw({ category: 'suggestion', message: 'a suggestion' }),
        raw({ category: 'warning', message: 'a warning' }),
        raw({ message: 'kept' }),
      ],
      CODE,
    );
    expect(found.map((d) => d.message)).toEqual(['kept']);
  });

  it('widens an empty range to one character, so the underline can be seen', () => {
    const [d] = normaliseDiagnostics([raw({ start: 3, length: 0 })], CODE);
    expect(d).toMatchObject({ from: 3, to: 4 });
  });

  it('puts an error at the very end on the last character instead', () => {
    const code = 'let x = (';
    const [d] = normaliseDiagnostics([raw({ start: code.length, length: 0 })], code);
    expect(d).toMatchObject({ from: code.length - 1, to: code.length, column: code.length });
  });

  it('clamps a range that runs past the end of the code', () => {
    const [d] = normaliseDiagnostics([raw({ start: 20, length: 500 })], CODE);
    expect(d).toMatchObject({ from: 20, to: CODE.length });
  });

  it('places an error without a position at the start of the code', () => {
    const [d] = normaliseDiagnostics([raw({ start: undefined, length: undefined })], CODE);
    expect(d).toMatchObject({ from: 0, to: 1, line: 1, column: 1 });
  });

  it('gives empty code an empty range, since there is nothing to underline', () => {
    const [d] = normaliseDiagnostics([raw({ start: 0, length: 0 })], '');
    expect(d).toMatchObject({ from: 0, to: 0, line: 1, column: 1 });
  });

  it('orders by position and drops exact repeats', () => {
    const found = normaliseDiagnostics(
      [
        raw({ start: 20, message: 'later' }),
        raw({ start: 2, message: 'first' }),
        raw({ start: 20, message: 'later' }),
      ],
      CODE,
    );
    expect(found.map((d) => d.message)).toEqual(['first', 'later']);
  });

  it('keeps two different errors on the same range', () => {
    const found = normaliseDiagnostics(
      [raw({ code: 2, message: 'b' }), raw({ code: 1, message: 'a' })],
      CODE,
    );
    expect(found.map((d) => d.message)).toEqual(['a', 'b']);
  });

  it('keeps at most a screenful of errors', () => {
    const many = Array.from({ length: MAX_DIAGNOSTICS + 5 }, (_, i) =>
      raw({ start: i % 10, code: i }),
    );
    expect(normaliseDiagnostics(many, CODE)).toHaveLength(MAX_DIAGNOSTICS);
  });

  it('trims a long message and says so', () => {
    const [d] = normaliseDiagnostics([raw({ message: `  ${'x'.repeat(5000)}  ` })], CODE);
    expect(d?.message).toHaveLength(MAX_DIAGNOSTIC_MESSAGE);
    expect(d?.message.endsWith('…')).toBe(true);
  });
});

describe('describeDiagnostics', () => {
  const at = (line: number, message: string) => ({
    from: 0,
    to: 1,
    line,
    column: 1,
    code: 1,
    message,
  });

  it('names the line of each error', () => {
    expect(describeDiagnostics([at(4, 'One.'), at(9, 'Two.')])).toBe('Line 4: One.\nLine 9: Two.');
  });

  it('shows the first few and counts the rest', () => {
    const errors = [1, 2, 3, 4, 5, 6, 7].map((n) => at(n, `E${n}.`));
    expect(describeDiagnostics(errors)).toBe(
      'Line 1: E1.\nLine 2: E2.\nLine 3: E3.\nLine 4: E4.\nLine 5: E5.\nand 2 more',
    );
  });

  it('says "and 1 more" for a single extra error', () => {
    const errors = [1, 2, 3, 4, 5, 6].map((n) => at(n, `E${n}.`));
    expect(describeDiagnostics(errors).endsWith('\nand 1 more')).toBe(true);
  });
});
