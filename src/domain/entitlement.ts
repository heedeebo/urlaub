import { daysBetween, makeDate, parseISO, roundHalf, yearOf } from "./dates";
import type { ISODate, ProrationMethod } from "./types";

/**
 * Number of full calendar months employed in a year. A month counts when the
 * employment started on or before the 1st of that month.
 */
export function fullMonthsEmployed(employmentStart: ISODate, year: number): number {
  const startYear = yearOf(employmentStart);
  if (startYear < year) return 12;
  if (startYear > year) return 0;
  const d = parseISO(employmentStart);
  const firstFullMonth = d.getDate() === 1 ? d.getMonth() : d.getMonth() + 1; // 0-based
  return Math.max(0, 12 - firstFullMonth);
}

/** Annual entitlement for a year, prorated in the year employment started. */
export function entitlementForYear(
  annual: number,
  employmentStart: ISODate,
  year: number,
  method: ProrationMethod,
): number {
  if (!employmentStart) return annual;
  const startYear = yearOf(employmentStart);
  if (year < startYear) return 0;
  if (year > startYear || method === "none") return annual;

  switch (method) {
    case "fullMonthsRoundUp": {
      const raw = (annual * fullMonthsEmployed(employmentStart, year)) / 12;
      return Math.ceil(raw - 1e-9);
    }
    case "fullMonthsRound": {
      const raw = (annual * fullMonthsEmployed(employmentStart, year)) / 12;
      return Math.round(raw + 1e-9);
    }
    case "exactDays": {
      const yearDays = daysBetween(makeDate(year, 1, 1), makeDate(year + 1, 1, 1));
      const employedDays = daysBetween(employmentStart, makeDate(year + 1, 1, 1));
      return roundHalf((annual * employedDays) / yearDays);
    }
  }
}
