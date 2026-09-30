function solution(A: number[]): number {
  // A set answers "is k held?" in O(1), so the scan up from 1 is O(N) in total.
  const held = new Set(A);
  let ticket = 1;
  while (held.has(ticket)) ticket++;
  return ticket;
}
