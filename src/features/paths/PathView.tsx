'use client';

import {
  ArrowRight,
  Award,
  BookOpen,
  Check,
  ChevronDown,
  FlaskConical,
  Repeat2,
  Square,
  Timer,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import { OwnPathPace } from './OwnPathTools';
import { useMemo } from 'react';
import { buttonClass } from '@/components/ui/Button';
import { InlineCode } from '@/components/ui/InlineCode';
import { ProgressLine } from '@/components/ui/ProgressLine';
import { rowAction, rowArrow, rowItem, rowList } from '@/components/ui/rows';
import { formatMinutes } from '@/core/insight';
import { bestTestScores } from '@/core/online-test/path-tests';
import type { PathLesson, PathSummary, PathTest } from '@/lib/content';
import { cn } from '@/lib/cn';
import { certificateHref, examHref, formatLocalDate, percent } from '@/features/exam/stages';
import { usePathExam } from '@/features/exam/usePathExam';
import { useProgress } from '@/features/store/StoreProvider';
import { stageSessionHref } from '@/features/practice/topics';
import { usePathProgress, type PathProgress } from './usePathProgress';
import { onPath } from './links';

/** Tests shown in a stage before the rest fold away. */
const TESTS_SHOWN = 3;

/**
 * One path: the promise, then one panel with the one next step, then the stages as plain
 * lists, each with its lessons and a quiet "Try it" group. What the path leaves you able to
 * do, how to answer and how you know you are ready fold away at the foot, so the lessons
 * stay the spine.
 *
 * `embedded` drops the breadcrumb where Learn already frames the path, and adds the link to
 * its progress. `tools` sit beside the title and `drawer` opens under it (Learn's path
 * switcher). A `custom` path is one the learner built from chapters: it has no track
 * lecture, final exam or readiness notes.
 */
export function PathView({
  path,
  embedded = false,
  custom = false,
  tools,
  drawer,
}: {
  path: PathSummary;
  embedded?: boolean;
  custom?: boolean;
  tools?: React.ReactNode;
  drawer?: React.ReactNode;
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

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4">
        <header className="flex flex-col gap-2">
          {embedded ? null : (
            <nav aria-label="Breadcrumb" className="t-label">
              <Link
                href="/library"
                className="hover:text-fg transition-colors duration-150 ease-out"
              >
                Library
              </Link>
            </nav>
          )}
          {/* An own path carries more actions than fit beside its title, so they go under it. */}
          <div
            className={cn(
              'flex flex-col gap-1',
              !custom && 'lg:flex-row lg:items-end lg:justify-between lg:gap-4',
            )}
          >
            <div className="flex min-w-0 flex-col gap-1">
              <h1 className="t-title" data-arrive="title">
                {path.title}
              </h1>
              <p data-arrive="rise" className="text-muted prose-measure text-lg">
                {path.promise}
              </p>
              {custom ? (
                <OwnPathPace
                  pathId={path.id}
                  minutesLeft={path.stages
                    .flatMap((s) => s.lessons)
                    .filter((l) => !progress.isDone(l.id))
                    .reduce((sum, l) => sum + l.minutes, 0)}
                />
              ) : null}
            </div>
            {custom && !tools ? null : (
              <div
                className={cn(
                  '-ml-2 flex shrink-0 flex-wrap items-center',
                  !custom && 'lg:-mr-2 lg:ml-0',
                )}
              >
                {custom ? null : (
                  <Link
                    href={`/lectures/tracks/${path.id}`}
                    className={buttonClass('quiet', 'md', 'text-muted hover:text-fg')}
                  >
                    <BookOpen aria-hidden size={16} strokeWidth={2} />
                    Read as a lecture
                  </Link>
                )}
                {tools}
              </div>
            )}
          </div>
        </header>

        {drawer}

        <NextStep path={path} progress={progress} embedded={embedded} custom={custom} />
      </div>

      <section aria-labelledby="stages-title" className="flex flex-col">
        <h2 id="stages-title" className="t-section rule-b pb-1">
          The stages
        </h2>
        <ol data-arrive="stagger" className="flex flex-col">
          {path.stages.map((stage, stageIndex) => {
            const minutes = stage.lessons.reduce((sum, l) => sum + l.minutes, 0);
            const done = stage.lessons.filter((l) => progress.isDone(l.id)).length;
            return (
              <li key={stage.title} className={cn(stageIndex > 0 && 'rule-t')}>
                <section aria-label={stage.title} className="flex flex-col gap-2 py-3">
                  <div className="flex flex-col gap-0.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex min-w-0 flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
                        <span className="t-figure text-faint text-sm">
                          {String(stageIndex + 1).padStart(2, '0')}
                        </span>
                        <h3 className="t-section">{stage.title}</h3>
                        <span className="t-figure text-muted text-sm">
                          {done}/{stage.lessons.length} · {formatMinutes(minutes)}
                        </span>
                      </div>
                      {stage.lectureHref ? (
                        <Link
                          href={stage.lectureHref}
                          aria-label={`Read as a lecture: ${stage.title}`}
                          title="Read as a lecture"
                          className="text-muted hover:text-fg hover:bg-raised rounded-control -my-1 -mr-1 inline-flex size-5 shrink-0 items-center justify-center gap-1 text-sm font-medium transition-colors duration-150 ease-out md:w-auto md:px-1"
                        >
                          <BookOpen aria-hidden size={16} strokeWidth={2} />
                          <span className="hidden md:inline">Lecture</span>
                        </Link>
                      ) : null}
                    </div>
                    <p className="text-muted prose-measure">{stage.why}</p>
                  </div>
                  <ol className="-mx-1 flex flex-col">
                    {stage.lessons.map((lesson) => (
                      <PathLessonRow
                        key={lesson.id}
                        pathId={path.id}
                        lesson={lesson}
                        done={progress.isDone(lesson.id)}
                        next={lesson.id === progress.nextId}
                      />
                    ))}
                  </ol>
                  {stage.optional.length > 0 ? (
                    <Fold
                      label={`If you have time · ${stage.optional.length} ${
                        stage.optional.length === 1 ? 'lesson' : 'lessons'
                      }`}
                    >
                      <ol className="-mx-1 flex flex-col pt-0.5">
                        {stage.optional.map((lesson) => (
                          <PathLessonRow
                            key={lesson.id}
                            pathId={path.id}
                            lesson={lesson}
                            done={progress.isDone(lesson.id)}
                            next={false}
                            optional
                          />
                        ))}
                      </ol>
                    </Fold>
                  ) : null}
                  {stage.lessons.length > 0 ? (
                    <StageTests
                      stage={stage.title}
                      practice={stageSessionHref([
                        ...stage.lessons.map((l) => l.id),
                        ...stage.optional.map((l) => l.id),
                      ])}
                      tests={stage.tests ?? []}
                      result={testResult}
                    />
                  ) : null}
                </section>
              </li>
            );
          })}
          {custom ? null : (
            <FinalStop path={path} lessonsDone={progress.ready && progress.nextId === undefined} />
          )}
        </ol>
      </section>

      {path.practice.length > 0 ? (
        <section aria-labelledby="practice-title" className="flex flex-col gap-2">
          <div className="flex flex-col gap-0.5">
            <h2 id="practice-title" className="t-section">
              Practise it for real
            </h2>
            <p className="text-muted">Alongside the lessons, in order.</p>
          </div>
          <ol className={rowList()}>
            {path.practice.map((item, i) => (
              <li key={item.href + item.label} className={rowItem}>
                <Link href={item.href} className={rowAction('items-start')}>
                  <span className="t-figure text-faint w-2 shrink-0 pt-0.5 text-sm">{i + 1}</span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="font-medium">{item.label}</span>
                    <span className="text-muted text-sm">{item.text}</span>
                  </span>
                  <ArrowRight
                    aria-hidden
                    size={16}
                    strokeWidth={2}
                    className={cn(rowArrow, 'mt-0.5')}
                  />
                </Link>
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      {custom ? null : <AboutPath path={path} />}
    </div>
  );
}

/**
 * The one raised surface on the page: the next lesson, named, with the button that opens it
 * and how far along the path is. Once every lesson is done it points at the final exam.
 */
function NextStep({
  path,
  progress,
  embedded,
  custom,
}: {
  path: PathSummary;
  progress: PathProgress;
  embedded: boolean;
  custom: boolean;
}) {
  const stage = path.stages.find((s) => s.lessons.some((l) => l.id === progress.nextId));
  const next = stage?.lessons.find((l) => l.id === progress.nextId);
  const started = progress.done > 0;
  const left = path.stages
    .flatMap((s) => s.lessons)
    .filter((l) => !progress.isDone(l.id))
    .reduce((sum, l) => sum + l.minutes, 0);
  const exam = !next && !custom;
  return (
    <section
      aria-label="Next step"
      data-arrive="rise"
      className="bg-surface border-border rounded-panel shadow-edge flex flex-col gap-3 border p-2 md:p-3"
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <p className="t-label">
            {next && stage
              ? `${started ? 'Next' : 'Start here'} · ${stage.title}`
              : 'All lessons done'}
          </p>
          <p className="text-lg font-semibold">
            {next ? <InlineCode text={next.title} /> : 'Every lesson on this path is done'}
          </p>
          {next?.objective ? (
            <p className="text-muted text-sm">
              <InlineCode text={next.objective} />
            </p>
          ) : exam ? (
            <p className="text-muted text-sm">The final exam is the last step.</p>
          ) : null}
        </div>
        {next?.href ? (
          <Link
            href={onPath(next.href, path.id)}
            className={buttonClass('primary', 'lg', 'shrink-0')}
          >
            {started ? 'Continue' : 'Start'} · {next.minutes} min
            <ArrowRight aria-hidden size={16} strokeWidth={2} />
          </Link>
        ) : exam ? (
          <Link href={examHref(path.id)} className={buttonClass('primary', 'lg', 'shrink-0')}>
            Take the final exam
            <ArrowRight aria-hidden size={16} strokeWidth={2} />
          </Link>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <ProgressLine
          value={progress.total ? progress.done / progress.total : 0}
          label={`${progress.done} of ${progress.total} lessons done`}
          className="min-w-20 flex-1"
        />
        <p className="t-figure text-muted text-sm">
          {progress.done}/{progress.total} lessons
          {left > 0 ? ` · ${formatMinutes(left)} left` : ''}
        </p>
        {embedded ? (
          <Link
            href="/progress?scope=path"
            className="text-muted hover:text-fg inline-flex min-h-5 items-center gap-0.5 text-sm font-medium transition-colors duration-150 ease-out"
          >
            Progress on this path
            <ArrowRight aria-hidden size={16} strokeWidth={2} />
          </Link>
        ) : null}
      </div>
    </section>
  );
}

/**
 * The route's last stop, after the last stage: the final exam and the certificate it earns.
 * Open from the start, and quiet: the panel above points here once every lesson is done.
 */
function FinalStop({ path, lessonsDone }: { path: PathSummary; lessonsDone: boolean }) {
  const exam = usePathExam(path.id);
  const pct = exam.best ? percent(exam.best.right, exam.best.total) : undefined;
  return (
    <li className="rule-t">
      <section aria-labelledby="final-stop-title" className="flex flex-col gap-2 py-3">
        <div className="flex flex-col gap-0.5">
          <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
            <span aria-hidden className="text-faint self-center">
              {exam.passed ? (
                <Check size={16} strokeWidth={2} />
              ) : (
                <Award size={16} strokeWidth={2} />
              )}
            </span>
            <h3 id="final-stop-title" className="t-section">
              Final exam and certificate
            </h3>
            <span className="t-figure text-muted text-sm">
              {exam.passed ? 'Certified' : pct !== undefined ? `Best ${pct}%` : '20 min'}
            </span>
          </div>
          <p className="text-muted prose-measure">
            {exam.firstPass
              ? `Passed on ${formatLocalDate(exam.firstPass.localDate)} with ${percent(exam.firstPass.right, exam.firstPass.total)}%.`
              : pct !== undefined
                ? `Best so far ${pct}%. 80% passes and earns the certificate.`
                : lessonsDone
                  ? 'Questions from every stage, mixed. 80% passes and earns the certificate.'
                  : 'Questions from every stage, mixed. 80% passes. Open now, best after the lessons.'}
          </p>
        </div>
        <div className="-ml-2 flex flex-wrap">
          {exam.passed ? (
            <>
              <Link href={certificateHref(path.id)} className={buttonClass('quiet', 'md')}>
                See the certificate
                <ArrowRight aria-hidden size={16} strokeWidth={2} />
              </Link>
              <Link
                href={examHref(path.id)}
                className={buttonClass('quiet', 'md', 'text-muted hover:text-fg')}
              >
                Sit it again
              </Link>
            </>
          ) : (
            <Link href={examHref(path.id)} className={buttonClass('quiet', 'md')}>
              Sit the final exam
              <ArrowRight aria-hidden size={16} strokeWidth={2} />
            </Link>
          )}
        </div>
      </section>
    </li>
  );
}

/**
 * A lesson as a plain row: a circle marker, the title and its minutes. Done is a filled
 * circle and muted text, next is the accent ring on a tinted row, later a hairline ring,
 * and an optional lesson a dashed one.
 */
function PathLessonRow({
  pathId,
  lesson,
  done,
  next,
  optional = false,
}: {
  pathId: string;
  lesson: PathLesson;
  done: boolean;
  next: boolean;
  optional?: boolean;
}) {
  const body = (
    <>
      <span
        aria-hidden
        className={cn(
          'flex size-2 shrink-0 items-center justify-center rounded-full',
          done
            ? 'bg-fg text-bg'
            : next
              ? 'border-accent border-2'
              : cn('border-border-strong border', optional && 'border-dashed'),
        )}
      >
        {done ? <Check size={12} strokeWidth={3} /> : null}
      </span>
      <span
        className={cn(
          'min-w-0 flex-1',
          done ? 'text-muted' : next ? 'font-semibold' : 'font-medium',
        )}
      >
        <InlineCode text={lesson.title} />
      </span>
      <span className={cn('t-figure shrink-0 text-sm', next ? 'text-fg' : 'text-muted')}>
        {done
          ? 'Done'
          : next
            ? `Next · ${lesson.minutes} min`
            : lesson.href
              ? `${lesson.minutes} min`
              : 'Soon'}
      </span>
    </>
  );
  const row = cn(
    'rounded-control flex min-h-5 items-center gap-1.5 px-1 py-1',
    next && 'bg-accent-tint',
  );
  return (
    <li>
      {lesson.href ? (
        <Link
          href={onPath(lesson.href, pathId)}
          className={cn(row, 'transition-press active:scale-98', !next && 'hover:bg-raised')}
        >
          {body}
        </Link>
      ) : (
        <div className={row}>{body}</div>
      )}
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
    <details className={cn('group/fold', className)}>
      <summary
        className={cn(
          'hover:text-fg rounded-control flex cursor-pointer list-none items-center gap-1 transition-colors duration-150 ease-out',
          heading ? 'min-h-6 justify-between' : 'text-muted h-5 w-fit text-sm font-medium',
        )}
      >
        {heading ? <h2 className="t-section">{label}</h2> : null}
        <ChevronDown
          aria-hidden
          size={16}
          strokeWidth={2}
          className={cn(
            'shrink-0 transition-transform duration-150 ease-out group-open/fold:rotate-180',
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
 * so the group stays quiet: hairline rows, no accent, which marks the next lesson. Practice
 * comes first, labs before tests, the order a learner would reach for them.
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
    <section aria-label={`Try it: ${stage}`} className="flex flex-col gap-0.5 pt-1">
      <p className="t-label">
        Try it <span className="text-faint">· optional, recommended</span>
      </p>
      <ol className="-mx-1 flex flex-col">
        <TryRow
          href={practice}
          icon={Repeat2}
          title="Practise this stage"
          detail="Questions from these lessons"
          meta="10 min"
        />
        {shown.map((test) => (
          <TestRow key={test.key} test={test} result={result(test)} />
        ))}
      </ol>
      {rest.length > 0 ? (
        <Fold label={restNoun === 'tasks' ? `${rest.length} more tasks` : `${rest.length} more`}>
          <ol className="-mx-1 flex flex-col">
            {rest.map((test) => (
              <TestRow key={test.key} test={test} result={result(test)} />
            ))}
          </ol>
        </Fold>
      ) : null}
    </section>
  );
}

/**
 * One thing to try, drawn like a lesson row so the stage reads as one list: an icon where
 * the lesson's circle sits, the title, a muted note, and the time or best score on the right.
 */
function TryRow({
  href,
  icon: Icon,
  title,
  detail,
  meta,
  strong = false,
  muted = false,
}: {
  href: string;
  icon: LucideIcon;
  title: string;
  detail: string;
  meta: string;
  strong?: boolean;
  muted?: boolean;
}) {
  return (
    <li>
      <Link
        href={href}
        className="rounded-control hover:bg-raised transition-press flex min-h-5 items-center gap-1.5 px-1 py-1 active:scale-98"
      >
        <span aria-hidden className="text-muted flex size-2 shrink-0 items-center justify-center">
          <Icon size={16} strokeWidth={2} />
        </span>
        <span className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-1.5">
          <span className={cn('font-medium', muted && 'text-muted')}>{title}</span>
          <span className="text-muted text-sm">{detail}</span>
        </span>
        <span
          className={cn('t-figure shrink-0 text-sm', strong ? 'text-fg font-medium' : 'text-muted')}
        >
          {meta}
        </span>
      </Link>
    </li>
  );
}

function TestRow({ test, result }: { test: PathTest; result: string | undefined }) {
  const lab = test.kind === 'lab';
  return (
    <TryRow
      href={test.href}
      icon={lab ? FlaskConical : Timer}
      title={test.title}
      detail={lab ? 'Lab' : `${test.detail ? `${test.detail} · ` : ''}up to ${test.xp} XP`}
      meta={result ? (result === 'Done' ? 'Done' : `Best ${result}`) : `${test.minutes} min`}
      strong={Boolean(result && result !== 'Done')}
      muted={result === 'Done'}
    />
  );
}

/**
 * What the path leaves you able to do, how to answer, how you know you are done without
 * the app, and an honest line on what it leaves out. Folded: it matters at the start and
 * the end, not on every visit.
 */
function AboutPath({ path }: { path: PathSummary }) {
  const { outcomes, readyWhen, proof, coverage, shapes, method } = path;
  return (
    <div className="rule-b flex flex-col">
      {outcomes.length > 0 ? (
        <Fold label="At the end you can" heading className="rule-t py-1">
          <ul className="flex flex-col gap-1 pt-1 pb-2">
            {outcomes.map((outcome) => (
              <li key={outcome} className="flex gap-1">
                <Check aria-hidden size={16} strokeWidth={2} className="mt-0.5 shrink-0" />
                {outcome}
              </li>
            ))}
          </ul>
        </Fold>
      ) : null}
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
              <div className="flex flex-col gap-1">
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
      {shapes.length > 0 ? (
        <Fold label="How to answer" heading className="rule-t py-1">
          <dl className="grid grid-cols-1 gap-x-4 gap-y-2 pt-1 pb-2 md:grid-cols-2">
            {shapes.map((shape) => (
              <div key={shape.label} className="flex flex-col gap-0.5">
                <dt className="font-medium">{shape.label}</dt>
                <dd className="text-muted text-sm">{shape.text}</dd>
              </div>
            ))}
          </dl>
          {method.length > 0 ? (
            <div className="flex flex-col gap-0.5 pb-2">
              <h3 className="font-medium">Each lesson</h3>
              <ol className="text-muted flex list-decimal flex-col gap-0.5 pl-2 text-sm">
                {method.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
            </div>
          ) : null}
        </Fold>
      ) : null}
      {coverage ? (
        <Fold label="What it covers" heading className="rule-t py-1">
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
