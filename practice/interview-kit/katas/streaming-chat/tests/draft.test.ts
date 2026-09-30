import { describe, expect, it } from 'vitest';
import type { Delta } from '../fixtures/stream';
import { applyDelta, EMPTY_DRAFT } from '../src/draft';

const run = (deltas: Delta[]) => deltas.reduce(applyDelta, EMPTY_DRAFT);

describe('applyDelta', () => {
  it('appends text deltas', () => {
    expect(
      run([
        { type: 'text', text: 'Hel' },
        { type: 'text', text: 'lo' },
      ]).text,
    ).toBe('Hello');
  });

  it('does not mutate the previous draft', () => {
    const before = run([{ type: 'text', text: 'a' }]);
    const snapshot = structuredClone(before);
    applyDelta(before, { type: 'text', text: 'b' });
    applyDelta(before, { type: 'tool_call_start', id: 't1', name: 'x' });
    expect(before).toEqual(snapshot);
  });

  it('assembles tool call arguments per id and parses them only when done', () => {
    const partial = run([
      { type: 'tool_call_start', id: 't1', name: 'get_weather' },
      { type: 'tool_call_start', id: 't2', name: 'get_time' },
      { type: 'tool_call_args', id: 't1', argsDelta: '{"city":' },
      { type: 'tool_call_args', id: 't2', argsDelta: '{"tz":"UTC"}' },
      { type: 'tool_call_args', id: 't1', argsDelta: '"Oslo"}' },
    ]);
    expect(partial.toolCalls.map((c) => c.argsText)).toEqual(['{"city":"Oslo"}', '{"tz":"UTC"}']);
    expect(partial.toolCalls[0]!.args).toBeUndefined();

    const done = applyDelta(partial, { type: 'done' });
    expect(done.done).toBe(true);
    expect(done.toolCalls.map((c) => c.args)).toEqual([{ city: 'Oslo' }, { tz: 'UTC' }]);
  });

  it('marks invalid JSON arguments instead of guessing', () => {
    const done = run([
      { type: 'tool_call_start', id: 't1', name: 'search' },
      { type: 'tool_call_args', id: 't1', argsDelta: '{"q": "unterminated' },
      { type: 'done' },
    ]);
    expect(done.toolCalls[0]!.args).toBeUndefined();
    expect(done.toolCalls[0]!.error).toBe('Invalid JSON arguments');
  });

  it('rejects arguments for a call that never started', () => {
    expect(() => run([{ type: 'tool_call_args', id: 'ghost', argsDelta: '{}' }])).toThrow(/ghost/);
  });
});
