/** The public origin, without a trailing slash. Set NEXT_PUBLIC_SITE_URL when deployed. */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000').replace(
  /\/$/,
  '',
);
