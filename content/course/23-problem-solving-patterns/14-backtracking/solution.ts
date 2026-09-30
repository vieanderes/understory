// Sorted prices make pruning safe: once one price is over the remaining budget, every
// later price is too, so the loop can stop. Starting each level at the next index uses
// each item at most once and yields combinations in lexicographic order.
export function budgetCombos(prices: number[], budget: number): number[][] {
  const sorted = [...prices].sort((a, b) => a - b);
  const result: number[][] = [];
  const path: number[] = [];

  function explore(start: number, remaining: number): void {
    if (remaining === 0) {
      result.push([...path]);
      return;
    }
    for (let i = start; i < sorted.length; i++) {
      const price = sorted[i]!;
      if (price > remaining) break;
      path.push(price);
      explore(i + 1, remaining - price);
      path.pop();
    }
  }

  explore(0, budget);
  return result;
}
