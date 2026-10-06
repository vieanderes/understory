'use client';

import { ArrowRight, Award, BookOpen, Check, ChevronDown, Square } from 'lucide-react';
import Link from 'next/link';
import { useMemo } from 'react';
import { buttonClass } from '@/components/ui/Button';
import { InlineCode } from '@/components/ui/InlineCode';
import { ProgressLine } from '@/components/ui/ProgressLine';
import { formatMinutes } from '@/core/insight';
import { bestTestScores } from '@/core/online-test/path-tests';
import type { PathLesson, PathSummary, PathTest } from '@/lib/content';
import { cn } from '@/lib/cn';
import { certificateHref, examHref, formatLocalDate, percent } from '@/features/exam/stages';
import { usePathExam } from '@/features/exam/usePathExam';
import { useProgress } from '@/features/store/StoreProvider';
import { stageSessionHref } from '@/features/practice/topics';
import { usePathProgress } from './usePathProgress';
import { onPath } from './links';

/** Tests shown in a stage before the rest fold away. */
const TESTS_SHOWN = 3;

/**
 * One path: the promise and the one next step first, then the stages in order, each with its
 * lessons and the tests that check it. The side column holds what the path leaves you able to
 * do; how to answer and how you know you are ready fold away, so the lessons stay the spine.
 *
 * `embedded` drops the breadcrumb where Learn already frames the path. A `custom` path is one
 * the learner built from chapters: it has no track lecture, final exam or readiness notes.
 */
export function PathView({
  path,
  embedded = false,
  custom = false,
}: {
  path: PathSummary;
  embedded?: boolean;
  custom?: boolean;
}) {
  const progress = usePathProgress(path.lessonIds);
  const { status, state } = useProgress();
  const best = useMemo(() => bestTestScores(state.onlineTests), [state.onlineTests]);
  const testResult = (test: PathTest): string | undefined => {
    if (status !== 'ready') return undefined;
    if (test.kind === 'lesson') return state.completedLessons.has(test.key) ? 'Done' : undefined;
    const score = best[test.key];
    return score === undefined ? undefined : `Best ${score}%`;
  };
  const lessons = path.stages.flatMap((stage) => stage.lessons);
  const next = lessons.find((l) => l.id === progress.nextId);
  const started = progress.done > 0;
  // Lessons are numbered through the whole path, so each stage starts where the last ended.
  const offsets = path.stages.map((_, i) =>
    path.stages.slice(0, i).reduce((sum, stage) => sum + stage.lessons.length, 0),
  );

  return (
    <div className="grid grid-cols-4 gap-x-4 gap-y-6 md:grid-cols-12">
      <header className="col-span-4 flex flex-col gap-3 md:col-span-12 lg:col-span-8">
        {embedded ? null : (
          <nav aria-label="Breadcrumb" className="t-label">
            <Link href="/library" className="hover:text-fg transition-colors duration-150 ease-out">
              Library
            </Link>
          </nav>
        )}
        <h1 className="t-title" data-arrive="title">
          {path.title}
        </h1>
        <p data-arrive="rise" className="text-muted prose-measure text-lg">
          {path.promise}
        </p>
        <div data-arrive="rise" className="flex flex-wrap items-center gap-1 pt-1">
          {next?.href ? (
            <Link href={onPath(next.href, path.id)} className={buttonClass('primary')}>
              {started ? 'Continue' : 'Start the path'}
            </Link>
          ) : (
            <span className="text-muted">Every lesson on this path is done.</span>
          )}
          {custom ? null : (
            <Link href={`/lectures/tracks/${path.id}`} className={buttonClass('quiet')}>
              <BookOpen aria-hidden size={16} strokeWidth={2} />
              Read as a lecture
            </Link>
          )}
        </div>
        {next ? (
          <p className="text-muted text-sm">
            Next: <InlineCode text={next.title} /> · {next.minutes} min
          </p>
        ) : null}
      </header>

      <aside className="col-span-4 md:col-span-12 lg:col-span-4">
        <div className="bg-raised border-border rounded-panel shadow-edge flex flex-col gap-2 border p-2 md:p-3">
          <div className="flex items-baseline justify-between gap-2">
            <p className="t-figure text-lg font-semibold">
              {progress.done}
              <span className="text-muted font-normal">/{progress.total}</span>
            </p>
            <p className="t-label">about {formatMinutes(path.minutes)}</p>
          </div>
          <ProgressLine
            value={progress.total ? progress.done / progress.total : 0}
            label={`${progress.done} of ${progress.total} lessons done`}
          />
          {path.outcomes.length > 0 ? (
            <>
              <h2 className="pt-1 text-sm font-semibold">At the end you can</h2>
              <ul className="flex flex-col gap-1 text-sm">
                {path.outcomes.map((outcome) => (
                  <li key={outcome} className="text-muted flex gap-1">
                    <Check
                      aria-hidden
                      size={16}
                      strokeWidth={2}
                      className="text-fg mt-0.5 shrink-0"
                    />
                    {outcome}
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </div>
      </aside>

      <div className="col-span-4 flex flex-col gap-4 md:col-span-12 lg:col-span-8">
        <ol data-arrive="stagger" className="flex flex-col">
          {path.stages.map((stage, stageIndex) => {
            const minutes = stage.lessons.reduce((sum, l) => sum + l.minutes, 0);
            const done = stage.lessons.filter((l) => progress.isDone(l.id)).length;
            const before = path.stages[stageIndex - 1]?.lessons.at(-1);
            return (
              <li key={stage.title} className="flex flex-col">
                <section aria-label={stage.title} className="flex flex-col">
                  <div className="flex gap-2">
                    <Rail
                      above={
                        stageIndex === 0
                          ? 'none'
                          : before && progress.isDone(before.id)
                            ? 'done'
                            : 'todo'
                      }
                      below={
                        stage.lessons[0] && progress.isDone(stage.lessons[0].id) ? 'done' : 'todo'
                      }
                    >
                      <span
                        aria-hidden
                        className={cn(
                          'rounded-inner size-2 rotate-45 border-2',
                          done === stage.lessons.length
                            ? 'bg-fg border-fg'
                            : 'bg-surface border-border-strong',
                        )}
                      />
                    </Rail>
                    <div className="flex min-w-0 flex-1 flex-col gap-0.5 pt-1 pb-2">
                      <div className="flex items-baseline justify-between gap-2">
                        <h2 className="t-section">{stage.title}</h2>
                        <p className="t-label t-figure shrink-0">
                          {done}/{stage.lessons.length} · {formatMinutes(minutes)}
                        </p>
                      </div>
                      <p className="text-muted prose-measure">{stage.why}</p>
                      {stage.artifact ? (
                        <p className="text-sm">
                          <span className="text-muted">You leave with </span>
                          {stage.artifact.charAt(0).toLowerCase() + stage.artifact.slice(1)}
                        </p>
                      ) : null}
                      {stage.lectureHref ? (
                        <Link
                          href={stage.lectureHref}
                          aria-label={`Read as a lecture: ${stage.title}`}
                          className="text-muted hover:text-fg rounded-control -ml-0.5 inline-flex h-5 items-center gap-1 self-start px-0.5 text-sm font-medium transition-colors duration-150 ease-out"
                        >
                          <BookOpen aria-hidden size={16} strokeWidth={2} />
                          Read as a lecture
                        </Link>
                      ) : null}
                    </div>
                  </div>
                  <ol className="flex flex-col">
                    {stage.lessons.map((lesson, i) => {
                      const last =
                        stageIndex === path.stages.length - 1 && i === stage.lessons.length - 1;
                      return (
                        <PathLessonRow
                          key={lesson.id}
                          pathId={path.id}
                          lesson={lesson}
                          number={(offsets[stageIndex] ?? 0) + i + 1}
                          done={progress.isDone(lesson.id)}
                          next={lesson.id === progress.nextId}
                          above={progress.isDone(lesson.id) ? 'done' : 'todo'}
                          below={
                            last
                              ? progress.isDone(lesson.id)
                                ? 'done'
                                : 'todo'
                              : progress.isDone(lesson.id) &&
                                  (stage.lessons[i + 1]
                                    ? progress.isDone(stage.lessons[i + 1]!.id)
                                    : true)
                                ? 'done'
                                : 'todo'
                          }
                        />
                      );
                    })}
                  </ol>
                  {stage.optional.length > 0 ? (
                    <div className="flex gap-2">
                      <Rail above="todo" below="todo" />
                      <Fold
                        className="min-w-0 flex-1 pb-2"
                        label={`If you have time · ${stage.optional.length} ${
                          stage.optional.length === 1 ? 'lesson' : 'lessons'
                        }`}
                      >
                        <ul className="border-border rounded-panel divide-border mt-1 divide-y overflow-hidden border">
                          {stage.optional.map((lesson) => (
                            <OptionalRow
                              key={lesson.id}
                              pathId={path.id}
                              lesson={lesson}
                              done={progress.isDone(lesson.id)}
                            />
                          ))}
                        </ul>
                      </Fold>
                    </div>
                  ) : null}
                  {stage.lessons.length > 0 ? (
                    <div className="flex gap-2">
                      <Rail above="todo" below="todo" />
                      <StageTests
                        stage={stage.title}
                        practice={stageSessionHref([
                          ...stage.lessons.map((l) => l.id),
                          ...stage.optional.map((l) => l.id),
                        ])}
                        tests={stage.tests ?? []}
                        result={testResult}
                      />
                    </div>
                  ) : null}
                </section>
              </li>
            );
          })}
          {custom ? null : (
            <FinalStop path={path} lessonsDone={progress.ready && progress.nextId === undefined} />
          )}
        </ol>
        {path.practice.length > 0 ? (
          <section aria-labelledby="practice-title" className="flex flex-col gap-2">
            <div className="flex flex-col gap-0.5">
              <h2 id="practice-title" className="t-section">
                Practise it for real
              </h2>
              <p className="text-muted">
                Alongside the lessons, in order. The lessons teach; this is where it sticks.
              </p>
            </div>
            <ol className="border-border rounded-panel divide-border divide-y overflow-hidden border">
              {path.practice.map((item, i) => (
                <li key={item.href + item.label}>
                  <Link
                    href={item.href}
                    className="group hover:bg-raised flex items-start gap-2 p-2 transition-colors duration-150 ease-out md:p-3"
                  >
                    <span className="t-figure text-muted w-3 shrink-0 pt-0.5 text-sm">{i + 1}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium">{item.label}</span>
                      <span className="text-muted block text-sm">{item.text}</span>
                    </span>
                    <ArrowRight
                      aria-hidden
                      size={16}
                      strokeWidth={2}
                      className="text-faint group-hover:text-fg mt-0.5 shrink-0 transition-transform duration-150 ease-out group-hover:translate-x-0.5"
                    />
                  </Link>
                </li>
              ))}
            </ol>
          </section>
        ) : null}
        {custom ? null : <Readiness path={path} />}
      </div>

      {!custom && path.shapes.length > 0 ? (
        <aside className="col-span-4 md:col-span-12 lg:col-span-4">
          <Fold label="How to answer" className="rule-t pt-1 lg:sticky lg:top-4" heading>
            <dl className="flex flex-col gap-2 pt-1">
              {path.shapes.map((shape) => (
                <div key={shape.label} className="rule-t flex flex-col gap-0.5 pt-2">
                  <dt className="text-sm font-semibold">{shape.label}</dt>
                  <dd className="text-muted text-sm">{shape.text}</dd>
                </div>
              ))}
            </dl>
            {path.method.length > 0 ? (
              <>
                <h2 className="pt-2 text-sm font-semibold">Each lesson</h2>
                <ol className="text-muted flex list-decimal flex-col gap-0.5 pl-2 text-sm">
                  {path.method.map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ol>
              </>
            ) : null}
          </Fold>
        </aside>
      ) : null}
    </div>
  );
}

/**
 * The route's last stop, after the last stage: the final exam and the certificate it earns.
 * Open from the start. Once every lesson is done it becomes the one next step on the page.
 */
function FinalStop({ path, lessonsDone }: { path: PathSummary; lessonsDone: boolean }) {
  const exam = usePathExam(path.id);
  const pct = exam.best ? percent(exam.best.right, exam.best.total) : undefined;
  return (
    <li className="flex gap-2">
      <Rail above={lessonsDone ? 'done' : 'todo'} below="none">
        <span
          aria-hidden
          className={cn(
            'flex size-3 shrink-0 items-center justify-center rounded-full border-2',
            exam.passed ? 'bg-fg text-bg border-fg' : 'bg-surface border-border-strong text-faint',
          )}
        >
          {exam.passed ? <Check size={12} strokeWidth={3} /> : <Award size={12} strokeWidth={2} />}
        </span>
      </Rail>
      <section
        aria-labelledby="final-stop-title"
        className="flex min-w-0 flex-1 flex-col gap-1 pt-1 pb-2"
      >
        <div className="flex items-baseline justify-between gap-2">
          <h2 id="final-stop-title" className="t-section">
            Final exam and certificate
          </h2>
          <p className="t-label t-figure shrink-0">
            {exam.passed ? 'Certified' : pct !== undefined ? `Best ${pct}%` : '20 min'}
          </p>
        </div>
        <p className="text-muted prose-measure">
          {exam.firstPass
            ? `Passed on ${formatLocalDate(exam.firstPass.localDate)} with ${percent(exam.firstPass.right, exam.firstPass.total)}%.`
            : pct !== undefined
              ? `Best so far ${pct}%. 80% passes and earns the certificate.`
              : 'Questions from every stage, mixed. 80% passes and earns the certificate. Open now, best after the lessons.'}
        </p>
        <div className="flex flex-wrap gap-1 pt-1">
          {exam.passed ? (
            <>
              <Link href={certificateHref(path.id)} className={buttonClass('secondary', 'md')}>
                See the certificate
              </Link>
              <Link href={examHref(path.id)} className={buttonClass('quiet', 'md')}>
                Sit it again
              </Link>
            </>
          ) : (
            <Link
              href={examHref(path.id)}
              className={buttonClass(lessonsDone ? 'primary' : 'secondary', 'md')}
            >
              Sit the final exam
            </Link>
          )}
        </div>
      </section>
    </li>
  );
}

type Segment = 'done' | 'todo' | 'none';

const SEGMENT: Record<Segment, string> = {
  done: 'bg-fg',
  todo: 'bg-border-strong',
  none: 'bg-transparent',
};

/**
 * The line a path is drawn on. Each row carries its own piece of it: the part above its node
 * and the part below. Ink where the lessons on both ends are done, a hairline elsewhere.
 */
function Rail({
  above,
  below,
  children,
}: {
  above: Segment;
  below: Segment;
  children?: React.ReactNode;
}) {
  return (
    <span aria-hidden className="flex w-3 shrink-0 flex-col items-center">
      <span className={cn('h-1.5 w-0.5 shrink-0 rounded-full', SEGMENT[above])} />
      {children ?? <span className={cn('h-0.5 w-0.5', SEGMENT[below])} />}
      <span className={cn('min-h-1 w-0.5 flex-1 rounded-full', SEGMENT[below])} />
    </span>
  );
}

function PathLessonRow({
  pathId,
  lesson,
  number,
  done,
  next,
  above,
  below,
}: {
  pathId: string;
  lesson: PathLesson;
  number: number;
  done: boolean;
  next: boolean;
  above: Segment;
  below: Segment;
}) {
  const body = (
    <>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className={cn('font-medium', done && 'text-muted', next && 'text-accent')}>
          <InlineCode text={lesson.title} />
        </span>
        {lesson.objective ? (
          <span className="text-muted text-sm">
            <InlineCode text={lesson.objective} />
          </span>
        ) : null}
      </span>
      <span className="t-label t-figure shrink-0">
        {done ? 'Done' : next ? 'Next' : lesson.href ? `${lesson.minutes} min` : 'Soon'}
      </span>
    </>
  );
  const row =
    'rounded-control flex min-w-0 flex-1 items-start gap-2 px-1.5 py-1.5 transition-colors duration-150 ease-out';
  return (
    <li className="flex gap-2">
      <Rail above={above} below={below}>
        <span
          aria-hidden
          className={cn(
            'flex size-3 shrink-0 items-center justify-center rounded-full border-2 text-sm',
            done
              ? 'bg-fg text-bg border-fg'
              : next
                ? 'border-accent text-accent bg-surface'
                : 'border-border-strong text-faint bg-surface',
          )}
        >
          {done ? <Check size={12} strokeWidth={3} /> : <span className="t-figure">{number}</span>}
        </span>
      </Rail>
      {lesson.href ? (
        <Link
          href={onPath(lesson.href, pathId)}
          className={cn(row, next ? 'bg-accent-tint' : 'hover:bg-raised')}
        >
          {body}
        </Link>
      ) : (
        <div className={row}>{body}</div>
      )}
    </li>
  );
}

function OptionalRow({
  pathId,
  lesson,
  done,
}: {
  pathId: string;
  lesson: PathLesson;
  done: boolean;
}) {
  return (
    <li>
      {lesson.href ? (
        <Link
          href={onPath(lesson.href, pathId)}
          className="hover:bg-raised flex items-start justify-between gap-2 px-2 py-1.5 transition-colors duration-150 ease-out"
        >
          <span className={cn('min-w-0', done ? 'text-muted' : 'font-medium')}>
            <InlineCode text={lesson.title} />
          </span>
          <span className="t-label t-figure shrink-0">
            {done ? 'Done' : `${lesson.minutes} min`}
          </span>
        </Link>
      ) : null}
    </li>
  );
}

/**
 * A disclosure: secondary detail stays one tap away instead of filling the page. A
 * `heading` fold names a section; a plain one is a quiet "more" under a list.
 */
function Fold({
  label,
  heading = false,
  className,
  children,
}: {
  label: string;
  heading?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <details className={cn('group', className)}>
      <summary
        className={cn(
          'hover:text-fg rounded-control flex cursor-pointer list-none items-center gap-1 transition-colors duration-150 ease-out',
          heading ? 'min-h-5 justify-between' : 'text-muted h-5 text-sm font-medium',
        )}
      >
        {heading ? <h2 className="t-section">{label}</h2> : null}
        <ChevronDown
          aria-hidden
          size={16}
          strokeWidth={2}
          className={cn(
            'shrink-0 transition-transform duration-150 ease-out group-open:rotate-180',
            heading && 'text-muted order-last',
          )}
        />
        {heading ? null : label}
      </summary>
      {children}
    </details>
  );
}

/**
 * What a stage offers beyond its lessons: practice of the stage, the labs that show its
 * mechanisms moving, and the timed tests that check it. None is needed to finish the path,
 * but each is the way to make the stage stick, so the group says so plainly and stays
 * quiet: no accent, which marks the next lesson. Practice comes first, labs before tests,
 * the order a learner would reach for them.
 */
function StageTests({
  stage,
  practice,
  tests,
  result,
}: {
  stage: string;
  practice: string;
  tests: readonly PathTest[];
  result: (test: PathTest) => string | undefined;
}) {
  const ordered = [
    ...tests.filter((t) => t.kind === 'lab'),
    ...tests.filter((t) => t.kind !== 'lab'),
  ];
  const shown = ordered.slice(0, TESTS_SHOWN);
  const rest = ordered.slice(TESTS_SHOWN);
  const restNoun = rest.every((t) => t.kind === 'training') ? 'tasks' : 'more';
  return (
    <section aria-label={`Try it: ${stage}`} className="flex min-w-0 flex-1 flex-col gap-1 pb-2">
      <div className="flex flex-wrap items-baseline justify-between gap-x-2 pt-1">
        <h3 className="font-semibold whitespace-nowrap">Try it</h3>
        <p className="t-label shrink-0">Optional · recommended</p>
      </div>
      <ul className="border-border rounded-panel divide-border divide-y overflow-hidden border">
        <li>
          <Link
            href={practice}
            className="hover:bg-raised flex items-start justify-between gap-2 px-2 py-1.5 transition-colors duration-150 ease-out"
          >
            <span className="flex min-w-0 flex-col">
              <span className="font-medium">Practise this stage</span>
              <span className="text-muted text-sm">
                Questions from these lessons, done or not, the fading ones first
              </span>
            </span>
            <span className="t-label t-figure shrink-0">10 min</span>
          </Link>
        </li>
        {shown.map((test) => (
          <TestRow key={test.key} test={test} result={result(test)} />
        ))}
      </ul>
      {rest.length > 0 ? (
        <Fold label={restNoun === 'tasks' ? `${rest.length} more tasks` : `${rest.length} more`}>
          <ul className="border-border rounded-panel divide-border mt-1 divide-y overflow-hidden border">
            {rest.map((test) => (
              <TestRow key={test.key} test={test} result={result(test)} />
            ))}
          </ul>
        </Fold>
      ) : null}
    </section>
  );
}

function TestRow({ test, result }: { test: PathTest; result: string | undefined }) {
  return (
    <li>
      <Link
        href={test.href}
        className="hover:bg-raised flex items-start justify-between gap-2 px-2 py-1.5 transition-colors duration-150 ease-out"
      >
        <span className="flex min-w-0 flex-col">
          <span className={cn('font-medium', result === 'Done' && 'text-muted')}>{test.title}</span>
          <span className="text-muted text-sm">
            {test.kind === 'lab' ? (
              <>
                <span className="t-label">Lab</span> · {test.detail}
              </>
            ) : (
              <>
                {test.detail ? `${test.detail} · ` : ''}
                <span className="t-figure">up to {test.xp} XP</span>
              </>
            )}
          </span>
        </span>
        <span className={cn('t-label t-figure shrink-0', result && result !== 'Done' && 'text-fg')}>
          {result ?? `${test.minutes} min`}
        </span>
      </Link>
    </li>
  );
}

/**
 * How you know you are done, without the app: checks to run on yourself, the piece of work
 * that proves the path, and an honest line on what it leaves out. Folded: it matters at the
 * end, not on every visit.
 */
function Readiness({ path }: { path: PathSummary }) {
  const { readyWhen, proof, coverage } = path;
  if (readyWhen.length === 0 && !proof && !coverage) return null;
  return (
    <div className="flex flex-col">
      {readyWhen.length > 0 || proof ? (
        <Fold label="You are ready when" heading className="rule-t py-1">
          <div className="flex flex-col gap-3 pt-1 pb-2">
            {readyWhen.length > 0 ? (
              <ul className="flex flex-col gap-1">
                {readyWhen.map((check) => (
                  <li key={check} className="flex gap-1">
                    <Square
                      aria-hidden
                      size={16}
                      strokeWidth={2}
                      className="text-faint mt-0.5 shrink-0"
                    />
                    <span>{check}</span>
                  </li>
                ))}
              </ul>
            ) : null}
            {proof ? (
              <div className="bg-raised border-border rounded-panel shadow-edge flex flex-col gap-1 border p-2 md:p-3">
                <h3 className="font-semibold">
                  Prove it: {proof.title.charAt(0).toLowerCase() + proof.title.slice(1)}
                </h3>
                <ul className="text-muted flex list-disc flex-col gap-0.5 pl-2 text-sm">
                  {proof.evidence.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </Fold>
      ) : null}
      {coverage ? (
        <Fold label="What it covers" heading className="rule-t rule-b py-1">
          <dl className="grid grid-cols-1 gap-2 pt-1 pb-2 text-sm sm:grid-cols-3">
            {(
              [
                ['Covers', coverage.covered],
                ['Touches', coverage.partial],
                ['Leaves out', coverage.outside],
              ] as const
            )
              .filter(([, items]) => items.length > 0)
              .map(([label, items]) => (
                <div key={label} className="flex flex-col gap-0.5">
                  <dt className="t-label">{label}</dt>
                  <dd>
                    <ul className="text-muted flex flex-col gap-0.5">
                      {items.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </dd>
                </div>
              ))}
          </dl>
        </Fold>
      ) : null}
    </div>
  );
}
