import type { Metadata } from 'next';
import Link from 'next/link';
import { Title } from '@/features/motion/Title';
import { PathsIndex } from '@/features/paths/PathsIndex';
import { GoalShortcuts } from '@/features/plan/GoalShortcuts';
import { getPaths } from '@/lib/content';

export const metadata: Metadata = {
  title: 'Learning paths',
  description:
    'Learning paths, each one goal with a final exam and a certificate, and a plan for your situation.',
};

export default async function PathsPage() {
  const paths = await getPaths();
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <Title>Pick one goal.</Title>
        <p data-arrive="rise" className="text-muted prose-measure text-lg">
          Each learning path takes you through the lessons for one goal, then a final exam and a
          certificate. Everything else lives in the{' '}
          <Link href="/learn" className="text-fg underline underline-offset-4">
            library
          </Link>
          .
        </p>
      </header>
      <GoalShortcuts title="Not sure which path? Start from your goal" />
      <section aria-labelledby="all-paths-title" className="flex flex-col gap-2">
        <h2 id="all-paths-title" className="t-section">
          All learning paths
        </h2>
        <PathsIndex paths={paths} />
      </section>
    </div>
  );
}
