// prefix[i] holds the sum of the first i days, so prefix[0] is 0 and a range from..to
// (inclusive) is prefix[to + 1] - prefix[from]. One pass to build, O(1) per query.
export function rangeTotals(steps: number[], queries: [number, number][]): number[] {
  const prefix = [0];
  let total = 0;
  for (const count of steps) {
    total += count;
    prefix.push(total);
  }
  return queries.map(([from, to]) => (prefix[to + 1] ?? 0) - (prefix[from] ?? 0));
}
