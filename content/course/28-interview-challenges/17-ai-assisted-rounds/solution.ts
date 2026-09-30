export function mergeBookings(bookings: [number, number][]): [number, number][] {
  const sorted = [...bookings].sort((a, b) => a[0] - b[0]);
  const merged: [number, number][] = [];
  for (const [start, end] of sorted) {
    const last = merged[merged.length - 1];
    // Touching counts as joining (<=), and a booking inside a longer one must not
    // shorten the block, so keep the larger end.
    if (last && start <= last[1]) last[1] = Math.max(last[1], end);
    else merged.push([start, end]);
  }
  return merged;
}
