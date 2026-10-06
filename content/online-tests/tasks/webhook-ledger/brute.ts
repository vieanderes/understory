function solution(E: number[], D: number[], V: number[], X: number[]): number[][] {
  // Correct, but "seen before?" scans every earlier event id: O(N^2).
  const seen: number[] = [];
  const rows: number[][] = [];
  let duplicates = 0;
  let stale = 0;
  for (let k = 0; k < E.length; k++) {
    if (seen.includes(E[k]!)) {
      duplicates++;
      continue;
    }
    seen.push(E[k]!);
    const row = rows.find((r) => r[0] === D[k]);
    if (row === undefined) rows.push([D[k]!, V[k]!, X[k]!]);
    else if (row[1]! >= V[k]!) stale++;
    else {
      row[1] = V[k]!;
      row[2] = X[k]!;
    }
  }
  rows.sort((a, b) => a[0]! - b[0]!);
  return [[duplicates, stale], ...rows];
}
