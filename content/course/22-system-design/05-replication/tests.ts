import { pickConnection } from './solution';

test('someone who never wrote reads from a replica', () => {
  expect(pickConnection(undefined, 10_000, 2_000)).toBe('replica');
});

test('a read right after your own write goes to the primary', () => {
  expect(pickConnection(9_900, 10_000, 2_000)).toBe('primary');
});

test('a write longer ago than the lag reads from a replica', () => {
  expect(pickConnection(5_000, 10_000, 2_000)).toBe('replica');
});

test('exactly the lag ago counts as caught up', () => {
  expect(pickConnection(8_000, 10_000, 2_000)).toBe('replica');
});

test('a larger lag keeps reads on the primary for longer', () => {
  expect(pickConnection(5_000, 10_000, 6_000)).toBe('primary');
});
