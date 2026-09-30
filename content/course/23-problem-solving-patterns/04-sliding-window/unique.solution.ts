export function longestUnique(songs: number[]): number {
  // Where each song was last seen, so left can jump straight past an earlier copy.
  const lastSeen = new Map<number, number>();
  let left = 0;
  let best = 0;
  for (const [right, song] of songs.entries()) {
    const previous = lastSeen.get(song);
    // A copy before left is outside the window already, so it doesn't count.
    if (previous !== undefined && previous >= left) left = previous + 1;
    lastSeen.set(song, right);
    best = Math.max(best, right - left + 1);
  }
  return best;
}
