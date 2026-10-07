'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button, buttonClass } from '@/components/ui/Button';
import { Figure } from '@/components/ui/Figure';
import type { CompiledPlacementItem } from '@/core/content/placement-schema';
import {
  focusArea,
  overallLevel,
  placementKnows,
  recommendPath,
  type OverallStage,
  type PlacementOutcome,
  type PlacementSession,
  type Recommendation,
} from '@/core/placement';
import { cleanPathName } from '@/core/planner/name';
import { RichText } from '@/features/lesson-player/parts/RichText';
import { Title } from '@/features/motion/Title';
import { CHOSEN_PATH, chosenPathIds } from '@/features/paths/current';
import { newOwnPathId } from '@/features/paths/custom';
import { onPath } from '@/features/paths/links';
import { useProgress, useStore } from '@/features/store/StoreProvider';
import { ScoutMark } from '@/features/tutor/ScoutMark';
import { startPlanning } from '@/features/tutor/planner/planner-store';
import { cn } from '@/lib/cn';
import { levelName, type PlacementData } from './types';

const STAGE: Readonly<Record<OverallStage, string>> = {
  starting: 'Starting out',
  building: 'Building',
  working: 'Working',
  strong: 'Strong',
};

/**
 * The end of placement: one lesson to start, on a path that fits, then the overall level
 * and a level per area, each with a deeper check of its own.
 */
export function Results({
  session,
  outcome,
  data,
}: {
  session: PlacementSession;
  outcome: PlacementOutcome;
  data: PlacementData;
}) {
  const { state } = useProgress();
  const store = useStore();
  const router = useRouter();
  const [leaving, setLeaving] = useState(false);

  const areaIds = data.areas.map((a) => a.id);
  // A check of one area keeps every other area's last result.
  const levels: Record<string, number> = {
    ...Object.fromEntries(Object.entries(state.placementByArea).map(([id, p]) => [id, p.level])),
    ...outcome.levelByArea,
  };
  const overall = overallLevel(levels, areaIds);

  // The event may not have reached the state yet, so this result counts first.
  const assumed = new Set(outcome.assumedConcepts);
  const unassumed = new Set(outcome.unassumedConcepts);
  const knownBefore = placementKnows(state);
  const isKnown = (c: string) => assumed.has(c) || (!unassumed.has(c) && knownBefore(c));
  const isDone = (id: string) => state.completedLessons.has(id);

  const focusId =
    session.scope === 'all' ? focusArea(areaIds, levels, session.ratings) : session.scope;
  const focus = data.areas.find((a) => a.id === focusId);
  const rec = focus
    ? recommendPath({
        focus,
        level: levels[focus.id] ?? 0,
        rules: data.rules,
        paths: data.paths,
        lessons: data.lessons,
        moduleTitles: data.moduleTitles,
        isDone,
        isKnown,
      })
    : undefined;
  const lesson = rec?.firstLessonId
    ? data.lessons.find((l) => l.id === rec.firstLessonId)
    : undefined;
  const path = rec?.pathId ? data.paths.find((p) => p.id === rec.pathId) : undefined;

  /** Starting puts the path first on Learn, so Home and Learn carry on from here. */
  async function start() {
    if (!rec || !lesson || leaving) return;
    setLeaving(true);
    let pathId = rec.pathId;
    if (!pathId) {
      pathId = newOwnPathId();
      await store.record('custom_path_set', {
        pathId,
        name: cleanPathName(rec.draft.name),
        lessonIds: rec.draft.stages.flatMap((s) => s.lessonIds),
        stages: rec.draft.stages,
        summary: rec.draft.summary,
        origin: 'builder',
      });
    }
    const others = chosenPathIds(state.settings[CHOSEN_PATH]).filter((id) => id !== pathId);
    await store.record('setting_changed', {
      key: CHOSEN_PATH,
      value: [pathId, ...others].join(','),
    });
    router.push(onPath(lesson.href, pathId));
  }

  function refine() {
    if (!rec) return;
    startPlanning(rec.draft);
    router.push('/learn/build?plan=1');
  }

  const right = session.answers.filter((a) => a.correct).length;
  const missed = session.answers
    .filter((a) => !a.correct)
    .map((a) =>
      data.areas
        .find((area) => area.id === a.areaId)
        ?.levels.find((l) => l.level === a.level)
        ?.items.find((i) => i.id === a.itemId),
    )
    .filter((i): i is CompiledPlacementItem => i !== undefined);

  return (
    <section aria-labelledby="result-title" className="step-in flex flex-col gap-6 py-2">
      <div className="flex flex-col gap-2">
        <Title id="result-title">
          {lesson ? (
            <>
              Start with {lesson.title}. <span className="text-muted">Skip what you know.</span>
            </>
          ) : focus ? (
            <>
              Nothing left to learn in {focus.title}.{' '}
              <span className="text-muted">Pick another area.</span>
            </>
          ) : (
            <>
              Advanced in every area you checked.{' '}
              <span className="text-muted">Test out to mark a part done.</span>
            </>
          )}
        </Title>
        <p className="text-muted prose-measure">
          Concepts you showed are marked assumed. Practice checks them now and then over the next
          two weeks, so a gap still shows up.
        </p>
      </div>

      {rec && lesson && focus ? (
        <RecommendedPath
          rec={rec}
          name={path?.name ?? rec.draft.name}
          reason={`Your ${focus.title} level is ${levelName(levels[focus.id] ?? 0)}.`}
          leaving={leaving}
          onStart={() => void start()}
          onRefine={refine}
        />
      ) : (
        <Link href="/progress" className={cn(buttonClass('primary'), 'self-start')}>
          See your progress
        </Link>
      )}

      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 md:grid-cols-4">
        <Figure
          label="Overall"
          value={String(overall.score)}
          unit={`/ ${overall.max}`}
          note={STAGE[overall.stage]}
        />
        <Figure
          label="Areas checked"
          value={String(outcome.checked.length)}
          unit={`/ ${areaIds.length}`}
        />
        <Figure label="Right" value={String(right)} unit={`/ ${session.answers.length}`} />
        <Figure label="Assumed" value={String(outcome.assumedConcepts.length)} unit="concepts" />
      </dl>

      <section aria-labelledby="areas-title" className="prose-measure flex flex-col gap-1">
        <h2 id="areas-title" className="t-label">
          By area
        </h2>
        <ul className="flex flex-col">
          {data.areas.map((area) => {
            const level = levels[area.id];
            // An area rated New in this run was skipped, not shown to be new.
            const skipped = session.scope === 'all' && !outcome.checked.includes(area.id);
            const placed = level !== undefined && !skipped;
            const isFocus = area.id === focusId;
            const link =
              'hover:text-accent inline-flex min-h-5 items-center text-sm underline underline-offset-4';
            return (
              <li key={area.id} className="rule-t flex items-center gap-2 py-1">
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="font-medium">{area.title}</span>
                  <span className={cn('text-sm', isFocus ? 'text-accent' : 'text-muted')}>
                    {placed ? levelName(level) : 'Not checked'}
                    {isFocus ? ' · work on this next' : ''}
                  </span>
                </div>
                <div className="flex shrink-0 flex-col items-end">
                  <LevelMeter level={placed ? level : 0} gap={isFocus} />
                  <div className="flex gap-2">
                    {placed && level === 3 && area.part ? (
                      <Link href={`/practise/test-out/${area.part}`} className={link}>
                        Test out<span className="sr-only">: {area.title}</span>
                      </Link>
                    ) : null}
                    <Link href={`/start?area=${area.id}`} className={link}>
                      {placed ? 'Check in depth' : 'Check this area'}
                      <span className="sr-only">: {area.title}</span>
                    </Link>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      {missed.length > 0 ? (
        <section aria-labelledby="missed-title" className="prose-measure flex flex-col gap-3">
          <h2 id="missed-title" className="t-label">
            Worth a second look
          </h2>
          <ul className="flex flex-col gap-3">
            {missed.map((missedItem) => {
              const choices =
                missedItem.type === 'bug-hunt' ? missedItem.reasons : missedItem.choices;
              const answer = choices.find((c) => c.correct);
              const question =
                missedItem.type === 'bug-hunt' ? missedItem.prompt : missedItem.question;
              return (
                <li key={missedItem.id} className="rule-t flex flex-col gap-1 pt-2">
                  <RichText value={question} className="font-medium" />
                  {answer ? (
                    <>
                      <RichText inline value={answer.text} />
                      <RichText value={answer.feedback} className="text-muted text-sm" />
                    </>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}
    </section>
  );
}

function RecommendedPath({
  rec,
  name,
  reason,
  leaving,
  onStart,
  onRefine,
}: {
  rec: Recommendation;
  name: string;
  reason: string;
  leaving: boolean;
  onStart: () => void;
  onRefine: () => void;
}) {
  const skipped = rec.skipped.length;
  const lessons = rec.draft.stages.reduce((n, s) => n + s.lessonIds.length, 0);
  return (
    <section
      aria-labelledby="path-title"
      className="bg-surface border-border rounded-panel flex flex-col gap-3 border p-2 md:p-3"
    >
      <div className="flex flex-col gap-1">
        <h2 id="path-title" className="text-lg font-medium">
          {name}
        </h2>
        <p className="text-muted prose-measure">
          {reason}{' '}
          {rec.kind === 'path'
            ? 'This path fits where you are.'
            : 'No written path covers it, so this one is built from its lessons.'}
        </p>
        <p className="t-label text-muted">
          Path · {lessons} {lessons === 1 ? 'lesson' : 'lessons'}
          {skipped > 0 ? ` · ${skipped} skipped, you know them` : ''}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-1">
        <Button variant="primary" onClick={onStart} disabled={leaving}>
          {leaving ? 'Opening' : 'Start this lesson'}
        </Button>
        {rec.pathId ? (
          <Link href={`/paths/${rec.pathId}`} className={buttonClass('quiet')}>
            See the path
          </Link>
        ) : null}
        <Button variant="quiet" onClick={onRefine}>
          <ScoutMark size={16} />
          Refine with Scout
        </Button>
      </div>
    </section>
  );
}

/** Three steps, one per level; filled to the level placed. A gap is the accent. */
function LevelMeter({ level, gap }: { level: number; gap: boolean }) {
  return (
    <span aria-hidden className="flex gap-0.5 pt-1">
      {[1, 2, 3].map((step) => (
        <span
          key={step}
          className={cn(
            'h-0.5 w-3 rounded-full',
            step <= level ? (gap ? 'bg-accent' : 'bg-fg') : 'bg-border',
          )}
        />
      ))}
    </span>
  );
}
