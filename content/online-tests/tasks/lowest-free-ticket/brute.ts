function solution(A: number[]): number {
  // Correct, but includes() walks the whole array for every candidate: O(N**2).
  let ticket = 1;
  while (A.includes(ticket)) ticket++;
  return ticket;
}
