import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import type { ChildProcess } from 'node:child_process';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  cliArgs,
  cliAvailable,
  cliError,
  cliPrompt,
  parseCliLine,
  resetCliCache,
  runClaudeCli,
  type Spawn,
} from '@/adapters/assistant/server/claude-cli';
import type { StreamEvent } from '@/adapters/assistant/protocol';
import { BODY } from './fixtures';

class FakeChild extends EventEmitter {
  stdout = new PassThrough();
  stdin = new PassThrough();
  exitCode: number | null = null;
  killed = false;
  written = '';
  constructor() {
    super();
    this.stdin.on('data', (chunk) => (this.written += String(chunk)));
  }
  kill() {
    this.killed = true;
    this.stdout.end();
    queueMicrotask(() => this.emit('close', null));
    return true;
  }
  finish(lines: unknown[], code = 0) {
    for (const line of lines) this.stdout.write(`${JSON.stringify(line)}\n`);
    this.stdout.end();
    this.exitCode = code;
    setTimeout(() => this.emit('close', code), 0);
  }
}

function fakeSpawn(child: FakeChild, calls: { command: string; args: string[] }[] = []): Spawn {
  return (command, args) => {
    calls.push({ command, args });
    return child as unknown as ChildProcess;
  };
}

const textLine = (text: string, parent: string | null = null) => ({
  type: 'stream_event',
  parent_tool_use_id: parent,
  event: { type: 'content_block_delta', index: 1, delta: { type: 'text_delta', text } },
});

async function run(child: FakeChild, signal = new AbortController().signal) {
  const out: StreamEvent[] = [];
  for await (const event of runClaudeCli(BODY, signal, fakeSpawn(child), 'claude')) out.push(event);
  return out;
}

describe('claude CLI arguments', () => {
  it('runs print mode with streamed partial JSON, our system prompt and no tools', () => {
    const args = cliArgs({ ...BODY, model: 'claude-opus-5-5' });
    expect(args).toContain('-p');
    expect(args.join(' ')).toContain('--output-format stream-json');
    expect(args).toContain('--include-partial-messages');
    expect(args[args.indexOf('--tools') + 1]).toBe('');
    expect(args).toContain('--strict-mcp-config');
    expect(args).toContain('--no-session-persistence');
    expect(args[args.indexOf('--system-prompt') + 1]).toContain('Longest run');
    expect(args.slice(-2)).toEqual(['--model', 'claude-opus-5-5']);
  });

  it('writes earlier turns above the new question', () => {
    expect(cliPrompt(BODY.turns)).toBe('What does a run mean here?');
    const prompt = cliPrompt([
      { role: 'user', text: 'Hi' },
      { role: 'assistant', text: 'Hello' },
      { role: 'user', text: 'Is [] valid?' },
    ]);
    expect(prompt).toContain('Candidate: Hi');
    expect(prompt).toContain('Assistant: Hello');
    expect(prompt.endsWith('Is [] valid?')).toBe(true);
  });
});

describe('parseCliLine', () => {
  it('reads top-level text deltas and ignores subagents, thinking and noise', () => {
    expect(parseCliLine(JSON.stringify(textLine('Hey')))).toEqual({ kind: 'text', text: 'Hey' });
    expect(parseCliLine(JSON.stringify(textLine('x', 'tool_1')))).toEqual({ kind: 'other' });
    expect(
      parseCliLine(
        JSON.stringify({
          type: 'stream_event',
          event: { type: 'content_block_delta', delta: { type: 'thinking_delta', thinking: 'hm' } },
        }),
      ),
    ).toEqual({ kind: 'other' });
    expect(parseCliLine('not json')).toEqual({ kind: 'other' });
    expect(parseCliLine('null')).toEqual({ kind: 'other' });
  });

  it('reads the result line', () => {
    expect(
      parseCliLine(
        JSON.stringify({ type: 'result', subtype: 'success', is_error: false, result: 'Hi' }),
      ),
    ).toEqual({ kind: 'result', ok: true, text: 'Hi' });
    expect(
      parseCliLine(
        JSON.stringify({ type: 'result', subtype: 'success', is_error: true, result: 'Nope' }),
      ),
    ).toEqual({ kind: 'result', ok: false, message: 'Nope' });
  });

  it('turns CLI failures into plain words', () => {
    expect(cliError('Invalid API key · Please run /login').code).toBe('unauthorised');
    expect(cliError('Claude usage limit reached').code).toBe('rate-limited');
    expect(cliError('something else').code).toBe('failed');
  });
});

describe('runClaudeCli', () => {
  it('streams text and ends with done, sending the prompt on stdin', async () => {
    const child = new FakeChild();
    const calls: { command: string; args: string[] }[] = [];
    const events = (async () => {
      const out: StreamEvent[] = [];
      for await (const event of runClaudeCli(
        BODY,
        new AbortController().signal,
        fakeSpawn(child, calls),
        'claude',
      ))
        out.push(event);
      return out;
    })();
    child.finish([
      { type: 'system', subtype: 'init' },
      textLine('A run '),
      textLine('is a streak.'),
      { type: 'result', subtype: 'success', is_error: false, result: 'A run is a streak.' },
    ]);
    expect(await events).toEqual([
      { type: 'text', text: 'A run ' },
      { type: 'text', text: 'is a streak.' },
      { type: 'done' },
    ]);
    expect(calls[0]?.command).toBe('claude');
    expect(child.written).toBe('What does a run mean here?');
  });

  it('falls back to the result text when nothing streamed', async () => {
    const child = new FakeChild();
    const events = run(child);
    child.finish([{ type: 'result', subtype: 'success', is_error: false, result: 'Whole reply' }]);
    expect(await events).toEqual([{ type: 'text', text: 'Whole reply' }, { type: 'done' }]);
  });

  it('reports an error result', async () => {
    const child = new FakeChild();
    const events = run(child);
    child.finish([{ type: 'result', subtype: 'success', is_error: true, result: 'Not logged in' }]);
    expect(await events).toEqual([
      { type: 'error', code: 'unauthorised', message: expect.stringContaining('log in') },
    ]);
  });

  it('reports a missing binary as unavailable', async () => {
    const child = new FakeChild();
    const events = run(child);
    child.emit('error', Object.assign(new Error('spawn claude ENOENT'), { code: 'ENOENT' }));
    child.stdout.end();
    expect(await events).toEqual([
      { type: 'error', code: 'unavailable', message: expect.stringContaining('not installed') },
    ]);
  });

  it('reports an exit without a result', async () => {
    const child = new FakeChild();
    const events = run(child);
    child.finish([], 1);
    expect(await events).toEqual([
      { type: 'error', code: 'failed', message: 'Claude Code stopped with an error.' },
    ]);
  });

  it('kills the child on abort and yields nothing more', async () => {
    const child = new FakeChild();
    const controller = new AbortController();
    const iterator = runClaudeCli(BODY, controller.signal, fakeSpawn(child), 'claude');
    const first = iterator.next();
    child.stdout.write(`${JSON.stringify(textLine('Hal'))}\n`);
    expect((await first).value).toEqual({ type: 'text', text: 'Hal' });
    controller.abort();
    expect(child.killed).toBe(true);
    expect((await iterator.next()).done).toBe(true);
  });
});

describe('cliAvailable', () => {
  beforeEach(() => resetCliCache());

  it('is true when claude --version exits 0, and caches the answer', async () => {
    const child = new FakeChild();
    const calls: { command: string; args: string[] }[] = [];
    const answer = cliAvailable(fakeSpawn(child, calls), 'claude', 1000);
    child.emit('close', 0);
    expect(await answer).toBe(true);
    expect(calls[0]?.args).toEqual(['--version']);
    expect(await cliAvailable(fakeSpawn(new FakeChild(), calls), 'claude', 2000)).toBe(true);
    expect(calls).toHaveLength(1);
  });

  it('is false when the binary is missing', async () => {
    const child = new FakeChild();
    const answer = cliAvailable(fakeSpawn(child), 'claude', 1000);
    child.emit('error', new Error('ENOENT'));
    expect(await answer).toBe(false);
  });
});
