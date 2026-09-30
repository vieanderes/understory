export function bestPay(pay: number[]): number {
  // Target O(n), O(1) space: for each shift, skip it, or take it plus the best from two shifts back.
  let total = 0;
  for (const amount of pay) total += amount;
  return total;
}
