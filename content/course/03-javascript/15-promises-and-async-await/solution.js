async function mapWithLimit(items, limit, fn) {
  const results = [];
  let next = 0;

  // There is no `await` between the check and taking the index, so two workers never
  // take the same one.
  async function worker() {
    while (next < items.length) {
      const index = next;
      next += 1;
      results[index] = await fn(items[index], index);
    }
  }

  const workers = [];
  for (let i = 0; i < Math.min(limit, items.length); i++) { // Math.min gives the smaller number
    workers.push(worker());
  }
  // If one call rejects, its worker rejects, and `Promise.all` rejects with that error.
  await Promise.all(workers);
  return results;
}
