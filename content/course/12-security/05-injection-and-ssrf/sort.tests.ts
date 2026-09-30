import { orderByClause } from './sort.solution';

test('an allowed column is used', () => {
  expect(orderByClause('author')).toBe('ORDER BY author');
});

test('every allowed column works', () => {
  expect(orderByClause('year')).toBe('ORDER BY year');
  expect(orderByClause('title')).toBe('ORDER BY title');
});

test('an unknown column falls back to title', () => {
  expect(orderByClause('price')).toBe('ORDER BY title');
});

test('extra SQL after a column name is refused', () => {
  expect(orderByClause('year; DROP TABLE books')).toBe('ORDER BY title');
});

test('a partial match is refused', () => {
  expect(orderByClause('title2')).toBe('ORDER BY title');
});
