export type ParcelStatus = 'in_transit' | 'delivered' | 'returned' | 'unknown';

export interface Parcel {
  id: string;
  status: ParcelStatus;
  deliveredAt: string | null;
}

export type ParcelReply =
  | { ok: true; parcel: Parcel }
  | { ok: false; retryable: boolean; reason: string };

const KNOWN: readonly string[] = ['in_transit', 'delivered', 'returned'];
const RETRYABLE_CODES: readonly string[] = ['rate_limited', 'temporarily_unavailable'];

export function parseParcelReply(status: number, contentType: string, body: string): ParcelReply {
  let data: unknown;
  try {
    if (!contentType.includes('application/json')) throw new Error('not JSON');
    data = JSON.parse(body);
  } catch {
    // A proxy's HTML page or an empty body: usually a passing outage.
    return { ok: false, retryable: true, reason: 'not-json' };
  }
  const record = typeof data === 'object' && data !== null ? (data as Record<string, unknown>) : {};

  // The error code decides, not the status: this vendor sends errors with 200 and 500.
  const error = record.error;
  if (typeof error === 'object' && error !== null) {
    const code = String((error as Record<string, unknown>).code);
    return { ok: false, retryable: RETRYABLE_CODES.includes(code), reason: `vendor:${code}` };
  }
  if (status < 200 || status > 299) {
    return { ok: false, retryable: status === 429 || status >= 500, reason: `http-${status}` };
  }

  const { id, status: vendorStatus, delivered_at: deliveredAt } = record;
  if (typeof id !== 'string' || id === '' || typeof vendorStatus !== 'string') {
    return { ok: false, retryable: false, reason: 'bad-shape' };
  }
  // Tolerant reader: a status we've never seen becomes 'unknown', not a crash.
  const known = KNOWN.includes(vendorStatus) ? (vendorStatus as ParcelStatus) : 'unknown';
  return {
    ok: true,
    parcel: { id, status: known, deliveredAt: typeof deliveredAt === 'string' ? deliveredAt : null },
  };
}
