'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense, useMemo } from 'react';
import type { SessionMinutes } from '@/core/practice';
import { SessionRunner } from './SessionRunner';
import { parseChapters, parseTopics } from './topics';

function Session({ minutes }: { minutes: SessionMinutes }) {
  const query = useSearchParams();
  const raw = query.get('topics');
  const rawChapters = query.get('chapters');
  const topics = useMemo(() => parseTopics(raw), [raw]);
  const chapters = useMemo(() => parseChapters(rawChapters), [rawChapters]);
  return <SessionRunner session={{ kind: 'practice', minutes, topics, chapters }} />;
}

/** The query is read on the client, so every length is still prerendered. */
export function PracticeSessionRoute({ minutes }: { minutes: SessionMinutes }) {
  return (
    <Suspense fallback={null}>
      <Session minutes={minutes} />
    </Suspense>
  );
}
