'use client';

import { Button } from '@/components/ui/Button';
import { Title } from '@/features/motion/Title';

/** A render error in a page. The shell is not used here: it may be what failed. */
export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main
      id="content"
      className="frame flex min-h-dvh flex-col items-start justify-center gap-3 py-8"
    >
      <p className="t-label">Error{error.digest ? ` · ${error.digest}` : ''}</p>
      <Title>This page failed to render.</Title>
      <p className="text-muted prose-measure">
        Your progress is stored on this device and is not affected. Try again, or reload.
      </p>
      <Button variant="primary" onClick={reset}>
        Try again
      </Button>
    </main>
  );
}
