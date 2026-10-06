import { act, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ExplainBackStep } from '@/features/lesson-player/steps/ExplainBackStep';
import { setTutorOpen, takeQueuedQuestion, withholdTutor } from '@/features/tutor/tutor-store';
import { explainStep, renderStep } from './fixtures';

let pathname = '/learn/javascript/values-types-coercion';
vi.mock('next/navigation', () => ({ usePathname: () => pathname }));

/** A stand-in for the browser's recogniser: the test says what it heard. */
class FakeRecognition {
  static last: FakeRecognition | null = null;
  lang = '';
  continuous = false;
  interimResults = false;
  onresult: ((event: unknown) => void) | null = null;
  onerror: ((event: { error: string }) => void) | null = null;
  onend: (() => void) | null = null;
  started = false;
  constructor() {
    FakeRecognition.last = this;
  }
  start() {
    this.started = true;
  }
  stop() {
    this.started = false;
    this.onend?.();
  }
  abort() {
    this.stop();
  }
  hear(words: string, isFinal: boolean) {
    const result = Object.assign([{ transcript: words }], { isFinal });
    act(() => this.onresult?.({ resultIndex: 0, results: [result] }));
  }
  fail(error: string) {
    act(() => {
      this.onerror?.({ error });
      this.stop();
    });
  }
}

const TEXT = 'The field gives a string so plus joins the text';

describe('ExplainBackStep', () => {
  it('names who the explanation is for above the prompt', () => {
    const { unmount } = renderStep(ExplainBackStep, explainStep);
    expect(screen.getByText('Explain it to a teammate')).toBeInTheDocument();
    unmount();
    renderStep(ExplainBackStep, { ...explainStep, audience: 'reviewer', kind: 'decide' });
    expect(screen.getByText('Defend the choice to a reviewer')).toBeInTheDocument();
  });

  it('counts words live and keeps Compare off until something is written', async () => {
    const user = userEvent.setup();
    const view = renderStep(ExplainBackStep, explainStep);
    const box = screen.getByRole('textbox', { name: 'Your explanation' });
    expect(screen.getByRole('button', { name: 'Compare' })).toBeDisabled();
    expect(box).toHaveAccessibleDescription(/0 words.*Aim for 30 to 80/);
    await user.type(box, 'One');
    expect(box).toHaveAccessibleDescription(/1 word Aim/);
    await user.type(box, ' two  three ');
    expect(box).toHaveAccessibleDescription(/3 words/);
    expect(screen.getByRole('button', { name: 'Compare' })).toBeEnabled();
    // Writing alone is not an answer: the self-grade is.
    expect(view.submission()).toBeUndefined();
    expect(screen.queryByText('Model answer')).not.toBeInTheDocument();
  });

  it('reports as soon as the model answer shows, and again as boxes change', async () => {
    const user = userEvent.setup();
    const view = renderStep(ExplainBackStep, explainStep);
    await user.type(screen.getByRole('textbox'), TEXT);
    await user.click(screen.getByRole('button', { name: 'Compare' }));
    expect(screen.getByText('Model answer')).toBeInTheDocument();
    expect(view.submission()).toEqual({ type: 'explain-back', rubricHits: 0 });
    expect(screen.getByRole('textbox')).toHaveAttribute('readonly');

    const boxes = screen.getAllByRole('checkbox');
    expect(boxes).toHaveLength(3);
    expect(screen.getByRole('group', { name: 'My explanation made this point' })).toBeVisible();
    await user.click(boxes[0]!);
    await user.click(screen.getByRole('checkbox', { name: /joins text/ }));
    expect(view.submission()).toEqual({ type: 'explain-back', rubricHits: 2 });
    await user.click(boxes[0]!);
    expect(view.submission()).toEqual({ type: 'explain-back', rubricHits: 1 });
  });

  it('never puts the written text in the submission', async () => {
    const user = userEvent.setup();
    const view = renderStep(ExplainBackStep, explainStep);
    await user.type(screen.getByRole('textbox'), TEXT);
    await user.click(screen.getByRole('button', { name: 'Compare' }));
    expect(JSON.stringify(view.submission())).not.toContain('string');
  });

  it('works by keyboard, grades through the real grader and sums up in one line', async () => {
    const user = userEvent.setup();
    const view = renderStep(ExplainBackStep, explainStep);
    await user.type(screen.getByRole('textbox'), TEXT);
    await user.tab();
    expect(screen.getByRole('button', { name: 'Compare' })).toHaveFocus();
    await user.keyboard('{Enter}');
    for (const box of screen.getAllByRole('checkbox')) {
      box.focus();
      await user.keyboard(' ');
    }
    expect(view.submission()).toEqual({ type: 'explain-back', rubricHits: 3 });
    await user.click(screen.getByRole('button', { name: 'Check' }));
    expect(view.grade()?.correct).toBe(true);
    expect(screen.getByRole('status')).toHaveTextContent('3 of 3 points made');
    expect(screen.getAllByRole('checkbox')[0]).toBeDisabled();
  });

  it('renders code in a rubric point as code', async () => {
    const user = userEvent.setup();
    renderStep(ExplainBackStep, explainStep);
    await user.type(screen.getByRole('textbox'), TEXT);
    await user.click(screen.getByRole('button', { name: 'Compare' }));
    expect(screen.getByText('+').tagName).toBe('CODE');
  });
});

describe('ExplainBackStep, said out loud', () => {
  beforeEach(() => {
    FakeRecognition.last = null;
    window.localStorage.clear();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('offers no microphone where the browser cannot listen', () => {
    renderStep(ExplainBackStep, explainStep);
    expect(screen.queryByRole('button', { name: 'Say it out loud' })).not.toBeInTheDocument();
  });

  it('listens for a minute, shows words as they come and adds settled ones to the text', async () => {
    vi.stubGlobal('webkitSpeechRecognition', FakeRecognition);
    const user = userEvent.setup();
    renderStep(ExplainBackStep, explainStep);
    const box = screen.getByRole('textbox', { name: 'Your explanation' });
    await user.type(box, 'First');
    const mic = screen.getByRole('button', { name: 'Say it out loud' });
    expect(mic).toHaveAttribute('aria-pressed', 'false');
    await user.click(mic);
    const rec = FakeRecognition.last!;
    expect(rec.started).toBe(true);
    expect(rec.lang).toBe('en-GB');
    expect(mic).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('1:00')).toBeInTheDocument();
    expect(screen.getByText('Listening. You have one minute.')).toBeInTheDocument();
    // The first time, the learner hears where their speech goes.
    expect(screen.getByText(/Your browser turns speech into text/)).toBeInTheDocument();

    rec.hear('the field', false);
    expect(screen.getByText('the field')).toBeInTheDocument();
    expect(box).toHaveValue('First');
    rec.hear('the field gives a string', true);
    expect(box).toHaveValue('First the field gives a string');

    await user.click(mic);
    expect(mic).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByText('Stopped listening.')).toBeInTheDocument();
    // Still the learner's text: editable after speaking.
    await user.type(box, ' as text');
    expect(box).toHaveValue('First the field gives a string as text');

    await user.click(mic);
    expect(screen.queryByText(/Your browser turns speech into text/)).not.toBeInTheDocument();
  });

  it('stops by itself at the minute', async () => {
    vi.stubGlobal('webkitSpeechRecognition', FakeRecognition);
    let now = 0;
    vi.spyOn(Date, 'now').mockImplementation(() => now);
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    try {
      renderStep(ExplainBackStep, explainStep);
      act(() => screen.getByRole('button', { name: 'Say it out loud' }).click());
      now = 51_000;
      act(() => vi.advanceTimersByTime(250));
      expect(screen.getByText('0:09')).toBeInTheDocument();
      expect(screen.getByText('10 seconds left.')).toBeInTheDocument();
      now = 60_000;
      act(() => vi.advanceTimersByTime(250));
      expect(FakeRecognition.last!.started).toBe(false);
      expect(screen.getByRole('button', { name: 'Say it out loud' })).toHaveAttribute(
        'aria-pressed',
        'false',
      );
    } finally {
      vi.useRealTimers();
      vi.restoreAllMocks();
    }
  });

  it('says in one line when the microphone is blocked', async () => {
    vi.stubGlobal('webkitSpeechRecognition', FakeRecognition);
    const user = userEvent.setup();
    renderStep(ExplainBackStep, explainStep);
    await user.click(screen.getByRole('button', { name: 'Say it out loud' }));
    FakeRecognition.last!.fail('not-allowed');
    expect(screen.getAllByText('Microphone blocked. You can type instead.')).not.toHaveLength(0);
  });

  it('stops listening on Compare and puts the microphone away', async () => {
    vi.stubGlobal('webkitSpeechRecognition', FakeRecognition);
    const user = userEvent.setup();
    renderStep(ExplainBackStep, explainStep);
    await user.type(screen.getByRole('textbox'), TEXT);
    await user.click(screen.getByRole('button', { name: 'Say it out loud' }));
    await user.click(screen.getByRole('button', { name: 'Compare' }));
    expect(FakeRecognition.last!.started).toBe(false);
    expect(screen.queryByRole('button', { name: 'Say it out loud' })).not.toBeInTheDocument();
  });
});

describe('ExplainBackStep, Scout pushes back', () => {
  beforeEach(() => {
    pathname = '/learn/javascript/values-types-coercion';
    takeQueuedQuestion();
  });
  afterEach(() => act(() => setTutorOpen(false, { remember: false })));

  it('offers the push-back only after Compare, and sends nothing before the click', async () => {
    const user = userEvent.setup();
    renderStep(ExplainBackStep, explainStep);
    expect(screen.queryByRole('button', { name: /push back/ })).not.toBeInTheDocument();
    await user.type(screen.getByRole('textbox'), TEXT);
    await user.click(screen.getByRole('button', { name: 'Compare' }));
    expect(takeQueuedQuestion()).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Ask Scout to push back' }));
    const question = takeQueuedQuestion();
    expect(question).toContain(TEXT);
    expect(question).toContain('Explain it to a teammate');
    expect(question).toContain(explainStep.modelAnswer.md);
    for (const point of explainStep.rubric) expect(question).toContain(point);
    expect(question).toMatch(/exactly one follow-up question/);
  });

  it('is not offered while a test withholds Scout, or on an exam route', async () => {
    const user = userEvent.setup();
    let release = () => {};
    act(() => {
      release = withholdTutor();
    });
    const { unmount } = renderStep(ExplainBackStep, explainStep);
    await user.type(screen.getByRole('textbox'), TEXT);
    await user.click(screen.getByRole('button', { name: 'Compare' }));
    expect(screen.queryByRole('button', { name: /push back/ })).not.toBeInTheDocument();
    act(() => release());
    unmount();

    pathname = '/practise/exam/javascript';
    renderStep(ExplainBackStep, explainStep);
    await user.type(screen.getByRole('textbox'), TEXT);
    await user.click(screen.getByRole('button', { name: 'Compare' }));
    expect(screen.queryByRole('button', { name: /push back/ })).not.toBeInTheDocument();
  });
});
