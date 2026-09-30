async function handleInChunks(items, size, handle) {
  for (let start = 0; start < items.length; start += size) {
    for (const item of items.slice(start, start + size)) {
      handle(item);
    }
    // A timer is a new task, so clicks, other timers and a paint can go first.
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}
