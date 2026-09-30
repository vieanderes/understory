// Runs on your server. The app sends its signed-in user and { text }.
// The model key lives in env.MODEL_KEY and never goes back to the app.
async function handleSummarise(request, env, callModel) {
  const summary = await callModel(env.MODEL_KEY, request.body.text);
  return { status: 200, body: { summary } };
}
