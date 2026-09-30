import type { StreamFn } from '../fixtures/stream';

export interface ChatProps {
  stream: StreamFn;
}

export function Chat({ stream }: ChatProps) {
  void stream;
  return (
    <form>
      <label>
        Message
        <textarea />
      </label>
      <button type="submit">Send</button>
    </form>
  );
}
