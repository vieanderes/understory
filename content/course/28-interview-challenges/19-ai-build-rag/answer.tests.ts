import { answer, REFUSAL } from './answer.solution';

// A fake embedder: one dimension per word in a small vocabulary, counting occurrences.
const VOCAB = ['late', 'checkout', 'fee', 'pool', 'opens', 'breakfast', 'served', 'parking', 'free'];
async function embed(text: string): Promise<number[]> {
  const words = text.toLowerCase().split(/\W+/);
  return VOCAB.map((term) => words.filter((w) => w === term).length);
}

// A fake model that records every prompt and answers with a fixed line.
function fakeModel(reply: string) {
  const prompts: string[] = [];
  const generate = async (prompt: string) => {
    prompts.push(prompt);
    return reply;
  };
  return { prompts, generate };
}

const chunks = [
  { id: 'hotel#0', text: 'Breakfast is served from seven.' },
  { id: 'hotel#1', text: 'Late checkout costs a fee of 20 pounds.' },
  { id: 'hotel#2', text: 'The pool opens at nine.' },
  { id: 'hotel#3', text: 'Parking is free for guests.' },
];

test('answers from the best chunk and cites it', async () => {
  const model = fakeModel(' Late checkout costs 20 pounds. ');
  const result = await answer('Is there a fee for late checkout?', chunks, { embed, generate: model.generate, k: 2, threshold: 0.5 });
  expect(result).toEqual({ text: 'Late checkout costs 20 pounds.', citations: ['hotel#1'] });
});

test('the prompt holds kept chunks with their ids, then the question', async () => {
  const model = fakeModel('Nine.');
  await answer('When does the pool open?', chunks, { embed, generate: model.generate, k: 3, threshold: 0.5 });
  expect(model.prompts).toEqual(['[hotel#2] The pool opens at nine.\n\nQuestion: When does the pool open?']);
});

test('refuses without calling the model when nothing scores high enough', async () => {
  const model = fakeModel('Probably yes.');
  const result = await answer('Do you allow dogs?', chunks, { embed, generate: model.generate, k: 3, threshold: 0.5 });
  expect(result).toEqual({ text: REFUSAL, citations: [] });
  expect(model.prompts).toHaveLength(0);
});

test('keeps at most k chunks, best first', async () => {
  const model = fakeModel('Yes.');
  const result = await answer('free parking, late checkout fee, breakfast?', chunks, { embed, generate: model.generate, k: 2, threshold: 0.1 });
  expect(result.citations).toEqual(['hotel#1', 'hotel#3']);
});

test('a chunk with no known words scores zero instead of breaking the sort', async () => {
  const model = fakeModel('From seven.');
  const withEmpty = [{ id: 'hotel#9', text: '---' }, ...chunks];
  const result = await answer('When is breakfast served?', withEmpty, { embed, generate: model.generate, k: 1, threshold: 0.5 });
  expect(result.citations).toEqual(['hotel#0']);
});

test('a question with no known words refuses', async () => {
  const model = fakeModel('Guessing.');
  const result = await answer('???', chunks, { embed, generate: model.generate, k: 3, threshold: 0.1 });
  expect(result.text).toBe(REFUSAL);
});
