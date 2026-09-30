import { collect, initialState, reduceStream } from './solution';
import type { ChatState, Signal, StreamEvent } from './solution';

const fold = (events: StreamEvent[]): ChatState => events.reduce(reduceStream, initialState);

async function* stream(events: StreamEvent[]) {
  for (const event of events) yield event;
}

test('text deltas join into one message', () => {
  const state = fold([
    { type: 'text-delta', text: 'Your table ' },
    { type: 'text-delta', text: 'is booked.' },
    { type: 'done' },
  ]);
  expect(state).toEqual({ status: 'done', text: 'Your table is booked.', toolCalls: [], error: null, canRetry: false });
});

test('tool-call arguments are parsed only once the call ends', () => {
  const start: StreamEvent[] = [
    { type: 'tool-call-start', id: 't1', name: 'weather' },
    { type: 'tool-call-delta', id: 't1', argsDelta: '{"city": "Le' },
    { type: 'tool-call-delta', id: 't1', argsDelta: 'eds"}' },
  ];
  const midway = fold(start);
  expect(midway.toolCalls).toEqual([{ id: 't1', name: 'weather', argsText: '{"city": "Leeds"}', args: null, complete: false }]);
  const ended = reduceStream(midway, { type: 'tool-call-end', id: 't1' });
  expect(ended.toolCalls[0]?.args).toEqual({ city: 'Leeds' });
  expect(ended.toolCalls[0]?.complete).toBe(true);
});

test('two tool calls stream side by side without mixing', () => {
  const state = fold([
    { type: 'tool-call-start', id: 'a', name: 'stock' },
    { type: 'tool-call-start', id: 'b', name: 'price' },
    { type: 'tool-call-delta', id: 'b', argsDelta: '{"sku":' },
    { type: 'tool-call-delta', id: 'a', argsDelta: '{"sku": 7}' },
    { type: 'tool-call-delta', id: 'b', argsDelta: ' 9}' },
    { type: 'tool-call-end', id: 'a' },
    { type: 'tool-call-end', id: 'b' },
  ]);
  expect(state.toolCalls.map((c) => c.args)).toEqual([{ sku: 7 }, { sku: 9 }]);
});

test('the reducer never changes the state it is given', () => {
  const before = fold([{ type: 'text-delta', text: 'Hi' }, { type: 'tool-call-start', id: 'a', name: 'stock' }]);
  const copy = JSON.parse(JSON.stringify(before));
  reduceStream(before, { type: 'text-delta', text: ' there' });
  reduceStream(before, { type: 'tool-call-delta', id: 'a', argsDelta: '{}' });
  expect(before).toEqual(copy);
});

test('an error event keeps the text and offers a retry, and later events are ignored', () => {
  const state = fold([
    { type: 'text-delta', text: 'The venue opens' },
    { type: 'error', message: 'overloaded' },
    { type: 'text-delta', text: ' at six.' },
  ]);
  expect(state).toEqual({ status: 'error', text: 'The venue opens', toolCalls: [], error: 'overloaded', canRetry: true });
});

test('cancelling keeps the partial text, even when the read then throws', async () => {
  const signal = { aborted: false };
  async function* userStops() {
    yield { type: 'text-delta', text: 'Hel' } as StreamEvent;
    yield { type: 'text-delta', text: 'lo' } as StreamEvent;
    signal.aborted = true;
    yield { type: 'text-delta', text: ' there' } as StreamEvent;
  }
  const first = await collect(userStops(), signal);
  expect(first).toEqual({ status: 'cancelled', text: 'Hello', toolCalls: [], error: null, canRetry: true });
  const aborted: Signal = { aborted: false };
  async function* readRejects() {
    yield { type: 'text-delta', text: 'Checking' } as StreamEvent;
    (aborted as { aborted: boolean }).aborted = true;
    throw new Error('The operation was aborted');
  }
  const second = await collect(readRejects(), aborted);
  expect(second.status).toBe('cancelled');
  expect(second.text).toBe('Checking');
});

test('a dropped connection or a stream with no done is an error with a retry', async () => {
  async function* drops() {
    yield { type: 'text-delta', text: 'Two seats' } as StreamEvent;
    throw new Error('network lost');
  }
  expect(await collect(drops(), { aborted: false })).toEqual({
    status: 'error', text: 'Two seats', toolCalls: [], error: 'network lost', canRetry: true,
  });
  const ended = await collect(stream([{ type: 'text-delta', text: 'Two' }]), { aborted: false });
  expect(ended.status).toBe('error');
  expect(ended.canRetry).toBe(true);
  expect(ended.text).toBe('Two');
});
