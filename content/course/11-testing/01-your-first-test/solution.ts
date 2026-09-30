export function total(prices: number[]): number {
  let sum = 0;
  for (const price of prices) sum = sum + price;
  return sum;
}

export function testEmptyBasket() {
  expect(total([])).toBe(0);
}

export function testThreeItems() {
  expect(total([250, 100, 400])).toBe(750);
}
