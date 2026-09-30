function leaderOf(values: number[]): number | undefined {
  const counts = new Map<number, number>();
  for (const x of values) counts.set(x, (counts.get(x) ?? 0) + 1);
  for (const [x, c] of counts) if (c * 2 > values.length) return x;
  return undefined;
}

function solution(A: number[]): number {
  // Correct, but it counts both parts again from scratch for every split: O(N**2).
  let splits = 0;
  for (let s = 0; s + 1 < A.length; s++) {
    const l = leaderOf(A.slice(0, s + 1));
    const r = leaderOf(A.slice(s + 1));
    if (l !== undefined && r !== undefined && l !== r) splits++;
  }
  return splits;
}
