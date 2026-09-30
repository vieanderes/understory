function solution(K: number, A: number[]): number {
  // Caterpillar: for each right end, the left end only ever moves right, so O(N) in total.
  const seen = new Int32Array(100001);
  let distinct = 0;
  let left = 0;
  let total = 0;
  for (let right = 0; right < A.length; right++) {
    if (seen[A[right]]++ === 0) distinct++;
    while (distinct > K) {
      if (--seen[A[left]] === 0) distinct--;
      left++;
    }
    // Every stretch ending at `right` and starting in [left..right] is tidy.
    total += right - left + 1;
  }
  return total;
}
