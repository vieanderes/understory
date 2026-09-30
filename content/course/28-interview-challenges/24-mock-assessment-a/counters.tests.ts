import { scoreboard } from './counters.solution';

test('the example from the statement', () => {
  expect(scoreboard(5, [3, 4, 4, 6, 1, 4, 4])).toEqual([3, 2, 2, 4, 2]);
});

test('no resets at all', () => {
  expect(scoreboard(3, [1, 1, 3])).toEqual([2, 0, 1]);
});
