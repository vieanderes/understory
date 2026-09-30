export interface Req {
  method: string;
  path: string;
  body: string;
}

export interface Res {
  status: number;
  headers: Record<string, string>;
  body: string;
}

export type Handler = (request: Req) => Res;

export class NotFoundError extends Error {}

// A problem details response: one error shape for the whole API.
function problem(status: number, title: string, detail: string): Res {
  const headers = { 'Content-Type': 'application/problem+json' };
  return { status, headers, body: JSON.stringify({ title, status, detail }) };
}

// In a real server, log is console.error.
export function withErrors(handler: Handler, log: (error: unknown) => void): Handler {
  // Replace this. It lets every error escape, and the client gets an empty 500.
  return handler;
}
