// With n numbers, the answer is at most n + 1, so only 1 to n + 1 can matter. A counting
// array of that size ticks them off in one pass; the first unticked slot is the answer.
export function firstFreeNumber(used: number[]): number {
  const limit = used.length + 1;
  const seen = new Array<boolean>(limit + 1).fill(false);
  for (const value of used) {
    if (value >= 1 && value <= limit) seen[value] = true;
  }
  let next = 1;
  while (seen[next]) next++;
  return next;
}
