import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { certificateCode } from '@/core/exam';
import type { PathExamAttempt } from '@/core/progress';
import { PATH } from './fixtures';

let attempts: PathExamAttempt[] = [];
vi.mock('@/features/store/StoreProvider', () => ({
  useProgress: () => ({ status: 'ready', state: { pathExams: { 'coding-rounds': attempts } } }),
}));

const { CertificateView } = await import('@/features/exam/CertificateView');

const sitting = (right: number, localDate: string): PathExamAttempt => ({
  seed: 1,
  right,
  total: 28,
  startedAt: `${localDate}T09:40:00.000Z`,
  finishedAt: `${localDate}T10:00:00.000Z`,
  lessonIds: PATH.lessonIds,
  localDate,
});

beforeEach(() => {
  attempts = [];
  window.localStorage.clear();
});

describe('CertificateView', () => {
  it('says what earns the certificate before a pass, and links to the exam', () => {
    attempts = [sitting(14, '2026-09-20')];
    render(<CertificateView path={PATH} />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'Pass the final exam to earn the certificate.',
    );
    expect(screen.getByText(/Best so far 50%/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Sit the final exam' })).toHaveAttribute(
      'href',
      '/practise/exam/coding-rounds',
    );
  });

  it('issues from the first pass: date, score, outcomes, code and the honest line', () => {
    attempts = [sitting(10, '2026-09-20'), sitting(24, '2026-09-22'), sitting(28, '2026-09-25')];
    render(<CertificateView path={PATH} />);
    const sheet = screen.getByRole('article', {
      name: 'Certificate of completion for Coding rounds',
    });
    expect(sheet).toHaveTextContent('22 September 2026');
    expect(sheet).toHaveTextContent('86% · 24 of 28');
    expect(sheet).toHaveTextContent('Ten problems, solved and explained');
    expect(sheet).toHaveTextContent('Solve array problems in linear time');
    const code = certificateCode({
      pathId: 'coding-rounds',
      passedOn: '2026-09-22',
      right: 24,
      total: 28,
      lessonIds: PATH.lessonIds,
    });
    expect(sheet).toHaveTextContent(code);
    expect(sheet).toHaveTextContent(
      'Certificate of completion from Understory. It is not an accredited qualification.',
    );
  });

  it('keeps the name on this device and prints on Download PDF', async () => {
    attempts = [sitting(24, '2026-09-22')];
    const print = vi.spyOn(window, 'print').mockImplementation(() => {});
    const user = userEvent.setup();
    render(<CertificateView path={PATH} />);
    expect(screen.getByText('Your name')).toBeInTheDocument();
    await user.type(screen.getByRole('textbox', { name: 'Name on the certificate' }), 'Ada Byron');
    expect(screen.getByRole('article')).toHaveTextContent('Ada Byron');
    expect(window.localStorage.getItem('understory.certificate-name')).toBe('Ada Byron');
    await user.click(screen.getByRole('button', { name: 'Download PDF' }));
    expect(print).toHaveBeenCalledOnce();
  });
});
