// Starts `task` three times at once and returns how long they took together.
async function timeThree(task, now) {
  const start = now();
  await Promise.all([task(), task(), task()]);
  return now() - start;
}

// True when three runs at once take less than twice one run.
async function overlaps(task, now) {
  const start = now();
  await task();
  const one = now() - start;
  const three = await timeThree(task, now);
  return three < one * 2;
}
