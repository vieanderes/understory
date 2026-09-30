function solution(S: number[], E: number[], C: number): number {
  // Sort the starts and the free-again minutes separately and sweep them. A start opens
  // a new room only when no room is free by then: O(N * log(N)).
  const starts = Float64Array.from(S).sort();
  const frees = Float64Array.from(E, (end) => end + C).sort();
  let rooms = 0;
  let freed = 0;
  for (const start of starts) {
    if (frees[freed]! <= start) freed += 1;
    else rooms += 1;
  }
  return rooms;
}
