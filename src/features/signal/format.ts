/** Dates are formatted in UTC with a fixed locale, so server and client agree. */
const DAY = new Intl.DateTimeFormat('en-GB', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  timeZone: 'UTC',
});
const SHORT = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const MONTH = new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });

const at = (isoDate: string) => new Date(`${isoDate}T00:00:00Z`);

export const formatDay = (isoDate: string) => DAY.format(at(isoDate));
export const formatShort = (isoDate: string) => SHORT.format(at(isoDate));
export const formatMonth = (yyyyMm: string) => MONTH.format(at(`${yyyyMm}-01`));

export function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

/** `2026-09-17` to `2026-W38` (ISO 8601: weeks start on Monday, week 1 holds 4 January). */
export function isoWeekOf(isoDate: string): string {
  const date = at(isoDate);
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const yearStart = Date.UTC(date.getUTCFullYear(), 0, 1);
  const week = Math.ceil(((date.getTime() - yearStart) / 86_400_000 + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}
