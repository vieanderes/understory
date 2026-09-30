import { toPence } from './pence.solution';

test('a price typed as text becomes pence', () => {
  expect(toPence('2.50')).toBe(250);
});

test('a number is already pence', () => {
  expect(toPence(300)).toBe(300);
});

test('a missing price counts as 0', () => {
  expect(toPence(null)).toBe(0);
});
