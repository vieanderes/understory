function solution(A: number[]): number[] {
  // Correct, but includes() walks the whole array for every page number: O(N**2).
  const missing: number[] = [];
  for (let page = 1; page <= A.length + 2; page++) {
    if (!A.includes(page)) missing.push(page);
  }
  return missing;
}
