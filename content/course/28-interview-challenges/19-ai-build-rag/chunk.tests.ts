import { chunk } from './chunk.solution';

test('windows overlap by the given number of words', () => {
  const text = 'guests may cancel free of charge until noon the day before arrival';
  expect(chunk('policy', text, 4, 1)).toEqual([
    { id: 'policy#0', text: 'guests may cancel free' },
    { id: 'policy#1', text: 'free of charge until' },
    { id: 'policy#2', text: 'until noon the day' },
    { id: 'policy#3', text: 'day before arrival' },
  ]);
});

test('a text shorter than one chunk gives one chunk', () => {
  expect(chunk('note', 'doors open at six', 10, 2)).toEqual([{ id: 'note#0', text: 'doors open at six' }]);
});

test('no tail chunk that the one before already covers', () => {
  const chunks = chunk('menu', 'one two three four five six', 4, 2);
  expect(chunks.map((c) => c.text)).toEqual(['one two three four', 'three four five six']);
});

test('extra spaces and line breaks count as one gap', () => {
  expect(chunk('faq', '  refunds take\n\nfive   days ', 3, 0)).toEqual([
    { id: 'faq#0', text: 'refunds take five' },
    { id: 'faq#1', text: 'days' },
  ]);
});

test('empty text gives no chunks', () => {
  expect(chunk('blank', '   ', 5, 1)).toEqual([]);
});

test('an overlap as big as the size is rejected', () => {
  expect(() => chunk('doc', 'a b c', 3, 3)).toThrow();
});

test('large: 200,000 words chunk quickly', () => {
  const words: string[] = [];
  for (let i = 0; i < 200000; i++) words.push(`w${i % 97}`);
  const chunks = chunk('big', words.join(' '), 200, 40);
  expect(chunks).toHaveLength(1250);
  expect(chunks[1]?.text.split(' ')[0]).toBe('w63');
});
