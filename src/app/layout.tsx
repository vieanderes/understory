import type { Metadata, Viewport } from 'next';
import { HydrationMark } from '@/components/app/HydrationMark';
import { InlineScript } from '@/components/theme/InlineScript';
import { Arrival } from '@/features/motion/MotionLayer';
import { MOTION_INIT_SCRIPT } from '@/features/motion/init-script';
import { SITE_DESCRIPTION, SITE_NAME, SITE_TITLE, SITE_URL } from '@/lib/site';
import { THEME_INIT_SCRIPT } from '@/lib/theme';
import { fontVariables } from './fonts';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: SITE_TITLE, template: `%s · ${SITE_NAME}` },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  keywords: [
    'software engineering course',
    'learn to code',
    'free coding course',
    'open source course',
    'AI coding test practice',
    'coding interview preparation',
    'system design',
    'AI engineering',
    'Python',
    'TypeScript',
    'SQL',
  ],
  openGraph: {
    type: 'website',
    siteName: SITE_NAME,
    locale: 'en_GB',
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    url: '/',
  },
  twitter: { card: 'summary_large_image', title: SITE_TITLE, description: SITE_DESCRIPTION },
  verification: { google: 'RIWxqHB9lsk-QgZhNOtkfHFIM9m6OxbCEaEyw1rN2pU' },
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
