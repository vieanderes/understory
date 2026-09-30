export type Status = 'active' | 'confirmed' | 'expired';
export interface Hold { qty: number; status: Status; expiresAt: number }
export interface Store { capacity: number; sold: number; held: number; holds: Map<string, Hold> }
export const HOLD_MS = 10 * 60 * 1000;

// The only way to change a hold's status, like `UPDATE ... WHERE status = $from`.
// It changes the hold only if it's still in `from`, and says whether it did.
export function transition(store: Store, id: string, from: Status, to: Status): boolean {
  const hold = store.holds.get(id);
  if (hold === undefined || hold.status !== from) return false;
  hold.status = to;
  return true;
}

export function reserve(store: Store, id: string, qty: number, now: number): boolean {
  if (store.sold + store.held + qty > store.capacity) return false;
  store.holds.set(id, { qty, status: 'active', expiresAt: now + HOLD_MS });
  store.held += qty;
  return true;
}

export function confirm(store: Store, id: string, now: number): 'sold' | 'refund' {
  const hold = store.holds.get(id);
  if (hold === undefined || now >= hold.expiresAt) return 'refund';
  if (!transition(store, id, 'active', 'confirmed')) return 'refund';
  store.held -= hold.qty;
  store.sold += hold.qty;
  return 'sold';
}

export function expire(store: Store, id: string, now: number): boolean {
  const hold = store.holds.get(id);
  if (hold === undefined || now < hold.expiresAt) return false;
  if (!transition(store, id, 'active', 'expired')) return false;
  store.held -= hold.qty;
  return true;
}
