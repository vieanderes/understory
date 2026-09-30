import { describe, expect, it } from 'vitest';
import { locate, splitStatements } from '@/core/sql/split';

const texts = (sql: string) => splitStatements(sql).map((s) => s.text);

describe('splitStatements', () => {
  it('splits on semicolons and trims each statement', () => {
    expect(texts('select 1;  select 2 ;\nselect 3')).toEqual(['select 1', 'select 2', 'select 3']);
  });

  it('gives nothing for empty input, blank lines or comments alone', () => {
    expect(splitStatements('')).toEqual([]);
    expect(splitStatements('  ;\n;  ')).toEqual([]);
    expect(splitStatements('-- just a note\n/* and another */')).toEqual([]);
  });

  it('keeps a semicolon inside a string, a quoted name or a comment', () => {
    expect(texts('select \'a;b\'; select "odd;name" from t')).toEqual([
      "select 'a;b'",
      'select "odd;name" from t',
    ]);
    expect(texts('select 1 -- one; two\n; select 2')).toEqual(['select 1 -- one; two', 'select 2']);
    expect(texts('select /* a; /* nested; */ b; */ 1; select 2')).toEqual([
      'select /* a; /* nested; */ b; */ 1',
      'select 2',
    ]);
  });

  it('reads a doubled quote as part of the string', () => {
    expect(texts("select 'it''s; fine'; select 2")).toEqual(["select 'it''s; fine'", 'select 2']);
  });

  it('reads a backslash as an escape only in an E string', () => {
    expect(texts("select E'a\\';b'; select 2")).toEqual(["select E'a\\';b'", 'select 2']);
    expect(texts("select 'a\\'; select 2")).toEqual(["select 'a\\'", 'select 2']);
  });

  it('keeps a dollar-quoted body whole, with or without a tag', () => {
    const fn = 'create function f() returns int as $$ begin return 1; end $$ language plpgsql';
    expect(texts(`${fn}; select f()`)).toEqual([fn, 'select f()']);
    const tagged = "do $body$ begin raise notice 'x;'; end $body$";
    expect(texts(`${tagged}; select 1`)).toEqual([tagged, 'select 1']);
  });

  it('does not read a positional parameter as a dollar quote', () => {
    expect(texts('select $1; select 2')).toEqual(['select $1', 'select 2']);
  });

  it('keeps an unterminated string or comment to the end, for Postgres to report', () => {
    expect(texts("select 'open; select 2")).toEqual(["select 'open; select 2"]);
    expect(texts('select 1 /* open; select 2')).toEqual(['select 1 /* open; select 2']);
  });

  it('records where each statement starts, as an offset and a 1-based line', () => {
    const sql = '-- orders\nselect 1;\n\n  select\n  2;';
    const [first, second] = splitStatements(sql);
    expect(first).toMatchObject({ start: 0, line: 1 });
    // A leading comment belongs to the statement, as it does in psql.
    expect(first?.text).toBe('-- orders\nselect 1');
    expect(second).toMatchObject({ line: 4, text: 'select\n  2' });
    expect(sql.slice(second?.start)).toMatch(/^select/);
  });
});

describe('locate', () => {
  it('turns a 1-based position inside a statement into a line and column of the whole input', () => {
    const sql = 'select 1;\nselect *\nfrom ordrs;';
    const [, second] = splitStatements(sql);
    // Postgres counts characters from 1 within the statement it was given.
    const position = (second?.text.indexOf('ordrs') ?? 0) + 1;
    expect(locate(sql, second?.start ?? 0, position)).toEqual({ line: 3, column: 6 });
  });

  it('gives the statement start when there is no position', () => {
    expect(locate('select 1;\nselect x', 10, undefined)).toEqual({ line: 2, column: 1 });
  });
});
