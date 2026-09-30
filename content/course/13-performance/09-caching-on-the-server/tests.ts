import { createCache } from './solution';

function setup() {
  let clock = 0;
  const prices: Record<string, number> = { tea: 3, cake: 4 };
  const loads: string[] = [];
  const load = async (id: string) => {
    loads.push(id);
    return prices[id] ?? 0;
  };
  const cache = createCache(load, 30_000, () => clock);
  return { cache, loads, prices, tick: (ms: number) => (clock += ms) };
}

test('a second get within the lifetime is a hit', async () => {
  const { cache, loads } = setup();
  expect(await cache.get('tea')).toBe(3);
  expect(await cache.get('tea')).toBe(3);
  expect(loads).toEqual(['tea']);
});

test('each id has its own entry', async () => {
  const { cache, loads } = setup();
  await cache.get('tea');
  expect(await cache.get('cake')).toBe(4);
  expect(loads).toEqual(['tea', 'cake']);
});

test('an expired entry is loaded again', async () => {
  const { cache, loads, tick } = setup();
  await cache.get('tea');
  tick(30_000);
  await cache.get('tea');
  expect(loads).toEqual(['tea', 'tea']);
});

test('invalidate makes the next get load the new value', async () => {
  const { cache, prices } = setup();
  await cache.get('tea');
  prices.tea = 5;
  cache.invalidate('tea');
  expect(await cache.get('tea')).toBe(5);
});

test('invalidating one id leaves the others cached', async () => {
  const { cache, loads } = setup();
  await cache.get('tea');
  await cache.get('cake');
  cache.invalidate('tea');
  await cache.get('cake');
  expect(loads).toEqual(['tea', 'cake']);
});
