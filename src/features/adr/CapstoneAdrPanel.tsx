'use client';

import { PenLine } from 'lucide-react';
import Link from 'next/link';
import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { Button, buttonClass } from '@/components/ui/Button';
import { cn } from '@/lib/cn';
import { useProgress } from '@/features/store/StoreProvider';
import { AdrRecord, adrLabel } from './AdrRecord';

/* The form arrives when the learner opens it: most visits only read the record. */
const AdrForm = lazy(() => import('./AdrForm').then((m) => ({ default: m.AdrForm })));

interface CapstoneAdrPanelProps {
  partId: string;
  /** The part's place in the course, which numbers its record. */
  number: number;
  /** The level of the record's title in the page outline. */
  level: 2 | 3;
}

/**
 * The capstone's decision record, under the capstone: an offer to write one once the
 * capstone is built, the record once it exists, and the form while writing. Optional: the
 * capstone counts as built without it.
 */
export function CapstoneAdrPanel({ partId, number, level }: CapstoneAdrPanelProps) {
  const { status, state } = useProgress();
  const [editing, setEditing] = useState(false);
  const [notice, setNotice] = useState('');
  const opener = useRef<HTMLButtonElement>(null);
  const returnFocus = useRef(false);
  const adr = state.capstoneAdrs[partId];
  const built = state.completedCapstones.has(partId);

  // Back on the button that opened the form, so a keyboard user does not start again at the top.
  useEffect(() => {
    if (editing || !returnFocus.current) return;
    returnFocus.current = false;
    opener.current?.focus();
  }, [editing]);

  function close(message: string) {
    returnFocus.current = true;
    setNotice(message);
    setEditing(false);
  }

  if (status !== 'ready' || (!built && !adr)) return null;

  return (
    <div className="flex w-full flex-col items-start gap-2 pt-1" data-testid="capstone-adr">
      {editing ? (
        <Suspense fallback={<p className="text-muted text-sm">Opening the form</p>}>
          <AdrForm
            partId={partId}
            initial={adr}
            onDone={(saved) => close(saved ? 'Decision record saved.' : 'No changes to save.')}
            onCancel={() => close(adr ? 'Edit cancelled. The saved record is unchanged.' : '')}
          />
        </Suspense>
      ) : (
        <>
          {adr ? (
            <AdrRecord adr={adr} label={adrLabel(number)} level={level} />
          ) : (
            <p className="text-muted prose-measure text-sm">
              What was the main decision you made while building it? A short record of it, with the
              options you weighed, is worth keeping. Optional.
            </p>
          )}
          <div className="flex flex-wrap gap-1">
            <Button
              ref={opener}
              size="md"
              onClick={() => {
                setNotice('');
                setEditing(true);
              }}
            >
              <PenLine aria-hidden size={16} strokeWidth={2} />
              {adr ? 'Edit decision record' : 'Write a decision record'}
            </Button>
            {adr ? (
              <Link href="/decisions" className={buttonClass('quiet', 'md')}>
                All decision records
              </Link>
            ) : null}
          </div>
        </>
      )}
      {/* Always in the tree, so the first message is announced; out of sight while empty. */}
      <p role="status" className={cn('text-muted text-sm', notice === '' && 'sr-only')}>
        {notice}
      </p>
    </div>
  );
}
