import type { Metadata } from 'next';
import Link from 'next/link';
import { LABS } from '@/features/labs/registry';
import { Title } from '@/features/motion/Title';

export const metadata: Metadata = {
  title: 'Labs',
  description:
    'Small simulators for the mechanisms that are hard to see: the event loop, a race, an index.',
};

export default function LabsPage() {
  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-col gap-2">
        <p className="t-label">Labs</p>
        <Title>
          Mechanisms you can step through. <span className="text-muted">One step at a time.</span>
        </Title>
      </header>
      <ul className="flex flex-col">
        {LABS.map((lab) => (
          <li key={lab.id} className="rule-t">
            <Link
              href={`/labs/${lab.id}`}
              className="hover:bg-raised rounded-control -mx-1 flex min-h-6 flex-col gap-0.5 px-1 py-2 transition-colors duration-150 ease-out"
            >
              <span className="font-medium">{lab.title}</span>
              <span className="text-muted text-sm">{lab.question}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
