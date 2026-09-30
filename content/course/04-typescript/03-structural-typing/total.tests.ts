import { totalPence } from './total.solution';

test('multiplies price by quantity and adds it up', () => {
  expect(totalPence([{ pricePence: 4500 }, { pricePence: 500, quantity: 3 }])).toBe(6000);
});

test('a missing quantity means 1', () => {
  expect(totalPence([{ pricePence: 250 }])).toBe(250);
});

test('a quantity set to undefined also means 1', () => {
  expect(totalPence([{ pricePence: 250, quantity: undefined }])).toBe(250);
});

test('a quantity of 0 means 0, not 1', () => {
  expect(totalPence([{ pricePence: 250, quantity: 0 }, { pricePence: 100 }])).toBe(100);
});

test('accepts anything with the right shape', () => {
  const tickets = [
    { id: 'T-1', seat: 'A4', pricePence: 1200 },
    { id: 'T-2', seat: 'A5', pricePence: 1200, quantity: 2 },
  ];
  expect(totalPence(tickets)).toBe(3600);
});

test('an empty list totals 0', () => {
  expect(totalPence([])).toBe(0);
});
