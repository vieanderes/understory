function solution(A: string[], B: number, C: number, M: number): string[] {
  const RETRYABLE = new Set([408, 429, 500, 502, 503, 504]);
  const log: string[] = [];
  // The backoff doubles from B and is clamped each time, so it never grows past C and
  // never loses precision, however many retries there are.
  let backoff = B;
  for (let attempt = 1; ; attempt++) {
    const outcome = A[attempt - 1]!;
    const [codeText, retryAfter] = outcome.split(':');
    if (codeText !== 'timeout') {
      const code = Number(codeText);
      if (code >= 200 && code <= 299) {
        log.push('success');
        return log;
      }
      if (!RETRYABLE.has(code)) {
        log.push('fail');
        return log;
      }
    }
    if (attempt === M) {
      log.push('exhausted');
      return log;
    }
    log.push(`wait ${retryAfter !== undefined ? Number(retryAfter) : backoff}`);
    backoff = Math.min(C, backoff * 2);
  }
}
