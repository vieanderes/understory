import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SteppedFigure } from '@/features/lesson-player/figures/kit/SteppedFigure';
import { phaseAt } from '@/features/lesson-player/figures/kit/svg';
import { clampStep, PLAY_INTERVAL_MS } from '@/features/lesson-player/figures/kit/useStepper';

const STEPS = [
  { text: 'First, the question.', focus: [1] },
  { text: 'Then the search.', focus: [2] },
  { text: 'Last, the answer.', focus: [1, 2] },
];

const KEY = [
  { n: 1, title: 'Question', body: 'What was asked.' },
  { n: 2, title: 'Search', body: 'What was found.' },
];

function renderFigure() {
  return render(
    <SteppedFigure
      title="A test drawing"
      width={320}
      height={120}
      keyItems={KEY}
      steps={STEPS}
      draw={(step) => <text data-testid="drawn">{`step ${step}`}</text>}
    />,
  );
}

const step = () => screen.getByText(/^Step \d of \d\./).parentElement!;

afterEach(() => vi.useRealTimers());

describe('phaseAt', () => {
  it('is future before, now during, past after', () => {
    expect(phaseAt(0, 1)).toBe('future');
    expect(phaseAt(1, 1)).toBe('now');
    expect(phaseAt(2, 1, 2)).toBe('now');
    expect(phaseAt(3, 1, 2)).toBe('past');
  });

  it('can be hidden before it enters and after it is gone', () => {
    expect(phaseAt(0, 1, 1, { before: 'hidden' })).toBe('hidden');
    expect(phaseAt(4, 1, 1, { gone: 4 })).toBe('hidden');
  });
});

describe('clampStep', () => {
  it('keeps an index inside the figure', () => {
    expect(clampStep(-1, 3)).toBe(0);
    expect(clampStep(5, 3)).toBe(2);
    expect(clampStep(1, 3)).toBe(1);
    expect(clampStep(0, 0)).toBe(0);
  });
});

describe('SteppedFigure', () => {
  it('names the drawing and describes the current step in words', () => {
    renderFigure();
    const drawing = screen.getByRole('img', { name: 'A test drawing' });
    expect(drawing).toHaveAccessibleDescription('Step 1 of 3. First, the question.');
    expect(step()).toHaveAttribute('aria-live', 'polite');
  });

  it('steps forward and back with the buttons, and stays put at either end', () => {
    renderFigure();
    const back = screen.getByRole('button', { name: 'Back' });
    const next = screen.getByRole('button', { name: 'Next' });
    expect(back).toHaveAttribute('aria-disabled', 'true');

    fireEvent.click(back);
    expect(step()).toHaveTextContent('First, the question.');

    fireEvent.click(next);
    expect(step()).toHaveTextContent('Step 2 of 3. Then the search.');
    expect(screen.getByTestId('drawn')).toHaveTextContent('step 1');

    fireEvent.click(next);
    fireEvent.click(next);
    expect(step()).toHaveTextContent('Last, the answer.');
    expect(next).toHaveAttribute('aria-disabled', 'true');
    // Still focusable at the end, so a keyboard user never loses their place.
    expect(next).not.toBeDisabled();

    fireEvent.click(back);
    expect(step()).toHaveTextContent('Then the search.');
  });

  it('steps with the arrow keys, Home and End', () => {
    renderFigure();
    const group = screen.getByRole('group', { name: 'Step through the figure' });
    fireEvent.keyDown(group, { key: 'ArrowRight' });
    expect(step()).toHaveTextContent('Then the search.');
    fireEvent.keyDown(group, { key: 'End' });
    expect(step()).toHaveTextContent('Last, the answer.');
    fireEvent.keyDown(group, { key: 'ArrowLeft' });
    expect(step()).toHaveTextContent('Then the search.');
    fireEvent.keyDown(group, { key: 'Home' });
    expect(step()).toHaveTextContent('First, the question.');
  });

  it('marks the key lines the step is about', () => {
    renderFigure();
    const items = within(screen.getByRole('list')).getAllByRole('listitem');
    expect(items[0]).toHaveAttribute('aria-current', 'step');
    expect(items[1]).not.toHaveAttribute('aria-current');
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(items[0]).not.toHaveAttribute('aria-current');
    expect(items[1]).toHaveAttribute('aria-current', 'step');
  });

  it('plays once to the end, then offers a replay from the start', () => {
    vi.useFakeTimers();
    renderFigure();
    fireEvent.click(screen.getByRole('button', { name: 'Play' }));
    expect(screen.getByRole('button', { name: 'Pause' })).toBeInTheDocument();

    act(() => vi.advanceTimersByTime(PLAY_INTERVAL_MS));
    expect(step()).toHaveTextContent('Then the search.');
    act(() => vi.advanceTimersByTime(PLAY_INTERVAL_MS));
    expect(step()).toHaveTextContent('Last, the answer.');
    act(() => vi.advanceTimersByTime(PLAY_INTERVAL_MS * 3));
    expect(step()).toHaveTextContent('Last, the answer.');

    fireEvent.click(screen.getByRole('button', { name: 'Replay' }));
    expect(step()).toHaveTextContent('First, the question.');
    expect(screen.getByRole('button', { name: 'Pause' })).toBeInTheDocument();
  });

  it('stops playing when the learner steps by hand', () => {
    vi.useFakeTimers();
    renderFigure();
    fireEvent.click(screen.getByRole('button', { name: 'Play' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    act(() => vi.advanceTimersByTime(PLAY_INTERVAL_MS * 2));
    expect(step()).toHaveTextContent('Then the search.');
    expect(screen.getByRole('button', { name: 'Play' })).toBeInTheDocument();
  });

  it('draws a single-step figure without controls, still described in words', () => {
    render(
      <SteppedFigure
        title="Still"
        width={100}
        height={100}
        keyItems={[]}
        steps={[{ text: 'Only one state.' }]}
        draw={() => null}
      />,
    );
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.getByRole('img', { name: 'Still' })).toHaveAccessibleDescription(
      'Only one state.',
    );
  });
});
