function writeUpdate(update) {
  if (!update.impact || !update.impact.trim()) {
    // Readers decide whether they're affected before anything else.
    throw new Error('Impact first');
  }
  const lines = [`Impact: ${update.impact}`, `Status: ${update.status}`, `Now: ${update.doing}`];
  if (update.status === 'resolved') {
    return [...lines, 'No more updates. A summary follows.'].join('\n');
  }
  const [hours, minutes] = update.now.split(':').map(Number);
  // A clock time survives being read late; "in 30 minutes" doesn't.
  const next = (hours * 60 + minutes + update.everyMinutes) % (24 * 60);
  const hh = String(Math.floor(next / 60)).padStart(2, '0');
  const mm = String(next % 60).padStart(2, '0');
  return [...lines, `Next update: ${hh}:${mm} UTC`].join('\n');
}
