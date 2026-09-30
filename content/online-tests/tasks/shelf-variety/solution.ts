function solution(S: string, P: number[], Q: number[]): number[] {
  // One running count per genre: seen[g][i] is how many of the first i books have genre g,
  // so any segment's count of g is a difference of two entries. O(N + M).
  const genres = 'FHPS';
  const n = S.length;
  const seen = Array.from({ length: 4 }, () => new Int32Array(n + 1));
  for (let i = 0; i < n; i++) {
    const g = genres.indexOf(S[i]!);
    for (let k = 0; k < 4; k++) seen[k]![i + 1] = seen[k]![i]! + (k === g ? 1 : 0);
  }
  return P.map((p, i) => {
    const from = Math.min(p, Q[i]!);
    const to = Math.max(p, Q[i]!);
    let kinds = 0;
    for (let k = 0; k < 4; k++) if (seen[k]![to + 1]! > seen[k]![from]!) kinds++;
    return kinds;
  });
}
