/** Anything with a price in pence, and optionally a quantity, can be totalled. */
export type Priced = {
  pricePence: number;
  quantity?: number;
};

export function totalPence(items: readonly Priced[]): number {
  // Replace this body. The tests expect price times quantity, added up.
  return items.length;
}
