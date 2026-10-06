import { AppShell } from '@/components/layout/AppShell';
import { SmoothScroll } from '@/features/motion/MotionLayer';
import { OfflineNotice } from '@/features/pwa/OfflineNotice';
import { RegisterServiceWorker } from '@/features/pwa/RegisterServiceWorker';
import { StoreProvider } from '@/features/store/StoreProvider';
import { pathIndex } from '@/features/tutor/learner-situation';
import { StudyAssistant } from '@/features/tutor/StudyAssistant';
import { getManifest, getPaths } from '@/lib/content';
import { listDates } from '@/lib/news';

/** Every learner-facing page shares the shell and the progress store. Mocks and benches do not. */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const [{ contentRev }, dates, paths] = await Promise.all([
    getManifest(),
    listDates(),
    getPaths(),
  ]);
  return (
    <StoreProvider contentRev={contentRev}>
      <RegisterServiceWorker />
      <OfflineNotice />
      <SmoothScroll />
      <AppShell paths={pathIndex(paths)}>{children}</AppShell>
      <StudyAssistant shell paths={pathIndex(paths)} latestNews={dates[0]} />
    </StoreProvider>
  );
}
