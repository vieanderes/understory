import type { IsoDate } from './schema';

/*
 * Calendar arithmetic for the digests. Everything is UTC: the pipeline runs on a server
 * clock, and a news day is the UTC day the run belongs to.
 */

const MS_PER_DAY = 86_400_000;
const DAYS_PER_WEEK = 7;
/** ISO 8601: a week belongs to the year that holds its Thursday. Monday is day 1. */
const ISO_THURSDAY = 4;

const WEEK_KEY = /^(\d{4})-W(\d{2})$/;
const MONTH_KEY = /^(\d{4})-(\d{2})$/;

export interface DateRange {
  from: IsoDate;
  to: IsoDate;
}

function utc(date: IsoDate): number {
  return Date.parse(`${date}T00:00:00Z`);
}

export function toIsoDate(instant: Date): IsoDate {
  return instant.toISOString().slice(0, 10);
}

export function addDays(date: IsoDate, days: number): IsoDate {
  return toIsoDate(new Date(utc(date) + days * MS_PER_DAY));
}

/** Monday is 1 and Sunday is 7, as ISO 8601 counts. */
function isoWeekday(date: IsoDate): number {
  return new Date(utc(date)).getUTCDay() || DAYS_PER_WEEK;
}

/** `2026-W38` */
export function isoWeekKey(date: IsoDate): string {
  const thursday = addDays(date, ISO_THURSDAY - isoWeekday(date));
  const year = Number(thursday.slice(0, 4));
  const dayOfYear = (utc(thursday) - Date.UTC(year, 0, 1)) / MS_PER_DAY;
  const week = Math.floor(dayOfYear / DAYS_PER_WEEK) + 1;
  return `${year}-W${String(week).padStart(2, '0')}`;
}

/** Monday to Sunday of an ISO week, or null when the key names no week. */
export function weekRange(key: string): DateRange | null {
  const match = WEEK_KEY.exec(key);
  if (match === null) return null;
  // 4 January is always in week 1, so its Monday anchors the year.
  const fourth = `${match[1]}-01-04`;
  const firstMonday = addDays(fourth, 1 - isoWeekday(fourth));
  const from = addDays(firstMonday, (Number(match[2]) - 1) * DAYS_PER_WEEK);
  // A year has 52 or 53 weeks. A key beyond that lands in the next year's week 1.
  if (isoWeekKey(from) !== key) return null;
  return { from, to: addDays(from, DAYS_PER_WEEK - 1) };
}

/** `2026-09` */
export function monthKey(date: IsoDate): string {
  return date.slice(0, 7);
}

export function monthRange(key: string): DateRange | null {
  const match = MONTH_KEY.exec(key);
  const month = Number(match?.[2]);
  if (match === null || month < 1 || month > 12) return null;
  // Day 0 of the next month is the last day of this one.
  const last = new Date(Date.UTC(Number(match[1]), month, 0));
  return { from: `${key}-01`, to: toIsoDate(last) };
}
