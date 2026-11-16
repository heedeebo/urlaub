import { eachDay, roundHalf, weekday } from "./dates";
import type { ISODate, RequestDay } from "./types";

export type HolidayLookup = (date: ISODate) => string | undefined;

export interface WorkdayContext {
  workdays: number[]; // weekdays that are working days, 0 = Sunday
  holiday: HolidayLookup;
}

export function isWorkday(date: ISODate, ctx: WorkdayContext): boolean {
  return ctx.workdays.includes(weekday(date)) && !ctx.holiday(date);
}

/**
 * Builds the list of vacation days for a date range. Weekends (non-working
 * weekdays) and public holidays are skipped. Dates listed in halfDays count 0.5.
 */
export function buildRequestDays(
  start: ISODate,
  end: ISODate,
  ctx: WorkdayContext,
  halfDays: ISODate[] = [],
): RequestDay[] {
  return eachDay(start, end)
    .filter((d) => isWorkday(d, ctx))
    .map((date) => ({ date, value: halfDays.includes(date) ? 0.5 : 1 }));
}

export function sumDays(days: RequestDay[]): number {
  return roundHalf(days.reduce((s, d) => s + d.value, 0));
}

export interface RangeBreakdown {
  calendarDays: number;
  workdays: number;
  weekendDays: number;
  holidays: { date: ISODate; key: string }[];
}

export function describeRange(start: ISODate, end: ISODate, ctx: WorkdayContext): RangeBreakdown {
  const all = eachDay(start, end);
  const holidays: { date: ISODate; key: string }[] = [];
  let weekendDays = 0;
  let workdays = 0;
  for (const d of all) {
    if (!ctx.workdays.includes(weekday(d))) weekendDays++;
    else if (ctx.holiday(d)) holidays.push({ date: d, key: ctx.holiday(d)! });
    else workdays++;
  }
  return { calendarDays: all.length, workdays, weekendDays, holidays };
}
