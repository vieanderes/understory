import { bestRoute } from './stones.solution';

test('the example from the statement', () => {
  expect(bestRoute([1, -2, 0, 9, -1, -2], 3)).toBe(8);
});

test('jumps of one land on every stone', () => {
  expect(bestRoute([3, -1, 4], 1)).toBe(6);
});
