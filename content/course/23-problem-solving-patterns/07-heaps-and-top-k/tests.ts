import { topKFrequent } from './solution';

test('example: the k most used words, most used first', () => {
  const words = ['tea', 'milk', 'tea', 'bread', 'milk', 'tea'];
  expect(topKFrequent(words, 2)).toEqual(['tea', 'milk']);
});

test('a tie is broken alphabetically', () => {
  const words = ['pear', 'apple', 'fig', 'apple', 'pear', 'fig'];
  expect(topKFrequent(words, 2)).toEqual(['apple', 'fig']);
});

test('k larger than the number of words returns them all', () => {
  expect(topKFrequent(['b', 'a', 'b'], 10)).toEqual(['b', 'a']);
});

test('an empty list gives an empty result', () => {
  expect(topKFrequent([], 3)).toEqual([]);
});

test('k of 0 gives an empty result', () => {
  expect(topKFrequent(['a', 'b'], 0)).toEqual([]);
});

test('it handles many distinct words', () => {
  const words: string[] = [];
  for (let i = 0; i < 5000; i++) words.push(`w${i % 1000}`);
  words.push('w999', 'w999', 'w5');
  expect(topKFrequent(words, 3)).toEqual(['w999', 'w5', 'w0']);
});

test('performance: 200,000 searches of 50,000 words', () => {
  const words: string[] = [];
  for (let i = 0; i < 200000; i++) words.push(`w${(i * 7) % 50000}`);
  for (let i = 0; i < 5; i++) words.push('w42');
  words.push('w7', 'w7');
  expect(topKFrequent(words, 3)).toEqual(['w42', 'w7', 'w0']);
});
