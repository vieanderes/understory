'use client';

import { Download } from 'lucide-react';
import Link from 'next/link';
import { Button, buttonClass } from '@/components/ui/Button';
import {
  adrFileName,
  adrLog,
  adrLogMarkdown,
  adrMarkdown,
  type AdrEntry,
  type AdrPart,
} from '@/core/insight';
import { localDateOf } from '@/features/store/progress-store';
import { useProgress } from '@/features/store/StoreProvider';
import { downloadText } from '@/lib/download';
import { AdrRecord, adrLabel } from './AdrRecord';
import { Title } from '@/features/motion/Title';

/**
 * Every capstone's decision record in one place, in part order, with the whole log and
 * each record as Markdown to keep. Records are written and edited where the capstone is,
 * so this page only reads.
 */
export function AdrLogView({ parts }: { parts: AdrPart[] }) {
  const { status, state } = useProgress();
  const ready = status === 'ready';
  const entries: AdrEntry[] = ready ? adrLog(state, parts) : [];

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-col gap-2">
        <p className="t-label">ADR log</p>
        <Title wait={!ready}>
          {!ready ? (
            'Decision records.'
          ) : (
            <>
              <span className="t-figure">{entries.length}</span>{' '}
              {entries.length === 1 ? 'decision' : 'decisions'}.{' '}
              <span className="text-muted">One per capstone.</span>
            </>
          )}
        </Title>
        <p className="text-muted prose-measure">
          An architecture decision record says what you chose while building a capstone, why, and
          what you gave up. Kept together, they show your reasoning next to the code.
        </p>
        {entries.length > 0 ? (
          <div className="flex flex-wrap gap-1 pt-1">
            <Button
              variant="primary"
              onClick={() =>
                downloadText(
                  'understory-decisions.md',
                  adrLogMarkdown(entries, localDateOf(new Date())),
                )
              }
            >
              <Download aria-hidden size={16} strokeWidth={2} />
              Download all as Markdown
            </Button>
          </div>
        ) : null}
      </header>

      {ready && entries.length === 0 ? (
        <section aria-labelledby="none" className="rule-t flex flex-col items-start gap-2 pt-2">
          <h2 id="none" className="font-medium">
            No decision records yet
          </h2>
          <p className="text-muted prose-measure text-sm">
            Each part ends with a capstone. Once you mark one as built, you can write its record
            there.
          </p>
          <Link href="/learn" className={buttonClass('secondary', 'md')}>
            See the parts
          </Link>
        </section>
      ) : (
        <ol className="flex flex-col">
          {entries.map((entry) => (
            <li
              key={entry.partId}
              className="rule-t grid grid-cols-4 gap-x-4 gap-y-2 py-3 md:grid-cols-12"
            >
              <p className="t-label col-span-4 md:col-span-3">
                Part <span className="t-figure">{String(entry.number).padStart(2, '0')}</span> ·{' '}
                {entry.partTitle}
                <span className="text-muted block normal-case">{entry.capstoneTitle}</span>
              </p>
              <div className="col-span-4 flex flex-col items-start gap-2 md:col-span-9">
                <AdrRecord adr={entry.adr} label={adrLabel(entry.number)} level={2} />
                <div className="flex flex-wrap gap-1">
                  <Button
                    variant="quiet"
                    size="md"
                    onClick={() => downloadText(adrFileName(entry), adrMarkdown(entry))}
                  >
                    <Download aria-hidden size={16} strokeWidth={2} />
                    Download {adrLabel(entry.number)}
                  </Button>
                  <Link href={`/milestone/${entry.partId}`} className={buttonClass('quiet', 'md')}>
                    Edit at the milestone
                  </Link>
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
