function solution(A: number[]): number {
  // A set keeps each magnitude once, and adding to it is O(1) on average: O(N).
  const seen = new Set<number>();
  for (const value of A) seen.add(Math.abs(value));
  return seen.size;
}
