'use client';

import { Clock, Laptop, X } from 'lucide-react';
import Link from 'next/link';
import { useId, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { durationLine, LANGUAGE_LABEL, type TestSpec } from '@/core/online-test';
import { useMediaQuery } from '@/features/editor/useMediaQuery';
import { Mark } from './Mark';
import { setPrefs, usePrefs } from './prefs';

interface IntroScreenProps {
  spec: TestSpec;
  exitHref: string;
  /** Starts the test, with the assistant on or off as the candidate chose. */
  onStart: (options: { assistant: boolean; guided: boolean }) => void;
}

/**
 * The page before the test, as the platform lays it out: how long and how many tasks,
 * "Before you begin", help and accessibility, then a box to tick before "Start the test".
 */
export function IntroScreen({ spec, exitHref, onStart }: IntroScreenProps) {
  const [agreed, setAgreed] = useState(false);
  // Employers switch the assistant on per test; here the candidate may, to practise with it.
  const [assistant, setAssistant] = useState(spec.assistant);
  const assistantId = useId();
  const [guided, setGuided] = useState(spec.guided ?? false);
  const guidedId = useId();
  const prefs = usePrefs();
  const phone = useMediaQuery('(max-width: 47.99rem)');
  const agreeId = useId();
  const accessId = useId();
  const languages = spec.languages.map((l) => LANGUAGE_LABEL[l]).join(', ');

  return (
    <div className="bg-bg text-fg min-h-dvh">
      <header className="rule-b bg-surface">
        <div className="frame flex h-7 items-center gap-2">
          <Mark />
          <p className="font-medium">{spec.title}</p>
          <Link
            href={exitHref}
            aria-label="Leave"
            title="Leave"
            className="text-muted hover:text-fg hover:bg-raised rounded-control ml-auto inline-flex size-5 items-center justify-center"
          >
            <X aria-hidden size={20} strokeWidth={2} />
          </Link>
        </div>
      </header>

      <main id="content" className="frame grid grid-cols-4 gap-3 py-4 md:grid-cols-12">
        <div className="col-span-4 flex flex-col gap-3 md:col-span-7">
          <section className="bg-surface border-border rounded-panel flex flex-col gap-2 border p-3">
            <h1 className="t-section">{spec.title}</h1>
            <p className="flex items-center gap-1 text-lg">
              <Clock aria-hidden size={20} strokeWidth={2} className="text-muted" />
              <span className="t-figure font-semibold">{durationLine(spec)}</span>
            </p>
          </section>

          <section
            aria-labelledby="before-title"
            className="bg-surface border-border rounded-panel flex flex-col gap-2 border p-3"
          >
            <h2 id="before-title" className="text-lg font-semibold">
              Before you begin
            </h2>
            <ul className="flex list-disc flex-col gap-1 pl-3">
              <li>
                There is no option to pause. Make sure you will not be interrupted for{' '}
                <span className="t-figure">{spec.minutes}</span> minutes.
              </li>
              <li>
                If you close the browser by accident, come back to this test: your code and the
                clock are where you left them.
              </li>
              <li>
                Run your code as often as you like. Only the example tests run before you submit.
              </li>
              <li>When the time is up, your solutions are saved and submitted automatically.</li>
              <li>You can submit only once. Submitting ends the test for every task.</li>
              <li>
                The AI assistant is in the left rail. Everything you ask it goes into the report, as
                a reviewer would read it.
              </li>
              {spec.proctoring ? (
                <li>
                  This test records pasted code, attempts to copy the task and time away from the
                  tab, as a proctored test does.
                </li>
              ) : null}
              <li>Allowed languages: {languages}.</li>
            </ul>
            {phone ? (
              <p className="text-muted flex items-start gap-1 text-sm">
                <Laptop aria-hidden size={16} strokeWidth={2} className="mt-0.5 shrink-0" />
                The real test does not run on phones. Practise here, and sit it on a laptop.
              </p>
            ) : null}
          </section>
        </div>

        <div className="col-span-4 flex flex-col gap-3 md:col-span-5">
          <section
            aria-labelledby="help-title"
            className="bg-surface border-border rounded-panel flex flex-col gap-2 border p-3"
          >
            <h2 id="help-title" className="text-lg font-semibold">
              Do you need help?
            </h2>
            <p className="text-muted">
              Accessibility mode makes code and output larger. You can switch it in the test too.
            </p>
            <label htmlFor={accessId} className="flex min-h-5 cursor-pointer items-center gap-1">
              <input
                id={accessId}
                type="checkbox"
                checked={prefs.accessibility}
                onChange={(event) => setPrefs({ accessibility: event.target.checked })}
                className="accent-accent size-2"
              />
              Enable accessibility mode
            </label>
          </section>

          <section
            aria-labelledby="ready-title"
            className="bg-surface border-border rounded-panel flex flex-col gap-2 border p-3"
          >
            <h2 id="ready-title" className="text-lg font-semibold">
              Are you ready?
            </h2>
            <label htmlFor={guidedId} className="flex min-h-5 cursor-pointer items-start gap-1">
              <input
                id={guidedId}
                type="checkbox"
                checked={guided}
                onChange={(event) => setGuided(event.target.checked)}
                className="accent-accent mt-0.5 size-2"
              />
              <span>
                Guided mode
                <span className="text-muted block text-sm">
                  A coach walks each task step by step: what to read, what to ask the AI and why,
                  what to write yourself and what to let the AI write.
                </span>
              </span>
            </label>
            <label htmlFor={assistantId} className="flex min-h-5 cursor-pointer items-center gap-1">
              <input
                id={assistantId}
                type="checkbox"
                checked={assistant}
                onChange={(event) => setAssistant(event.target.checked)}
                className="accent-accent size-2"
              />
              Open the AI assistant when the test starts
            </label>
            <label htmlFor={agreeId} className="flex min-h-5 cursor-pointer items-center gap-1">
              <input
                id={agreeId}
                type="checkbox"
                checked={agreed}
                onChange={(event) => setAgreed(event.target.checked)}
                className="accent-accent size-2"
              />
              I have read the rules above
            </label>
            <Button
              variant="primary"
              disabled={!agreed}
              onClick={() => onStart({ assistant, guided })}
            >
              Start the test
            </Button>
          </section>
        </div>
      </main>
    </div>
  );
}
