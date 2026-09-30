import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useStreamingChat, type ChatEvent, type StreamFn } from './hook.solution';

// Browsers have AbortController. The CI copy of this sandbox doesn't, so the tests bring a
// small stand-in there. In the browser this block does nothing.
if (typeof globalThis.AbortController === 'undefined') {
  class StandInSignal {
    aborted = false;
    private listeners: (() => void)[] = [];
    addEventListener(_type: 'abort', listener: () => void) {
      this.listeners.push(listener);
    }
    fire() {
      this.aborted = true;
      for (const listener of this.listeners) listener();
    }
  }
  class StandInController {
    signal = new StandInSignal();
    abort() {
      if (!this.signal.aborted) this.signal.fire();
    }
  }
  globalThis.AbortController = StandInController as unknown as typeof AbortController;
}

function Chat({ stream }: { stream: StreamFn }) {
  const { answer, status, error, send, stop } = useStreamingChat(stream);
  return (
    <section>
      <button onClick={() => send('When does my parcel arrive?')}>Ask</button>
      <button onClick={stop}>Stop</button>
      <p>Status: {status}</p>
      <p aria-live="polite">{answer}</p>
      {error && <p role="alert">{error}</p>}
    </section>
  );
}

// Plays the events, then either ends or waits until the signal aborts.
function scripted(events: ChatEvent[], hang = false): StreamFn {
  return async function* (_message, signal) {
    for (const event of events) {
      await Promise.resolve();
      yield event;
    }
    if (hang) {
      await new Promise((_resolve, reject) => {
        signal.addEventListener('abort', () => reject(new Error('aborted')));
      });
    }
  };
}

test('shows the answer as it arrives, then done', async () => {
  const user = userEvent.setup();
  const stream = scripted([
    { type: 'token', text: 'It arrives ' },
    { type: 'token', text: 'on Friday.' },
    { type: 'done' },
  ]);
  render(<Chat stream={stream} />);
  await user.click(screen.getByRole('button', { name: 'Ask' }));
  expect(await screen.findByText('Status: done')).toBeInTheDocument();
  expect(screen.getByText('It arrives on Friday.')).toBeInTheDocument();
});

test('says it is waiting before the first token', async () => {
  const user = userEvent.setup();
  render(<Chat stream={scripted([], true)} />);
  await user.click(screen.getByRole('button', { name: 'Ask' }));
  expect(await screen.findByText('Status: waiting')).toBeInTheDocument();
});

test('Stop keeps the partial answer and marks it stopped', async () => {
  const user = userEvent.setup();
  render(<Chat stream={scripted([{ type: 'token', text: 'It arrives on' }], true)} />);
  await user.click(screen.getByRole('button', { name: 'Ask' }));
  expect(await screen.findByText('It arrives on')).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Stop' }));
  expect(await screen.findByText('Status: stopped')).toBeInTheDocument();
  expect(screen.getByText('It arrives on')).toBeInTheDocument();
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});

test('Stop aborts the signal the stream was given', async () => {
  const user = userEvent.setup();
  const signals: AbortSignal[] = [];
  const hanging = scripted([{ type: 'token', text: 'Checking' }], true);
  const stream: StreamFn = (message, signal) => {
    signals.push(signal);
    return hanging(message, signal);
  };
  render(<Chat stream={stream} />);
  await user.click(screen.getByRole('button', { name: 'Ask' }));
  await screen.findByText('Checking');
  await user.click(screen.getByRole('button', { name: 'Stop' }));
  expect(signals).toHaveLength(1);
  expect(signals[0]?.aborted).toBe(true);
});

test('an error event keeps the text and shows the message', async () => {
  const user = userEvent.setup();
  const stream = scripted([
    { type: 'token', text: 'It arrives' },
    { type: 'error', message: 'The model failed. Try again.' },
  ]);
  render(<Chat stream={stream} />);
  await user.click(screen.getByRole('button', { name: 'Ask' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('The model failed. Try again.');
  expect(screen.getByText('It arrives')).toBeInTheDocument();
  expect(screen.getByText('Status: error')).toBeInTheDocument();
});

test('a dropped connection is an error, not a stop', async () => {
  const user = userEvent.setup();
  const stream: StreamFn = async function* () {
    yield { type: 'token', text: 'It' };
    throw new Error('network down');
  };
  render(<Chat stream={stream} />);
  await user.click(screen.getByRole('button', { name: 'Ask' }));
  expect(await screen.findByRole('alert')).toBeInTheDocument();
  expect(screen.getByText('Status: error')).toBeInTheDocument();
});
