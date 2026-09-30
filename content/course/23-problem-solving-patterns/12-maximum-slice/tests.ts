import { bestStreak } from './solution';

test('example from the task', () => {
  expect(bestStreak([2, -5, 3, 4, -1])).toBe(7);
});

test('all losses give the smallest loss', () => {
  expect(bestStreak([-3, -1, -2])).toBe(-1);
});

test('one day is its own best run', () => {
  expect(bestStreak([-4])).toBe(-4);
  expect(bestStreak([6])).toBe(6);
});

test('a dip worth crossing joins two gains', () => {
  expect(bestStreak([5, -2, 6, -10, 3])).toBe(9);
});

test('the whole list can be the best run', () => {
  expect(bestStreak([1, 2, 3])).toBe(6);
});

test('performance: 300,000 days of gains and losses', () => {
  const changes: number[] = [];
  for (let i = 0; i < 300000; i++) changes.push(i % 3 === 0 ? -5 : 3);
  expect(bestStreak(changes)).toBe(100005);
});

test('the list is left as it was', () => {
  const changes = [4, -1, 2];
  bestStreak(changes);
  expect(changes).toEqual([4, -1, 2]);
});
