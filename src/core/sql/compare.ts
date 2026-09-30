import type { SqlCell, SqlResultSet } from './report';

/*
 * Two result sets are the same answer when they have the same columns, by name and in
 * order, and the same rows. Rows are a multiset: order counts only when the step asks
 * for it, and a duplicate row is a different answer. Values are compared as the text
 * Postgres printed, so 12.5 and 12.50 differ exactly when Postgres says they do.
 */

export interface CompareOptions {
  ordered: boolean;
}

export interface Comparison {
  match: boolean;
  /** Plain sentences, most basic first, for the learner. Empty when they match. */
  differences: string[];
}

const MAX_CELL = 40;

function formatCell(cell: SqlCell): string {
  if (cell === null) return 'null';
  // Quote only what a reader could take for something else.
  const text = cell === '' || cell === 'null' ? `'${cell}'` : cell;
  return text.length > MAX_CELL ? `${text.slice(0, MAX_CELL - 1)}…` : text;
}

export function formatRow(row: readonly SqlCell[]): string {
  return `(${row.map(formatCell).join(', ')})`;
}

/** A key per row that cannot confuse null with any text. */
const rowKey = (row: readonly SqlCell[]): string => JSON.stringify(row);

const rows = (n: number): string => (n === 0 ? 'no rows' : n === 1 ? '1 row' : `${n} rows`);

/** The first row of `a` that `b` lacks, counting duplicates. */
function firstMissing(a: readonly SqlCell[][], b: readonly SqlCell[][]): SqlCell[] | undefined {
  const counts = new Map<string, number>();
  for (const row of b) counts.set(rowKey(row), (counts.get(rowKey(row)) ?? 0) + 1);
  for (const row of a) {
    const left = counts.get(rowKey(row)) ?? 0;
    if (left === 0) return row;
    counts.set(rowKey(row), left - 1);
  }
  return undefined;
}

export function compareResultSets(
  expected: SqlResultSet,
  actual: SqlResultSet,
  options: CompareOptions,
): Comparison {
  const differences: string[] = [];
  const { columns: want } = expected;
  const { columns: got } = actual;
  if (want.length !== got.length) {
    differences.push(
      `Expected ${want.length} columns (${want.join(', ')}), got ${got.length} (${got.join(', ')}).`,
    );
  } else if (want.some((name, i) => name !== got[i])) {
    differences.push(`Expected the columns ${want.join(', ')}. Got ${got.join(', ')}.`);
  }
  if (expected.rowCount !== actual.rowCount) {
    differences.push(
      `Expected ${rows(expected.rowCount)}, got ${actual.rowCount === 0 ? 'none' : actual.rowCount}.`,
    );
  }
  // With other columns, rows cannot line up; the column sentence says enough.
  if (differences.length > 0 && want.length !== got.length) {
    return { match: false, differences };
  }
  const missing = firstMissing(expected.rows, actual.rows);
  const extra = firstMissing(actual.rows, expected.rows);
  if (missing) differences.push(`A missing row: ${formatRow(missing)}.`);
  if (extra) differences.push(`An extra row: ${formatRow(extra)}.`);
  if (
    differences.length === 0 &&
    options.ordered &&
    expected.rows.some((row, i) => rowKey(row) !== rowKey(actual.rows[i] ?? []))
  ) {
    differences.push('The rows are right, but in a different order.');
  }
  return { match: differences.length === 0, differences };
}
