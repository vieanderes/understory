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
  let data;
  try {
    data = JSON.parse(request.body);
  } catch {
    return problem('Body must be JSON');
  }
  if (typeof data !== 'object' || data === null) return problem('Body must be an object');
  const { productId, quantity } = data;
  if (typeof productId !== 'string' || productId === '') {
    return problem('productId must be a non-empty string');
  }
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 10) {
    return problem('quantity must be a whole number from 1 to 10');
  }
  return json(201, { productId, quantity });
}
