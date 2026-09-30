import { Geist, Geist_Mono } from 'next/font/google';

/*
 * next/font downloads these at build time and serves them from our own origin, so the
 * CSP can keep font-src 'self' and no request leaves for a font CDN.
 *
 * One family carries the product: Geist for titles and reading, set tighter and heavier
 * for titles, and Geist Mono for code and figures (docs/DESIGN.md).
 */
export const geist = Geist({ subsets: ['latin'], variable: '--font-geist', display: 'swap' });

export const geistMono = Geist_Mono({
  subsets: ['latin'],
  variable: '--font-geist-mono',
  display: 'swap',
});

export const fontVariables = [geist.variable, geistMono.variable].join(' ');
