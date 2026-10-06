/** Dates are formatted in UTC with a fixed locale, so server and client agree. */
const DAY = new Intl.DateTimeFormat('en-GB', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  timeZone: 'UTC',
});
const MONTH = new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });

/*
 * Short dates are spelled out by hand: engines disagree on en-GB's short month (Node's ICU
 * writes "Sept", Safari "Sep"), and a page rendered on the server must read the same in the
 * browser or React throws it away and renders it again.
 */
const SHORT_MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];
const SHORT_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const at = (isoDate: string) => new Date(`${isoDate}T00:00:00Z`);

export const formatDay = (isoDate: string) => DAY.format(at(isoDate));
/** `5 Oct`. */
export function formatShort(isoDate: string): string {
  const date = at(isoDate);
  return `${date.getUTCDate()} ${SHORT_MONTHS[date.getUTCMonth()]}`;
}
/** `Mon 5 Oct`, for archive rows. */
export const formatWeekday = (isoDate: string) =>
  `${SHORT_DAYS[at(isoDate).getUTCDay()]} ${formatShort(isoDate)}`;
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
