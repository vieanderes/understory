export interface Line {
  sku: string;
  quantity: number;
}

// ref is your own order id, written into the wholesaler's reference field.
export interface OrderRequest {
  ref: string;
  lines: Line[];
}

export class VendorError extends Error {
  readonly status: number | 'timeout';
  readonly code: string;
  constructor(status: number | 'timeout', code = '') {
    super(`Wholesaler error ${status} ${code}`.trim());
    this.status = status;
    this.code = code;
  }
}

// The wholesaler has no idempotency keys, and its search lags a few seconds behind writes.
export interface Wholesaler {
  findByRef(ref: string): Promise<{ id: string } | null>;
  createOrder(order: OrderRequest): Promise<{ id: string }>;
}

export interface Deps {
  sleep(ms: number): Promise<void>;
  // A targeted sync of one order, so your own pages show it straight away.
  refresh(vendorId: string): Promise<void>;
}

export type CreateResult =
  | { ok: true; vendorId: string; existed: boolean }
  | { ok: false; action: 'fix-data' | 'reconnect' | 'retry-later'; message: string };

export const MAX_CREATES = 3;
export const SEARCH_LAG_MS = 5_000;

const MESSAGES: Record<string, string> = {
  unknown_sku: "One of the products isn't sold by the wholesaler any more.",
  below_minimum: "The order is below the wholesaler's minimum.",
};
const FALLBACK_MESSAGE = 'The wholesaler turned the order down. Check the lines and try again.';

export async function createOnce(vendor: Wholesaler, order: OrderRequest, deps: Deps): Promise<CreateResult> {
  const found = async (vendorId: string): Promise<CreateResult> => {
    await deps.refresh(vendorId);
    return { ok: true, vendorId, existed: true };
  };

  // An earlier run may have placed it already.
  const before = await vendor.findByRef(order.ref);
  if (before) return found(before.id);

  for (let attempt = 1; attempt <= MAX_CREATES; attempt++) {
    try {
      const created = await vendor.createOrder(order);
      await deps.refresh(created.id);
      return { ok: true, vendorId: created.id, existed: false };
    } catch (error) {
      if (!(error instanceof VendorError)) throw error;
      // These fail the same way every time, so they go back to a person.
      if (error.status === 401 || error.status === 403) {
        return { ok: false, action: 'reconnect', message: 'Reconnect your wholesaler account.' };
      }
      if (error.status === 400 || error.status === 422) {
        return { ok: false, action: 'fix-data', message: MESSAGES[error.code] ?? FALLBACK_MESSAGE };
      }
      // Anything else may have landed. Let search catch up, then look before creating again.
      await deps.sleep(SEARCH_LAG_MS);
      const landed = await vendor.findByRef(order.ref);
      if (landed) return found(landed.id);
    }
  }
  return { ok: false, action: 'retry-later', message: "The wholesaler hasn't confirmed the order yet." };
}
