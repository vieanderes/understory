import { LIMITS, LOG_TRUNCATION_NOTICE } from './limits';

/**
 * A bounded log sink. The harness already caps what learner code prints, but each party
 * further out applies the cap again, because the party closer to the learner code is
 * the one that may have been subverted.
 */
export class LogBuffer {
  private readonly kept: string[] = [];
  private bytes = 0;
  private truncated = false;

  /** Returns false once the cap is reached, so callers can stop forwarding. */
  push(line: string): boolean {
    if (this.truncated) return false;
    const clipped = line.slice(0, LIMITS.maxLogLineLength);
    // UTF-16 code units, not encoded bytes: core has no TextEncoder, and the point is a
    // bound on memory, which this is.
    const size = clipped.length + 1;
    if (this.kept.length >= LIMITS.maxLogLines || this.bytes + size > LIMITS.maxLogBytes) {
      this.truncated = true;
      this.kept.push(LOG_TRUNCATION_NOTICE);
      return false;
    }
    this.kept.push(clipped);
    this.bytes += size;
    return true;
  }

  lines(): string[] {
    return [...this.kept];
  }
}

/** Applies the cap to a finished list, for results that arrive in one piece. */
export function capLogs(lines: readonly string[]): string[] {
  const buffer = new LogBuffer();
  for (const line of lines) {
    // The harness appends its own notice; keep one notice, not two.
    if (line === LOG_TRUNCATION_NOTICE) continue;
    if (!buffer.push(line)) break;
  }
  if (lines.includes(LOG_TRUNCATION_NOTICE) && !buffer.lines().includes(LOG_TRUNCATION_NOTICE)) {
    return [...buffer.lines(), LOG_TRUNCATION_NOTICE];
  }
  return buffer.lines();
}
