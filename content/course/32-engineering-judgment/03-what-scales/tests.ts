import { scaleRisks } from './solution';

test('a SELECT with no LIMIT is unbounded', () => {
  expect(scaleRisks([{ line: 4, sql: 'SELECT * FROM books', inLoop: false }])).toEqual([
    { line: 4, problem: 'unbounded' },
  ]);
});

test('a LIMIT in any case makes it bounded', () => {
  const sql = 'select id, title from books order by added desc limit 20';
  expect(scaleRisks([{ line: 7, sql, inLoop: false }])).toEqual([]);
});

test('one row by id, or a count, needs no LIMIT', () => {
  const calls = [
    { line: 2, sql: 'SELECT * FROM books WHERE id = $1', inLoop: false },
    { line: 3, sql: 'SELECT count(*) FROM loans', inLoop: false },
  ];
  expect(scaleRisks(calls)).toEqual([]);
});

test('filtering on member_id can still return thousands of rows', () => {
  const sql = 'SELECT * FROM loans WHERE member_id = $1';
  expect(scaleRisks([{ line: 9, sql, inLoop: false }])).toEqual([{ line: 9, problem: 'unbounded' }]);
});

test('a query in a loop is n-plus-one, even when it returns one row', () => {
  const sql = 'SELECT name FROM authors WHERE id = $1';
  expect(scaleRisks([{ line: 12, sql, inLoop: true }])).toEqual([{ line: 12, problem: 'n-plus-one' }]);
});

test('both findings come n-plus-one first, and writes are ignored', () => {
  const calls = [
    { line: 5, sql: 'INSERT INTO plays (show_id) VALUES ($1)', inLoop: false },
    { line: 8, sql: '  SELECT * FROM plays WHERE show_id = $1', inLoop: true },
  ];
  expect(scaleRisks(calls)).toEqual([
    { line: 8, problem: 'n-plus-one' },
    { line: 8, problem: 'unbounded' },
  ]);
});
