function solution(S: number[], E: number[], C: number): number {
  // Correct, but slow: O(N^2). The most rooms are busy at the start of some booking,
  // so count, for each start, the bookings (with cleaning) that cover it.
  let most = 0;
  for (const start of S) {
    let busy = 0;
    for (let j = 0; j < S.length; j++) {
      if (S[j]! <= start && start < E[j]! + C) busy += 1;
    }
    most = Math.max(most, busy);
  }
  return most;
}
