'use client';

import { X } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { buttonClass } from '@/components/ui/Button';
import { Figure } from '@/components/ui/Figure';
import { buildPathExam, PATH_EXAM_MINUTES } from '@/core/exam';
import { sessionSize } from '@/core/practice/session';
import { useCatalog } from '@/features/catalog/useCatalog';
import { Title } from '@/features/motion/Title';
import { currentDevice } from '@/features/practice/device';
import { SessionRunner } from '@/features/practice/SessionRunner';
import type { PathSummary } from '@/lib/content';
import { certificateHref, examStages, formatLocalDate, percent } from './stages';
import { usePathExam } from './usePathExam';

/**
 * A path's final exam: what it covers and how it is marked, then the run, then the result.
 * Nothing is locked. It can be sat at any time and as often as wanted; the intro only says
 * when it is most worth sitting.
 */
export function ExamView({ path }: { path: PathSummary }) {
  // Each sitting is a fresh runner with a fresh seed; the count is its key.
  const [sitting, setSitting] = useState(0);

  if (sitting > 0) {
    return (
      <SessionRunner
        key={sitting}
        session={{
          kind: 'exam',
          path,
          onRetake: () => {
            setSitting((n) => n + 1);
            window.scrollTo(0, 0);
          },
        }}
      />
    );
  }
  return <ExamIntro path={path} onStart={() => setSitting(1)} />;
}

function ExamIntro({ path, onStart }: { path: PathSummary; onStart: () => void }) {
  const { catalog } = useCatalog();
  const exam = usePathExam(path.id);
  // The real count on this device, once the index is here: a phone leaves out typing steps.
  const questions = catalog
    ? buildPathExam({ catalog, stages: examStages(path), device: currentDevice(), seed: 0 }).length
    : sessionSize(PATH_EXAM_MINUTES);
  const lessons = path.lessonIds.length;

  return (
    <div className="bg-bg text-fg flex min-h-dvh flex-col">
      <header className="rule-b bg-bg sticky top-0 z-20">
        <div className="frame flex h-8 items-center gap-2">
          <Link
            href={`/paths/${path.id}`}
            aria-label="Back to the path"
            title="Back to the path"
            className="text-muted hover:text-fg hover:bg-raised rounded-control -ml-1 inline-flex size-5 shrink-0 items-center justify-center transition-colors duration-150 ease-out"
          >
            <X aria-hidden size={20} strokeWidth={2} />
          </Link>
          <p className="t-label min-w-0 truncate">{path.name}</p>
        </div>
      </header>

      <main id="content" className="frame flex-1 pt-4 pb-20">
        <section aria-labelledby="exam-title" className="flex flex-col gap-6 py-4">
          <div className="flex flex-col gap-2">
            <p className="t-label">Final exam</p>
            <Title id="exam-title">{path.name}</Title>
            <p data-arrive="rise" className="text-muted prose-measure text-lg">
              Questions from every stage of the path, mixed. Score 80% to pass and earn the
              certificate.
            </p>
          </div>

          <div className="flex flex-wrap gap-1">
            <button
              type="button"
              onClick={onStart}
              disabled={questions === 0}
              className={buttonClass('primary', 'lg')}
            >
              Start the exam
            </button>
            {exam.passed ? (
              <Link href={certificateHref(path.id)} className={buttonClass('quiet')}>
                See the certificate
              </Link>
            ) : null}
          </div>
          {questions === 0 ? (
            <p className="text-muted text-sm">This path has no scored steps on this device yet.</p>
          ) : null}

          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 md:grid-cols-4">
            <Figure label="Questions" value={String(questions)} />
            <Figure label="Time, about" value={String(PATH_EXAM_MINUTES)} unit="min" />
            <Figure label="Pass mark" value="80%" />
            <Figure
              label="Best so far"
              value={exam.best ? `${percent(exam.best.right, exam.best.total)}%` : '··'}
              note={
                exam.firstPass
                  ? `Passed on ${formatLocalDate(exam.firstPass.localDate)}`
                  : exam.attempts > 0
                    ? `${exam.attempts} ${exam.attempts === 1 ? 'sitting' : 'sittings'}`
                    : 'Not sat yet'
              }
            />
          </dl>

          <div className="flex flex-col gap-2">
            <h2 className="t-section">What it covers</h2>
            <ol className="border-border rounded-panel divide-border divide-y overflow-hidden border">
              {path.stages.map((stage, i) => (
                <li key={stage.title} className="flex items-baseline justify-between gap-2 p-2">
                  <span className="flex min-w-0 gap-1">
                    <span className="t-figure text-faint shrink-0">{i + 1}</span>
                    <span className="font-medium">{stage.title}</span>
                  </span>
                  <span className="t-label t-figure shrink-0">
                    {stage.lessons.length} {stage.lessons.length === 1 ? 'lesson' : 'lessons'}
                  </span>
                </li>
              ))}
            </ol>
          </div>

          <ul className="text-muted prose-measure flex list-disc flex-col gap-0.5 pl-2 text-sm">
            <li>Nothing is locked. Sit it any time, as often as you like.</li>
            <li>
              It works best after the {lessons} {lessons === 1 ? 'lesson' : 'lessons'}, since it
              asks what they teach.
            </li>
            <li>Every answer is checked by the app. Self-graded steps are left out.</li>
            <li>A step whose content changed is skipped and does not count.</li>
          </ul>
        </section>
      </main>
    </div>
  );
}
