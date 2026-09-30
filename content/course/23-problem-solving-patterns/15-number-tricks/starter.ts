export function exactTotal(amounts: number[]): bigint {
  // Adds as plain numbers, then converts. Past 2^53 the running total rounds.
  let total = 0;
  for (const amount of amounts) total += amount;
  return BigInt(total);
}
