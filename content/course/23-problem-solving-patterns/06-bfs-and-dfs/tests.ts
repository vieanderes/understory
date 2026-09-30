import { countIslands } from './solution';

test('an empty map has no islands', () => {
  expect(countIslands([])).toBe(0);
});

test('a map of only water has no islands', () => {
  expect(countIslands(['...', '...'])).toBe(0);
});

test('touching land cells make one island', () => {
  expect(countIslands(['XX.', 'X..', '...'])).toBe(1);
});

test('cells that touch only at a corner are separate islands', () => {
  expect(countIslands(['X.', '.X'])).toBe(2);
});

test('it counts several islands of different shapes', () => {
  expect(countIslands(['XX..X', '....X', '.X...', '.XX.X'])).toBe(4);
});

test('it leaves the map unchanged', () => {
  const map = ['X.X', '.X.'];
  countIslands(map);
  expect(map).toEqual(['X.X', '.X.']);
});

test('performance: one 300 by 300 island', () => {
  const big: string[] = [];
  for (let row = 0; row < 300; row++) big.push('X'.repeat(300));
  expect(countIslands(big)).toBe(1);
});
