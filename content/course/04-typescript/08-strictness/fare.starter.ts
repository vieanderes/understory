/** Fare in pence for each zone a trip passes through, for example `{ central: 280 }`. */
export type FareTable = Record<string, number>;

// This project uses `noUncheckedIndexedAccess`, so `fares[zone]` is `number | undefined`.
// The `!` below hides that from the checker, and checks nothing when the code runs.
// Remove it and handle the missing fare.
export function tripFare(fares: FareTable, zones: readonly string[]): number | undefined {
  let total = 0;
  for (const zone of zones) {
    total += fares[zone]!;
  }
  return total;
}
