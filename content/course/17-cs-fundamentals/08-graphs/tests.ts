import { fewestHops, type Graph } from './solution';

const tube: Graph = {
  Ash: ['Birch', 'Cedar'],
  Birch: ['Ash', 'Dale'],
  Cedar: ['Ash', 'Dale'],
  Dale: ['Birch', 'Cedar', 'Elm'],
  Elm: ['Dale'],
  Fern: [],
};

test('a node is 0 hops from itself', () => {
  expect(fewestHops(tube, 'Ash', 'Ash')).toBe(0);
});

test('a direct neighbour is 1 hop away', () => {
  expect(fewestHops(tube, 'Ash', 'Cedar')).toBe(1);
});

test('it finds the shortest route, not the first one', () => {
  expect(fewestHops(tube, 'Ash', 'Elm')).toBe(3);
});

test('an unreachable node gives -1', () => {
  expect(fewestHops(tube, 'Ash', 'Fern')).toBe(-1);
});

test('a cycle does not trap the search', () => {
  const ring: Graph = { ana: ['ben'], ben: ['cy'], cy: ['ana'], dee: [] };
  expect(fewestHops(ring, 'ana', 'cy')).toBe(2);
  expect(fewestHops(ring, 'ana', 'dee')).toBe(-1);
});

test('edges are one-way unless listed both ways', () => {
  const oneWay: Graph = { install: ['compile'], compile: [] };
  expect(fewestHops(oneWay, 'install', 'compile')).toBe(1);
  expect(fewestHops(oneWay, 'compile', 'install')).toBe(-1);
});
