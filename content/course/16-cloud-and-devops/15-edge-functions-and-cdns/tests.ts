import { bestPlacement, type Network } from './solution';

const sydney: Network = {
  edgeRttMs: 5,
  originRttMs: 280,
  edgeToDbRttMs: 280,
  originToDbRttMs: 1,
  queryMs: 2,
};

test('with no queries the edge wins by the whole round trip', () => {
  expect(bestPlacement(sydney, 0)).toEqual({ edgeMs: 5, originMs: 280, best: 'edge' });
});

test('one query is already slower from the edge', () => {
  expect(bestPlacement(sydney, 1)).toEqual({ edgeMs: 287, originMs: 283, best: 'origin' });
});

test('three queries cost three far trips from the edge', () => {
  expect(bestPlacement(sydney, 3)).toEqual({ edgeMs: 851, originMs: 289, best: 'origin' });
});

test('a user next to the origin gains nothing from the edge', () => {
  const frankfurt: Network = { ...sydney, edgeRttMs: 5, originRttMs: 5, edgeToDbRttMs: 1 };
  expect(bestPlacement(frankfurt, 2).best).toBe('same');
});

test('a database replica near the edge turns the result round', () => {
  const replicaNearby: Network = { ...sydney, edgeToDbRttMs: 4 };
  expect(bestPlacement(replicaNearby, 3)).toEqual({ edgeMs: 23, originMs: 289, best: 'edge' });
});
