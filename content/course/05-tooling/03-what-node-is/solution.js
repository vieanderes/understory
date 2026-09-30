function portFrom(env) {
  // Every environment variable is text, and an empty one counts as missing.
  if (env.PORT === undefined || env.PORT === '') {
    return 3000;
  }
  const port = Number(env.PORT);
  if (Number.isNaN(port)) {
    return 3000;
  }
  return port;
}
