function solution(A: number[]): number {
  // Correct, but it scans the list of magnitudes seen so far for every reading:
  // O(N * D) for D different magnitudes.
  const seen: number[] = [];
  for (const value of A) {
    const magnitude = Math.abs(value);
    let found = false;
    for (let i = 0; i < seen.length; i++) {
      if (seen[i] === magnitude) {
        found = true;
        break;
      }
    }
    if (!found) seen.push(magnitude);
  }
  return seen.length;
}
