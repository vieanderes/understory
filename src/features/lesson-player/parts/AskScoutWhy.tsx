'use client';

import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { editorRequest, stuckQuestion, type EditorInput, type StuckInput } from '@/core/scout';
import { ScoutMark } from '@/features/tutor/ScoutMark';
import { askTutor, useTutorAvailable } from '@/features/tutor/tutor-store';

/*
 * Scout from a step, wherever Scout is allowed (never in an exam).
 *
 * After a wrong answer or a failing run: Scout as the Tutor, starting from what the learner
 * did (docs/SCOUT-ROLES.md, section 6). Absent wherever Scout is, such as an exam.
 */
export function AskScoutWhy(props: StuckInput) {
  const scout = useTutorAvailable(usePathname());
  if (!scout) return null;
  return (
    <div>
      <Button variant="secondary" size="md" onClick={() => askTutor(stuckQuestion(props), 'stuck')}>
        <ScoutMark size={16} />
        Ask Scout why
      </Button>
    </div>
  );
}

/**
 * After a passing run: Scout as the Editor reads the code (docs/SCOUT-ROLES.md, section 7).
 * The step keeps what was sent, so it outlives this button between runs: a second request
 * carries the code sent before, and Scout says what changed.
 */
export function AskScoutReview({
  sent,
  onSent,
  ...props
}: Omit<EditorInput, 'previous'> & {
  sent: string | null;
  onSent: (code: string) => void;
}) {
  const scout = useTutorAvailable(usePathname());
  if (!scout) return null;
  const review = () => {
    const revised = sent !== null && sent.trim() !== props.work.trim();
    askTutor(editorRequest({ ...props, ...(revised ? { previous: sent } : {}) }), 'work');
    onSent(props.work);
  };
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
      <Button variant="secondary" size="md" onClick={review}>
        <ScoutMark size={16} />
        Ask Scout to review
      </Button>
      <p className="text-muted text-sm">Sends your code to Scout.</p>
    </div>
  );
}
