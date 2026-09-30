import { useState } from 'react';

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

  async function send(message: string) {
    setStatus('waiting');
    // Read stream(message, signal) here and update the state.
  }

  function stop() {
    // Cancel the stream that's running.
  }

  return { answer, status, error, send, stop };
}
