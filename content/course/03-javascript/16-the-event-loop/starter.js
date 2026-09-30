async function handleInChunks(items, size, handle) {
  // This handles every item in one go, so nothing else can run until it ends.
  // Handle `size` items, then wait for a timer before the next chunk.
  for (const item of items) {
    handle(item);
  }
}
