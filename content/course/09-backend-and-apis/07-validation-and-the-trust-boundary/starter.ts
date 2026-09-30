export interface Req {
  method: string;
  path: string;
  headers?: Record<string, string>;
  body: string;
}

export interface Res {
  status: number;
  headers?: Record<string, string>;
  body: string;
}

function json(status: number, data: unknown): Res {
  return { status, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) };
}

// A 400 with a problem details body, as in the errors lesson.
function problem(detail: string): Res {
  const body = JSON.stringify({ title: 'Invalid order', status: 400, detail });
  return { status: 400, headers: { 'Content-Type': 'application/problem+json' }, body };
}

// POST /orders
export function createOrder(request: Req): Res {
  const order = JSON.parse(request.body);
  return json(201, order);
}
