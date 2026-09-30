import Link from 'next/link';
import { AppShell } from '@/components/layout/AppShell';
import { buttonClass } from '@/components/ui/Button';
import { Title } from '@/features/motion/Title';

export default function NotFound() {
  return (
    <AppShell>
      <div className="flex flex-col items-start gap-3 py-8">
        <p className="t-label">404</p>
        <Title>Nothing at this address.</Title>
        <p className="text-muted prose-measure">
          The page moved or never existed. Your progress is stored on this device and is not
          affected.
        </p>
        <Link href="/" className={buttonClass('primary')}>
          Go home
        </Link>
      </div>
    </AppShell>
  );
}
