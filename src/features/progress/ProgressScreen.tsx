'use client';

import { ArrowRight, ChevronDown } from 'lucide-react';
import Link from 'next/link';
import { useMemo, type ReactNode } from 'react';
import { Ledger, PageHead, type LedgerRow } from '@/components/layout/PageHead';
import { buttonClass } from '@/components/ui/Button';
import { rowAction, rowArrow, rowItem, rowList } from '@/components/ui/rows';
import {
  formatMinutes,
  progressReport,
  progressScopes,
  resolveScope,
  type ProgressReport,
  type ProgressScope,
  type ScopePath,
  type TestCatalogEntry,
  type WorkItem,
} from '@/core/insight';
import type { MasteryState } from '@/core/mastery';
import type { PlanCatalog } from '@/core/plan';
import { useCatalog } from '@/features/catalog/useCatalog';
import { useNow } from '@/features/catalog/useNow';
import { MapView, type MapModule, type MapPart } from '@/features/map/MapView';
import { CELL_STYLE, LEGEND, STATE_LABEL } from '@/features/map/states';
import { Title } from '@/features/motion/Title';
import { CHOSEN_PATH, currentPath } from '@/features/paths/current';
import { withOwnPaths, type CourseTree } from '@/features/paths/custom';
import { usePlan } from '@/features/plan/usePlan';
import { useProgress } from '@/features/store/StoreProvider';
import { localDateOf } from '@/features/store/progress-store';
import type { PathSummary } from '@/lib/content';
import { cn } from '@/lib/cn';
import { workCopy } from './copy';
import { setScopeParam, useScopeParam } from './useScopeParam';
import { WeekBaseline, WeekChart, weekLabel } from './WeekChart';

const DATE = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const dateOf = (localDate: string) => DATE.format(new Date(`${localDate}T12:00:00Z`));

const toScopePath = (path: PathSummary): ScopePath => ({
  id: path.id,
  name: path.name,
  lessonIds: path.lessonIds,
  timedTests: path.practice.some((p) => p.href.startsWith('/practise/online-test')),
});

/** Chapters past this fold away, so a long scope is not a wall of rows. */
const SHOWN_CHAPTERS = 5;

export interface ProgressScreenProps {
  paths: readonly PathSummary[];
  planCatalog: PlanCatalog;
  tree: CourseTree;
  modules: MapModule[];
  parts: MapPart[];
  tests: readonly TestCatalogEntry[];
}

/**
 * Where the learner stands: a few figures, the one thing to do next, then activity, mastery,
 * results and what is untouched, each for the scope picked at the top. Detail folds away,
 * so the first screen answers "how am I doing and what now" and nothing more.
 */
export function ProgressScreen(props: ProgressScreenProps) {
  const { paths: written, planCatalog, tree, tests } = props;
  const { status, state } = useProgress();
  const { catalog, failed } = useCatalog();
  const planState = usePlan(planCatalog);
  const now = useNow();
  const scopeId = useScopeParam();
  const ready = status === 'ready' && catalog !== null && now !== null;

  const scopes = useMemo(() => {
    if (!ready) return null;
    const isDone = (id: string) => state.completedLessons.has(id);
    const paths = withOwnPaths(tree, state.ownPaths, written);
    const path = currentPath(paths, planState, isDone, state.settings[CHOSEN_PATH]);
    return progressScopes({
      catalog,
      path: path ? toScopePath(path) : undefined,
      paths: written.map(toScopePath),
      interests: state.profile?.interests ?? [],
    });
  }, [ready, state, catalog, tree, written, planState]);

  const scope = scopes ? resolveScope(scopes, scopeId) : null;
  const report = useMemo(
    () =>
      ready && scope
        ? progressReport({
            catalog,
            state,
            now,
            today: localDateOf(now),
            scope,
            tests,
            pathNames: Object.fromEntries(written.map((p) => [p.id, p.name])),
          })
        : null,
    [ready, scope, catalog, state, now, tests, written],
  );

  if (failed) {
    return (
      <div className="flex flex-col gap-3">
        <PageHead label="Progress" title={<Title>Progress</Title>} />
        <p className="text-muted">
          The course index did not load. Check the connection and reload.
        </p>
      </div>
    );
  }

  if (!report || !scope || !scopes) {
    return (
      <div className="flex flex-col gap-3">
        <PageHead label="Progress" title={<Title wait>Progress</Title>} />
        <p className="text-muted">Reading your progress...</p>
      </div>
    );
  }

  if (!report.started) return <FirstVisit report={report} />;

  return (
    <div className="flex flex-col gap-6 md:gap-8">
      <div className="flex flex-col gap-4 md:gap-6">
        <PageHead
          label="Progress"
          title={
            <Title>
              <span className="t-figure">{report.lessons.done}</span> of{' '}
              <span className="t-figure">{report.lessons.total}</span> lessons.{' '}
              <span className="text-muted">{headline(report)}</span>
            </Title>
          }
          actions={<ScopePicker scopes={scopes} value={scope.id} />}
          aside={<Ledger rows={ledgerRows(report)} />}
        />
        {report.next ? <NextUp item={report.next} /> : <AllDone scope={scope} />}
      </div>

      {report.workOn.length > 1 ? <WorkOn items={report.workOn.slice(1)} /> : null}

      <Section id="activity" title="Activity" note={activityNote(report)}>
        {report.activity.active ? (
          <>
            <WeekChart weeks={report.weeks} />
            <Disclosure label="Show as a table">
              <WeekTable report={report} />
            </Disclosure>
          </>
        ) : (
          <WeekBaseline weeks={report.weeks} />
        )}
      </Section>

      <Section
        id="mastery"
        title="Mastery"
        note="Memory fades, so this does too. Practice brings it back."
      >
        <MasteryOverview report={report} scope={scope} />
        <div className="pt-2 md:pt-3">
          <MapView
            key={scope.id}
            modules={props.modules}
            parts={props.parts}
            concepts={new Set(scope.conceptIds)}
            folded
          />
        </div>
      </Section>

      <Results report={report} scope={scope} />

      {report.notStarted.length > 0 ? (
        <Section
          id="not-started"
          title="Not started yet"
          note={`${report.notStarted.length} ${
            report.notStarted.length === 1 ? 'chapter' : 'chapters'
          } with no lesson done.`}
        >
          <RowList>
            {report.notStarted.slice(0, SHOWN_CHAPTERS).map((c) => (
              <ChapterRow key={c.id} chapter={c} />
            ))}
          </RowList>
          {report.notStarted.length > SHOWN_CHAPTERS ? (
            <Disclosure label={`Show ${report.notStarted.length - SHOWN_CHAPTERS} more`}>
              <RowList>
                {report.notStarted.slice(SHOWN_CHAPTERS).map((c) => (
                  <ChapterRow key={c.id} chapter={c} />
                ))}
              </RowList>
            </Disclosure>
          ) : null}
        </Section>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// The head
// ---------------------------------------------------------------------------

function headline(report: ProgressReport): string {
  const { solid, total } = report.concepts;
  if (total === 0) return '';
  return `${solid} of ${total} concepts solid.`;
}

function ledgerRows(report: ProgressReport): LedgerRow[] {
  const week = report.weeks.at(-1);
  const rows: LedgerRow[] = [
    {
      label: 'Lessons left',
      short: 'Left',
      value: report.lessons.total - report.lessons.done,
      unit: report.lessons.minutesLeft > 0 ? formatMinutes(report.lessons.minutesLeft) : undefined,
    },
    report.concepts.gaps > 0
      ? { label: 'Gaps', value: report.concepts.gaps, gap: true }
      : { label: 'Due for review', short: 'Due', value: report.recall.due },
    {
      label: 'This week',
      short: 'Week',
      value: week?.xp ?? 0,
      unit: `/ ${report.activity.goal} XP`,
    },
    { label: 'Weeks at goal', short: 'At goal', value: report.activity.met, unit: '/ 8' },
  ];
  return rows;
}

function ScopePicker({ scopes, value }: { scopes: readonly ProgressScope[]; value: string }) {
  const topics = scopes.filter((s) => s.kind === 'topic');
  const parts = scopes.filter((s) => s.kind === 'part');
  const path = scopes.find((s) => s.kind === 'path');
  return (
    <label className="flex max-w-full min-w-0 items-center gap-1">
      <span className="t-label shrink-0">Show</span>
      <span className="relative inline-flex min-w-0">
        <select
          value={value}
          onChange={(e) => setScopeParam(e.target.value)}
          className="border-border hover:border-border-strong rounded-control h-5 max-w-full min-w-0 cursor-pointer appearance-none truncate border bg-transparent pr-4 pl-1 text-left font-medium transition-colors duration-150 ease-out"
        >
          <option value="all">Everything</option>
          {path ? <option value="path">My path: {path.label}</option> : null}
          {topics.length > 0 ? (
            <optgroup label="My interests">
              {topics.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </optgroup>
          ) : null}
          <optgroup label="One part">
            {parts.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </optgroup>
        </select>
        <ChevronDown
          aria-hidden
          size={16}
          strokeWidth={2}
          className="text-muted pointer-events-none absolute top-1/2 right-1 -translate-y-1/2"
        />
      </span>
    </label>
  );
}

function NextUp({ item }: { item: WorkItem }) {
  const copy = workCopy(item);
  return (
    <section
      aria-labelledby="next-title"
      data-arrive="rise"
      className="bg-surface border-border rounded-panel flex flex-col gap-2 border p-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:p-3"
    >
      <div className="flex min-w-0 flex-col gap-0.5">
        <p className="t-label">Most useful now</p>
        <h2 id="next-title" className="text-lg font-semibold">
          {copy.title}
        </h2>
        <p className="text-muted text-sm">{copy.detail}</p>
      </div>
      <Link href={item.href} className={buttonClass('primary', 'lg', 'w-full shrink-0 sm:w-auto')}>
        {copy.action}
        <ArrowRight aria-hidden size={16} strokeWidth={2} />
      </Link>
    </section>
  );
}

function AllDone({ scope }: { scope: ProgressScope }) {
  return (
    <p data-arrive="rise" className="text-muted rule-t pt-2">
      Nothing open in {scope.kind === 'all' ? 'the course' : scope.label}. Practice keeps it held.{' '}
      <Link href="/practise" className="text-fg underline underline-offset-4">
        Practise
      </Link>
    </p>
  );
}

function FirstVisit({ report }: { report: ProgressReport }) {
  return (
    <div className="flex flex-col gap-4 md:gap-6">
      <PageHead
        label="Progress"
        title={<Title>Nothing to count yet.</Title>}
        lede="Finish a first lesson and this page fills in: what you did, what holds and what to work on next."
      />
      {report.next ? <NextUp item={report.next} /> : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sections
// ---------------------------------------------------------------------------

function Section({
  id,
  title,
  note,
  children,
}: {
  id: string;
  title: string;
  note?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-title`}
      data-arrive="rise"
      className="flex scroll-mt-12 flex-col gap-3"
    >
      <div className="flex flex-col gap-0.5">
        <h2 id={`${id}-title`} className="t-section">
          {title}
        </h2>
        {note ? <p className="text-muted prose-measure">{note}</p> : null}
      </div>
      {children}
    </section>
  );
}

function Disclosure({ label, children }: { label: string; children: ReactNode }) {
  return (
    <details className="group">
      <summary className="text-muted hover:text-fg rounded-control inline-flex min-h-5 cursor-pointer list-none items-center gap-0.5 text-sm font-medium transition-colors duration-150 ease-out">
        {label}
        <ChevronDown
          aria-hidden
          size={16}
          strokeWidth={2}
          className="transition-transform duration-150 ease-out group-open:rotate-180"
        />
      </summary>
      <div className="pt-1">{children}</div>
    </details>
  );
}

function RowList({ children }: { children: ReactNode }) {
  return <ul className={rowList()}>{children}</ul>;
}

function LinkRow({
  href,
  title,
  detail,
  action,
}: {
  href: string;
  title: string;
  detail: ReactNode;
  action: string;
}) {
  return (
    <li className={rowItem}>
      <Link href={href} className={rowAction()}>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="font-medium">{title}</span>
          <span className="text-muted text-sm">{detail}</span>
        </span>
        <span className="text-muted group-hover:text-fg inline-flex shrink-0 items-center gap-1 text-sm transition-colors duration-150 ease-out">
          <span className="hidden sm:inline">{action}</span>
          <ArrowRight aria-hidden size={16} strokeWidth={2} className={rowArrow} />
        </span>
      </Link>
    </li>
  );
}

function WorkOn({ items }: { items: readonly WorkItem[] }) {
  return (
    <Section id="work-on" title="Work on next">
      <RowList>
        {items.map((item) => {
          const copy = workCopy(item);
          return (
            <LinkRow
              key={`${item.kind}-${item.title}`}
              href={item.href}
              title={copy.title}
              detail={copy.detail}
              action={copy.action}
            />
          );
        })}
      </RowList>
    </Section>
  );
}

function activityNote(report: ProgressReport): string {
  const minutes = report.weeks.reduce((sum, w) => sum + w.minutes, 0);
  const lessons = report.weeks.reduce((sum, w) => sum + w.lessons, 0);
  if (!report.activity.active) {
    return `Nothing in the last eight weeks yet. Your goal is ${report.activity.goal} XP a week.`;
  }
  if (minutes === 0) return 'Reviews and practice only, no lessons or tests in eight weeks.';
  return `About ${formatMinutes(minutes)} over ${lessons} ${
    lessons === 1 ? 'lesson' : 'lessons'
  } in eight weeks, estimated from lessons and tests.`;
}

function WeekTable({ report }: { report: ProgressReport }) {
  return (
    <table className="w-full">
      <caption className="sr-only">Activity per week</caption>
      <thead>
        <tr className="rule-b text-left">
          <th scope="col" className="t-label pb-1 font-normal">
            Week of
          </th>
          <th scope="col" className="t-label pb-1 text-right font-normal">
            Lessons
          </th>
          <th scope="col" className="t-label pb-1 text-right font-normal">
            Time
          </th>
          <th scope="col" className="t-label pb-1 text-right font-normal">
            XP
          </th>
          <th scope="col" className="t-label pb-1 text-right font-normal">
            Goal
          </th>
        </tr>
      </thead>
      <tbody>
        {[...report.weeks].reverse().map((week) => (
          <tr key={week.weekKey} className="rule-b">
            <th scope="row" className="py-1 text-left font-normal">
              {weekLabel(week)}
            </th>
            <td className="t-figure py-1 text-right text-sm">{week.lessons}</td>
            <td className="t-figure py-1 text-right text-sm">{formatMinutes(week.minutes)}</td>
            <td className="t-figure py-1 text-right text-sm">{week.xp}</td>
            <td className="text-muted py-1 text-right text-sm">{week.met ? 'Met' : '··'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

type Bucket = (typeof LEGEND)[number];

/** The bar's order, firmest first. Unseen is what is left, drawn last as the track. */
const OVERVIEW: readonly Bucket[] = ['fluent', 'solid', 'practised', 'assumed', 'gap', 'unseen'];

const bucketOf = (state: MasteryState): Bucket => (state === 'introduced' ? 'practised' : state);

/**
 * Every concept in scope as one bar, firmest first, with the legend and its counts inline,
 * so an empty scope reads as a measured start and not as a row of zeros. Recall joins the
 * line once there is a card to recall.
 */
function MasteryOverview({ report, scope }: { report: ProgressReport; scope: ProgressScope }) {
  const ids = new Set(scope.conceptIds);
  const counts = new Map<Bucket, number>(LEGEND.map((s) => [s, 0]));
  let seen = 0;
  for (const view of report.views) {
    if (!ids.has(view.id) || view.state === 'unseen') continue;
    const bucket = bucketOf(view.state);
    counts.set(bucket, (counts.get(bucket) ?? 0) + 1);
    seen += 1;
  }
  const total = report.concepts.total;
  counts.set('unseen', Math.max(0, total - seen));
  const { due, fading, holding } = report.recall;
  const recall = [
    { label: 'Due now', value: due, gap: false },
    { label: 'Fading', value: fading, gap: fading > 0 },
    { label: 'Holding', value: holding, gap: false },
  ];
  const summary = LEGEND.map((s) => `${STATE_LABEL[s]} ${counts.get(s) ?? 0}`).join(', ');

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className="flex items-baseline gap-1">
          <span className="t-figure text-lg">{report.concepts.started}</span>
          <span className="text-muted text-sm">
            of <span className="t-figure">{total}</span> concepts started
          </span>
        </p>
        {due + fading + holding > 0 ? (
          <dl className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            {recall.map((item) => (
              <div key={item.label} className="flex items-baseline gap-1">
                <dt className="t-label">{item.label}</dt>
                <dd className={cn('t-figure', item.gap && 'text-accent')}>{item.value}</dd>
              </div>
            ))}
          </dl>
        ) : null}
      </div>
      <div
        role="img"
        aria-label={`Concepts by state: ${summary}.`}
        className="flex h-1 w-full gap-0.5"
      >
        {OVERVIEW.map((state) => {
          const count = counts.get(state) ?? 0;
          return count === 0 ? null : (
            <span
              key={state}
              className={cn('rounded-inner h-full min-w-1', CELL_STYLE[state])}
              style={{ flexGrow: count, flexBasis: 0 }}
            />
          );
        })}
      </div>
      <ul aria-hidden className="flex flex-wrap gap-x-3 gap-y-1">
        {LEGEND.map((state) => {
          const count = counts.get(state) ?? 0;
          return (
            <li key={state} className="text-muted flex items-center gap-1 text-sm">
              <span className={cn('size-1 shrink-0', CELL_STYLE[state])} />
              {STATE_LABEL[state]}
              <span className={cn('t-figure', count > 0 ? 'text-fg' : 'text-faint')}>{count}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Results({ report, scope }: { report: ProgressReport; scope: ProgressScope }) {
  const { tests, exams, testOuts, capstones } = report;
  const hasTests = scope.timedTests;
  if (!hasTests && exams.length === 0 && testOuts.length === 0 && capstones.length === 0) {
    return null;
  }
  const sat = tests.sittings.length;
  return (
    <Section
      id="results"
      title="Tests and exams"
      note={
        sat > 0
          ? `${sat} timed ${sat === 1 ? 'test' : 'tests'} sat. Scores are the share of hidden tests passed.`
          : undefined
      }
    >
      {hasTests ? (
        tests.byTest.length > 0 ? (
          <div className="flex flex-col gap-1">
            <table className="w-full">
              <caption className="sr-only">Timed coding tests</caption>
              <thead>
                <tr className="rule-b text-left">
                  <th scope="col" className="t-label pb-1 font-normal">
                    Coding test
                  </th>
                  <th
                    scope="col"
                    className="t-label hidden pb-1 text-right font-normal sm:table-cell"
                  >
                    Scores
                  </th>
                  <th scope="col" className="t-label pb-1 text-right font-normal">
                    Best
                  </th>
                </tr>
              </thead>
              <tbody>
                {tests.byTest.map((t) => (
                  <tr key={t.testKey} className="rule-b">
                    <th scope="row" className="py-1 pr-2 text-left font-normal">
                      <Link
                        href={t.href}
                        className="hover:text-accent font-medium transition-colors duration-150 ease-out"
                      >
                        {t.title}
                      </Link>
                      <span className="text-muted block text-sm">
                        {t.sittings} {t.sittings === 1 ? 'sitting' : 'sittings'}, last {t.last}%
                      </span>
                    </th>
                    <td className="t-figure text-muted hidden py-1 text-right text-sm sm:table-cell">
                      {t.trend.slice(-5).join(' · ')}
                    </td>
                    <td className="t-figure py-1 text-right text-lg">{t.best}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Disclosure label={`Every sitting (${sat})`}>
              <RowList>
                {tests.sittings.map((s) => (
                  <li key={s.attemptId} className="rule-t flex items-baseline gap-2 py-1">
                    <span className="t-figure text-muted w-8 shrink-0 text-sm">{dateOf(s.on)}</span>
                    <span className="min-w-0 flex-1">
                      {s.title}
                      {s.guided ? <span className="text-muted text-sm"> · guided</span> : null}
                    </span>
                    <span className="t-figure text-sm">{s.score}%</span>
                  </li>
                ))}
              </RowList>
            </Disclosure>
          </div>
        ) : tests.neverSat[0] ? (
          <RowList>
            <LinkRow
              href={tests.neverSat[0].href}
              title={tests.neverSat[0].title}
              detail="No timed test sat yet. Start with this one."
              action="Sit test"
            />
          </RowList>
        ) : null
      ) : null}

      {exams.length + testOuts.length + capstones.length > 0 ? (
        <RowList>
          {exams.map((e) => (
            <ResultRow
              key={e.pathId}
              label="Final exam"
              title={e.name}
              value={`${e.best}%`}
              detail={`${e.passed ? 'Passed' : 'Not passed yet'} · ${e.sittings} ${
                e.sittings === 1 ? 'sitting' : 'sittings'
              }, last ${dateOf(e.lastOn)}`}
              href={e.href}
            />
          ))}
          {testOuts.map((t) => (
            <ResultRow
              key={t.id}
              label="Test-out"
              title={t.title}
              value={`${t.best}%`}
              detail={`${t.passed ? 'Passed' : 'Not passed yet'} · ${t.sittings} ${
                t.sittings === 1 ? 'sitting' : 'sittings'
              }`}
            />
          ))}
          {capstones.map((c) => (
            <ResultRow
              key={c.partId}
              label="Capstone"
              title={c.title}
              value={c.built ? 'Built' : c.ready ? 'Ready' : undefined}
              detail={
                c.built
                  ? c.written
                    ? 'Built, with a decision record'
                    : 'Built. No decision record yet'
                  : c.ready
                    ? 'Every lesson of the part is done'
                    : 'Opens when the part is done'
              }
              href={c.href}
            />
          ))}
        </RowList>
      ) : null}
    </Section>
  );
}

function ResultRow({
  label,
  title,
  value,
  detail,
  href,
}: {
  label: string;
  title: string;
  value?: string;
  detail: string;
  href?: string;
}) {
  const body = (
    <>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="t-label">{label}</span>
        <span className="font-medium">{title}</span>
        <span className="text-muted text-sm">{detail}</span>
      </span>
      {value ? <span className="t-figure shrink-0 text-lg">{value}</span> : null}
    </>
  );
  return (
    <li className={rowItem}>
      {href ? (
        <Link href={href} className={rowAction()}>
          {body}
        </Link>
      ) : (
        <div className="flex min-h-6 items-center gap-2 py-1.5">{body}</div>
      )}
    </li>
  );
}

function ChapterRow({ chapter }: { chapter: ProgressReport['notStarted'][number] }) {
  return (
    <LinkRow
      href={chapter.href}
      title={chapter.title}
      detail={`${chapter.lessons} ${chapter.lessons === 1 ? 'lesson' : 'lessons'} · about ${formatMinutes(
        chapter.minutes,
      )}`}
      action="Start"
    />
  );
}
