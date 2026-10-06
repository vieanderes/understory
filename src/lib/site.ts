/**
 * The public origin, without a trailing slash. NEXT_PUBLIC_SITE_URL wins; on Vercel the
 * production domain is exposed automatically, so a missing variable no longer sends
 * crawlers to localhost through the sitemap, canonical URLs and share cards.
 */
const vercelProduction = process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL;

export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ??
  (vercelProduction ? `https://${vercelProduction}` : 'http://localhost:3000')
).replace(/\/$/, '');

export const SITE_NAME = 'Understory';

/** The search title of the home page: what it is, not only its name. */
export const SITE_TITLE = 'Understory: a free, open-source software engineering course';

export const SITE_DESCRIPTION =
  'Learn software engineering from your first program to system design and AI engineering. Hundreds of lessons in the browser, spaced practice, a simulator for AI-assisted coding tests, and Scout, an AI tutor on your own Claude. Free, open source, no account.';

/** The code, the issues and how to contribute. */
export const REPO_URL = 'https://github.com/vieanderes/understory';
