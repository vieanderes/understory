import { frameAnswer } from './solution';

test('each chunk is one event: a data line, then a blank line', () => {
  expect(frameAnswer(['Tea'])).toBe('data: {"text":"Tea"}\n\ndata: [DONE]\n\n');
});

test('chunks keep their order and their spaces', () => {
  expect(frameAnswer(['Tea', ' is', ' hot.'])).toBe(
    'data: {"text":"Tea"}\n\ndata: {"text":" is"}\n\ndata: {"text":" hot."}\n\ndata: [DONE]\n\n',
  );
});

test('a chunk with a line break stays one event', () => {
  expect(frameAnswer(['one\ntwo'])).toBe('data: {"text":"one\\ntwo"}\n\ndata: [DONE]\n\n');
});

test('empty chunks send nothing', () => {
  expect(frameAnswer(['Tea', '', ' is'])).toBe(
    'data: {"text":"Tea"}\n\ndata: {"text":" is"}\n\ndata: [DONE]\n\n',
  );
});

test('the stream always ends with [DONE]', () => {
  expect(frameAnswer([])).toBe('data: [DONE]\n\n');
});
