import { minDeletions } from './deletions.solution';

test('the example from the task', () => {
  expect(minDeletions('BAAABAB')).toBe(2);
});

test('already in order needs no deletions', () => {
  expect(minDeletions('AABB')).toBe(0);
  expect(minDeletions('')).toBe(0);
});

test('one letter of each kind out of order', () => {
  expect(minDeletions('BA')).toBe(1);
});

test('it is cheaper to delete the Bs when they are fewer', () => {
  expect(minDeletions('BBBAAAA')).toBe(3);
});

test('it is cheaper to delete the As when they are fewer', () => {
  expect(minDeletions('AAAABBBBA')).toBe(1);
  expect(minDeletions('BBAA')).toBe(2);
});

test('alternating letters', () => {
  expect(minDeletions('ABABAB')).toBe(2);
});

test('performance: 100,000 letters', () => {
  expect(minDeletions('B'.repeat(50000) + 'A'.repeat(50000))).toBe(50000);
  expect(minDeletions('AB'.repeat(50000))).toBe(49999);
});
