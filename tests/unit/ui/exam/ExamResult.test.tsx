import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { ExamItem } from '@/core/exam';
import { ExamResult } from '@/features/exam/ExamResult';
import { PATH } from './fixtures';

const item = (lessonId: string, stage: number, n: number): ExamItem => ({
  source: 'interleave',
  cardKey: `skill:${lessonId}#s${n}`,
  concept: lessonId,
  lessonId,
  stage,
});

const ITEMS = [
  item('c.one', 0, 1),
  item('c.three', 1, 1),
  item('c.two', 0, 2),
  item('c.three', 1, 2),
];

describe('ExamResult', () => {
  it('names a weak stage and links the lessons behind its misses', () => {
    render(
      <ExamResult
        path={PATH}
        items={ITEMS}
        outcomes={[false, true, true, true]}
        right={3}
        total={4}
        passed={false}
        onRetake={vi.fn()}
      />,
    );
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Not yet.');
    const stages = screen.getByRole('heading', { name: 'By stage' }).parentElement!;
    expect(within(stages).getByText('1/2 · Weak')).toBeInTheDocument();
    expect(within(stages).getByText('2/2')).toBeInTheDocument();
    expect(within(stages).getByRole('link', { name: 'Arrays' })).toHaveAttribute(
      'href',
      '/learn/c/one?path=coding-rounds',
    );
    expect(screen.getByRole('link', { name: 'Back to the path' })).toHaveAttribute(
      'href',
      '/paths/coding-rounds',
    );
  });

  it('offers the certificate on a pass, and a retake either way', async () => {
    const onRetake = vi.fn();
    render(
      <ExamResult
        path={PATH}
        items={ITEMS}
        outcomes={[true, true, true, null]}
        right={3}
        total={3}
        passed
        onRetake={onRetake}
      />,
    );
    expect(screen.getByRole('link', { name: 'See the certificate' })).toHaveAttribute(
      'href',
      '/paths/coding-rounds/certificate',
    );
    expect(screen.getByText('Every stage at 80% or more.')).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Sit it again' }));
    expect(onRetake).toHaveBeenCalledOnce();
  });
});
