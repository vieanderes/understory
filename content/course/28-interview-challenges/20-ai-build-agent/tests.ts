import { runAgent } from './solution';
import type { Message, ModelReply, Options, Tool } from './solution';

// A scripted fake model: it returns the replies in order and keeps a copy of what it saw.
function scripted(replies: ModelReply[]) {
  const seen: Message[][] = [];
  let next = 0;
  const model = async (messages: Message[]) => {
    seen.push(messages.map((m) => ({ ...m })));
    const reply = replies[Math.min(next, replies.length - 1)];
    next++;
    if (!reply) throw new Error('the script is empty');
    return reply;
  };
  return { model, seen };
}

const call = (id: string, name: string, input: unknown = {}): ModelReply => ({ type: 'tool_calls', calls: [{ id, name, input }] });
const final = (value: unknown): ModelReply => ({ type: 'final', text: JSON.stringify(value) });
const good = { answer: 'Room 4 is free at ten.', sources: ['rooms'] };

function options(extra: Partial<Options> = {}): Options {
  return {
    task: 'Is a room free at ten?',
    maxSteps: 5,
    maxRetries: 1,
    approve: async () => false,
    fallback: { answer: 'I could not finish that.', sources: [] },
    ...extra,
  };
}

const lookup: Tool = { run: async () => 'room 4: free at 10:00' };

test('a valid final reply ends the run', async () => {
  const { model } = scripted([final(good)]);
  expect(await runAgent(model, {}, options())).toEqual({ status: 'done', output: good, steps: 1 });
});

test('a tool result is fed back as a tool message', async () => {
  const { model, seen } = scripted([call('c1', 'rooms', { time: '10:00' }), final(good)]);
  const result = await runAgent(model, { rooms: lookup }, options());
  expect(result.status).toBe('done');
  expect(result.steps).toBe(2);
  expect(seen[1]?.[2]).toEqual({ role: 'tool', callId: 'c1', content: 'room 4: free at 10:00', isError: false });
});

test('an unknown tool is refused as an error result, and the run goes on', async () => {
  const { model, seen } = scripted([call('c1', 'delete_all'), final(good)]);
  const result = await runAgent(model, { rooms: lookup }, options());
  expect(result.status).toBe('done');
  const toolMessage = seen[1]?.[2];
  expect(toolMessage).toEqual({ role: 'tool', callId: 'c1', content: 'Unknown tool: delete_all', isError: true });
});

test('a write tool runs only after approval', async () => {
  const booked: unknown[] = [];
  const book: Tool = { write: true, run: async (input) => { booked.push(input); return 'booked'; } };
  const asked: string[] = [];
  const refuse = scripted([call('c1', 'book', { room: 4 }), final(good)]);
  await runAgent(refuse.model, { book }, options({ approve: async (c) => { asked.push(c.name); return false; } }));
  expect(booked).toEqual([]);
  expect(asked).toEqual(['book']);
  expect(refuse.seen[1]?.[2]).toEqual({ role: 'tool', callId: 'c1', content: 'Not approved by the user', isError: true });
  const allow = scripted([call('c2', 'book', { room: 4 }), final(good)]);
  await runAgent(allow.model, { book }, options({ approve: async () => true }));
  expect(booked).toEqual([{ room: 4 }]);
});

test('a tool that throws becomes an error result, not a crash', async () => {
  const broken: Tool = { run: async () => { throw new Error('timed out'); } };
  const { model, seen } = scripted([call('c1', 'rooms'), final(good)]);
  const result = await runAgent(model, { rooms: broken }, options());
  expect(result.status).toBe('done');
  expect(seen[1]?.[2]).toEqual({ role: 'tool', callId: 'c1', content: 'Error: timed out', isError: true });
});

test('the step cap stops a model that never finishes', async () => {
  const { model, seen } = scripted([call('c1', 'rooms')]);
  const result = await runAgent(model, { rooms: lookup }, options({ maxSteps: 3 }));
  expect(result).toEqual({ status: 'stopped', output: options().fallback, steps: 3 });
  expect(seen).toHaveLength(3);
});

test('invalid output is retried with the error, then falls back', async () => {
  const fixed = scripted([{ type: 'final', text: 'Room 4 is free.' }, final(good)]);
  const first = await runAgent(fixed.model, {}, options());
  expect(first).toEqual({ status: 'done', output: good, steps: 2 });
  const lastSeen = fixed.seen[1]?.[fixed.seen[1].length - 1];
  expect(lastSeen?.role).toBe('user');
  expect(lastSeen?.role === 'user' ? lastSeen.content : '').toContain('Invalid output');
  const stubborn = scripted([final({ answer: 'Room 4', sources: 'rooms' })]);
  const second = await runAgent(stubborn.model, {}, options({ maxRetries: 2 }));
  expect(second).toEqual({ status: 'fallback', output: options().fallback, steps: 3 });
});
