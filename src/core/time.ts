/*
 * Time, said one way. Kampala is UTC+3 all year (no daylight saving), and
 * every day in the books is a Kampala day (spec 02 §8 Q13, the server's
 * ow_today()). Words follow docs/audit/GLOSSARY.md: "How long" is "41 m",
 * "9 h 41 m", "2 days"; "When" is "15:20" today, "Thu 23:28" otherwise.
 *
 * Nothing here reads the clock: the caller passes `now` (a data source's
 * now(), which the demo fixes at Sat 17 Oct 2026 10:41).
 */
import type { Day, Ms } from './types.ts';

export const KAMPALA_OFFSET_MS = 3 * 3600 * 1000;
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** A wall-clock moment in Kampala as epoch ms: at('2026-10-17', '10:41'). */
export function at(day: Day, hm: string = '00:00'): Ms {
  return Date.parse(`${day}T${hm.length === 4 ? '0' + hm : hm}:00+03:00`);
}

function local(ms: Ms): Date {
  return new Date(ms + KAMPALA_OFFSET_MS);
}

/** The Kampala day of a moment. */
export function dayOf(ms: Ms): Day {
  return local(ms).toISOString().slice(0, 10);
}

/** "10:41", "9:02" (no leading zero on the hour, as FACTS writes times). */
export function clock(ms: Ms): string {
  const d = local(ms);
  return d.getUTCHours() + ':' + String(d.getUTCMinutes()).padStart(2, '0');
}

/** "Sat 17 Oct". */
export function dayLabel(dayOrMs: Day | Ms): string {
  const d = typeof dayOrMs === 'number' ? local(dayOrMs) : new Date(dayOrMs + 'T00:00:00Z');
  return `${DAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}

/** "Sat". */
export function weekday(dayOrMs: Day | Ms): string {
  const d = typeof dayOrMs === 'number' ? local(dayOrMs) : new Date(dayOrMs + 'T00:00:00Z');
  return DAYS[d.getUTCDay()];
}

/** "October". */
export function monthName(dayOrMs: Day | Ms): string {
  const d = typeof dayOrMs === 'number' ? local(dayOrMs) : new Date(dayOrMs + 'T00:00:00Z');
  return MONTHS_LONG[d.getUTCMonth()];
}

/** GLOSSARY "When": "15:20" today, "Fri 15:40" this week, else "Mon 24 Aug". */
export function when(ms: Ms, now: Ms): string {
  const d = dayOf(ms), today = dayOf(now);
  if (d === today) return clock(ms);
  const days = daysApart(d, today);
  if (days > 0 && days < 7) return `${weekday(ms)} ${clock(ms)}`;
  return dayLabel(ms);
}

/** GLOSSARY "How long": "12 m", "2 h", "9 h 41 m", "2 days". */
export function howLong(fromMs: Ms, toMs: Ms): string {
  const mins = Math.max(0, Math.floor((toMs - fromMs) / 60000));
  if (mins < 60) return `${mins} m`;
  const h = Math.floor(mins / 60), m = mins % 60;
  if (h < 24) return m ? `${h} h ${m} m` : `${h} h`;
  const days = Math.floor(h / 24);
  return days === 1 ? '1 day' : `${days} days`;
}

/** Whole days from day a to day b. */
export function daysApart(a: Day, b: Day): number {
  return Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 864e5);
}

/** A day plus n days. */
export function addDays(day: Day, n: number): Day {
  const d = new Date(day + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Days left in the month after today (FACTS §1: Sat 17 Oct → 14). */
export function daysLeftInMonth(today: Day): number {
  const d = new Date(today + 'T00:00:00Z');
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  return last - d.getUTCDate();
}

/** 'YYYY-MM' of a day. */
export function monthOf(day: Day): string {
  return day.slice(0, 7);
}

/**
 * The 24-hour WhatsApp reply window, from the customer's last message (sales.html waWindowInfo).
 * Open: "23 h to reply" (hoursLeft, whole hours down). Shut: "shut · 2 days", counted in calendar
 * days since they last wrote (FACTS §1: Nansana wrote Thu 15 Oct 16:02 → "shut · 2 days" on Sat).
 */
export function replyWindow(lastInAt: Ms | null, now: Ms): { open: boolean; hoursLeft: number; daysShut: number } {
  if (!lastInAt) return { open: false, hoursLeft: 0, daysShut: 0 };
  const left = lastInAt + 24 * 3600 * 1000 - now;
  if (left > 0) return { open: true, hoursLeft: Math.floor(left / 3600000), daysShut: 0 };
  return { open: false, hoursLeft: 0, daysShut: daysApart(dayOf(lastInAt), dayOf(now)) };
}
