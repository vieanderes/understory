import { firstBreak } from './brackets.solution';

test('a properly nested string gives -1', () => {
  expect(firstBreak('{[()()]}')).toBe(-1);
});

test('a wrong closing bracket gives its index', () => {
  expect(firstBreak('([)()]')).toBe(2);
});

test('brackets left open give the length', () => {
  expect(firstBreak('(()')).toBe(3);
});
