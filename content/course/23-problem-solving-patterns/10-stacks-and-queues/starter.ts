export function daysToWait(temps: number[]): number[] {
  // Target O(n): keep a stack of days still waiting for a warmer one.
  return temps.map(() => 0);
}
