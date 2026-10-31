/**
 * Days and weeks, always in the store's own time zone.
 *
 * Never use `Date.toISOString()` for a day: it converts to UTC, and from 5pm
 * (or 4pm in winter) Los Angeles time UTC is already tomorrow — Saturday's
 * dinner close would land in next week. Days are plain "YYYY-MM-DD" strings
 * everywhere, made here.
 *
 * A week is named by its Monday. The store is closed on Sunday, so a Sunday
 * belongs to the week that just ended, and Monday starts a fresh chart.
 */

export const STORE_TIME_ZONE = 'America/Los_Angeles';

const dayFormat = new Intl.DateTimeFormat('en-CA', {
  timeZone: STORE_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** Today at the store, as "YYYY-MM-DD". */
export function storeToday(now = new Date()): string {
  return dayFormat.format(now);
}

/** Noon UTC on that day: the same calendar day everywhere in the Americas. */
function noon(day: string): Date {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12));
}

function toDay(date: Date): string {
  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, '0'),
    String(date.getUTCDate()).padStart(2, '0'),
  ].join('-');
}

export function addDays(day: string, days: number): string {
  return toDay(new Date(noon(day).getTime() + days * 86_400_000));
}

/** The Monday a day belongs to. A Sunday belongs to the week before it. */
export function mondayOf(day: string): string {
  const weekday = noon(day).getUTCDay(); // 0 = Sunday
  return addDays(day, weekday === 0 ? -6 : 1 - weekday);
}

export function thisWeek(now = new Date()): string {
  return mondayOf(storeToday(now));
}

const short = (date: Date, options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', ...options }).format(date);

/** "Oct 26 – 31, 2026", or "Sep 28 – Oct 3, 2026" across a month end. */
export function weekLabel(monday: string): string {
  const start = noon(monday);
  const end = noon(addDays(monday, 5));
  const sameMonth = start.getUTCMonth() === end.getUTCMonth();
  const from = short(start, { month: 'short', day: 'numeric' });
  const to = short(end, sameMonth ? { day: 'numeric' } : { month: 'short', day: 'numeric' });
  return `${from} – ${to}, ${end.getUTCFullYear()}`;
}

/** "10/26" for the day `index` days after Monday. */
export function shortDate(monday: string, index: number): string {
  return short(noon(addDays(monday, index)), { month: 'numeric', day: 'numeric' });
}
