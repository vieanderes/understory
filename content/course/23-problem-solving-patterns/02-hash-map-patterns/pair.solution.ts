export function twoSum(prices: number[], target: number): [number, number] | null {
  const seen = new Map<number, number>();
  for (const [i, price] of prices.entries()) {
    const j = seen.get(target - price);
    // j can be 0, a real position, so compare with undefined rather than test truthiness.
    if (j !== undefined) return [j, i];
    // Stored after the check, so a price can't pair with itself.
    seen.set(price, i);
  }
  return null;
}
