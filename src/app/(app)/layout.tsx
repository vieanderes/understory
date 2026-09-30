import { AppShell } from '@/components/layout/AppShell';
import { SmoothScroll } from '@/features/motion/MotionLayer';
import { OfflineNotice } from '@/features/pwa/OfflineNotice';
import { RegisterServiceWorker } from '@/features/pwa/RegisterServiceWorker';
import { StoreProvider } from '@/features/store/StoreProvider';
import { StudyAssistant } from '@/features/tutor/StudyAssistant';
import { getManifest, getPaths } from '@/lib/content';

/** Every learner-facing page shares the shell and the progress store. Mocks and benches do not. */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const [{ contentRev }, paths] = await Promise.all([getManifest(), getPaths()]);
  return (
    <StoreProvider contentRev={contentRev}>
      <RegisterServiceWorker />
      <OfflineNotice />
      <SmoothScroll />
      <AppShell
        paths={paths.map(({ id, name, stages }) => ({
          id,
          name,
          stages: stages.map((s) => ({ title: s.title, lessonIds: s.lessons.map((l) => l.id) })),
        }))}
      >
        {children}
      </AppShell>
      <StudyAssistant shell />
    </StoreProvider>
  );
}
