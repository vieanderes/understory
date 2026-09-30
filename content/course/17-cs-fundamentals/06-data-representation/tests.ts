import { splitBill } from './solution';

test('an even split gives equal shares', () => {
  expect(splitBill(900, 3)).toEqual([300, 300, 300]);
});

test('a leftover penny goes to the first person', () => {
  expect(splitBill(1000, 3)).toEqual([334, 333, 333]);
});

test('the shares always add up to the total', () => {
  const shares = splitBill(1001, 7);
  let sum = 0;
  for (const share of shares) sum = sum + share;
  expect(sum).toBe(1001);
  expect(shares).toHaveLength(7);
});

test('fewer pence than people leaves some with nothing', () => {
  expect(splitBill(2, 3)).toEqual([1, 1, 0]);
});

test('a total of nothing splits into zeros', () => {
  expect(splitBill(0, 2)).toEqual([0, 0]);
});

test('fractions of a penny, or no people, throw', () => {
  expect(() => splitBill(10.5, 2)).toThrow();
  expect(() => splitBill(1000, 0)).toThrow();
});
