async function mapWithLimit(items, limit, fn) {
  // This starts every call at once and ignores `limit`. Keep at most `limit` running.
  return Promise.all(items.map((item, index) => fn(item, index)));
}
