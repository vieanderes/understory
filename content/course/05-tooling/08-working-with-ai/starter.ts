/** One item in an order. Prices are whole pence, so 4500 is 45 pounds. */
export interface Item {
  pence: number;
}

// The assistant wrote this for the old rule: a promo percentage and a flat fee.
// Read it, predict the failing tests, then change it to the new rule.
export function orderPrice(items: Item[], promoPercent: number): number {
  let subtotal = 0;
  let discount = 0;
  for (const item of items) {
    subtotal += item.pence;
    discount = Math.round((subtotal * promoPercent) / 100);
  }
  return subtotal - discount + 250;
}
