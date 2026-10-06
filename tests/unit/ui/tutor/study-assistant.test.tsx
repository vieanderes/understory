import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

let pathname = '/learn/javascript/maps';
vi.mock('next/navigation', () => ({ usePathname: () => pathname }));
vi.stubGlobal(
  'fetch',
  vi.fn(async () => new Response('', { status: 404 })),
);

const { Markdown, parseBlocks } = await import('@/features/online-test/assistant/Markdown');
const { StudyAssistant } = await import('@/features/tutor/StudyAssistant');
const {
  appendMessage,
  askTutor,
  readHistory,
  setTutorOpen,
  setTutorScope,
  takeQueuedQuestion,
  tutorHiddenOn,
  withholdTutor,
} = await import('@/features/tutor/tutor-store');
const { stepText } = await import('@/features/tutor/step-text');

describe('Markdown replies', () => {
  it('splits a reply into blocks, and keeps an unclosed fence while streaming', () => {
    const blocks = parseBlocks(
      '# Title\n\nSome **bold** text.\n\n- one\n- two\n\n```ts\nconst a = 1;\n```\n\n> note\n\n```py\nx = 1',
    );
    expect(blocks.map((b) => b.kind)).toEqual([
      'heading',
      'paragraph',
      'list',
      'code',
      'quote',
      'code',
    ]);
    expect(blocks.at(-1)).toEqual({ kind: 'code', language: 'py', text: 'x = 1', closed: false });
    expect(blocks[3]).toMatchObject({ kind: 'code', closed: true });
  });

  it('renders code highlighted with a copy button, and links safely', () => {
    render(
      <Markdown
        text={
          'Use `Map`, see [docs](https://example.com).\n\n1. first\n2. second\n\n```ts\nconst counts = new Map();\n```'
        }
      />,
    );
    expect(screen.getByText('Map', { selector: 'code' })).toBeInTheDocument();
    const link = screen.getByRole('link', { name: 'docs' });
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    expect(screen.getByRole('button', { name: 'Copy the code' })).toBeInTheDocument();
    expect(document.querySelector('.tok-keyword')?.textContent).toBe('const');
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
  });

  it('never turns a reply into markup', () => {
    const { container } = render(
      <Markdown text={'<img src=x onerror=alert(1)> and [x](javascript:alert(1))'} />,
    );
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('a')).toBeNull();
  });
});

describe('step text for the tutor', () => {
  it('collects the prose of a step and leaves the answers out', () => {
    const text = stepText({
      prompt: { md: 'Count the votes.', html: '' },
      options: [{ text: { md: 'A Map', html: '' }, feedback: { md: 'Right', html: '' } }],
      solution: { md: 'THE ANSWER', html: '' },
      starterCode: 'function count() {}',
    });
    expect(text).toContain('Count the votes.');
    expect(text).toContain('A Map');
    expect(text).toContain('Starter code:\nfunction count() {}');
    expect(text).not.toContain('THE ANSWER');
  });
});

describe('StudyAssistant', () => {
  beforeEach(() => {
    window.localStorage.clear();
    pathname = '/learn/javascript/maps';
    setTutorScope(null);
  });

  it('opens from the corner, knows the lesson and keeps its conversation', async () => {
    const user = userEvent.setup();
    setTutorScope({
      key: 'js.maps',
      title: 'Counting with a Map',
      onScreen: 'A Map removes the inner loop.',
    });
    appendMessage('js.maps', { role: 'user', text: 'Why a Map?', at: 1 });
    await act(async () => {
      render(<StudyAssistant />);
    });
    await user.click(screen.getByRole('button', { name: 'Ask Scout AI' }));
    const panel = screen.getByRole('complementary', { name: 'Scout AI' });
    expect(panel).toHaveTextContent('Counting with a Map');
    // The panel is a lazy chunk; under a full parallel run it can take more than a second.
    expect(await screen.findByText('Why a Map?', {}, { timeout: 5000 })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'New chat' }));
    expect(readHistory('js.maps')).toEqual([]);
    // Clearing is never final by surprise: Undo brings the conversation back.
    expect(screen.getByRole('status')).toHaveTextContent('Conversation cleared.');
    await user.click(screen.getByRole('button', { name: 'Undo' }));
    expect(readHistory('js.maps')).toHaveLength(1);
    await user.click(screen.getByRole('button', { name: 'New chat' }));
    expect(readHistory('js.maps')).toEqual([]);
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('complementary', { name: 'Scout AI' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ask Scout AI' })).toBeInTheDocument();
  });

  it('remembers the learner opening it, and a timed test closing it does not count', async () => {
    await act(async () => {
      render(<StudyAssistant />);
    });
    act(() => setTutorOpen(true));
    const panel = screen.getByRole('complementary', { name: 'Scout AI' });
    // It docks beside the page from lg up; the app shell's panel is the other kind.
    expect(panel).toHaveAttribute('data-dock', 'focus');
    expect(window.localStorage.getItem('understory:scout:open')).toBe('1');
    let release = () => {};
    act(() => {
      release = withholdTutor();
    });
    expect(window.localStorage.getItem('understory:scout:open')).toBe('1');
    act(() => release());
    act(() => setTutorOpen(false));
    expect(window.localStorage.getItem('understory:scout:open')).toBeNull();
  });

  it('stays out of the coding simulator, which has its own assistant', async () => {
    pathname = '/practise/online-test/demo';
    await act(async () => {
      render(<StudyAssistant />);
    });
    expect(screen.queryByRole('button', { name: 'Ask Scout AI' })).not.toBeInTheDocument();
  });

  it('steps away, panel and all, while a timed test withholds it, and returns after', async () => {
    setTutorOpen(true);
    let release = () => {};
    await act(async () => {
      render(<StudyAssistant />);
      release = withholdTutor();
    });
    expect(screen.queryByRole('button', { name: 'Ask Scout AI' })).not.toBeInTheDocument();
    expect(screen.queryByRole('complementary', { name: 'Scout AI' })).not.toBeInTheDocument();
    act(() => release());
    // Withholding closed the panel, so the corner button comes back, not an open panel.
    expect(screen.getByRole('button', { name: 'Ask Scout AI' })).toBeInTheDocument();
    expect(screen.queryByRole('complementary', { name: 'Scout AI' })).not.toBeInTheDocument();
  });

  it('opens to ask a question a page queued, once', async () => {
    setTutorScope({ key: 'js.coercion', title: 'Coercion', onScreen: 'Explain it.' });
    await act(async () => {
      render(<StudyAssistant />);
    });
    await act(async () => {
      askTutor('Push back on my explanation.');
    });
    expect(screen.getByRole('complementary', { name: 'Scout AI' })).toBeInTheDocument();
    // Sent at once with a provider ready; waiting in the question box while one is set up.
    await vi.waitFor(() => {
      const asked = readHistory('js.coercion').some(
        (message) => message.text === 'Push back on my explanation.',
      );
      const waiting =
        (screen.queryByRole('textbox', { name: 'Ask the assistant' }) as HTMLTextAreaElement | null)
          ?.value === 'Push back on my explanation.';
      expect(asked || waiting).toBe(true);
    });
    expect(takeQueuedQuestion()).toBeNull();
  });
});

describe('tutor routes', () => {
  it('keeps Scout out of timed tests, the simulator and print, and in lessons', () => {
    expect(tutorHiddenOn('/practise/exam/javascript')).toBe(true);
    expect(tutorHiddenOn('/practise/checkpoint/js-1')).toBe(true);
    expect(tutorHiddenOn('/practise/test-out/js')).toBe(true);
    expect(tutorHiddenOn('/practise/online-test/demo')).toBe(true);
    expect(tutorHiddenOn('/print/lesson')).toBe(true);
    expect(tutorHiddenOn('/learn/javascript/maps')).toBe(false);
    expect(tutorHiddenOn('/practise/review')).toBe(false);
  });
});
