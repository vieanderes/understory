import type { Metadata } from 'next';
import { SandboxHarness } from './SandboxHarness';

/**
 * A bench for the code sandbox: the e2e suite drives it and people use it for manual
 * checks. It is always built, because e2e runs against the production build, but it is
 * linked from nowhere and kept out of search indexes. It exposes nothing a learner
 * could not already do on a lesson page.
 */
export const metadata: Metadata = {
  title: 'Sandbox bench',
  robots: { index: false, follow: false },
};

export default function Page() {
  return <SandboxHarness />;
}
