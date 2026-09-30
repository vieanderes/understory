// The clock the tests hand in: milliseconds since 1970.
const now = () => Date.now();

// Waits 30 ms without using the thread, like a database call.
const waitForDatabase = () => new Promise((done) => setTimeout(done, 30));

// Keeps the thread busy for `ms`, like resizing a photo.
function computeFor(ms) {
  return async () => {
    const start = now();
    while (now() - start < ms) {
      // computing
    }
  };
}

test('three waits at once overlap', async () => {
  expect(await overlaps(waitForDatabase, now)).toBe(true);
});

test('three computations at once do not', async () => {
  expect(await overlaps(computeFor(30), now)).toBe(false);
});

test('a shorter computation does not overlap either', async () => {
  expect(await overlaps(computeFor(15), now)).toBe(false);
});
