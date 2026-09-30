import { largestBanner } from './banner.solution';

test('the example from the statement', () => {
  expect(largestBanner([2, 1, 5, 6, 2, 3])).toBe(10);
});

test('one building', () => {
  expect(largestBanner([4])).toBe(4);
});
