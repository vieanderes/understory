function solution(S: string[], R: number[], U: number[]): string[] {
  const log: string[] = [];
  for (let k = 0; k < S.length; k++) {
    if (R[k] === 1) {
      log.push(`done ${S[k]}`);
      continue;
    }
    log.push(`failed ${S[k]}`);
    // Compensate newest first: later steps may depend on earlier ones, as a shipment
    // depends on the charge. The failed step changed nothing, so it is not undone.
    for (let j = k - 1; j >= 0; j--) {
      if (U[j] === -1) continue;
      if (U[j] === 0) {
        log.push(`stuck ${S[j]}`, 'needs attention');
        return log;
      }
      log.push(`undo ${S[j]}`);
    }
    log.push('rolled back');
    return log;
  }
  log.push('committed');
  return log;
}
