import { rankRoutes, type Route } from './solution';

const weights = { team: 3, reach: 2, device: 4, cost: 1 };
const routes: Route[] = [
  { name: 'website', scores: { team: 5, reach: 5, device: 1, cost: 5 }, can: ['push'] },
  { name: 'cross-platform', scores: { team: 4, reach: 4, device: 4, cost: 3 }, can: ['push', 'bluetooth'] },
  { name: 'native', scores: { team: 1, reach: 3, device: 5, cost: 1 }, can: ['push', 'bluetooth', 'nfc'] },
];

test('ranks every route by its weighted total, best first', () => {
  expect(rankRoutes(routes, weights, [])).toEqual([
    { name: 'cross-platform', total: 39 },
    { name: 'website', total: 34 },
    { name: 'native', total: 30 },
  ]);
});

test('a route that cannot do a must-have is dropped, whatever it scores', () => {
  const names = rankRoutes(routes, { cost: 1 }, ['bluetooth']).map((r) => r.name);
  expect(names).toEqual(['cross-platform', 'native']);
});

test('several must-haves all have to be there', () => {
  const names = rankRoutes(routes, weights, ['bluetooth', 'nfc']).map((r) => r.name);
  expect(names).toEqual(['native']);
});

test('a tie is broken by name', () => {
  const tied: Route[] = [
    { name: 'website', scores: { cost: 3 }, can: [] },
    { name: 'native', scores: { cost: 3 }, can: [] },
  ];
  expect(rankRoutes(tied, { cost: 2 }, []).map((r) => r.name)).toEqual(['native', 'website']);
});

test('a raw figure such as pounds is refused', () => {
  const pounds: Route[] = [{ name: 'native', scores: { cost: 30000 }, can: [] }];
  expect(() => rankRoutes(pounds, { cost: 1 }, [])).toThrow();
});

test('a missing score is refused', () => {
  const missing: Route[] = [{ name: 'website', scores: {}, can: [] }];
  expect(() => rankRoutes(missing, { cost: 1 }, [])).toThrow();
});
