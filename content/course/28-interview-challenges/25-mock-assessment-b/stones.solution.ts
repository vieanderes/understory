export function bestRoute(A: number[], K: number): number {
  // best[i] is the highest total that ends on stone i: A[i] plus the best of the K
  // stones before it. A deque of indices, with best values falling from front to back,
  // keeps that maximum at the front, so each stone costs O(1) amortised.
  const n = A.length;
  const best = new Array<number>(n);
  best[0] = A[0]!;
  const window: number[] = [0];
  let head = 0;
  for (let i = 1; i < n; i++) {
    if (window[head]! < i - K) head += 1;
    best[i] = A[i]! + best[window[head]!]!;
    while (window.length > head && best[window[window.length - 1]!]! <= best[i]!) {
      window.pop();
    }
    window.push(i);
  }
  return best[n - 1]!;
}
