// best(i) = the most you can earn from the first i shifts. Either skip shift i, or take
// it and skip the one before: max(best(i - 1), best(i - 2) + pay[i]). Filled bottom up,
// only the last two answers are ever needed.
export function bestPay(pay: number[]): number {
  let twoBack = 0;
  let oneBack = 0;
  for (const amount of pay) {
    const current = Math.max(oneBack, twoBack + amount);
    twoBack = oneBack;
    oneBack = current;
  }
  return oneBack;
}
