import { useRef, useState } from 'react';

export type ChatEvent =
  | { type: 'token'; text: string }
  | { type: 'done' }
  | { type: 'error'; message: string };

// Exactly one of these at a time, so the UI can never be in two states.
export type Status = 'idle' | 'waiting' | 'streaming' | 'done' | 'stopped' | 'error';

export type StreamFn = (message: string, signal: AbortSignal) => AsyncIterable<ChatEvent>;

export function useStreamingChat(stream: StreamFn) {
  const [answer, setAnswer] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string | null>(null);
  // A ref, not state: swapping the controller shouldn't re-render anything.
  const controllerRef = useRef<AbortController | null>(null);

  async function send(message: string) {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setAnswer('');
    setError(null);
    setStatus('waiting');
    try {
      for await (const event of stream(message, controller.signal)) {
        // A newer send or Stop owns the screen now.
        if (controller.signal.aborted) return;
        if (event.type === 'token') {
          setStatus('streaming');
          // Functional update: builds on the latest text, never a stale copy.
          setAnswer((previous) => previous + event.text);
        } else if (event.type === 'done') {
          setStatus('done');
        } else {
          setError(event.message);
          setStatus('error');
        }
      }
    } catch {
      if (controller.signal.aborted) return;
      setError("Couldn't reach the assistant. Try again.");
      setStatus('error');
    }
  }

  function stop() {
    const controller = controllerRef.current;
    if (!controller || controller.signal.aborted) return;
    controller.abort();
    setStatus('stopped');
  }

  return { answer, status, error, send, stop };
}
