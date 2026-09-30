// A fake loader. It counts the calls running at once and takes `ticks` microtask turns.
function makeLoader(ticksFor = () => 3) {
  const stats = { running: 0, most: 0, calls: 0 };
  async function load(city) {
    stats.calls += 1;
    stats.running += 1;
    stats.most = Math.max(stats.most, stats.running); // Math.max gives the larger number
    for (let tick = 0; tick < ticksFor(city); tick++) await Promise.resolve();
    stats.running -= 1;
    return 'forecast for ' + city;
  }
  return { load, stats };
}

test('resolves with the results in the order of the items', async () => {
  // Earlier cities take longer, so they finish last.
  const ticks = { Leeds: 10, York: 8, Hull: 6, Bath: 4, Ely: 2 };
  const { load } = makeLoader((city) => ticks[city]);
  const forecasts = await mapWithLimit(['Leeds', 'York', 'Hull', 'Bath', 'Ely'], 2, load);
  expect(forecasts).toEqual([
    'forecast for Leeds',
    'forecast for York',
    'forecast for Hull',
    'forecast for Bath',
    'forecast for Ely',
  ]);
});

test('never runs more than `limit` calls at once', async () => {
  const { load, stats } = makeLoader();
  await mapWithLimit(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'], 3, load);
  expect(stats.most).toBe(3);
  expect(stats.calls).toBe(8);
});

test('starts the next call as soon as one finishes, not in batches', async () => {
  // Leeds is slow. With a limit of 2, York, Hull and Bath all run beside it.
  const order = [];
  const { load } = makeLoader((city) => (city === 'Leeds' ? 30 : 2));
  await mapWithLimit(['Leeds', 'York', 'Hull', 'Bath'], 2, async (city) => {
    const forecast = await load(city);
    order.push(city);
    return forecast;
  });
  expect(order).toEqual(['York', 'Hull', 'Bath', 'Leeds']);
});

test('passes the index as the second argument', async () => {
  const labels = await mapWithLimit(['Leeds', 'York'], 2, async (city, index) => {
    return index + 1 + '. ' + city;
  });
  expect(labels).toEqual(['1. Leeds', '2. York']);
});

test('resolves with an empty array for an empty list and calls nothing', async () => {
  const { load, stats } = makeLoader();
  expect(await mapWithLimit([], 4, load)).toEqual([]);
  expect(stats.calls).toBe(0);
});

test('rejects with the error of a call that rejects', async () => {
  let message = 'did not reject';
  try {
    await mapWithLimit(['Leeds', 'York', 'Hull'], 2, async (city) => {
      if (city === 'York') throw new Error('York is offline');
      return city;
    });
  } catch (error) {
    message = error.message;
  }
  expect(message).toBe('York is offline');
});
