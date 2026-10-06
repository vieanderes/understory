import { addDays, monthKey, monthRange } from './dates';
import type { IsoDate } from './schema';

/*
 * The edition picker's month grid and how a keyboard moves through it. Only days with an
 * edition can be reached, so every move lands on a page that exists.
 */

const DAYS_PER_WEEK = 7;

/** Monday is 0 and Sunday is 6: the picker's columns. */
function column(date: IsoDate): number {
  return (new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % DAYS_PER_WEEK;
}

/** A month's weeks, Monday first, with `null` for the days of the months either side. */
export function monthWeeks(month: string): (IsoDate | null)[][] {
  const range = monthRange(month);
  if (range === null) return [];
  const cells: (IsoDate | null)[] = Array.from({ length: column(range.from) }, () => null);
  for (let day = range.from; day <= range.to; day = addDays(day, 1)) cells.push(day);
  while (cells.length % DAYS_PER_WEEK !== 0) cells.push(null);
  const weeks: (IsoDate | null)[][] = [];
  for (let at = 0; at < cells.length; at += DAYS_PER_WEEK) {
    weeks.push(cells.slice(at, at + DAYS_PER_WEEK));
  }
  return weeks;
}

/** `2026-12` plus one is `2027-01`. */
export function addMonths(month: string, by: number): string {
  const index = Number(month.slice(0, 4)) * 12 + Number(month.slice(5, 7)) - 1 + by;
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, '0')}`;
}

/**
 * The edition `by` days away, or the next one beyond it in the same direction when that day
 * has none. Undefined past either end, so the caller stays where it is.
 */
export function stepEdition(
  dates: readonly IsoDate[],
  from: IsoDate,
  by: number,
): IsoDate | undefined {
  const target = addDays(from, by);
  let best: IsoDate | undefined;
  for (const date of dates) {
    if (by > 0 ? date < target : date > target) continue;
    if (best === undefined || (by > 0 ? date < best : date > best)) best = date;
  }
  return best;
}

/**
 * Where focus lands in another month: the same day of the month when it has an edition,
 * else the nearest edition in that month, or its first or last when asked.
 */
export function editionInMonth(
  dates: readonly IsoDate[],
  month: string,
  prefer: IsoDate | 'first' | 'last',
): IsoDate | undefined {
  const inMonth = dates.filter((date) => monthKey(date) === month).sort();
  if (inMonth.length === 0) return undefined;
  if (prefer === 'first') return inMonth[0];
  if (prefer === 'last') return inMonth.at(-1);
  const range = monthRange(month);
  const wanted = `${month}-${prefer.slice(8, 10)}`;
  // A day past the month's end (31 into a 30-day month) aims at its last day.
  const aim = range !== null && wanted > range.to ? range.to : wanted;
  const distance = (date: IsoDate) =>
    Math.abs(Date.parse(`${date}T00:00:00Z`) - Date.parse(`${aim}T00:00:00Z`));
  return inMonth.reduce((best, date) => (distance(date) < distance(best) ? date : best));
}
