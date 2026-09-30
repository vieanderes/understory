import { firstBreak } from './brackets.solution';

test('an empty string is properly nested', () => {
  expect(firstBreak('')).toBe(-1);
});

test('one opening bracket', () => {
  expect(firstBreak('[')).toBe(1);
});

test('one closing bracket', () => {
  expect(firstBreak('}')).toBe(0);
});

test('a closing bracket first, before anything could match', () => {
  expect(firstBreak(')(')).toBe(0);
});

test('all the same type, nested and side by side', () => {
  expect(firstBreak('(((())))')).toBe(-1);
  expect(firstBreak('()()()()')).toBe(-1);
});

test('the right count but the wrong type', () => {
  expect(firstBreak('(]')).toBe(1);
  expect(firstBreak('{[}]')).toBe(2);
});

test('an extra closing bracket after a valid part', () => {
  expect(firstBreak('()[]{}]')).toBe(6);
});

test('only opening brackets', () => {
  expect(firstBreak('({[')).toBe(3);
});

test('mixed types nested deeply', () => {
  expect(firstBreak('{[(){}]([])}')).toBe(-1);
  expect(firstBreak('{[(){}]([)]}')).toBe(9);
});

test('a break before the unclosed tail wins', () => {
  expect(firstBreak('(((]')).toBe(3);
});
