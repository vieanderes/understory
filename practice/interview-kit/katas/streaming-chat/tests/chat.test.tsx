// @vitest-environment jsdom
import { act, cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { createControlledStream, type Delta, type StreamCall } from '../fixtures/stream';
import { Chat } from '../src/chat';

afterEach(cleanup);

function setup() {
  const { stream, calls } = createControlledStream();
  const user = userEvent.setup();
  render(<Chat stream={stream} />);
  const box = screen.getByRole('textbox', { name: 'Message' });
  return { calls, user, box };
}

async function push(call: StreamCall, ...deltas: Delta[]) {
  await act(async () => call.push(...deltas));
}

async function finish(call: StreamCall) {
  await act(async () => call.finish());
}

function messages() {
  return within(screen.getByRole('list', { name: 'Conversation' })).queryAllByRole('listitem');
}

async function send(ctx: ReturnType<typeof setup>, text: string) {
  await ctx.user.type(ctx.box, text);
  await ctx.user.click(screen.getByRole('button', { name: 'Send' }));
}

describe('Chat', () => {
  it('sends the message, clears the box and streams the reply in as it arrives', async () => {
    const ctx = setup();
    expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled();
    await send(ctx, 'Hi');

    expect(ctx.box).toHaveValue('');
    expect(ctx.calls[0]!.messages).toEqual([{ role: 'user', content: 'Hi' }]);
    expect(messages()[0]).toHaveTextContent('You');
    expect(messages()[0]).toHaveTextContent('Hi');

    await push(ctx.calls[0]!, { type: 'text', text: 'Hel' });
    expect(messages()[1]).toHaveTextContent('Hel');
    expect(messages()[1]).toHaveAttribute('aria-busy', 'true');

    await push(ctx.calls[0]!, { type: 'text', text: 'lo there' });
    expect(messages()[1]).toHaveTextContent('Hello there');

    await finish(ctx.calls[0]!);
    expect(messages()[1]).toHaveAttribute('aria-busy', 'false');
    expect(screen.queryByRole('button', { name: 'Stop' })).toBeNull();
  });

  it('shows tool calls as they start', async () => {
    const ctx = setup();
    await send(ctx, 'Weather?');
    await push(
      ctx.calls[0]!,
      { type: 'tool_call_start', id: 't1', name: 'get_weather' },
      { type: 'tool_call_args', id: 't1', argsDelta: '{"city":"Oslo"}' },
    );
    expect(messages()[1]).toHaveTextContent('Used tool get_weather');
  });

  it('stops on request, keeps the partial text and sends it as history next time', async () => {
    const ctx = setup();
    await send(ctx, 'Tell me a long story');
    await push(ctx.calls[0]!, { type: 'text', text: 'Once upon' });
    await ctx.user.click(screen.getByRole('button', { name: 'Stop' }));

    expect(ctx.calls[0]!.signal.aborted).toBe(true);
    expect(messages()[1]).toHaveTextContent('Once upon');
    expect(messages()[1]).toHaveTextContent('Stopped');
    expect(screen.queryByRole('alert')).toBeNull();

    await send(ctx, 'Shorter please');
    expect(ctx.calls[1]!.messages).toEqual([
      { role: 'user', content: 'Tell me a long story' },
      { role: 'assistant', content: 'Once upon' },
      { role: 'user', content: 'Shorter please' },
    ]);
  });

  it('shows a mid-stream failure and retries with the same history', async () => {
    const ctx = setup();
    await send(ctx, 'Hi');
    await push(ctx.calls[0]!, { type: 'text', text: 'Half an ans' });
    await act(async () => ctx.calls[0]!.fail(new Error('connection reset')));

    expect(screen.getByRole('alert')).toHaveTextContent('The response was interrupted.');
    expect(messages()[1]).toHaveTextContent('Half an ans');

    await ctx.user.click(screen.getByRole('button', { name: 'Retry' }));
    expect(ctx.calls).toHaveLength(2);
    expect(ctx.calls[1]!.messages).toEqual([{ role: 'user', content: 'Hi' }]);

    await push(ctx.calls[1]!, { type: 'text', text: 'A whole answer' });
    await finish(ctx.calls[1]!);
    expect(screen.queryByRole('alert')).toBeNull();
    expect(messages()).toHaveLength(2);
    expect(messages()[1]).toHaveTextContent('A whole answer');
    expect(messages()[1]).not.toHaveTextContent('Half an ans');
  });

  it('passes the whole conversation on the next turn', async () => {
    const ctx = setup();
    await send(ctx, 'First');
    await push(ctx.calls[0]!, { type: 'text', text: 'Reply one' });
    await finish(ctx.calls[0]!);
    await send(ctx, 'Second');
    expect(ctx.calls[1]!.messages).toEqual([
      { role: 'user', content: 'First' },
      { role: 'assistant', content: 'Reply one' },
      { role: 'user', content: 'Second' },
    ]);
  });
});
