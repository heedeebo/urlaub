import type { ISODate } from "./types";

const pad = (n: number) => String(n).padStart(2, "0");

/** Local date to "YYYY-MM-DD". */
export function toISO(d: Date): ISODate {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** "YYYY-MM-DD" to a local Date at midnight (avoids UTC shifts of new Date("...")). */
export function parseISO(s: ISODate): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(s: ISODate, n: number): ISODate {
  const d = parseISO(s);
  d.setDate(d.getDate() + n);
  return toISO(d);
}

export function makeDate(year: number, month1: number, day: number): ISODate {
  return `${year}-${pad(month1)}-${pad(day)}`;
}

/** Inclusive list of dates from start to end. Empty if end < start. */
export function eachDay(start: ISODate, end: ISODate): ISODate[] {
  const out: ISODate[] = [];
  if (!start || !end || end < start) return out;
  for (let d = start; d <= end; d = addDays(d, 1)) out.push(d);
  return out;
}

export const yearOf = (s: ISODate) => Number(s.slice(0, 4));

export function weekday(s: ISODate): number {
  return parseISO(s).getDay();
}

export function daysBetween(a: ISODate, b: ISODate): number {
  return Math.round((parseISO(b).getTime() - parseISO(a).getTime()) / 86400000);
}

export function todayISO(): ISODate {
  return toISO(new Date());
}

/** Rounds to half days and removes float noise (0.1 + 0.2 style). */
export function roundHalf(n: number): number {
  return Math.round(n * 2) / 2;
}
