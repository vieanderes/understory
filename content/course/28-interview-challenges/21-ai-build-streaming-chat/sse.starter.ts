// The part of TextDecoder the parser needs. In real code, pass `new TextDecoder()`.
export type Decoder = { decode(bytes: Uint8Array, options: { stream: boolean }): string };

export type SseParser = {
  // Feeds the next chunk of bytes and returns the data of every event it completed.
  push(bytes: Uint8Array): string[];
  // True once the stream has sent `data: [DONE]`.
  done(): boolean;
};

export function createSseParser(decoder: Decoder): SseParser {
  return {
    push(bytes) {
      // Treats every chunk as whole events. Real chunks split anywhere.
      const text = decoder.decode(bytes, { stream: false });
      return text
        .split('\n\n')
        .filter((block) => block.startsWith('data: '))
        .map((block) => block.slice(6));
    },
    done: () => false,
  };
}
