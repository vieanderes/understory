'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { PLAN_GOALS, type PlanCatalog, type PlanGoal } from '@/core/plan';
import { useProgress } from '@/features/store/StoreProvider';
import { PlanSetup } from './PlanSetup';
import { PlanView } from './PlanView';

function Screen({ catalog }: { catalog: PlanCatalog }) {
  const { status, state } = useProgress();
  const router = useRouter();
  const query = useSearchParams();
  const asked = query.get('goal');
  const goal = PLAN_GOALS.find((g) => g === asked) as PlanGoal | undefined;
  const [editing, setEditing] = useState(query.has('edit'));

  if (status !== 'ready') return <p className="text-muted py-4">Reading your progress...</p>;
  const firstTime = !state.plan && !state.profile;
  if (!state.plan || editing) {
    return (
      <PlanSetup
        catalog={catalog}
        initial={state.plan}
        initialProfile={state.profile}
        initialGoal={goal}
        onDone={() => {
          setEditing(false);
          // A first setup, or one that ends without a plan, goes to Home: that is where the
          // answers show. Changing a plan stays here to show the new one.
          if (firstTime || !state.plan) router.push('/');
        }}
        {...(!firstTime
          ? { onCancel: () => (state.plan ? setEditing(false) : router.back()) }
          : {})}
      />
    );
  }
  return <PlanView catalog={catalog} onChange={() => setEditing(true)} />;
}

/** /plan: the setup questions when there is nothing yet, the plan when there is. */
export function PlanScreen({ catalog }: { catalog: PlanCatalog }) {
  return (
    <div className="py-4 md:py-6">
      <Suspense fallback={null}>
        <Screen catalog={catalog} />
      </Suspense>
    </div>
  );
}
