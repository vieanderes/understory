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
  return (request) => {
    try {
      return handler(request);
    } catch (error) {
      if (error instanceof NotFoundError) {
        return problem(404, 'Not Found', error.message);
      }
      log(error);
      return problem(500, 'Internal Server Error', 'Something went wrong on our side.');
    }
  };
}
