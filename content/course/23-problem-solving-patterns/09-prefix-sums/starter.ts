export function rangeTotals(steps: number[], queries: [number, number][]): number[] {
  // Target O(n + q): add the days up once, then answer each query without a loop.
  return queries.map(() => 0);
}
