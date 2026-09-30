function solution(A: number[]): number {
  // Sorted longest first, the best triangle whose longest side is A[i] uses the next two
  // planks, the longest left. The first such triple that works is the widest: O(N log N).
  const planks = A.slice().sort((x, y) => y - x);
  for (let i = 0; i + 2 < planks.length; i++) {
    if (planks[i]! < planks[i + 1]! + planks[i + 2]!) {
      return planks[i]! + planks[i + 1]! + planks[i + 2]!;
    }
  }
  return 0;
}
