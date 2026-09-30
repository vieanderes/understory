// Runs on your server. The app sends its signed-in user and { text }.
// The model key lives in env.MODEL_KEY and never goes back to the app.
async function handleSummarise(request, env, callModel) {
  if (!request.user) return { status: 401, body: { error: 'Sign in first' } };
  const text = request.body.text;
  if (typeof text !== 'string' || text.trim() === '') {
    return { status: 400, body: { error: 'Send some text' } };
  }
  if (text.length > 5000) return { status: 413, body: { error: 'Text too long' } };
  const summary = await callModel(env.MODEL_KEY, text);
  return { status: 200, body: { summary } };
}
