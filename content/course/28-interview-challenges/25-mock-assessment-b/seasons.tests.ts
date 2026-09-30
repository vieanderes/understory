import { largestSeason } from './seasons.solution';

test('the example from the statement', () => {
  expect(largestSeason(3, [20, 10, 30, 20, 20, 20, 20])).toBe(60);
});

test('one season holds everything', () => {
  expect(largestSeason(1, [5, 5, 5])).toBe(15);
});
