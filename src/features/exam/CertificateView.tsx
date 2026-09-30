'use client';

import { Check, Printer } from 'lucide-react';
import Link from 'next/link';
import { useId } from 'react';
import { Wordmark } from '@/components/brand/Logo';
import { buttonClass } from '@/components/ui/Button';
import { certificateCode, certificateFacts } from '@/core/exam';
import type { PathSummary } from '@/lib/content';
import { cn } from '@/lib/cn';
import { examHref, formatLocalDate, percent } from './stages';
import { useCertificateName } from './useCertificateName';
import { usePathExam } from './usePathExam';

/**
 * A path's certificate of completion. Before the exam is passed it says what earns it; after,
 * it is one sheet that prints to a single page (window.print, then "Save as PDF"). The screen
 * controls around the sheet are hidden on paper.
 */
export function CertificateView({ path }: { path: PathSummary }) {
  const exam = usePathExam(path.id);

  return (
    <div className="flex flex-col gap-4">
      <nav aria-label="Breadcrumb" className="t-label flex gap-1 print:hidden">
        <Link href="/paths" className="hover:text-fg transition-colors duration-150 ease-out">
          Paths
        </Link>
        <span aria-hidden>/</span>
        <Link
          href={`/paths/${path.id}`}
          className="hover:text-fg transition-colors duration-150 ease-out"
        >
          {path.name}
        </Link>
      </nav>
      {!exam.ready ? (
        <p className="t-label">Loading</p>
      ) : exam.firstPass ? (
        <Issued path={path} attempt={exam.firstPass} />
      ) : (
        <NotYet path={path} best={exam.best} attempts={exam.attempts} />
      )}
    </div>
  );
}

function NotYet({
  path,
  best,
  attempts,
}: {
  path: PathSummary;
  best: { right: number; total: number } | undefined;
  attempts: number;
}) {
  return (
    <section aria-labelledby="certificate-title" className="flex flex-col gap-3">
      <h1 id="certificate-title" className="t-title" data-arrive="title">
        Pass the final exam to earn the certificate.
      </h1>
      <p data-arrive="rise" className="text-muted prose-measure text-lg">
        Score 80% or more on the exam for {path.name}. It takes about 20 minutes, covers the{' '}
        {path.lessonIds.length} lessons of the path, and is open now.
      </p>
      {best ? (
        <p className="t-figure text-sm">
          Best so far {percent(best.right, best.total)}%
          <span className="text-muted">
            {' '}
            · {attempts} {attempts === 1 ? 'sitting' : 'sittings'}
          </span>
        </p>
      ) : null}
      <div className="flex flex-wrap gap-1 pt-1">
        <Link href={examHref(path.id)} className={buttonClass('primary', 'lg')}>
          Sit the final exam
        </Link>
        <Link href={`/paths/${path.id}`} className={buttonClass('quiet')}>
          Back to the path
        </Link>
      </div>
    </section>
  );
}

function Issued({
  path,
  attempt,
}: {
  path: PathSummary;
  attempt: NonNullable<ReturnType<typeof usePathExam>['firstPass']>;
}) {
  const [name, setName] = useCertificateName();
  const nameId = useId();
  const code = certificateCode(certificateFacts(path.id, attempt));
  const passedOn = formatLocalDate(attempt.localDate);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 print:hidden">
        <h1 className="t-section">Your certificate</h1>
        <div className="flex flex-col gap-2 md:flex-row md:items-end">
          <div className="flex min-w-0 flex-col gap-0.5 md:w-40">
            <label htmlFor={nameId} className="text-sm font-medium">
              Name on the certificate
            </label>
            <input
              id={nameId}
              type="text"
              autoComplete="name"
              spellCheck={false}
              maxLength={80}
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="bg-surface border-border-strong rounded-control focus-visible:border-accent h-5 w-full border px-1.5 transition-colors duration-150 ease-out"
            />
          </div>
          <button
            type="button"
            onClick={() => window.print()}
            className={buttonClass('primary', 'md')}
          >
            <Printer aria-hidden size={16} strokeWidth={2} />
            Download PDF
          </button>
        </div>
        <p className="text-muted text-sm">
          The name stays on this device. In the print dialogue, choose Save as PDF.
        </p>
      </div>

      <article
        aria-label={`Certificate of completion for ${path.name}`}
        className="certificate-sheet bg-surface border-border rounded-panel shadow-edge flex flex-col gap-6 border p-3 md:p-8"
      >
        <header className="flex items-center justify-between gap-2">
          <Wordmark />
          <p className="t-label">Certificate of completion</p>
        </header>

        <div className="flex flex-col gap-2">
          <p className="t-label">This certifies that</p>
          <p className={cn('t-title break-words', !name && 'text-faint')}>{name || 'Your name'}</p>
          <p className="text-muted text-lg">
            completed the learning path <span className="text-fg font-semibold">{path.name}</span>
          </p>
          <p className="text-muted prose-measure">{path.title}</p>
        </div>

        <dl className="rule-t grid grid-cols-2 gap-x-4 gap-y-2 pt-2 md:grid-cols-3">
          <div className="flex flex-col gap-0.5">
            <dt className="t-label">Passed on</dt>
            <dd className="t-figure font-medium">{passedOn}</dd>
          </div>
          <div className="flex flex-col gap-0.5">
            <dt className="t-label">Final exam</dt>
            <dd className="t-figure font-medium">
              {percent(attempt.right, attempt.total)}%
              <span className="text-muted font-normal">
                {' '}
                · {attempt.right} of {attempt.total}
              </span>
            </dd>
          </div>
          <div className="flex flex-col gap-0.5">
            <dt className="t-label">Lessons</dt>
            <dd className="t-figure font-medium">
              {attempt.lessonIds.length}
              <span className="text-muted font-normal"> in {path.stages.length} stages</span>
            </dd>
          </div>
        </dl>

        <section aria-labelledby="certifies-title" className="flex flex-col gap-1">
          <h2 id="certifies-title" className="t-label">
            What this certifies
          </h2>
          {path.proof ? <p className="font-medium">{path.proof.title}</p> : null}
          <ul className="flex flex-col gap-0.5">
            {path.outcomes.map((outcome) => (
              <li key={outcome} className="text-muted flex gap-1 text-sm">
                <Check aria-hidden size={16} strokeWidth={2} className="text-fg mt-0.5 shrink-0" />
                {outcome}
              </li>
            ))}
          </ul>
        </section>

        <footer className="certificate-foot rule-t flex flex-col gap-2 pt-2 md:flex-row md:items-end md:justify-between">
          <div className="flex flex-col gap-0.5">
            <p className="t-label">Verification code</p>
            <p className="font-mono text-base font-medium tracking-normal">{code}</p>
          </div>
          <p className="text-muted max-w-40 text-sm md:text-right">
            Certificate of completion from Understory. It is not an accredited qualification.
          </p>
        </footer>
      </article>
    </div>
  );
}
