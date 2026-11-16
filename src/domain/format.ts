import { parseISO, yearOf } from "./dates";
import type { ISODate } from "./types";

export function formatDate(iso: ISODate, locale = "en-US", opts?: Intl.DateTimeFormatOptions): string {
  if (!iso) return "";
  return parseISO(iso).toLocaleDateString(locale, opts ?? { month: "long", day: "numeric", year: "numeric" });
}

export function formatShort(iso: ISODate, locale = "en-US"): string {
  return formatDate(iso, locale, { month: "short", day: "numeric" });
}

export function formatDateTime(isoTimestamp: string, locale = "en-US"): string {
  if (!isoTimestamp) return "";
  return new Date(isoTimestamp).toLocaleString(locale, {
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** "May 4 to May 8, 2027" or "Dec 28, 2026 to Jan 4, 2027". */
export function formatRange(start: ISODate, end: ISODate, locale = "en-US", joiner = "to"): string {
  if (!start) return "";
  if (start === end) return formatDate(start, locale);
  if (yearOf(start) === yearOf(end)) {
    return `${formatDate(start, locale, { month: "long", day: "numeric" })} ${joiner} ${formatDate(end, locale)}`;
  }
  return `${formatDate(start, locale)} ${joiner} ${formatDate(end, locale)}`;
}

/** 5 -> "5", 2.5 -> "2.5" */
export function formatDays(n: number, locale = "en-US"): string {
  return n.toLocaleString(locale, { maximumFractionDigits: 1 });
}
