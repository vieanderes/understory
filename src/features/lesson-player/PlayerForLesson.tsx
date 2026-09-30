'use client';

import dynamic from 'next/dynamic';
import type { ComponentProps } from 'react';
import { LessonPlayer } from './LessonPlayer';

// Only four lessons are timed assessments, so the rest never download their player. The
// split must happen in a client component: a server page does not code-split a client
// import (node_modules/next/dist/docs/01-app/02-guides/lazy-loading.md).
const AssessmentPlayer = dynamic(() =>
  import('@/features/assessment/AssessmentPlayer').then((m) => m.AssessmentPlayer),
);

type Props = ComponentProps<typeof LessonPlayer>;

/** The lesson player, or the assessment player when the lesson is a timed test. */
export function PlayerForLesson(props: Props) {
  if (props.lesson.assessment === true) {
    // A timed test ends on its own report, not on the next lesson of a path.
    const { lesson, moduleTitle, exitHref, solutionsUrl, next } = props;
    return <AssessmentPlayer {...{ lesson, moduleTitle, exitHref, solutionsUrl, next }} />;
  }
  return <LessonPlayer {...props} />;
}
