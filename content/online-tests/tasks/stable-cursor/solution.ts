function solution(R: number[][], C: number[], P: number): number[] {
  // Compare whole (second, id) pairs: comparing seconds alone skips or repeats records that
  // share the cursor's second. Pairs also work when the cursor's record no longer exists.
  const after = (row: number[]): boolean =>
    C.length === 0 || row[0]! > C[0]! || (row[0] === C[0] && row[1]! > C[1]!);
  const page: number[] = [];
  for (const row of R) {
    if (page.length === P) break;
    if (after(row)) page.push(row[1]!);
  }
  return page;
}
