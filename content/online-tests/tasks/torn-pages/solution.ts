function solution(A: number[]): number[] {
  // The two missing numbers sum to s. The smaller is at most s / 2 and the larger is above
  // it, so the missing sum below that pivot is the smaller one alone. Two passes, O(N).
  const n = A.length + 2;
  let present = 0;
  for (const page of A) present += page;
  const s = (n * (n + 1)) / 2 - present;
  const pivot = Math.floor(s / 2);
  let below = 0;
  for (const page of A) if (page <= pivot) below += page;
  const smaller = (pivot * (pivot + 1)) / 2 - below;
  return [smaller, s - smaller];
}
