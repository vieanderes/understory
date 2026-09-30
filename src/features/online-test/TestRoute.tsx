'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { buttonClass } from '@/components/ui/Button';
import { specFor, type OnlineTestIndex, type TestSpec } from '@/core/online-test';
import { HUB_HREF, OnlineTestRunner } from './OnlineTestRunner';

interface TestRouteProps {
  testKey: string;
  /** Resolved on the server for presets and training; null for a custom test. */
  spec: TestSpec | null;
  index: OnlineTestIndex;
}

function CustomSpec({ index }: { index: OnlineTestIndex }) {
  const query = useSearchParams();
  const spec = specFor('custom', index, new URLSearchParams(query.toString()));
  if (!spec) {
    return (
      <main id="content" className="frame flex flex-col items-start gap-2 py-6">
        <h1 className="t-section">This custom test has no tasks</h1>
        <p className="text-muted">Choose its tasks on the tests page.</p>
        <Link href={HUB_HREF} className={buttonClass('primary', 'lg')}>
          Choose tasks
        </Link>
      </main>
    );
  }
  return <OnlineTestRunner spec={spec} />;
}

export function TestRoute({ spec, index }: TestRouteProps) {
  if (spec) return <OnlineTestRunner spec={spec} />;
  return (
    <Suspense fallback={null}>
      <CustomSpec index={index} />
    </Suspense>
  );
}
