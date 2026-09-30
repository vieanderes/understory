import { OfflineNotice } from '@/features/pwa/OfflineNotice';
import { RegisterServiceWorker } from '@/features/pwa/RegisterServiceWorker';
import { StoreProvider } from '@/features/store/StoreProvider';
import { StudyAssistant } from '@/features/tutor/StudyAssistant';
import { getManifest } from '@/lib/content';

/** Focus mode: a lesson or a session fills the screen. No places, no tab bar, one way out. */
export default async function FocusLayout({ children }: { children: React.ReactNode }) {
  const { contentRev } = await getManifest();
  return (
    <StoreProvider contentRev={contentRev}>
      <RegisterServiceWorker />
      <OfflineNotice />
      {children}
      <StudyAssistant />
    </StoreProvider>
  );
}
