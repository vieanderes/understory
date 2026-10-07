'use client';

import { X } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import {
  answerPlacement,
  currentPlacementItem,
  placementOutcome,
  placementProgress,
  plannedModules,
  startPlacement,
  undoPlacement,
  type PlacementMode,
  type PlacementSession,
} from '@/core/placement';
import type { Confidence } from '@/core/progress';
import { requestPersistence } from '@/features/store/client';
import { useProgress, useStore } from '@/features/store/StoreProvider';
import { withholdTutor } from '@/features/tutor/tutor-store';
import { AreaIntro, Intro, typicalQuestions } from './Intro';
import { PlacementItem } from './PlacementItem';
import { Results } from './Results';
import type { PlacementData } from './types';

/**
 * Placement (LEARNING-SCIENCE.md B1). The learner picks the parts to check and how long to
 * spend; the session asks the same fixed questions of everyone, module by module, the
 * parts taking turns. `area` runs the thorough check of that one part.
 */
export function PlacementRunner({ data, area }: { data: PlacementData; area?: string }) {
  const store = useStore();
  const { status } = useProgress();
  const only = area ? data.areas.find((a) => a.id === area) : undefined;

  const [session, setSession] = useState<PlacementSession | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const [mode, setMode] = useState<PlacementMode>('balanced');

  // Placement measures where the learner starts, so the study assistant stays away and
  // never sits on the Next button. Undone on unmount.
  useEffect(() => withholdTutor(), []);

  const current = session ? currentPlacementItem(session, data.areas) : null;
  const finished = session !== null && current === null;
  const currentModule = current
    ? data.areas
        .find((a) => a.id === current.areaId)
        ?.modules.find((m) => m.id === current.moduleId)
    : undefined;
  const item = current
    ? [...(currentModule?.core ?? []), ...(currentModule?.deep ?? [])].find(
        (i) => i.id === current.id,
      )
    : undefined;
  const progress = session ? placementProgress(session, data.areas) : null;

  const outcome = finished && session ? placementOutcome(session, data.areas) : null;
  const recorded = useRef(false);
  useEffect(() => {
    if (!outcome || !session || recorded.current) return;
    recorded.current = true;
    void store.record('placement_completed', {
      scope: session.scope,
      levelByArea: { ...outcome.levelByArea },
      thetaByModule: { ...outcome.thetaByModule },
      assumedConcepts: [...outcome.assumedConcepts],
      unassumedConcepts: [...outcome.unassumedConcepts],
    });
    void requestPersistence();
  }, [outcome, session, store]);

  /** How many modules a mode asks over the parts picked so far. */
  const modulesFor = (value: PlacementMode, areas: readonly string[] = picked) =>
    plannedModules(startPlacement({ areas, mode: value }), data.areas).length;

  function begin() {
    if (only) {
      setSession(startPlacement({ areas: [only.id], mode: 'thorough', scope: only.id }));
      return;
    }
    if (picked.length > 0) setSession(startPlacement({ areas: picked, mode }));
  }

  function answer(correct: boolean, confidence: Confidence) {
    if (!session || !current) return;
    void store.record('placement_answered', {
      itemId: current.id,
      moduleId: current.moduleId,
      areaId: current.areaId,
      // Core questions stand at Working, deep ones at Advanced.
      level: current.role === 'core' ? 2 : 3,
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

  const asking = session !== null && !finished && progress !== null;
  // Progress by modules done: how many questions a module takes depends on the answers,
  // how many modules there are does not. Modules are asked in plan order.
  const planned = session ? plannedModules(session, data.areas) : [];
  const done = current ? planned.findIndex((p) => p.moduleId === current.moduleId) : planned.length;
  const share = planned.length === 0 ? 0 : done / planned.length;

  return (
    <div className="bg-bg text-fg flex min-h-dvh flex-col">
      <header className="bg-bg sticky top-0 z-20">
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
            {asking ? `Question ${progress.asked + 1}` : ''}
          </p>
        </div>
        {/* How far along, by modules done: drawn rather than counted. */}
        <div
          role="progressbar"
          aria-label="Modules done"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(share * 100)}
          className="bg-border h-0.5 w-full overflow-hidden"
        >
          <div
            className="bg-fg h-full w-full origin-left transition-transform duration-200 ease-out motion-reduce:transition-none"
            style={{ transform: `scaleX(${share})` }}
          />
        </div>
      </header>

      <main id="content" className="frame flex-1 pt-4 pb-4">
        {!session ? (
          only ? (
            <AreaIntro
              title={only.title}
              questions={typicalQuestions(modulesFor('thorough', [only.id]), 'thorough')}
              onBegin={begin}
              ready={status === 'ready'}
            />
          ) : (
            <Intro
              areas={data.areas}
              picked={picked}
              mode={mode}
              onToggle={(id) =>
                setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]))
              }
              onAll={(all) => setPicked(all ? data.areas.map((a) => a.id) : [])}
              onMode={setMode}
              onStart={begin}
              modulesFor={(value) => modulesFor(value)}
              ready={status === 'ready'}
            />
          )
        ) : outcome ? (
          <Results session={session} outcome={outcome} data={data} />
        ) : item ? (
          <PlacementItem
            key={item.id}
            item={item}
            followUp={current?.role === 'deep'}
            {...(only ? { area: only.title } : {})}
            onAnswer={answer}
            onBack={back}
          />
        ) : (
          <p className="t-label">Loading</p>
        )}
      </main>
    </div>
  );
}
