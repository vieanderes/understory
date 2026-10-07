'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button, buttonClass } from '@/components/ui/Button';
import { Figure } from '@/components/ui/Figure';
import type { CompiledPlacementItem } from '@/core/content/placement-schema';
import {
  areaReports,
  focusArea,
  overallLevel,
  placementKnows,
  recommendPath,
  verdictFor,
  type AreaReport,
  type AreaVerdict,
  type ModuleState,
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
import type { PlacementData } from './types';

const VERDICT: Readonly<Record<AreaVerdict, string>> = {
  deeper: 'Go deeper',
  mostly: 'Mostly there',
  solid: 'Solid',
};

const SURE_BUT_WRONG_SHOWN = 3;

/** A module's state in words, its strength carried by weight and the gap by the accent. */
const MODULE_STATE: Readonly<Record<ModuleState, string>> = {
  gap: 'gap',
  known: 'basics',
  strong: 'strong',
};

const MODULE_STATE_CLASS: Readonly<Record<ModuleState, string>> = {
  gap: 'text-accent',
  known: 'text-fg',
  strong: 'text-fg font-semibold',
};

/** Where to look first: the gaps, then the near misses, then what holds. */
const VERDICT_ORDER: readonly AreaVerdict[] = ['deeper', 'mostly', 'solid'];

interface AreaRow {
  readonly area: PlacementData['areas'][number];
  readonly verdict: AreaVerdict;
  /** This run's evidence; absent for an area placed by an earlier check. */
  readonly report: AreaReport | undefined;
}

const STAGE: Readonly<Record<OverallStage, string>> = {
  starting: 'Starting out',
  building: 'Building',
  working: 'Working',
  strong: 'Strong',
};

/**
 * The end of placement: one lesson to start, then an honest picture. Each area gets a
 * verdict in plain words, solid, mostly there or go deeper, with the answers behind it, so
 * a learner can see how much it rests on. Misses the learner was certain of come last:
 * they are the surest sign of a misconception.
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

  const focusId = session.scope === 'all' ? focusArea(outcome.checked, levels) : session.scope;
  const focus = data.areas.find((a) => a.id === focusId);
  // The path starts where the gaps are: the focus area's gap modules, else all of it.
  const gapModules = outcome.modules
    .filter((m) => m.areaId === focusId && m.state === 'gap')
    .map((m) => m.moduleId);
  const rec = focus
    ? recommendPath({
        focus: {
          id: focus.id,
          title: focus.title,
          modules: gapModules.length > 0 ? gapModules : focus.modules.map((m) => m.id),
        },
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

  const reports = new Map(areaReports(session, data.areas).map((r) => [r.areaId, r]));
  // A verdict for every area with a level: this run's, or an earlier check's.
  const verdicts = data.areas.flatMap((area): AreaRow[] => {
    const report = reports.get(area.id);
    const earlier = state.placementByArea[area.id];
    if (report) return [{ area, verdict: report.verdict, report }];
    // A part not picked this time keeps what an earlier check found.
    if (earlier) return [{ area, verdict: verdictFor(earlier.level), report: undefined }];
    return [];
  });
  const unchecked = data.areas.filter((a) => !verdicts.some((v) => v.area.id === a.id));
  const count = (v: AreaVerdict) => verdicts.filter((x) => x.verdict === v).length;
  const right = session.answers.filter((a) => a.correct && a.confidence !== 'guess').length;

  const sureButWrong = session.answers
    .filter((a) => !a.correct && a.confidence === 'certain')
    .map((a) =>
      data.areas
        .find((area) => area.id === a.areaId)
        ?.modules.flatMap((m) => [...m.core, ...m.deep])
        .find((i) => i.id === a.itemId),
    )
    .filter((i): i is CompiledPlacementItem => i !== undefined);
  // A few, so the list stays a short read; the rest sit in their areas' verdicts.
  const sureShown = sureButWrong.slice(0, SURE_BUT_WRONG_SHOWN);

  const link =
    'hover:text-accent inline-flex min-h-5 items-center text-sm underline underline-offset-4';

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
              <span className="text-muted">Pick another part.</span>
            </>
          ) : (
            <>
              Solid in every part you checked.{' '}
              <span className="text-muted">Test out to mark a part done.</span>
            </>
          )}
        </Title>
        <p className="text-muted prose-measure">
          {session.mode === 'quick' ? 'A rough estimate' : 'An estimate'} from{' '}
          {session.answers.length} {session.answers.length === 1 ? 'answer' : 'answers'} over{' '}
          {outcome.modules.length} {outcome.modules.length === 1 ? 'module' : 'modules'}. A module
          counts as strong only after a harder question, confirmed, and a guess never counts as
          right. Practice keeps checking over the next two weeks, so a gap still shows up.
        </p>
      </div>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 md:grid-cols-4">
        <Figure
          label="Go deeper"
          value={String(count('deeper'))}
          unit={count('deeper') === 1 ? 'part' : 'parts'}
          tone={count('deeper') > 0 ? 'gap' : 'default'}
        />
        <Figure
          label="Mostly there"
          value={String(count('mostly'))}
          unit={count('mostly') === 1 ? 'part' : 'parts'}
        />
        <Figure
          label="Solid"
          value={String(count('solid'))}
          unit={count('solid') === 1 ? 'part' : 'parts'}
        />
        <Figure
          label="Right"
          value={String(right)}
          unit={`/ ${session.answers.length}`}
          note={`Overall ${overall.score} / ${overall.max}, ${STAGE[overall.stage]}`}
        />
      </dl>

      {rec && lesson && focus ? (
        <RecommendedPath
          rec={rec}
          name={path?.name ?? rec.draft.name}
          reason={`${focus.title} is where to go deeper next.`}
          leaving={leaving}
          onStart={() => void start()}
          onRefine={refine}
        />
      ) : (
        <Link href="/progress" className={cn(buttonClass('primary'), 'self-start')}>
          See your progress
        </Link>
      )}

      <section aria-labelledby="areas-title" className="prose-measure flex flex-col gap-3">
        <h2 id="areas-title" className="t-label">
          By part
        </h2>
        {VERDICT_ORDER.map((verdict) => {
          const rows = verdicts.filter((v) => v.verdict === verdict);
          if (rows.length === 0) return null;
          return (
            <div key={verdict} className="flex flex-col">
              <h3
                className={cn('pb-1 font-medium', verdict === 'deeper' ? 'text-accent' : 'text-fg')}
              >
                {VERDICT[verdict]}
              </h3>
              <ul className="flex flex-col">
                {rows.map(({ area, report }) => {
                  const level = levels[area.id] ?? 0;
                  const isFocus = area.id === focusId;
                  return (
                    <li key={area.id} className="rule-t flex items-start gap-2 py-1">
                      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <span>{area.title}</span>
                        <span className="t-label text-muted">
                          {report
                            ? `${report.right} of ${report.asked} right${
                                report.modulesAsked < report.modulesTotal
                                  ? ` · ${report.modulesAsked} of ${report.modulesTotal} modules`
                                  : ''
                              }`
                            : 'From an earlier check'}
                          {isFocus ? ' · start here' : ''}
                        </span>
                        {report ? (
                          <ul className="flex flex-wrap gap-x-2 text-sm">
                            {report.modules.map((m) => (
                              <li key={m.moduleId}>
                                <span className="text-muted">
                                  {data.moduleTitles[m.moduleId] ?? m.moduleId}{' '}
                                </span>
                                <span className={MODULE_STATE_CLASS[m.state]}>
                                  {MODULE_STATE[m.state]}
                                </span>
                              </li>
                            ))}
                          </ul>
                        ) : null}
                      </div>
                      <div className="flex shrink-0 flex-col items-end">
                        <LevelMeter level={level} gap={verdict === 'deeper'} />
                        <div className="flex gap-2">
                          {level === 3 && area.part ? (
                            <Link href={`/practise/test-out/${area.part}`} className={link}>
                              Test out<span className="sr-only">: {area.title}</span>
                            </Link>
                          ) : null}
                          <Link href={`/start?area=${area.id}`} className={link}>
                            Check in depth<span className="sr-only">: {area.title}</span>
                          </Link>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
        {unchecked.length > 0 ? (
          <div className="flex flex-col">
            <h3 className="text-muted pb-1 font-medium">Not checked</h3>
            <ul className="flex flex-col">
              {unchecked.map((area) => (
                <li key={area.id} className="rule-t flex items-center gap-2 py-1">
                  <span className="text-muted min-w-0 flex-1">{area.title}</span>
                  <Link href={`/start?area=${area.id}`} className={link}>
                    Check this part<span className="sr-only">: {area.title}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>

      {sureButWrong.length > 0 ? (
        <section aria-labelledby="sure-title" className="prose-measure flex flex-col gap-3">
          <div className="flex flex-col gap-0.5">
            <h2 id="sure-title" className="t-label">
              Sure, but wrong
            </h2>
            <p className="text-muted text-sm">
              You were certain of these. They are the gaps most worth closing.
              {sureButWrong.length > sureShown.length
                ? ` ${sureShown.length} of ${sureButWrong.length} shown.`
                : ''}
            </p>
          </div>
          <ul className="flex flex-col gap-3">
            {sureShown.map((missedItem) => {
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
