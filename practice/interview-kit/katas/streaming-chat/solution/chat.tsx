import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { ChatMessage, StreamFn } from '../fixtures/stream';
import { applyDelta, EMPTY_DRAFT, type AssistantDraft } from './draft';

export interface ChatProps {
  stream: StreamFn;
}

type Entry =
  | { id: number; role: 'user'; content: string }
  | {
      id: number;
      role: 'assistant';
      draft: AssistantDraft;
      status: 'streaming' | 'done' | 'stopped' | 'failed';
    };

function toHistory(entries: Entry[]): ChatMessage[] {
  // A failed reply is not something the assistant said, so it never goes back to the model.
  return entries.flatMap((entry): ChatMessage[] => {
    if (entry.role === 'user') return [{ role: 'user', content: entry.content }];
    if (entry.status === 'failed' || entry.status === 'streaming') return [];
    return [{ role: 'assistant', content: entry.draft.text }];
  });
}

export function Chat({ stream }: ChatProps) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [input, setInput] = useState('');
  const controller = useRef<AbortController | null>(null);
  const nextId = useRef(0);
  const streaming = entries.some((e) => e.role === 'assistant' && e.status === 'streaming');

  useEffect(() => () => controller.current?.abort(), []);

  async function respond(history: Entry[]) {
    const id = nextId.current++;
    const abort = new AbortController();
    controller.current = abort;
    setEntries([...history, { id, role: 'assistant', draft: EMPTY_DRAFT, status: 'streaming' }]);

    const update = (change: (entry: Extract<Entry, { role: 'assistant' }>) => Entry) =>
      setEntries((current) =>
        current.map((entry) =>
          entry.id === id && entry.role === 'assistant' ? change(entry) : entry,
        ),
      );

    try {
      for await (const delta of stream(toHistory(history), abort.signal)) {
        if (abort.signal.aborted) break;
        update((entry) => ({ ...entry, draft: applyDelta(entry.draft, delta) }));
      }
      if (abort.signal.aborted) update((entry) => ({ ...entry, status: 'stopped' }));
      else update((entry) => ({ ...entry, status: 'done' }));
    } catch {
      // A stop surfaces as a thrown abort. That is the user's choice, not a failure.
      update((entry) => ({ ...entry, status: abort.signal.aborted ? 'stopped' : 'failed' }));
    } finally {
      if (controller.current === abort) controller.current = null;
    }
  }

  function send(event: FormEvent) {
    event.preventDefault();
    const content = input.trim();
    if (!content || streaming) return;
    setInput('');
    void respond([...entries, { id: nextId.current++, role: 'user', content }]);
  }

  function retry(failedId: number) {
    void respond(entries.filter((entry) => entry.id !== failedId));
  }

  return (
    <div>
      <ol aria-label="Conversation">
        {entries.map((entry) =>
          entry.role === 'user' ? (
            <li key={entry.id}>
              <strong>You</strong>
              <p>{entry.content}</p>
            </li>
          ) : (
            <li key={entry.id} aria-busy={entry.status === 'streaming'}>
              <strong>Assistant</strong>
              <p>{entry.draft.text}</p>
              {entry.draft.toolCalls.map((call) => (
                <p key={call.id}>Used tool {call.name}</p>
              ))}
              {entry.status === 'stopped' && <p>Stopped</p>}
              {entry.status === 'failed' && (
                <div role="alert">
                  The response was interrupted.{' '}
                  <button type="button" onClick={() => retry(entry.id)}>
                    Retry
                  </button>
                </div>
              )}
            </li>
          ),
        )}
      </ol>
      <form onSubmit={send}>
        <label>
          Message
          <textarea value={input} onChange={(event) => setInput(event.target.value)} />
        </label>
        {streaming ? (
          <button type="button" onClick={() => controller.current?.abort()}>
            Stop
          </button>
        ) : (
          <button type="submit" disabled={!input.trim()}>
            Send
          </button>
        )}
      </form>
    </div>
  );
}
