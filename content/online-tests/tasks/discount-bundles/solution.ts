function solution(A: number[], K: number): number {
  // Sort, then walk two pointers in from both ends. When the cheapest and dearest fit,
  // the cheapest fits with everything between them too: O(N * log(N)).
  const prices = Float64Array.from(A).sort();
  let left = 0;
  let right = prices.length - 1;
  let count = 0;
  while (left < right) {
    if (prices[left]! + prices[right]! <= K) {
      count += right - left;
      left += 1;
    } else {
      right -= 1;
    }
  }
  return count;
}
