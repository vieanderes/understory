import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { HintLadder, type SolutionState } from '@/features/lesson-player/parts/HintLadder';

const HINTS = ['First nudge', 'Second nudge', 'Third nudge'].map((text) => ({
  md: text,
  html: `<p>${text}</p>`,
}));

function Harness({
  onShowSolution,
  solution = 'hidden',
}: {
  onShowSolution?: () => void;
  solution?: SolutionState;
}) {
  const [shown, setShown] = useState(0);
  return (
    <HintLadder
      hints={HINTS}
      shown={shown}
      onShowHint={() => setShown((n) => n + 1)}
      onShowSolution={onShowSolution}
      solution={solution}
    />
  );
}

async function takeAllHints() {
  for (const n of [1, 2, 3])
    await userEvent.click(screen.getByRole('button', { name: `Hint ${n} of 3` }));
}

describe('HintLadder', () => {
  it('starts with no hint showing and says what a hint costs', () => {
    render(<Harness onShowSolution={vi.fn()} />);
    expect(screen.queryAllByTestId('hint')).toHaveLength(0);
    expect(screen.getByText('Each hint lowers the score for this step')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Show solution' })).not.toBeInTheDocument();
  });

  it('reveals one rung per press, in order, and moves focus to the new hint', async () => {
    render(<Harness onShowSolution={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: 'Hint 1 of 3' }));
    expect(screen.getAllByTestId('hint').map((li) => li.textContent)).toEqual(['1First nudge']);
    expect(screen.getByTestId('hint')).toHaveFocus();

    await userEvent.click(screen.getByRole('button', { name: 'Hint 2 of 3' }));
    await userEvent.click(screen.getByRole('button', { name: 'Hint 3 of 3' }));
    expect(screen.getAllByTestId('hint').map((li) => li.textContent)).toEqual([
      '1First nudge',
      '2Second nudge',
      '3Third nudge',
    ]);
    expect(screen.queryByRole('button', { name: /^Hint/ })).not.toBeInTheDocument();
  });

  it('offers the solution only after the last hint, and asks once before showing it', async () => {
    const onShowSolution = vi.fn();
    render(<Harness onShowSolution={onShowSolution} />);
    await takeAllHints();

    await userEvent.click(screen.getByRole('button', { name: 'Show solution' }));
    expect(screen.getByText('Show the solution? This step then scores 0.')).toBeInTheDocument();
    expect(onShowSolution).not.toHaveBeenCalled();
    // The safe answer has focus.
    expect(screen.getByRole('button', { name: 'Keep trying' })).toHaveFocus();

    await userEvent.click(screen.getByRole('button', { name: 'Keep trying' }));
    expect(onShowSolution).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Show solution' })).toHaveFocus();

    await userEvent.click(screen.getByRole('button', { name: 'Show solution' }));
    await userEvent.click(screen.getByRole('button', { name: 'Show' }));
    expect(onShowSolution).toHaveBeenCalledTimes(1);
  });

  it('does not offer a solution the lesson does not ship', async () => {
    render(<Harness />);
    await takeAllHints();
    expect(screen.queryByRole('button', { name: 'Show solution' })).not.toBeInTheDocument();
  });

  it('says so when the solution is showing, and stops offering it', async () => {
    render(<Harness onShowSolution={vi.fn()} solution="shown" />);
    await takeAllHints();
    expect(screen.getByText('Solution shown. This step scores 0.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Show solution' })).not.toBeInTheDocument();
  });

  it('reports a failed download and lets the learner try again', async () => {
    render(<Harness onShowSolution={vi.fn()} solution="failed" />);
    await takeAllHints();
    expect(screen.getByRole('alert')).toHaveTextContent('The solution did not load. Try again.');
    expect(screen.getByRole('button', { name: 'Show solution' })).toBeEnabled();
  });
});
