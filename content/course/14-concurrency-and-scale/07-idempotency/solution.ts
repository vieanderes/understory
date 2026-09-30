export interface Reply {
  status: number;
  body: string;
}

// What the store remembers about a key: still running, or finished with a reply.
export type Entry = { state: 'running' } | { state: 'done'; reply: Reply };

export type Handler = (body: string) => Promise<Reply>;

export function withIdempotency(store: Map<string, Entry>, handler: Handler) {
  return async (key: string, body: string): Promise<Reply> => {
    const found = store.get(key);
    if (found?.state === 'done') return found.reply;
    if (found?.state === 'running') return { status: 409, body: 'Still in progress' };
    // Claimed before the first await, so a second attempt can't slip into the gap.
    store.set(key, { state: 'running' });
    try {
      const reply = await handler(body);
      store.set(key, { state: 'done', reply });
      return reply;
    } catch (error) {
      // Nothing was stored, so the next attempt may run the work again.
      store.delete(key);
      throw error;
    }
  };
}
