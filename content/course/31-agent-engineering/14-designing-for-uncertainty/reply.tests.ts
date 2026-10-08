import { decideReply, type Request } from './reply.solution';

const question: Request = {
  kind: 'question',
  ambiguous: false,
  costlyIfWrong: false,
  confidence: 0.95,
  reversible: true,
};
const action: Request = { ...question, kind: 'action' };

test('a confident, cheap answer is given plainly', () => {
  expect(decideReply(question)).toBe('answer');
});

test('a costly or less certain answer shows its sources', () => {
  expect(decideReply({ ...question, costlyIfWrong: true })).toBe('answer-with-sources');
  expect(decideReply({ ...question, confidence: 0.7 })).toBe('answer-with-sources');
});

test('0.9 is enough for a plain answer, just under it is not', () => {
  expect(decideReply({ ...question, confidence: 0.9 })).toBe('answer');
  expect(decideReply({ ...question, confidence: 0.89 })).toBe('answer-with-sources');
});

test('ambiguous and costly means ask, however sure the agent is', () => {
  expect(decideReply({ ...action, ambiguous: true, costlyIfWrong: true })).toBe('ask');
  expect(decideReply({ ...question, ambiguous: true, costlyIfWrong: true, confidence: 0.3 })).toBe('ask');
});

test('an ambiguous but cheap request is not asked about', () => {
  expect(decideReply({ ...question, ambiguous: true })).toBe('answer');
  expect(decideReply({ ...action, ambiguous: true })).toBe('preview-then-act');
});

test('low confidence hands off to a person, from 0.5 down', () => {
  expect(decideReply({ ...question, confidence: 0.49 })).toBe('hand-off');
  expect(decideReply({ ...question, confidence: 0.5 })).toBe('answer-with-sources');
});

test('an action you cannot undo needs 0.8 before the agent offers it', () => {
  expect(decideReply({ ...action, reversible: false, confidence: 0.7 })).toBe('hand-off');
  expect(decideReply({ ...action, reversible: false, confidence: 0.8 })).toBe('preview-then-act');
  expect(decideReply({ ...action, confidence: 0.6 })).toBe('preview-then-act');
  expect(decideReply({ ...action, reversible: false, costlyIfWrong: true })).toBe('preview-then-act');
});
