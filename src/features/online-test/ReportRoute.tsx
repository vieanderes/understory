'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { buttonClass } from '@/components/ui/Button';
import { customQuery } from '@/core/online-test';
import { useReport } from './attempt-store';
import { HUB_HREF } from './OnlineTestRunner';
import { ReportView } from './Report';

function Report({ recommended }: { recommended: Record<string, number> }) {
  const id = useSearchParams().get('id');
  const report = useReport(id);
  if (!report) {
    return (
      <main id="content" className="frame flex flex-col items-start gap-2 py-6">
        <h1 className="t-section">No report here</h1>
        <p className="text-muted">
          Reports are kept in this browser. This one is on another device, or was cleared.
        </p>
        <Link href={HUB_HREF} className={buttonClass('primary', 'lg')}>
          All tests
        </Link>
      </main>
    );
  }
  const spec = report.attempt.spec;
  const again = `${HUB_HREF}/${spec.key}${spec.key === 'custom' ? `?${customQuery(spec)}` : ''}`;
  return <ReportView report={report} recommended={recommended} againHref={again} />;
}

export function ReportRoute({ recommended }: { recommended: Record<string, number> }) {
  return (
    <Suspense fallback={null}>
      <Report recommended={recommended} />
    </Suspense>
  );
}
