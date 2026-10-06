'use client';

import { ArrowRight } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { buttonClass } from '@/components/ui/Button';
import { parsePlanOffer } from '@/core/planner/protocol';
import { setAssistantDraft } from '@/features/online-test/assistant-draft';
import { ScoutMark } from '../ScoutMark';
import { isPlanRoute, NEW_PLAN_HREF, openScoutPlanner, startPlanning } from './planner-store';

/*
 * Scout's offer, away from the builder, to plan a path together: a button that opens the
 * builder with Scout planning beside it, a new plan with what the learner said waiting in
 * the question box to send.
 */
export function PlanOffer({ body, live }: { body: string; live: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const offer = parsePlanOffer(body);
  if (!offer) return null;
  const go = () => {
    if (offer.brief) setAssistantDraft(offer.brief);
    if (isPlanRoute(pathname)) {
      startPlanning(undefined);
      openScoutPlanner();
    } else router.push(NEW_PLAN_HREF);
  };
  return (
    <div className="py-0.5">
      <button
        type="button"
        onClick={go}
        disabled={!live}
        className={buttonClass('secondary', 'md', 'gap-1')}
      >
        <ScoutMark size={16} />
        Plan it with Scout
        <ArrowRight aria-hidden size={16} strokeWidth={2} />
      </button>
    </div>
  );
}
