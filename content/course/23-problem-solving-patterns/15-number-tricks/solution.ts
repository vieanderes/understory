// Every amount is exact on its own; the running total is what passes 2^53. Keeping the
// total as a BigInt from the start means no addition can round.
export function exactTotal(amounts: number[]): bigint {
  let total = 0n;
  for (const amount of amounts) total += BigInt(amount);
  return total;
}
