function solution(K: number, A: number[]): number {
  // Closing a team the moment it reaches K never hurts: any later cut leaves less behind.
  let teams = 0;
  let energy = 0;
  for (const x of A) {
    energy += x;
    if (energy >= K) {
      teams++;
      energy = 0;
    }
  }
  return teams;
}
