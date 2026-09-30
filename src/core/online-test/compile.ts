import type { TypeDiagnostic } from '../ports/type-checker';

/*
 * What stops a TypeScript run with "Compiler output:". The app's checker is strict, with
 * noUncheckedIndexedAccess, which is right for lessons but not what the platform compiles
 * with: there `A[i] + 1` compiles, and code that fails only on those extra checks would
 * score 0 here and 100 there. So the diagnostics that only strictness or unchecked index
 * access produce are left out, and what remains is what any tsc would refuse.
 */
export const LENIENT_IGNORED_CODES: ReadonlySet<number> = new Set([
  2531, // Object is possibly 'null'.
  2532, // Object is possibly 'undefined'.
  2533, // Object is possibly 'null' or 'undefined'.
  18047, // 'x' is possibly 'null'.
  18048, // 'x' is possibly 'undefined'.
  18049, // 'x' is possibly 'null' or 'undefined'.
  7005, // Variable implicitly has an 'any' type.
  7006, // Parameter implicitly has an 'any' type.
  7019, // Rest parameter implicitly has an 'any[]' type.
  7031, // Binding element implicitly has an 'any' type.
  7034, // Variable implicitly has type 'any' in some locations.
]);

/**
 * A 2345 or 2322 that only complains about `undefined` sneaking in is strictness too, and
 * so is 2538 about `undefined` as an index, which `A[B[i]]` gets under unchecked access.
 */
function onlyAboutUndefined(d: TypeDiagnostic): boolean {
  return (
    (d.code === 2345 || d.code === 2322 || d.code === 2538) &&
    /\| undefined'|'undefined'/.test(d.message)
  );
}

export function platformCompileErrors(diagnostics: readonly TypeDiagnostic[]): string[] {
  return diagnostics
    .filter((d) => !LENIENT_IGNORED_CODES.has(d.code) && !onlyAboutUndefined(d))
    .map(
      (d) =>
        `solution.ts(${d.line},${d.column}): error TS${d.code}: ${d.message.split('\n')[0] ?? ''}`,
    );
}
