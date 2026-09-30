import type { Metadata, Viewport } from 'next';
import { HydrationMark } from '@/components/app/HydrationMark';
import { InlineScript } from '@/components/theme/InlineScript';
import { Arrival } from '@/features/motion/MotionLayer';
import { MOTION_INIT_SCRIPT } from '@/features/motion/init-script';
import { THEME_INIT_SCRIPT } from '@/lib/theme';
import { fontVariables } from './fonts';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'Understory', template: '%s · Understory' },
  description:
    'Learn software engineering from the page to the platform, keep it through spaced practice, and follow what changes. Local-first. No account.',
  applicationName: 'Understory',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#fbfbfc' },
    { media: '(prefers-color-scheme: dark)', color: '#08090a' },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // data-theme is set by the inline script before paint, so the server value differs.
    <html lang="en-GB" className={fontVariables} suppressHydrationWarning>
      <head>
        <InlineScript html={THEME_INIT_SCRIPT} />
        <InlineScript html={MOTION_INIT_SCRIPT} />
      </head>
      <body>
        <a
          href="#content"
          className="bg-accent text-accent-fg rounded-control sr-only px-2 py-1 focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50"
        >
          Skip to content
        </a>
        {children}
        <HydrationMark />
        <Arrival />
      </body>
    </html>
  );
}
