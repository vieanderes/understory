export function slidingWindow(limit: number, windowMs: number): (now: number) => boolean {
  let windowStart = 0;
  let current = 0;
  let previous = 0;
  return (now) => {
    const start = Math.floor(now / windowMs) * windowMs;
    if (start !== windowStart) {
      previous = start - windowStart === windowMs ? current : 0;
      current = 0;
      windowStart = start;
    }
    const overlap = 1 - (now - start) / windowMs;
    if (previous * overlap + current >= limit) return false;
    current += 1;
    return true;
  };
}
