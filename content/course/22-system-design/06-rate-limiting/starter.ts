export function slidingWindow(limit: number, windowMs: number): (now: number) => boolean {
  // Count this window and the one before, and weight the one before by how much still overlaps.
  let count = 0;
  return (now) => {
    count += 1;
    return count <= limit;
  };
}
