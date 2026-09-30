function solution(A: number[], B: number[]): number {
  // Correct, but it replays the track one collision at a time, searching from the start
  // and removing the loser from the middle of the list: O(N**2).
  const sizes = A.slice();
  const directions = B.slice();
  for (;;) {
    let i = 0;
    while (i + 1 < sizes.length && !(directions[i] === 1 && directions[i + 1] === 0)) i++;
    if (i + 1 >= sizes.length) return sizes.length;
    if (sizes[i]! >= sizes[i + 1]!) {
      sizes[i] = sizes[i]! + sizes[i + 1]!;
      sizes.splice(i + 1, 1);
      directions.splice(i + 1, 1);
    } else {
      sizes[i + 1] = sizes[i]! + sizes[i + 1]!;
      sizes.splice(i, 1);
      directions.splice(i, 1);
    }
  }
}
