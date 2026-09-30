export interface Reply {
  status: number;
  body: string;
}

// What the store remembers about a key: still running, or finished with a reply.
export type Entry = { state: 'running' } | { state: 'done'; reply: Reply };

export type Handler = (body: string) => Promise<Reply>;

export function withIdempotency(store: Map<string, Entry>, handler: Handler) {
  return async (key: string, body: string): Promise<Reply> => {
    // Every attempt runs the handler, so a retry charges again.
    return handler(body);
  };
}
