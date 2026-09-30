export function total(prices: number[]): number {
  let sum = 0;
  for (const price of prices) sum = sum + price;
  return sum;
}

export function testEmptyBasket() {
  // Check that an empty basket costs 0
}

export function testThreeItems() {
  // Check a basket of 250, 100 and 400
}
