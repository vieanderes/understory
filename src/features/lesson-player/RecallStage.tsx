'use client';

import { useState } from 'react';
import type { CompiledLesson } from '@/core/content/compiled';
import { RecallCardView } from './RecallCardView';

/**
 * The lesson ends by pulling its ideas back out of memory. That first retrieval starts
 * each card's schedule; practice brings it back when it is about to fade.
 */
export function RecallStage({ lesson, onDone }: { lesson: CompiledLesson; onDone: () => void }) {
  const [index, setIndex] = useState(0);
  const card = lesson.recall[index];
  if (!card) return null;

  return (
    <RecallCardView
      key={card.id}
      lessonId={lesson.id}
      card={card}
      label={
        <>
          Recall · <span className="t-figure">{index + 1}</span> of{' '}
          <span className="t-figure">{lesson.recall.length}</span>
        </>
      }
      onRated={() => (index + 1 < lesson.recall.length ? setIndex(index + 1) : onDone())}
    />
  );
}
