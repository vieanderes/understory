/** Anything with a price in pence, and optionally a quantity, can be totalled. */
export type Priced = {
  pricePence: number;
  quantity?: number;
};

export function totalPence(items: readonly Priced[]): number {
  let total = 0;
  for (const item of items) {
    // `??` only replaces undefined, so a quantity of 0 still counts as 0.
    total += item.pricePence * (item.quantity ?? 1);
  }
  return total;
}
