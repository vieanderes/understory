import { basketTotal, type PricingApi } from './solution';

const catalogue: Record<string, number> = { tent: 12900, stove: 4500, mug: 800 };

// A fake pricing service that counts its trips.
function fakePricing() {
  const trips = { one: 0, many: 0 };
  const api: PricingApi = {
    getPrice: async (sku) => {
      trips.one = trips.one + 1;
      return catalogue[sku] ?? 0;
    },
    getPrices: async (skus) => {
      trips.many = trips.many + 1;
      const found: Record<string, number> = {};
      for (const sku of skus) {
        const price = catalogue[sku];
        if (price !== undefined) found[sku] = price;
      }
      return found;
    },
  };
  return { api, trips };
}

const basket = [
  { sku: 'tent', qty: 1 },
  { sku: 'stove', qty: 2 },
  { sku: 'mug', qty: 4 },
];

test('the total is the same as before', async () => {
  expect(await basketTotal(basket, fakePricing().api)).toBe(25100);
});

test('a basket costs one trip, however many lines', async () => {
  const { api, trips } = fakePricing();
  await basketTotal(basket, api);
  expect(trips).toEqual({ one: 0, many: 1 });
});

test('an empty basket costs nothing and makes no trip', async () => {
  const { api, trips } = fakePricing();
  expect(await basketTotal([], api)).toBe(0);
  expect(trips).toEqual({ one: 0, many: 0 });
});

test('a sku the service has no price for throws and names it', async () => {
  const { api } = fakePricing();
  let message = '';
  try {
    await basketTotal([{ sku: 'kayak', qty: 1 }], api);
  } catch (error) {
    message = String(error);
  }
  expect(message).toContain('kayak');
});
