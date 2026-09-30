/** One item in an order. Prices are whole pence, so 4500 is 45 pounds. */
export interface Item {
  pence: number;
}

const DELIVERY_FEE = 250;
const GROUP_SIZE = 5;
const GROUP_PERCENT = 10;

export function orderPrice(items: Item[], promoPercent: number): number {
  // An empty order is not an order, so it carries no fee.
  if (items.length === 0) return 0;
  let subtotal = 0;
  for (const item of items) {
    subtotal += item.pence;
  }
  // The discounts do not stack: the larger percentage applies.
  let percent = promoPercent;
  if (items.length >= GROUP_SIZE) {
    percent = Math.max(percent, GROUP_PERCENT);
  }
  const discount = Math.round((subtotal * percent) / 100);
  return subtotal - discount + DELIVERY_FEE;
}
