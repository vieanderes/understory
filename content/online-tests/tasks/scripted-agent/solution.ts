function solution(T: string[], W: string[], A: string[], K: number): string {
  const writes = new Set(W);
  const approved = new Set(A);
  // Only calls that actually ran count for the step cap and the loop rules.
  const ran: string[] = [];
  const stop = (outcome: string): string => `${outcome} ${ran.length}`;
  for (const turn of T) {
    if (turn === 'final') return stop('answered');
    if (ran.length === K) return stop('step-cap');
    const m = ran.length;
    const repeatsLast = m >= 1 && turn === ran[m - 1];
    const repeatsPair = m >= 3 && turn === ran[m - 2] && ran[m - 1] === ran[m - 3];
    if (repeatsLast || repeatsPair) return stop('loop');
    const tool = turn.split(' ')[0]!;
    if (writes.has(tool) && !approved.has(tool)) return stop('needs-approval');
    ran.push(turn);
  }
  return stop('no-answer');
}
