function solution(A: number[]): number {
  // Correct, but it tries every mast count up to the number of hilltops, and each try walks
  // the whole list of hilltops: O(N**2).
  const hilltops: number[] = [];
  for (let i = 1; i + 1 < A.length; i++) {
    if (A[i - 1]! < A[i]! && A[i]! > A[i + 1]!) hilltops.push(i);
  }
  let best = 0;
  for (let k = 1; k <= hilltops.length; k++) {
    let placed = 0;
    let last = -Infinity;
    for (const h of hilltops) {
      if (h - last >= k) {
        placed++;
        last = h;
      }
    }
    if (placed >= k) best = k;
  }
  return best;
}
