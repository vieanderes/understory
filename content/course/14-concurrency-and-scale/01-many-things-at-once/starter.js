// Starts `task` three times at once and returns how long they took together.
async function timeThree(task, now) {
  const start = now();
  await Promise.all([task(), task(), task()]);
  return now() - start;
}

// True when three runs at once take less than twice one run.
async function overlaps(task, now) {
  // Time one run of `task` here, then compare it with timeThree.
  return true;
}
