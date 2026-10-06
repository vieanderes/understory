import { runSaga, type SagaStep } from './solution';

// A step that records its calls, and fails its run or its undo on request.
function step(name: string, calls: string[], opts: { fail?: boolean; failUndo?: boolean; noUndo?: boolean } = {}): SagaStep {
  const made: SagaStep = {
    name,
    run: async () => {
      calls.push(`run ${name}`);
      if (opts.fail) throw new Error(`${name} is down`);
    },
  };
  if (!opts.noUndo) {
    made.undo = async () => {
      calls.push(`undo ${name}`);
      if (opts.failUndo) throw new Error(`${name} undo is down`);
    };
  }
  return made;
}

test('when every step works, nothing is undone', async () => {
  const calls: string[] = [];
  const result = await runSaga([step('reserve-oven', calls), step('hold-card', calls), step('book-courier', calls)]);
  expect(result).toEqual({ ok: true, log: ['ran reserve-oven', 'ran hold-card', 'ran book-courier'], stuck: [] });
});

test('a failure undoes the finished steps, newest first', async () => {
  const calls: string[] = [];
  const result = await runSaga([step('reserve-oven', calls), step('hold-card', calls), step('book-courier', calls, { fail: true })]);
  expect(result.ok).toBe(false);
  expect(result.log).toEqual(['ran reserve-oven', 'ran hold-card', 'failed book-courier', 'undid hold-card', 'undid reserve-oven']);
});

test('the failed step is not undone, and later steps never run', async () => {
  const calls: string[] = [];
  await runSaga([step('reserve-oven', calls), step('book-courier', calls, { fail: true }), step('send-confirmation', calls)]);
  expect(calls).toEqual(['run reserve-oven', 'run book-courier', 'undo reserve-oven']);
});

test('a failure at the first step undoes nothing', async () => {
  const calls: string[] = [];
  const result = await runSaga([step('reserve-oven', calls, { fail: true }), step('hold-card', calls)]);
  expect(result).toEqual({ ok: false, log: ['failed reserve-oven'], stuck: [] });
});

test('a step with no undo is skipped during compensation', async () => {
  const calls: string[] = [];
  const result = await runSaga([step('reserve-oven', calls), step('notify-kitchen', calls, { noUndo: true }), step('hold-card', calls, { fail: true })]);
  expect(result.log).toEqual(['ran reserve-oven', 'ran notify-kitchen', 'failed hold-card', 'undid reserve-oven']);
});

test('an undo that throws is recorded as stuck, and the rest still run', async () => {
  const calls: string[] = [];
  const result = await runSaga([
    step('reserve-oven', calls),
    step('hold-card', calls, { failUndo: true }),
    step('book-courier', calls, { fail: true }),
  ]);
  expect(result.log).toEqual(['ran reserve-oven', 'ran hold-card', 'failed book-courier', 'undo failed hold-card', 'undid reserve-oven']);
  expect(result.stuck).toEqual(['hold-card']);
});
