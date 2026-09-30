import type { ExamStage } from '@/core/exam';
import type { PathSummary } from '@/lib/content';

/** The path's stages as the exam builder reads them: required lessons only, in order. */
export function examStages(path: Pick<PathSummary, 'stages'>): ExamStage[] {
  return path.stages.map((stage) => ({
    title: stage.title,
    lessonIds: stage.lessons.map((lesson) => lesson.id),
  }));
}

/** Where a path's exam and certificate live. */
export const examHref = (pathId: string) => `/practise/exam/${pathId}`;
export const certificateHref = (pathId: string) => `/paths/${pathId}/certificate`;

const DATE = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});

/** A learner's local date (YYYY-MM-DD) in words, the same in every time zone. */
export function formatLocalDate(localDate: string): string {
  return DATE.format(new Date(`${localDate}T12:00:00Z`));
}

export const percent = (right: number, total: number) =>
  total > 0 ? Math.round((right / total) * 100) : 0;
