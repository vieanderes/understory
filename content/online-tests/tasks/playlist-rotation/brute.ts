function solution(A: number[], K: number): number[] {
  // Correct, but it moves one track at a time and copies the whole list each move: O(N**2).
  const n = A.length;
  if (n === 0) return [];
  let moves = ((K % n) + n) % n;
  let list = A.slice();
  while (moves-- > 0) list = [list[n - 1]!, ...list.slice(0, n - 1)];
  return list;
}
