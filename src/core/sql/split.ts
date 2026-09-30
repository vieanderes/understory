/*
 * Splits what a learner typed into statements, the way psql does, so each one runs on
 * its own and shows its own result or error. Postgres would run a whole string as one
 * implicit transaction and, on the first error, throw away the results before it: a
 * learner would never see which statement failed or what the others returned.
 *
 * It knows only what can hide a semicolon: strings ('', E'' with backslash escapes),
 * quoted names (""), dollar quotes ($$ or $tag$), line comments and nested block
 * comments. Anything left open runs to the end of the input, for Postgres to report.
 */

export interface SqlStatement {
  /** The statement without the semicolon and the whitespace around it. */
  text: string;
  /** Offset of `text` in the input. */
  start: number;
  /** 1-based line of the input where `text` starts. */
  line: number;
}

const IDENT_START = /[A-Za-z_\u0080-￿]/;
const IDENT_PART = /[A-Za-z0-9_$\u0080-￿]/;

/** The dollar-quote tag that opens at `i`, such as `$$` or `$body$`, or null. */
function dollarTag(sql: string, i: number): string | null {
  const before = i > 0 ? sql.charAt(i - 1) : '';
  // `a$b` is a name and `$1` a parameter, not quotes.
  if (before !== '' && IDENT_PART.test(before)) return null;
  let j = i + 1;
  if (sql.charAt(j) !== '$') {
    if (!IDENT_START.test(sql.charAt(j))) return null;
    while (j < sql.length && /[A-Za-z0-9_\u0080-￿]/.test(sql.charAt(j))) j += 1;
    if (sql.charAt(j) !== '$') return null;
  }
  return sql.slice(i, j + 1);
}

/** Where the quoted or commented stretch that opens at `i` ends, or -1 if none opens. */
function skip(sql: string, i: number): number {
  const c = sql.charAt(i);
  const next = sql.charAt(i + 1);
  if (c === '-' && next === '-') {
    const end = sql.indexOf('\n', i);
    return end === -1 ? sql.length : end;
  }
  if (c === '/' && next === '*') {
    let depth = 1;
    let j = i + 2;
    while (j < sql.length && depth > 0) {
      if (sql.startsWith('/*', j)) {
        depth += 1;
        j += 2;
      } else if (sql.startsWith('*/', j)) {
        depth -= 1;
        j += 2;
      } else j += 1;
    }
    return j;
  }
  if (c === "'" || c === '"') {
    const escapes =
      c === "'" && /[Ee]/.test(sql.charAt(i - 1)) && !IDENT_PART.test(sql.charAt(i - 2));
    let j = i + 1;
    while (j < sql.length) {
      const d = sql.charAt(j);
      if (escapes && d === '\\') j += 2;
      else if (d === c && sql.charAt(j + 1) === c) j += 2;
      else if (d === c) return j + 1;
      else j += 1;
    }
    return sql.length;
  }
  if (c === '$') {
    const tag = dollarTag(sql, i);
    if (tag === null) return -1;
    const end = sql.indexOf(tag, i + tag.length);
    return end === -1 ? sql.length : end + tag.length;
  }
  return -1;
}

/** True when the text holds nothing but whitespace and comments. */
function isBlank(text: string): boolean {
  let i = 0;
  while (i < text.length) {
    const c = text.charAt(i);
    if (/\s/.test(c)) {
      i += 1;
      continue;
    }
    if ((c === '-' && text.charAt(i + 1) === '-') || (c === '/' && text.charAt(i + 1) === '*')) {
      i = skip(text, i);
      continue;
    }
    return false;
  }
  return true;
}

const lineAt = (sql: string, offset: number): number => sql.slice(0, offset).split('\n').length;

export function splitStatements(sql: string): SqlStatement[] {
  const statements: SqlStatement[] = [];
  let from = 0;
  const push = (to: number) => {
    const raw = sql.slice(from, to);
    const lead = raw.length - raw.trimStart().length;
    const text = raw.trim();
    if (text !== '' && !isBlank(text)) {
      statements.push({ text, start: from + lead, line: lineAt(sql, from + lead) });
    }
  };
  let i = 0;
  while (i < sql.length) {
    const end = skip(sql, i);
    if (end !== -1) {
      i = end;
      continue;
    }
    if (sql.charAt(i) === ';') {
      push(i);
      from = i + 1;
    }
    i += 1;
  }
  push(sql.length);
  return statements;
}

/**
 * Where a Postgres error points, in the learner's whole input. `position` is Postgres's
 * 1-based character offset into the statement it was given, which began at `start`.
 */
export function locate(
  sql: string,
  start: number,
  position: number | undefined,
): { line: number; column: number } {
  const offset = start + Math.max(0, (position ?? 1) - 1);
  const before = sql.slice(0, offset);
  const lines = before.split('\n');
  return { line: lines.length, column: (lines.at(-1)?.length ?? 0) + 1 };
}
