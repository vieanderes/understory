function solution(S: string): number {
  // Correct, but scans forward from every start: O(N**2).
  let best = 0;
  for (let p = 0; p < S.length; p++) {
    let depth = 0;
    for (let q = p; q < S.length; q++) {
      depth += S[q] === '(' ? 1 : -1;
      if (depth < 0) break;
      if (depth === 0) best = Math.max(best, q - p + 1);
    }
  }
  return best;
}
