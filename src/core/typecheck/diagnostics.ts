import type { RawDiagnostic, TypeDiagnostic } from '../ports/type-checker';

/** More than this is noise: the first errors usually cause the rest. */
export const MAX_DIAGNOSTICS = 20;
/** A compiler message chain can quote whole object types. */
export const MAX_DIAGNOSTIC_MESSAGE = 600;
/** How many errors the failed "Type errors" check spells out. */
const DESCRIBED = 5;

function lineAndColumn(code: string, offset: number): { line: number; column: number } {
  let line = 1;
  let lineStart = 0;
  for (let i = code.indexOf('\n'); i !== -1 && i < offset; i = code.indexOf('\n', i + 1)) {
    line += 1;
    lineStart = i + 1;
  }
  return { line, column: offset - lineStart + 1 };
}

function clampMessage(message: string): string {
  const text = message.trim();
  return text.length <= MAX_DIAGNOSTIC_MESSAGE
    ? text
    : `${text.slice(0, MAX_DIAGNOSTIC_MESSAGE - 1)}…`;
}

/**
 * What the learner sees of the compiler's output: errors in their own file, in order,
 * each with a range that can be underlined. The tests and the libraries are context only;
 * an error there is the author's to fix, and the gate makes sure there is none.
 */
export function normaliseDiagnostics(
  raw: readonly RawDiagnostic[],
  code: string,
): TypeDiagnostic[] {
  const end = code.length;
  const seen = new Set<string>();
  const found: TypeDiagnostic[] = [];
  for (const d of raw) {
    if (d.file !== 'code' || d.category !== 'error') continue;
    let from = Math.min(Math.max(d.start ?? 0, 0), end);
    let to = Math.min(from + Math.max(d.length ?? 0, 0), end);
    // An empty range draws nothing. "';' expected" at the end of the code is the usual one.
    if (to === from) {
      if (from === end) from = Math.max(0, end - 1);
      to = Math.min(from + 1, end);
    }
    const message = clampMessage(d.message);
    const key = `${from}:${to}:${d.code}:${message}`;
    if (seen.has(key)) continue;
    seen.add(key);
    found.push({ from, to, ...lineAndColumn(code, from), code: d.code, message });
  }
  found.sort((a, b) => a.from - b.from || a.to - b.to || a.code - b.code);
  return found.slice(0, MAX_DIAGNOSTICS);
}

/** The message of the failed "Type errors" check: one line per error, the first few. */
export function describeDiagnostics(diagnostics: readonly TypeDiagnostic[]): string {
  const lines = diagnostics.slice(0, DESCRIBED).map((d) => `Line ${d.line}: ${d.message}`);
  const rest = diagnostics.length - DESCRIBED;
  if (rest > 0) lines.push(`and ${rest} more`);
  return lines.join('\n');
}
