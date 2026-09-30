import { ask } from './solution';

const env = { MODEL_API_KEY: 'sk-live-7f3a' };
const post = (data: unknown) => ({ method: 'POST', path: '/api/ask', body: JSON.stringify(data) });

function failWith(name: string, message: string) {
  return async () => {
    const error = new Error(message);
    error.name = name;
    throw error;
  };
}

test('answers 200 with the model answer, sending the key from env', async () => {
  let keyUsed = '';
  const callModel = async (question: string, key: string) => {
    keyUsed = key;
    return `You asked: ${question}`;
  };
  const res = await ask(post({ question: 'Hi' }), env, callModel);
  expect(res.status).toBe(200);
  expect(JSON.parse(res.body)).toEqual({ answer: 'You asked: Hi' });
  expect(keyUsed).toBe('sk-live-7f3a');
});

test('a missing question is a 400, and the model is never called', async () => {
  let called = false;
  const callModel = async () => {
    called = true;
    return 'x';
  };
  expect((await ask(post({}), env, callModel)).status).toBe(400);
  expect((await ask(post({ question: '' }), env, callModel)).status).toBe(400);
  expect(called).toBe(false);
});

test('a timeout becomes a 504', async () => {
  const res = await ask(post({ question: 'Hi' }), env, failWith('TimeoutError', 'The operation was aborted due to timeout'));
  expect(res.status).toBe(504);
});

test('any other failure becomes a 502', async () => {
  const res = await ask(post({ question: 'Hi' }), env, failWith('TypeError', 'fetch failed'));
  expect(res.status).toBe(502);
});

test('the upstream error text never reaches the client', async () => {
  const res = await ask(post({ question: 'Hi' }), env, failWith('Error', '401: key sk-live-7f3a is not valid'));
  expect(res.status).toBe(502);
  expect(res.body).not.toContain('sk-live');
  expect(res.body).not.toContain('401');
});
