// Count each city's roads once. A road's pair then has rank roads(a) + roads(b) - 1,
// since the road between them touches both and is counted twice.
export function networkRank(from: number[], to: number[], cities: number): number {
  const roads = new Array<number>(cities + 1).fill(0);
  const count = (city: number | undefined) => roads[city ?? 0] ?? 0;
  for (let i = 0; i < from.length; i++) {
    roads[from[i] ?? 0] = count(from[i]) + 1;
    roads[to[i] ?? 0] = count(to[i]) + 1;
  }
  let best = 0;
  for (let i = 0; i < from.length; i++) {
    best = Math.max(best, count(from[i]) + count(to[i]) - 1);
  }
  return best;
}
