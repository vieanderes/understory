import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { EventLoopQueues } from '@/features/lesson-player/figures/EventLoopQueues';
import { LessonFigure } from '@/features/lesson-player/figures/LessonFigure';
import { RequestHops } from '@/features/lesson-player/figures/RequestHops';

describe('lesson figures', () => {
  it('draws the finished request timeline from the lab engine', () => {
    render(<RequestHops scenario="first-visit" />);
    const timeline = screen.getByRole('region', { name: 'Timeline' });
    expect(within(timeline).getAllByText(/ms/).length).toBeGreaterThan(1);
  });

  it('draws the microtask and the timer callback both waiting', () => {
    render(<EventLoopQueues />);
    expect(screen.getByText('Microtask queue')).toBeInTheDocument();
    expect(screen.getByText('confirmSeat')).toBeInTheDocument();
    expect(screen.getByText('expireHold')).toBeInTheDocument();
  });

  it('loads the drawing on demand and always shows the caption', async () => {
    render(<LessonFigure id="event-loop-queues" caption="The microtask goes first." />);
    expect(screen.getByText('The microtask goes first.')).toBeInTheDocument();
    expect(await screen.findByText('Task queue')).toBeInTheDocument();
  });
});
