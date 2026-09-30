export interface Order {
  id: string;
  totalPence: number;
  status: 'pending' | 'paid';
}

// The event as constructEvent returns it, after the signature check passed.
export interface StripeEvent {
  id: string;
  type: string;
  data: {
    object: {
      client_reference_id: string;
      payment_status: string;
      amount_total: number;
    };
  };
}

export type Outcome = 'paid' | 'ignored' | 'already paid' | 'unknown order' | 'wrong amount';

export function markPaid(event: StripeEvent, orders: Map<string, Order>): Outcome {
  const session = event.data.object;
  const order = orders.get(session.client_reference_id);
  if (!order) return 'unknown order';
  order.status = 'paid';
  return 'paid';
}
