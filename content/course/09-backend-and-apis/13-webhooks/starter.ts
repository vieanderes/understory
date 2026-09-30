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
  await work.markPaid(event.orderId);
  claimed.add(event.id);
  return json(200, { received: true });
}
