export interface Res {
  status: number;
  headers?: Record<string, string>;
  body: string;
}

function json(status: number, data: unknown): Res {
  return { status, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) };
}

// What the app saved before it sent the browser away, and who signs in.
export interface Session {
  state?: string;
  user?: string;
}

// GET /callback?code=...&state=...
// exchange(code) stands in for the library call that swaps a code for the user's name.
export function callback(
  query: Record<string, string>,
  session: Session,
  exchange: (code: string) => string,
): Res {
  session.user = exchange(query.code ?? '');
  return { status: 302, headers: { Location: '/' }, body: '' };
}
