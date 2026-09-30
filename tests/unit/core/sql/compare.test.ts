import { describe, expect, it } from 'vitest';
import { compareResultSets, formatRow } from '@/core/sql/compare';
import type { SqlResultSet } from '@/core/sql/report';

const set = (columns: string[], rows: (string | null)[][]): SqlResultSet => ({
  columns,
  rows,
  rowCount: rows.length,
});

const orders = set(
  ['id', 'customer', 'shipped'],
  [
    ['1', 'Ana', 't'],
    ['2', 'Ben', 'f'],
  ],
);

describe('compareResultSets', () => {
  it('matches the same columns and rows', () => {
    expect(compareResultSets(orders, orders, { ordered: true })).toEqual({
      match: true,
      differences: [],
    });
  });

  it('ignores row order unless order is asked for', () => {
    const reversed = set(orders.columns, [...orders.rows].reverse());
    expect(compareResultSets(orders, reversed, { ordered: false }).match).toBe(true);
    expect(compareResultSets(orders, reversed, { ordered: true })).toEqual({
      match: false,
      differences: ['The rows are right, but in a different order.'],
    });
  });

  it('names a different number of columns first, with both lists', () => {
    const two = set(
      ['id', 'customer'],
      [
        ['1', 'Ana'],
        ['2', 'Ben'],
      ],
    );
    expect(compareResultSets(orders, two, { ordered: false }).differences[0]).toBe(
      'Expected 3 columns (id, customer, shipped), got 2 (id, customer).',
    );
  });

  it('names columns with other names or in another order', () => {
    const renamed = set(['id', 'name', 'shipped'], orders.rows);
    expect(compareResultSets(orders, renamed, { ordered: false }).differences).toEqual([
      'Expected the columns id, customer, shipped. Got id, name, shipped.',
    ]);
  });

  it('counts rows, then names the first missing and the first extra row', () => {
    const one = set(orders.columns, [['2', 'Ben', 'f']]);
    expect(compareResultSets(one, orders, { ordered: false }).differences).toEqual([
      'Expected 1 row, got 2.',
      'An extra row: (1, Ana, t).',
    ]);
    expect(compareResultSets(orders, one, { ordered: false }).differences).toEqual([
      'Expected 2 rows, got 1.',
      'A missing row: (1, Ana, t).',
    ]);
  });

  it('treats rows as a multiset: a duplicate row is one too many', () => {
    const doubled = set(orders.columns, [...orders.rows, ['2', 'Ben', 'f']]);
    expect(compareResultSets(orders, doubled, { ordered: false }).differences).toEqual([
      'Expected 2 rows, got 3.',
      'An extra row: (2, Ben, f).',
    ]);
  });

  it('tells null apart from the text "null"', () => {
    const withNull = set(['note'], [[null]]);
    const withText = set(['note'], [['null']]);
    expect(compareResultSets(withNull, withText, { ordered: false }).differences).toEqual([
      'A missing row: (null).',
      "An extra row: ('null').",
    ]);
  });

  it('compares with the same row count but different values in order', () => {
    const changed = set(orders.columns, [
      ['1', 'Ana', 't'],
      ['2', 'Ben', 't'],
    ]);
    expect(compareResultSets(orders, changed, { ordered: true }).differences).toEqual([
      'A missing row: (2, Ben, f).',
      'An extra row: (2, Ben, t).',
    ]);
  });

  it('compares zero rows with zero rows', () => {
    const empty = set(orders.columns, []);
    expect(compareResultSets(empty, empty, { ordered: false }).match).toBe(true);
    expect(compareResultSets(empty, orders, { ordered: false }).differences[0]).toBe(
      'Expected no rows, got 2.',
    );
  });

  it('uses the full row count when the rows were cut short', () => {
    const cut: SqlResultSet = { ...orders, rowCount: 900, truncated: true };
    expect(compareResultSets(orders, cut, { ordered: false }).differences[0]).toBe(
      'Expected 2 rows, got 900.',
    );
  });
});

describe('formatRow', () => {
  it('shows text as Postgres prints it, null as null, and quotes what could be mistaken', () => {
    expect(formatRow(['1', 'Ana', null, 'null', ''])).toBe("(1, Ana, null, 'null', '')");
  });

  it('shortens a long value', () => {
    expect(formatRow(['x'.repeat(60)])).toBe(`(${'x'.repeat(39)}…)`);
  });
});
