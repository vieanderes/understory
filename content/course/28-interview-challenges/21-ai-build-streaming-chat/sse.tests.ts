import { createSseParser } from './sse.solution';
import type { Decoder } from './sse.solution';

// The sandbox has no TextEncoder or TextDecoder, so these two small stand-ins do UTF-8
// the way the real ones do, including holding a split character when stream is true.
function utf8(text: string): Uint8Array {
  const bytes: number[] = [];
  for (const char of text) {
    const code = char.codePointAt(0) ?? 0;
    if (code < 0x80) bytes.push(code);
    else if (code < 0x800) bytes.push(0xc0 | (code >> 6), 0x80 | (code & 63));
    else if (code < 0x10000) bytes.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 63), 0x80 | (code & 63));
    else bytes.push(0xf0 | (code >> 18), 0x80 | ((code >> 12) & 63), 0x80 | ((code >> 6) & 63), 0x80 | (code & 63));
  }
  return Uint8Array.from(bytes);
}

function fakeTextDecoder(): Decoder {
  let held: number[] = [];
  return {
    decode(bytes, options) {
      const all = [...held, ...bytes];
      held = [];
      let text = '';
      let i = 0;
      while (i < all.length) {
        const first = all[i] ?? 0;
        const size = first < 0x80 ? 1 : first >= 0xf0 ? 4 : first >= 0xe0 ? 3 : 2;
        if (i + size > all.length) {
          // Half a character: hold it for the next chunk, or give up on it.
          if (options.stream) held = all.slice(i);
          else text += '�';
          break;
        }
        const rest = all.slice(i + 1, i + size).reduce((code, byte) => (code << 6) | (byte & 63), 0);
        const lead = size === 1 ? first : first & (0xff >> (size + 1));
        text += String.fromCodePoint((lead << (6 * (size - 1))) | rest);
        i += size;
      }
      return text;
    },
  };
}

// Feeds the stream in pieces of `size` bytes and collects every event.
function feed(stream: string, size: number): { events: string[]; done: boolean } {
  const bytes = utf8(stream);
  const parser = createSseParser(fakeTextDecoder());
  const events: string[] = [];
  for (let start = 0; start < bytes.length; start += size) {
    events.push(...parser.push(bytes.slice(start, start + size)));
  }
  return { events, done: parser.done() };
}

const STREAM =
  'data: {"text":"Your order"}\n\n' +
  'data: {"text":" ships Monday."}\n\n' +
  'data: [DONE]\n\n';

test('a whole stream in one chunk gives its events, without [DONE]', () => {
  expect(feed(STREAM, 1000)).toEqual({ events: ['{"text":"Your order"}', '{"text":" ships Monday."}'], done: true });
});

test('fed three bytes at a time, it gives the same events', () => {
  expect(feed(STREAM, 3)).toEqual(feed(STREAM, 1000));
});

test('every chunk size from 1 to 12 gives the same events', () => {
  for (let size = 1; size <= 12; size++) expect(feed(STREAM, size).events).toHaveLength(2);
});

test('half an event waits until the rest arrives', () => {
  const parser = createSseParser(fakeTextDecoder());
  expect(parser.push(utf8('data: {"text":"Hel'))).toEqual([]);
  expect(parser.push(utf8('lo"}\n\n'))).toEqual(['{"text":"Hello"}']);
});

test('a character split across chunks arrives whole', () => {
  const stream = 'data: {"text":"Café ☕"}\n\ndata: [DONE]\n\n';
  for (let size = 1; size <= 6; size++) expect(feed(stream, size).events).toEqual(['{"text":"Café ☕"}']);
});

test('nothing after [DONE] is returned', () => {
  const parser = createSseParser(fakeTextDecoder());
  expect(parser.push(utf8('data: [DONE]\n\ndata: {"text":"late"}\n\n'))).toEqual([]);
  expect(parser.push(utf8('data: {"text":"later"}\n\n'))).toEqual([]);
  expect(parser.done()).toBe(true);
});

test('other fields are skipped, and several data lines join with a newline', () => {
  const stream = ': keep-alive\n\nevent: message\nid: 7\ndata: first line\ndata:second line\n\n';
  expect(feed(stream, 4).events).toEqual(['first line\nsecond line']);
});
