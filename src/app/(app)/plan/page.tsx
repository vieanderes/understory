import type { Metadata } from 'next';
import { PlanScreen } from '@/features/plan/PlanScreen';
import { getPlanCatalog } from '@/lib/content';

export const metadata: Metadata = {
  title: 'Your plan',
  description: 'A plan built from your goal, your time and where you start, with a step for today.',
};

export default async function PlanPage() {
  return <PlanScreen catalog={await getPlanCatalog()} />;
}
