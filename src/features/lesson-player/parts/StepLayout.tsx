import { cn } from '@/lib/cn';

/**
 * The reading geometry of a step. With code: code left and the question right on a wide
 * screen; on a phone the code comes first and the question follows in the same scroll,
 * so both are read as one thing (no split attention). Without code: one reading column.
 */
export function StepLayout({
  code,
  children,
}: {
  code?: React.ReactNode;
  children: React.ReactNode;
}) {
  if (!code) {
    return <div className="flex max-w-3xl flex-col gap-3">{children}</div>;
  }
  return (
    <div className="grid grid-cols-4 gap-x-4 gap-y-3 md:grid-cols-12">
      <div className={cn('col-span-4 min-w-0 md:col-span-7')}>
        {/* The code stays in view while the learner reads the choices. */}
        <div className="md:sticky md:top-10">{code}</div>
      </div>
      <div className="col-span-4 flex min-w-0 flex-col gap-3 md:col-span-5">{children}</div>
    </div>
  );
}
