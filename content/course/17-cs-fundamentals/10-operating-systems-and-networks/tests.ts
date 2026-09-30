import { splitMessages } from './solution';

test('one complete message', () => {
  expect(splitMessages('', '{"move":"e4"}\n')).toEqual({ messages: ['{"move":"e4"}'], rest: '' });
});

test('two messages that arrived in one chunk', () => {
  expect(splitMessages('', 'e4\ne5\n')).toEqual({ messages: ['e4', 'e5'], rest: '' });
});

test('an unfinished message is kept as the rest', () => {
  expect(splitMessages('', 'e4\n{"mo')).toEqual({ messages: ['e4'], rest: '{"mo' });
});

test('the leftover from last time completes with the new chunk', () => {
  expect(splitMessages('{"mo', 've":"e5"}\n')).toEqual({ messages: ['{"move":"e5"}'], rest: '' });
});

test('a chunk with no newline only grows the rest', () => {
  expect(splitMessages('ab', 'cd')).toEqual({ messages: [], rest: 'abcd' });
});

test('an empty chunk and blank lines produce no messages', () => {
  expect(splitMessages('', '')).toEqual({ messages: [], rest: '' });
  expect(splitMessages('', '\n\ne4\n')).toEqual({ messages: ['e4'], rest: '' });
});
