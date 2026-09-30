import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Feedback } from '@/features/lesson-player/parts/Feedback';
import { StepTicks } from '@/features/lesson-player/parts/StepTicks';

describe('Feedback', () => {
  it('marks a right answer with a short moment', () => {
    render(<Feedback verdict="right">Because it is.</Feedback>);
    const status = screen.getByRole('status');
    expect(status).toHaveTextContent('Right');
    expect(status).toHaveAttribute('data-verdict', 'right');
    expect(status.querySelector('.verdict-draw')).not.toBeNull();
  });

  it('treats a wrong answer as a gap to fill, not a failure', () => {
    render(<Feedback verdict="wrong">Here is the idea.</Feedback>);
    const status = screen.getByRole('status');
    expect(status).toHaveTextContent('Not quite');
    expect(status.querySelector('.text-danger')).toBeNull();
    expect(status.querySelector('.text-accent')).not.toBeNull();
    expect(status.querySelector('.verdict-idea')).not.toBeNull();
  });
});

describe('StepTicks', () => {
  it('fills a right tick and marks a wrong one as a gap', () => {
    const { container } = render(
      <StepTicks ticks={['right', 'wrong', 'todo']} label="Step 3 of 3" />,
    );
    const ticks = container.querySelectorAll('span');
    expect(ticks[0]).toHaveClass('tick-fill');
    expect(ticks[1]).toHaveClass('bg-accent');
  });
});
