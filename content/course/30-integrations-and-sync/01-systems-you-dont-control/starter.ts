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
  // Trusts the status and the shape. The cast checks nothing at runtime.
  if (status !== 200) return { ok: false, retryable: true, reason: `http-${status}` };
  return { ok: true, parcel: JSON.parse(body) as Parcel };
}
