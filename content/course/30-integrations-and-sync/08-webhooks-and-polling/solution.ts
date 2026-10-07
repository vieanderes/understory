const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

// The wait before each retry: seven attempts in all, spread over about 21 hours.
export const RETRY_DELAYS_MS: readonly number[] = [MINUTE, 5 * MINUTE, 30 * MINUTE, 2 * HOUR, 6 * HOUR, 12 * HOUR];
// Failed attempts in a row, across all events, before the endpoint is switched off.
export const DISABLE_AFTER = 15;

export interface EndpointState {
  consecutiveFailures: number;
  disabled: boolean;
}

export type Outcome = { status: number; retryAfterMs?: number } | { error: 'timeout' | 'network' };

export type Decision =
  | { kind: 'delivered' }
  | { kind: 'retry'; at: number }
  | { kind: 'give-up' }
  | { kind: 'disable'; notifyOwner: true };

// attempt is the number of the attempt that just finished, starting at 1.
export function afterAttempt(
  endpoint: EndpointState,
  attempt: number,
  outcome: Outcome,
  now: number,
): { decision: Decision; endpoint: EndpointState } {
  // Only a 2xx counts. A redirect is a failure, because following it is how SSRF gets past the URL check.
  if ('status' in outcome && outcome.status >= 200 && outcome.status < 300) {
    return { decision: { kind: 'delivered' }, endpoint: { consecutiveFailures: 0, disabled: false } };
  }

  const failures = endpoint.consecutiveFailures + 1;
  // Counted per endpoint, not per event, so a dead endpoint is noticed even mid-schedule.
  if (failures >= DISABLE_AFTER) {
    return { decision: { kind: 'disable', notifyOwner: true }, endpoint: { consecutiveFailures: failures, disabled: true } };
  }

  const delay = RETRY_DELAYS_MS[attempt - 1];
  const next: EndpointState = { consecutiveFailures: failures, disabled: false };
  // The event stays in the delivery log, so the owner can replay it later.
  if (delay === undefined) return { decision: { kind: 'give-up' }, endpoint: next };

  const asked = 'status' in outcome ? (outcome.retryAfterMs ?? 0) : 0;
  return { decision: { kind: 'retry', at: now + Math.max(delay, asked) }, endpoint: next };
}
