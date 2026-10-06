import { OfflineNotice } from '@/features/pwa/OfflineNotice';
import { RegisterServiceWorker } from '@/features/pwa/RegisterServiceWorker';
import { StoreProvider } from '@/features/store/StoreProvider';
import { pathIndex } from '@/features/tutor/learner-situation';
import { StudyAssistant } from '@/features/tutor/StudyAssistant';
import { getManifest, getPaths } from '@/lib/content';
import { listDates } from '@/lib/news';

/** Focus mode: a lesson or a session fills the screen. No places, no tab bar, one way out. */
export default async function FocusLayout({ children }: { children: React.ReactNode }) {
  const [{ contentRev }, dates, paths] = await Promise.all([
    getManifest(),
    listDates(),
    getPaths(),
  ]);
  return (
    <StoreProvider contentRev={contentRev}>
      <RegisterServiceWorker />
      <OfflineNotice />
      {children}
      <StudyAssistant paths={pathIndex(paths)} latestNews={dates[0]} />
    </StoreProvider>
  );
}
