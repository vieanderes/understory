// The part of TextDecoder the parser needs. In real code, pass `new TextDecoder()`.
export type Decoder = { decode(bytes: Uint8Array, options: { stream: boolean }): string };

export type SseParser = {
  // Feeds the next chunk of bytes and returns the data of every event it completed.
  push(bytes: Uint8Array): string[];
  // True once the stream has sent `data: [DONE]`.
  done(): boolean;
};

export function createSseParser(decoder: Decoder): SseParser {
  let buffer = '';
  let finished = false;
  return {
    push(bytes) {
      if (finished) return [];
      // stream: true keeps a character split across two chunks until its last byte arrives.
      buffer += decoder.decode(bytes, { stream: true });
      const blocks = buffer.split('\n\n');
      // The last block may be half an event, so it waits for the next chunk.
      buffer = blocks.pop() ?? '';
      const events: string[] = [];
      for (const block of blocks) {
        const data = block
          .split('\n')
          .filter((line) => line.startsWith('data:'))
          .map((line) => line.slice(5).replace(/^ /, ''))
          .join('\n');
        if (data === '') continue;
        if (data === '[DONE]') {
          finished = true;
          break;
        }
        events.push(data);
      }
      return events;
    },
    done: () => finished,
  };
}
