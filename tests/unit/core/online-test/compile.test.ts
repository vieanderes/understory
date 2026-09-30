import { describe, expect, it } from 'vitest';
import { platformCompileErrors } from '@/core/online-test';
import type { TypeDiagnostic } from '@/core/ports/type-checker';

const d = (code: number, message: string): TypeDiagnostic => ({
  from: 0,
  to: 1,
  line: 1,
  column: 42,
  code,
  message,
});

describe('platform compile errors', () => {
  it('keeps what any tsc refuses, in the platform format', () => {
    expect(
      platformCompileErrors([d(2322, "Type 'string' is not assignable to type 'number'.")]),
    ).toEqual([
      "solution.ts(1,42): error TS2322: Type 'string' is not assignable to type 'number'.",
    ]);
    expect(
      platformCompileErrors([d(2538, "Type 'boolean' cannot be used as an index type.")]),
    ).toHaveLength(1);
    expect(platformCompileErrors([d(1005, "';' expected.\nmore")])).toEqual([
      "solution.ts(1,42): error TS1005: ';' expected.",
    ]);
  });

  it('drops what only strictness and unchecked index access produce', () => {
    expect(
      platformCompileErrors([
        d(2532, "Object is possibly 'undefined'."),
        d(18048, "'x' is possibly 'undefined'."),
        d(7006, "Parameter 'a' implicitly has an 'any' type."),
        d(
          2345,
          "Argument of type 'number | undefined' is not assignable to parameter of type 'number'.",
        ),
        d(2322, "Type 'undefined' is not assignable to type 'number'."),
        d(2538, "Type 'undefined' cannot be used as an index type."),
      ]),
    ).toEqual([]);
  });
});
