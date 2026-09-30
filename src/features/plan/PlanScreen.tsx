'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { PLAN_GOALS, type PlanCatalog, type PlanGoal } from '@/core/plan';
import { useProgress } from '@/features/store/StoreProvider';
import { PlanSetup } from './PlanSetup';
import { PlanView } from './PlanView';

function Screen({ catalog }: { catalog: PlanCatalog }) {
  const { status, state } = useProgress();
  const query = useSearchParams();
  const asked = query.get('goal');
  const goal = PLAN_GOALS.find((g) => g === asked) as PlanGoal | undefined;
  const [editing, setEditing] = useState(false);

  if (status !== 'ready') return <p className="text-muted py-4">Reading your progress...</p>;
  if (!state.plan || editing) {
    return (
      <PlanSetup
        catalog={catalog}
        initial={editing ? state.plan : undefined}
        initialGoal={goal}
        onDone={() => setEditing(false)}
        {...(editing ? { onCancel: () => setEditing(false) } : {})}
      />
    );
  }
  return <PlanView catalog={catalog} onChange={() => setEditing(true)} />;
}

/** /plan: the setup when there is no plan, the plan when there is. */
export function PlanScreen({ catalog }: { catalog: PlanCatalog }) {
  return (
    <div className="py-4 md:py-6">
      <Suspense fallback={null}>
        <Screen catalog={catalog} />
      </Suspense>
    </div>
  );
}
