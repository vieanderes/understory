import { answerSuggestion } from './solution';

test('a good suggestion is created with 201 and a trimmed title', () => {
  expect(answerSuggestion('{"title":"  Small Island "}')).toEqual({
    status: 201,
    body: { title: 'Small Island' },
  });
});

test('text that is not JSON is the caller\'s mistake: 400', () => {
  expect(answerSuggestion('title=Emma')).toEqual({ status: 400, body: { error: 'Send JSON' } });
  expect(answerSuggestion('')).toEqual({ status: 400, body: { error: 'Send JSON' } });
});

test('JSON without a usable title is a 400 too', () => {
  const noTitle = { status: 400, body: { error: 'Add a title' } };
  expect(answerSuggestion('{}')).toEqual(noTitle);
  expect(answerSuggestion('{"title":"   "}')).toEqual(noTitle);
  expect(answerSuggestion('{"title":42}')).toEqual(noTitle);
});

test('valid JSON that is not an object has no title', () => {
  expect(answerSuggestion('null')).toEqual({ status: 400, body: { error: 'Add a title' } });
  expect(answerSuggestion('"Emma"')).toEqual({ status: 400, body: { error: 'Add a title' } });
});

test('only the title is kept', () => {
  expect(answerSuggestion('{"title":"Emma","approved":true}')).toEqual({
    status: 201,
    body: { title: 'Emma' },
  });
});
