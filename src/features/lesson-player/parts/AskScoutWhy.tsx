'use client';

import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { stuckQuestion, type StuckInput } from '@/core/scout';
import { ScoutMark } from '@/features/tutor/ScoutMark';
import { askTutor, useTutorAvailable } from '@/features/tutor/tutor-store';

/*
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
