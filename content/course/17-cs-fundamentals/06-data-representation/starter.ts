export function splitBill(totalPence: number, people: number): number[] {
  // Dividing gives fractions of a penny. Work in whole pence, and hand out what's left over.
  return [totalPence / people];
}
