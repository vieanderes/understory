function solution(E: number[], D: number[], V: number[], X: number[]): number[][] {
  // A Set of event ids answers "seen before?" in O(1); scanning a list instead makes the
  // whole run O(N^2). A Map holds each record's current [version, value].
  const seen = new Set<number>();
  const records = new Map<number, [number, number]>();
  let duplicates = 0;
  let stale = 0;
  for (let k = 0; k < E.length; k++) {
    if (seen.has(E[k]!)) {
      duplicates++;
      continue;
    }
    seen.add(E[k]!);
    const current = records.get(D[k]!);
    if (current !== undefined && current[0] >= V[k]!) {
      stale++;
      continue;
    }
    records.set(D[k]!, [V[k]!, X[k]!]);
  }
  const ids = [...records.keys()].sort((a, b) => a - b);
  return [[duplicates, stale], ...ids.map((id) => [id, ...records.get(id)!])];
}
