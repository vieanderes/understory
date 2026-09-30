/** Fare in pence for each zone a trip passes through, for example `{ central: 280 }`. */
export type FareTable = Record<string, number>;

export function tripFare(fares: FareTable, zones: readonly string[]): number | undefined {
  let total = 0;
  for (const zone of zones) {
    const fare = fares[zone];
    // Compare with `undefined`, not falsy: a free zone costs 0 and is a real fare.
    if (fare === undefined) return undefined;
    // Here the checker has narrowed `fare` to `number`, so no `!` is needed.
    total += fare;
  }
  return total;
}
