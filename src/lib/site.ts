/** The public origin, without a trailing slash. Set NEXT_PUBLIC_SITE_URL when deployed. */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000').replace(
  /\/$/,
  '',
);

/** The code, the issues and how to contribute. */
export const REPO_URL = 'https://github.com/vieanderes/understory';
