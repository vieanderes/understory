import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { Rich } from '@/core/content/compiled';
import type { LessonLecture } from '@/core/lecture';
import { LessonLectureView, lectureOutline } from '@/features/lecture/LessonLectureView';

const r = (md: string): Rich => ({ md, html: md });

const lecture = {
  id: 'js.cache',
  moduleId: 'js',
  moduleSlug: 'javascript',
  slug: 'cache',
  title: 'Caching',
  objective: 'Keep a copy close by.',
  level: 'essential',
  lessonMinutes: 8,
  readingMinutes: 4,
  assessment: false,
  opening: 'A cache keeps a copy. It saves a trip.',
  remember: [],
  blocks: [],
  deeper: [],
  pitfalls: [r('A stale read.')],
  verify: [
    { lens: 'breaks', label: 'What breaks', checks: [r('A cold start floods the database.')] },
    { lens: 'tests', label: 'How to test it', checks: [r('Expire a key and read it again.')] },
  ],
  interview: [{ question: r('Why cache?'), answer: r('To save a trip.') }],
  terms: [],
  flashcards: [],
  references: [],
  hasNotes: true,
} as LessonLecture;

describe('LessonLectureView, before you ship', () => {
  it('prints the checks by lens between the mistakes and the interview questions', () => {
    render(<LessonLectureView lecture={lecture} level={1} showLessonLink={false} />);
    const headings = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent);
    const at = (title: string) => headings.indexOf(title);
    expect(at('Before you ship')).toBeGreaterThan(at('Common mistakes'));
    expect(at('Before you ship')).toBeLessThan(at('Interview questions'));
    const section = screen.getByRole('region', { name: 'Before you ship' });
    expect(within(section).getByText('What breaks')).toBeInTheDocument();
    expect(within(section).getByText('Expire a key and read it again.')).toBeInTheDocument();
  });

  it('lists the section in the outline, and leaves it out when there are no checks', () => {
    expect(lectureOutline(lecture).map((item) => item.label)).toContain('Before you ship');
    expect(lectureOutline({ ...lecture, verify: [] }).map((item) => item.label)).not.toContain(
      'Before you ship',
    );
  });
});
