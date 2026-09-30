import { createClient } from './client.solution';

// Lets other work run for a few turns, so calls overlap the way network calls do.
async function turns(count: number): Promise<void> {
  for (let turn = 0; turn < count; turn++) await Promise.resolve();
}

// A fake model that shouts the prompt back, and counts what it was asked.
function fakeModel(delay: (prompt: string) => number = () => 3) {
  const asked: string[] = [];
  let inFlight = 0;
  let most = 0;
  const call = async (prompt: string): Promise<string> => {
    asked.push(prompt);
    inFlight += 1;
    most = Math.max(most, inFlight);
    await turns(delay(prompt));
    inFlight -= 1;
    return prompt.toUpperCase();
  };
  return { call, asked, most: () => most };
}

test('identical prompts asked at the same time share one call', async () => {
  const model = fakeModel();
  const client = createClient(model.call);
  const answers = await Promise.all([client.complete('summarise the refund policy'), client.complete('summarise the refund policy')]);
  expect(answers).toEqual(['SUMMARISE THE REFUND POLICY', 'SUMMARISE THE REFUND POLICY']);
  expect(model.asked).toHaveLength(1);
});

test('a finished answer is served again without a call', async () => {
  const model = fakeModel();
  const client = createClient(model.call);
  await client.complete('translate hello');
  expect(await client.complete('translate hello')).toBe('TRANSLATE HELLO');
  expect(model.asked).toHaveLength(1);
});

test('a failure is forgotten, so the next caller tries again', async () => {
  let calls = 0;
  const client = createClient(async (prompt) => {
    calls += 1;
    if (calls === 1) throw new Error('overloaded');
    return prompt.toUpperCase();
  });
  let first = '';
  try {
    await client.complete('tag this ticket');
  } catch (error) {
    first = (error as Error).message;
  }
  expect(first).toBe('overloaded');
  expect(await client.complete('tag this ticket')).toBe('TAG THIS TICKET');
  expect(calls).toBe(2);
});

test('completeMany keeps the order of the prompts', async () => {
  // Longer prompts take longer, so they finish out of order.
  const model = fakeModel((prompt) => 20 - prompt.length);
  const client = createClient(model.call);
  const prompts = ['a', 'bbbbbbb', 'cc', 'dddddddddddd', 'eee'];
  expect(await client.completeMany(prompts, 2)).toEqual(['A', 'BBBBBBB', 'CC', 'DDDDDDDDDDDD', 'EEE']);
});

test('completeMany never runs more than `limit` calls at once', async () => {
  const model = fakeModel();
  const client = createClient(model.call);
  const prompts = ['one', 'two', 'three', 'four', 'five', 'six', 'seven'];
  await client.completeMany(prompts, 3);
  expect(model.most()).toBe(3);
  expect(model.asked).toHaveLength(7);
});

test('a prompt repeated in completeMany reaches the model once', async () => {
  const model = fakeModel();
  const client = createClient(model.call);
  expect(await client.completeMany(['yes', 'no', 'yes'], 3)).toEqual(['YES', 'NO', 'YES']);
  expect(model.asked).toEqual(['yes', 'no']);
});

test('an empty list gives an empty list and no calls', async () => {
  const model = fakeModel();
  const client = createClient(model.call);
  expect(await client.completeMany([], 4)).toEqual([]);
  expect(model.asked).toHaveLength(0);
});
