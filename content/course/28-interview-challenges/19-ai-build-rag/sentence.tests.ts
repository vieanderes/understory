import { chunkSentences } from './sentence.solution';

test('packs whole sentences and repeats the last one in the next chunk', () => {
  const text = 'Check in opens at noon. Bags go on the belt. Show your pass at the gate! Board?';
  expect(chunkSentences(text, 50)).toEqual([
    'Check in opens at noon. Bags go on the belt.',
    'Bags go on the belt. Show your pass at the gate!',
    'Show your pass at the gate! Board?',
  ]);
});

test('text that fits is one chunk', () => {
  expect(chunkSentences('Doors open at six. The show starts at seven.', 100)).toEqual([
    'Doors open at six. The show starts at seven.',
  ]);
});

test('a sentence longer than the limit stays whole, once', () => {
  const long = 'This one sentence about the refund policy is far longer than the limit.';
  expect(chunkSentences(`Short one. ${long} Short two.`, 30)).toEqual(['Short one.', long, 'Short two.']);
});

test('the overlap is left out when it would not fit', () => {
  expect(chunkSentences('Pay at the desk. Collect your key from the night porter.', 45)).toEqual([
    'Pay at the desk.',
    'Collect your key from the night porter.',
  ]);
});

test('no chunk passes the limit unless it is one long sentence', () => {
  const text = 'One. Two two. Three three three. Four four four four. Five. Six six. Seven.';
  for (const chunk of chunkSentences(text, 25)) expect(chunk.length).toBeLessThanOrEqual(25);
});

test('text after the last full stop is a sentence too', () => {
  expect(chunkSentences('Rooms are cleaned daily. Towels on request', 30)).toEqual([
    'Rooms are cleaned daily.',
    'Towels on request',
  ]);
});

test('empty text gives no chunks', () => {
  expect(chunkSentences('   ', 50)).toEqual([]);
});
