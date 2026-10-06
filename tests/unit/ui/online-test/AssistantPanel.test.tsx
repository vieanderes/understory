import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  AssistantError,
  type AssistantContext,
  type AssistantPort,
  type AssistantProviderId,
  type AssistantRequest,
  type AssistantSignal,
} from '@/core/ports/assistant';

let cliAvailable = false;
vi.stubGlobal(
  'fetch',
  vi.fn(async (url: string) =>
    url === '/api/assistant/local'
      ? Response.json({ available: cliAvailable })
      : new Response('', { status: 404 }),
  ),
);

const { AssistantPanel } = await import('@/features/online-test/assistant/AssistantPanel');
const { resetLocalCliAvailability } = await import('@/features/online-test/assistant/prefs');
const { setAssistantDraft } = await import('@/features/online-test/assistant-draft');
type Message = Parameters<Parameters<typeof AssistantPanel>[0]['onMessage']>[0];

const CONTEXT: AssistantContext = {
  taskTitle: 'Longest run',
  statement: 'Return the longest run.',
  language: 'javascript',
  code: 'function solution(a) {}',
  output: '',
};

/** A port whose reply the test releases chunk by chunk. */
function controllablePort() {
  const requests: AssistantRequest[] = [];
  let push: ((chunk: string | null | Error) => void) | undefined;
  const port: AssistantPort = {
    id: 'api-key',
    async *send(request: AssistantRequest, signal?: AssistantSignal) {
      requests.push(request);
      const queue: (string | null | Error)[] = [];
      let wake: (() => void) | undefined;
      push = (chunk) => {
        queue.push(chunk);
        wake?.();
      };
      signal?.addEventListener?.('abort', () => push?.(null));
      while (true) {
        if (queue.length === 0) await new Promise<void>((resolve) => (wake = resolve));
        const next = queue.shift();
        if (next === null || next === undefined) return;
        if (next instanceof Error) throw next;
        yield next;
      }
    },
  };
  return { port, requests, push: (chunk: string | null | Error) => act(async () => push?.(chunk)) };
}

function Harness({
  createPort,
  onMessage,
  initial = [],
}: {
  createPort?: (id: AssistantProviderId) => AssistantPort;
  onMessage?: (message: Message) => void;
  initial?: Message[];
}) {
  const [transcript, setTranscript] = useState<Message[]>(initial);
  return (
    <div style={{ height: 600 }}>
      <AssistantPanel
        context={CONTEXT}
        transcript={transcript}
        createPort={createPort}
        onMessage={(message) => {
          onMessage?.(message);
          setTranscript((all) => [...all, message]);
        }}
      />
    </div>
  );
}

beforeEach(() => {
  window.localStorage.clear();
  setAssistantDraft('');
  window.sessionStorage.clear();
  cliAvailable = false;
  resetLocalCliAvailability();
});

describe('AssistantPanel', () => {
  it('opens the key setup until a key is saved, and keeps the key in localStorage', async () => {
    const user = userEvent.setup();
    render(<Harness createPort={() => controllablePort().port} />);
    // A Claude account through MCP is the default; a key is chosen explicitly.
    // The connection sits behind a chip; setup opens on demand.
    await user.click(screen.getByRole('button', { name: /Assistant settings/ }));
    expect(screen.getByRole('radio', { name: /^Claude app/ })).toBeChecked();
    await user.click(screen.getByRole('radio', { name: /An API key/ }));
    expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled();
    const key = screen.getByLabelText('Anthropic API key');
    await user.type(key, 'sk-ant-123');
    expect(window.localStorage.getItem('understory:assistant:key')).toBe('sk-ant-123');
    await user.type(screen.getByLabelText('Ask the assistant'), 'Hi');
    expect(screen.getByRole('button', { name: 'Send' })).toBeEnabled();
  });

  it('sends on Enter, streams the reply and hands both messages to the parent', async () => {
    window.localStorage.setItem('understory:assistant:key', 'sk-1');
    const user = userEvent.setup();
    const fake = controllablePort();
    const onMessage = vi.fn();
    render(
      <Harness
        createPort={() => fake.port}
        onMessage={onMessage}
        initial={[
          { role: 'user', text: 'Earlier', at: 1 },
          { role: 'assistant', text: 'Answer', at: 2 },
        ]}
      />,
    );
    expect(screen.queryByLabelText('Anthropic API key')).not.toBeInTheDocument();

    const box = screen.getByLabelText('Ask the assistant');
    await user.type(box, 'Can N be 0?{Enter}');
    expect(onMessage).toHaveBeenCalledWith(
      expect.objectContaining({ role: 'user', text: 'Can N be 0?' }),
    );
    expect(box).toHaveValue('');
    expect(fake.requests[0]).toEqual({
      context: CONTEXT,
      turns: [
        { role: 'user', text: 'Earlier' },
        { role: 'assistant', text: 'Answer' },
        { role: 'user', text: 'Can N be 0?' },
      ],
    });

    await fake.push('Yes, ');
    const live = screen.getByText('Yes,').closest('[aria-live]');
    expect(live).toHaveAttribute('aria-busy', 'true');
    await fake.push('return 0.');
    expect(screen.getByRole('button', { name: 'Stop' })).toBeInTheDocument();
    await fake.push(null);

    await waitFor(() =>
      expect(onMessage).toHaveBeenLastCalledWith(
        expect.objectContaining({ role: 'assistant', text: 'Yes, return 0.' }),
      ),
    );
    const log = screen.getByRole('log', { name: 'Conversation' });
    expect(within(log).getByText('Yes, return 0.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Send' })).toBeInTheDocument();
  });

  it('adds a line on Shift+Enter instead of sending', async () => {
    window.localStorage.setItem('understory:assistant:key', 'sk-1');
    const user = userEvent.setup();
    const onMessage = vi.fn();
    render(<Harness createPort={() => controllablePort().port} onMessage={onMessage} />);
    const box = screen.getByLabelText('Ask the assistant');
    await user.type(box, 'one{Shift>}{Enter}{/Shift}two');
    expect(box).toHaveValue('one\ntwo');
    expect(onMessage).not.toHaveBeenCalled();
  });

  it('stops a reply and keeps what arrived', async () => {
    window.localStorage.setItem('understory:assistant:key', 'sk-1');
    const user = userEvent.setup();
    const fake = controllablePort();
    const onMessage = vi.fn();
    render(<Harness createPort={() => fake.port} onMessage={onMessage} />);
    await user.type(screen.getByLabelText('Ask the assistant'), 'Explain{Enter}');
    await fake.push('Partial');
    await user.click(screen.getByRole('button', { name: 'Stop' }));
    await waitFor(() =>
      expect(onMessage).toHaveBeenLastCalledWith(
        expect.objectContaining({ role: 'assistant', text: 'Partial' }),
      ),
    );
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('shows an error in plain words', async () => {
    window.localStorage.setItem('understory:assistant:key', 'sk-1');
    const user = userEvent.setup();
    const fake = controllablePort();
    const onMessage = vi.fn();
    render(<Harness createPort={() => fake.port} onMessage={onMessage} />);
    await user.type(screen.getByLabelText('Ask the assistant'), 'Hi{Enter}');
    await fake.push(new AssistantError('rate-limited', 'This key has hit its rate limit.'));
    expect(await screen.findByRole('alert')).toHaveTextContent('This key has hit its rate limit.');
    expect(onMessage).toHaveBeenCalledTimes(1);
  });

  it('shows the pairing code and the exact MCP command, and remembers the choice', async () => {
    const user = userEvent.setup();
    const ids: AssistantProviderId[] = [];
    render(
      <Harness
        createPort={(id) => {
          ids.push(id);
          return controllablePort().port;
        }}
      />,
    );
    await user.click(screen.getByRole('button', { name: /Assistant settings/ }));
    await user.click(screen.getByRole('radio', { name: /An API key/ }));
    await user.click(screen.getByRole('radio', { name: /^Claude app/ }));
    expect(window.localStorage.getItem('understory:assistant:provider')).toBe('mcp');
    expect(ids.at(-1)).toBe('mcp');

    // The tab keeps its secret beside the code; only the code is shown.
    const stored = window.sessionStorage.getItem('understory:assistant:pairing') ?? '';
    expect(stored).toMatch(/^[A-Z2-9]{8}:[0-9a-f]{64}$/);
    const [code = '', secret = ''] = stored.split(':');
    expect(screen.getByText(`${code.slice(0, 4)}-${code.slice(4)}`)).toBeInTheDocument();
    expect(document.body.textContent).not.toContain(secret);
    expect(screen.getByText(/Not connected yet/)).toBeInTheDocument();
    expect(
      screen.getByText(
        `Keep answering my Understory questions, code ${code.slice(0, 4)}-${code.slice(4)}`,
      ),
    ).toBeInTheDocument();

    // A new code replaces the old one at once.
    await user.click(screen.getByRole('button', { name: 'New code' }));
    const [next = ''] = (window.sessionStorage.getItem('understory:assistant:pairing') ?? '').split(
      ':',
    );
    expect(next).not.toBe(code);
    expect(screen.getByText(`${next.slice(0, 4)}-${next.slice(4)}`)).toBeInTheDocument();
    expect(
      screen.getByText(
        `claude mcp add --transport http understory ${window.location.origin}/api/mcp`,
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Copy command' })).toBeInTheDocument();
  });

  it('says the Claude Code plugin is not ready yet, and sets Claude Code up the way that works', async () => {
    const user = userEvent.setup();
    render(<Harness createPort={() => controllablePort().port} />);
    await user.click(screen.getByRole('button', { name: /Assistant settings/ }));
    await user.click(screen.getByRole('radio', { name: /^Claude Code\s*Works now/ }));
    expect(window.localStorage.getItem('understory:assistant:provider')).toBe('mcp');
    expect(window.localStorage.getItem('understory:assistant:claude-client')).toBe('code');
    expect(
      screen.getByRole('region', { name: 'The Claude Code plugin is not ready yet' }),
    ).toHaveTextContent(/approved/);
    const steps = screen.getByRole('list', { name: 'Connect Claude Code' });
    expect(
      within(steps).getByText(
        `claude mcp add --transport http understory ${window.location.origin}/api/mcp`,
      ),
    ).toBeInTheDocument();
    const [code = ''] = (window.sessionStorage.getItem('understory:assistant:pairing') ?? '').split(
      ':',
    );
    expect(
      within(steps).getByText(
        `Keep answering my Understory questions, code ${code.slice(0, 4)}-${code.slice(4)}`,
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText(/dangerously-load-development-channels/)).not.toBeInTheDocument();
  });

  it('offers the local Claude account only when the server says it is available', async () => {
    const user = userEvent.setup();
    const { unmount } = render(<Harness createPort={() => controllablePort().port} />);
    await waitFor(() => expect(fetch).toHaveBeenCalled());
    await user.click(screen.getByRole('button', { name: /Assistant settings/ }));
    expect(
      screen.queryByRole('radio', { name: /Claude Code on this machine/ }),
    ).not.toBeInTheDocument();
    unmount();

    cliAvailable = true;
    resetLocalCliAvailability();
    render(<Harness createPort={() => controllablePort().port} />);
    await user.click(await screen.findByRole('button', { name: /Assistant settings/ }));
    expect(
      await screen.findByRole('radio', { name: /Claude Code on this machine/ }),
    ).toBeInTheDocument();
  });
});
