function solution(S: string, P: number[], Q: number[]): number[] {
  // Correct, but it reads every book of every segment again: O(N * M).
  return P.map((p, i) => {
    const from = Math.min(p, Q[i]!);
    const to = Math.max(p, Q[i]!);
    const kinds = new Set<string>();
    for (let j = from; j <= to; j++) kinds.add(S[j]!);
    return kinds.size;
  });
}
