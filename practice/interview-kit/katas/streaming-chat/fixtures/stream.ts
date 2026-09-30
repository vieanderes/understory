/**
 * A fake streamed model response. Real providers send the same shape of events over
 * server-sent events; here the test pushes them by hand, so it decides exactly when each
 * delta arrives and when the connection drops.
 */

export type Delta =
  | { type: 'text'; text: string }
  | { type: 'tool_call_start'; id: string; name: string }
  | { type: 'tool_call_args'; id: string; argsDelta: string }
  | { type: 'done' };

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export type StreamFn = (messages: ChatMessage[], signal: AbortSignal) => AsyncIterable<Delta>;

export interface StreamCall {
  messages: ChatMessage[];
  signal: AbortSignal;
  push(...deltas: Delta[]): void;
  /** Ends with a done delta. */
  finish(): void;
  /** Breaks the connection: the iterator throws this error. */
  fail(error: Error): void;
}

export function createControlledStream(): { stream: StreamFn; calls: StreamCall[] } {
  const calls: StreamCall[] = [];

  const stream: StreamFn = (messages, signal) => {
    const queue: Array<{ delta?: Delta; error?: unknown; end?: true }> = [];
    let wake: (() => void) | undefined;
    const notify = () => {
      wake?.();
      wake = undefined;
    };
    const enqueue = (item: (typeof queue)[number]) => {
      queue.push(item);
      notify();
    };

    signal.addEventListener('abort', () => enqueue({ error: signal.reason }), { once: true });

    calls.push({
      messages: structuredClone(messages),
      signal,
      push: (...deltas) => deltas.forEach((delta) => enqueue({ delta })),
      finish: () => {
        enqueue({ delta: { type: 'done' } });
        enqueue({ end: true });
      },
      fail: (error) => enqueue({ error }),
    });

    return {
      async *[Symbol.asyncIterator]() {
        for (;;) {
          while (queue.length === 0) await new Promise<void>((resolve) => (wake = resolve));
          const item = queue.shift()!;
          if (item.error !== undefined) throw item.error;
          if (item.end) return;
          yield item.delta!;
        }
      },
    };
  };

  return { stream, calls };
}
