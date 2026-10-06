'use client';

import { ArrowRight, ChevronDown } from 'lucide-react';
import Link from 'next/link';
import { useMemo, type ReactNode } from 'react';
import { Ledger, PageHead, type LedgerRow } from '@/components/layout/PageHead';
import { buttonClass } from '@/components/ui/Button';
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
import type { PlanCatalog } from '@/core/plan';
import { useCatalog } from '@/features/catalog/useCatalog';
import { useNow } from '@/features/catalog/useNow';
import { MapView, type MapModule, type MapPart } from '@/features/map/MapView';
import { CELL_STYLE, LEGEND, STATE_LABEL } from '@/features/map/states';
import { Title } from '@/features/motion/Title';
import { CHOSEN_PATH, currentPath } from '@/features/paths/current';
import { customPathSummary, type CourseTree } from '@/features/paths/custom';
import { usePlan } from '@/features/plan/usePlan';
import { useProgress } from '@/features/store/StoreProvider';
import { localDateOf } from '@/features/store/progress-store';
import type { PathSummary } from '@/lib/content';
import { cn } from '@/lib/cn';
import { workCopy } from './copy';
import { setScopeParam, useScopeParam } from './useScopeParam';
import { WeekChart, weekLabel } from './WeekChart';

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
    const paths = state.customPath
      ? [customPathSummary(tree, state.customPath), ...written]
      : written;
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
        <WeekChart weeks={report.weeks} />
        <Disclosure label="Show as a table">
          <WeekTable report={report} />
        </Disclosure>
      </Section>

      <Section id="mastery" title="Mastery" note={masteryNote(report)}>
        <RecallLine report={report} />
        <Legend />
        <MapView
          key={scope.id}
          modules={props.modules}
          parts={props.parts}
          concepts={new Set(scope.conceptIds)}
          folded
        />
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
    { label: 'Goal met, last 8 weeks', short: 'Goal met', value: report.activity.met, unit: '/ 8' },
  ];
  return rows;
}

function ScopePicker({ scopes, value }: { scopes: readonly ProgressScope[]; value: string }) {
  const topics = scopes.filter((s) => s.kind === 'topic');
  const parts = scopes.filter((s) => s.kind === 'part');
  const path = scopes.find((s) => s.kind === 'path');
  return (
    <label className="flex flex-wrap items-center gap-1">
      <span className="t-label">Show</span>
      <span className="relative inline-flex min-w-0">
        <select
          value={value}
          onChange={(e) => setScopeParam(e.target.value)}
          className={cn(
            buttonClass('secondary', 'md'),
            'max-w-full min-w-0 cursor-pointer appearance-none truncate pr-4 text-left',
          )}
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
      className="rule-t flex scroll-mt-12 flex-col gap-3 pt-3"
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
  return <ul className="rule-b flex flex-col">{children}</ul>;
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
    <li className="rule-t">
      <Link
        href={href}
        className="group hover:bg-surface flex min-h-6 items-center gap-2 py-1 transition-colors duration-150 ease-out sm:px-1"
      >
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="group-hover:text-accent font-medium transition-colors duration-150 ease-out">
            {title}
          </span>
          <span className="text-muted text-sm">{detail}</span>
        </span>
        <span className="text-muted group-hover:text-fg inline-flex shrink-0 items-center gap-0.5 text-sm font-medium transition-colors duration-150 ease-out">
          <span className="hidden sm:inline">{action}</span>
          <ArrowRight aria-hidden size={16} strokeWidth={2} />
        </span>
      </Link>
    </li>
  );
}

function WorkOn({ items }: { items: readonly WorkItem[] }) {
  return (
    <section aria-labelledby="work-title" data-arrive="rise" className="flex flex-col gap-2">
      <h2 id="work-title" className="t-section">
        Work on next
      </h2>
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
    </section>
  );
}

function activityNote(report: ProgressReport): string {
  const minutes = report.weeks.reduce((sum, w) => sum + w.minutes, 0);
  const lessons = report.weeks.reduce((sum, w) => sum + w.lessons, 0);
  if (minutes === 0) return 'No lessons or tests in the last eight weeks.';
  return `About ${formatMinutes(minutes)} and ${lessons} ${
    lessons === 1 ? 'lesson' : 'lessons'
  } in eight weeks. Time is estimated from lessons and tests.`;
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

function masteryNote(report: ProgressReport): string {
  const { total, started, solid } = report.concepts;
  return `${started} of ${total} concepts started, ${solid} solid. Memory fades, so this does too: practice brings it back.`;
}

function RecallLine({ report }: { report: ProgressReport }) {
  const { due, fading, holding } = report.recall;
  const items = [
    { label: 'Due now', value: due },
    { label: 'Fading', value: fading, gap: fading > 0 },
    { label: 'Holding', value: holding },
  ];
  return (
    <dl className="grid grid-cols-3 gap-x-4">
      {items.map((item) => (
        <div key={item.label} className="rule-t flex flex-col-reverse gap-0.5 pt-1">
          <dt className="t-label">{item.label}</dt>
          <dd className={cn('t-figure text-lg', item.gap && 'text-accent')}>{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function Legend() {
  return (
    <ul aria-label="How state is shown" className="flex flex-wrap gap-x-3 gap-y-1">
      {LEGEND.map((state) => (
        <li key={state} className="text-muted flex items-center gap-1 text-sm">
          <span aria-hidden className={cn('size-1 shrink-0', CELL_STYLE[state])} />
          {STATE_LABEL[state]}
        </li>
      ))}
    </ul>
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
              value={c.built ? 'Built' : c.ready ? 'Ready' : '··'}
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
  value: string;
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
      <span className="t-figure shrink-0 text-lg">{value}</span>
    </>
  );
  return (
    <li className="rule-t">
      {href ? (
        <Link
          href={href}
          className="hover:bg-surface flex min-h-6 items-center gap-2 py-1 transition-colors duration-150 ease-out sm:px-1"
        >
          {body}
        </Link>
      ) : (
        <div className="flex min-h-6 items-center gap-2 py-1 sm:px-1">{body}</div>
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
