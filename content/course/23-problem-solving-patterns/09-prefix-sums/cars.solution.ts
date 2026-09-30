// Each west car passes every east car before it, so a running count of east cars replaces
// the inner loop. The cap is "more than", so exactly 1,000,000,000 is still returned.
export function passingCars(cars: number[]): number {
  let east = 0;
  let pairs = 0;
  for (const car of cars) {
    if (car === 0) {
      east++;
    } else {
      pairs += east;
      if (pairs > 1_000_000_000) return -1;
    }
  }
  return pairs;
}
