import { AppShell } from '@/components/layout/AppShell';
import { SmoothScroll } from '@/features/motion/MotionLayer';
import { OfflineNotice } from '@/features/pwa/OfflineNotice';
import { RegisterServiceWorker } from '@/features/pwa/RegisterServiceWorker';
import { StoreProvider } from '@/features/store/StoreProvider';
import { StudyAssistant } from '@/features/tutor/StudyAssistant';
import { getManifest } from '@/lib/content';
import { listDates } from '@/lib/news';

/** Every learner-facing page shares the shell and the progress store. Mocks and benches do not. */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const [{ contentRev }, dates] = await Promise.all([getManifest(), listDates()]);
  return (
    <StoreProvider contentRev={contentRev}>
      <RegisterServiceWorker />
      <OfflineNotice />
      <SmoothScroll />
      <AppShell latestNews={dates[0]}>{children}</AppShell>
      <StudyAssistant shell />
    </StoreProvider>
  );
}
