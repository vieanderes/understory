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
  // Retries every failure one minute later, for ever, and never switches anything off.
  if ('status' in outcome && outcome.status < 400) {
    return { decision: { kind: 'delivered' }, endpoint };
  }
  return { decision: { kind: 'retry', at: now + MINUTE }, endpoint };
}
