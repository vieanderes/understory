'use client';

import { X } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import {
  AREA_LEVELS,
  answerPlacement,
  currentPlacementItem,
  defaultRatings,
  placementOutcome,
  placementProgress,
  startPlacement,
  undoPlacement,
  type AreaRating,
  type PlacementSession,
  type StartedAs,
} from '@/core/placement';
import type { Confidence } from '@/core/progress';
import { requestPersistence } from '@/features/store/client';
import { useProgress, useStore } from '@/features/store/StoreProvider';
import { withholdTutor } from '@/features/tutor/tutor-store';
import { AreaIntro, Intro } from './Intro';
import { PlacementItem } from './PlacementItem';
import { Results } from './Results';
import type { PlacementData } from './types';

/** The check of one area asks two right answers per level, so a lucky pick counts less. */
const ITEMS_TO_PASS_ONE_AREA = 2;

/**
 * Placement (LEARNING-SCIENCE.md B1). The full check asks where the learner comes from and
 * how they rate each area, then searches each area on its own. `area` runs the deeper check
 * of that one area. Nothing is marked right or wrong until the end.
 */
export function PlacementRunner({ data, area }: { data: PlacementData; area?: string }) {
  const store = useStore();
  const { status, state } = useProgress();
  const areaIds = data.areas.map((a) => a.id);
  const only = area ? data.areas.find((a) => a.id === area) : undefined;

  const [startedAs, setStartedAs] = useState<StartedAs | null>(null);
  const [ratings, setRatings] = useState<Record<string, AreaRating>>({});
  const [session, setSession] = useState<PlacementSession | null>(null);

  // Placement measures where the learner starts, so the study assistant stays away and
  // never sits on the Next button. Undone on unmount.
  useEffect(() => withholdTutor(), []);

  const current = session ? currentPlacementItem(session, data.areas) : null;
  const finished = session !== null && current === null;
  const currentArea = current ? data.areas.find((a) => a.id === current.areaId) : undefined;
  const item = current
    ? currentArea?.levels
        .find((l) => l.level === current.level)
        ?.items.find((i) => i.id === current.id)
    : undefined;
  const progress = session ? placementProgress(session, data.areas) : null;

  const outcome = finished && session ? placementOutcome(session, data.areas) : null;
  const recorded = useRef(false);
  useEffect(() => {
    if (!outcome || !session || recorded.current) return;
    recorded.current = true;
    void store.record('placement_completed', {
      scope: session.scope,
      ...(session.startedAs ? { startedAs: session.startedAs } : {}),
      levelByArea: { ...outcome.levelByArea },
      thetaByModule: { ...outcome.thetaByModule },
      assumedConcepts: [...outcome.assumedConcepts],
      unassumedConcepts: [...outcome.unassumedConcepts],
    });
    void requestPersistence();
  }, [outcome, session, store]);

  function chooseStart(value: StartedAs) {
    setStartedAs(value);
    setRatings(defaultRatings(value, areaIds));
  }

  function begin() {
    if (only) {
      setSession(
        startPlacement({
          ratings: { [only.id]: 'some' },
          scope: only.id,
          itemsToPass: ITEMS_TO_PASS_ONE_AREA,
          attempt: state.placementsCompleted,
        }),
      );
      return;
    }
    if (!startedAs) return;
    setSession(startPlacement({ ratings, startedAs, attempt: state.placementsCompleted }));
  }

  function answer(correct: boolean, confidence: Confidence) {
    if (!session || !current) return;
    void store.record('placement_answered', {
      itemId: current.id,
      moduleId: current.moduleId,
      areaId: current.areaId,
      level: current.level,
      correct,
      confidence,
    });
    setSession(answerPlacement(session, data.areas, { itemId: current.id, correct, confidence }));
  }

  // Back takes the last answer back, or from the first question returns to the start.
  function back() {
    if (!session) return;
    setSession(session.answers.length === 0 ? null : undoPlacement(session));
  }

  const where =
    currentArea && progress
      ? only
        ? currentArea.title
        : `${currentArea.title} · area ${progress.areaIndex + 1} of ${progress.areaCount}`
      : '';

  return (
    <div className="bg-bg text-fg flex min-h-dvh flex-col">
      <header className="rule-b bg-bg sticky top-0 z-20">
        <div className="frame flex h-8 items-center gap-2">
          <Link
            href="/"
            aria-label="Leave placement"
            title="Leave placement"
            className="text-muted hover:text-fg hover:bg-raised rounded-control -ml-1 inline-flex size-5 shrink-0 items-center justify-center transition-colors duration-150 ease-out"
          >
            <X aria-hidden size={20} strokeWidth={2} />
          </Link>
          <p className="t-label flex-1">Find your level</p>
          <p className="t-label t-figure shrink-0 text-right">
            {session && !finished && progress ? `${progress.asked + 1} / ${progress.maxItems}` : ''}
          </p>
        </div>
      </header>

      <main id="content" className="frame flex-1 pt-4 pb-4">
        {!session ? (
          only ? (
            <AreaIntro
              title={only.title}
              questions={AREA_LEVELS * ITEMS_TO_PASS_ONE_AREA}
              onBegin={begin}
              ready={status === 'ready'}
            />
          ) : (
            <Intro
              areas={data.areas}
              startedAs={startedAs}
              ratings={ratings}
              onStartedAs={chooseStart}
              onRate={(id, rating) => setRatings((r) => ({ ...r, [id]: rating }))}
              onBegin={begin}
              ready={status === 'ready'}
            />
          )
        ) : outcome ? (
          <Results session={session} outcome={outcome} data={data} />
        ) : item ? (
          <PlacementItem key={item.id} item={item} where={where} onAnswer={answer} onBack={back} />
        ) : (
          <p className="t-label">Loading</p>
        )}
      </main>
    </div>
  );
}
