export interface WebhookEvent {
  id: string;
  type: string;
  orderId: string;
}

export interface Res {
  status: number;
  body: string;
}

// The slow work, handed in so the tests can watch it.
export interface Work {
  markPaid(orderId: string): Promise<void>;
}

function json(status: number, data: unknown): Res {
  return { status, body: JSON.stringify(data) };
}

const claimed = new Set<string>();

export async function receive(event: WebhookEvent, work: Work): Promise<Res> {
  if (claimed.has(event.id)) return json(200, { received: true });
  if (event.type !== 'payment.succeeded') return json(200, { received: true });
  claimed.add(event.id);
  try {
    await work.markPaid(event.orderId);
  } catch {
    claimed.delete(event.id);
    return json(500, { error: 'Try again' });
  }
  return json(200, { received: true });
}
