// Money stays in whole pence. Everyone gets the rounded-down share, and the pennies left
// over go one each to the first people, so the shares always add up to the total.
export function splitBill(totalPence: number, people: number): number[] {
  if (!Number.isInteger(totalPence) || totalPence < 0) {
    throw new Error('totalPence must be a whole number, 0 or more');
  }
  if (!Number.isInteger(people) || people < 1) {
    throw new Error('people must be a whole number, 1 or more');
  }
  const base = Math.floor(totalPence / people);
  const extra = totalPence % people;
  const shares: number[] = [];
  for (let i = 0; i < people; i++) {
    shares.push(i < extra ? base + 1 : base);
  }
  return shares;
}
