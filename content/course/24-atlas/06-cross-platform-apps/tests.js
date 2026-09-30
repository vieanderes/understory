const env = { MODEL_KEY: 'mk_secret_123' };

// A fake model that records the key and text it was called with.
function makeModel() {
  const calls = [];
  const callModel = async (key, text) => {
    calls.push({ key, text });
    return 'Short version';
  };
  return { calls, callModel };
}

test('a signed-in user gets a summary', async () => {
  const model = makeModel();
  const response = await handleSummarise({ user: 'ana', body: { text: 'A long ticket' } }, env, model.callModel);
  expect(response.status).toBe(200);
  expect(response.body.summary).toBe('Short version');
});

test('the server passes its own key to the model', async () => {
  const model = makeModel();
  await handleSummarise({ user: 'ana', body: { text: 'Hi' } }, env, model.callModel);
  expect(model.calls[0].key).toBe('mk_secret_123');
});

test('nobody signed in gets 401, and the model is never called', async () => {
  const model = makeModel();
  const response = await handleSummarise({ user: null, body: { text: 'Hi' } }, env, model.callModel);
  expect(response.status).toBe(401);
  expect(model.calls).toHaveLength(0);
});

test('empty text gets 400', async () => {
  const model = makeModel();
  const response = await handleSummarise({ user: 'ana', body: { text: '   ' } }, env, model.callModel);
  expect(response.status).toBe(400);
  expect(model.calls).toHaveLength(0);
});

test('missing text gets 400', async () => {
  const model = makeModel();
  const response = await handleSummarise({ user: 'ana', body: {} }, env, model.callModel);
  expect(response.status).toBe(400);
});

test('text over 5000 characters gets 413', async () => {
  const model = makeModel();
  const response = await handleSummarise({ user: 'ana', body: { text: 'a'.repeat(5001) } }, env, model.callModel);
  expect(response.status).toBe(413);
  expect(model.calls).toHaveLength(0);
});

test('the key never appears in a response', async () => {
  const model = makeModel();
  const response = await handleSummarise({ user: 'ana', body: { text: 'Hi' } }, env, model.callModel);
  expect(JSON.stringify(response)).not.toContain('mk_secret_123');
});
