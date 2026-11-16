import { addDays, makeDate, toISO } from "./dates";
import type { ISODate } from "./types";

export const GERMAN_STATES: { code: string; name: string }[] = [
  { code: "BW", name: "Baden-Württemberg" },
  { code: "BY", name: "Bavaria" },
  { code: "BE", name: "Berlin" },
  { code: "BB", name: "Brandenburg" },
  { code: "HB", name: "Bremen" },
  { code: "HH", name: "Hamburg" },
  { code: "HE", name: "Hesse" },
  { code: "MV", name: "Mecklenburg-Western Pomerania" },
  { code: "NI", name: "Lower Saxony" },
  { code: "NW", name: "North Rhine-Westphalia" },
  { code: "RP", name: "Rhineland-Palatinate" },
  { code: "SL", name: "Saarland" },
  { code: "SN", name: "Saxony" },
  { code: "ST", name: "Saxony-Anhalt" },
  { code: "SH", name: "Schleswig-Holstein" },
  { code: "TH", name: "Thuringia" },
];

export const COUNTRIES = [
  { code: "DE", name: "Germany" },
  { code: "OTHER", name: "Other (no public holidays)" },
];

/** Easter Sunday (Gregorian calendar, anonymous algorithm). */
export function easterSunday(year: number): ISODate {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return makeDate(year, month, day);
}

/** Wednesday before November 23 (Day of Repentance, Saxony). */
function repentanceDay(year: number): ISODate {
  const d = new Date(year, 10, 22);
  while (d.getDay() !== 3) d.setDate(d.getDate() - 1);
  return toISO(d);
}

/**
 * Public holidays for a country/region and year. Keys are dates, values are
 * translation keys (holiday.*) so the names can be translated later.
 */
export function publicHolidays(year: number, country: string, region: string): Map<ISODate, string> {
  const h = new Map<ISODate, string>();
  if (country !== "DE") return h;
  const e = easterSunday(year);
  const add = (date: ISODate, key: string) => h.set(date, key);
  const inRegion = (...codes: string[]) => codes.includes(region);

  add(makeDate(year, 1, 1), "newYear");
  if (inRegion("BW", "BY", "ST")) add(makeDate(year, 1, 6), "epiphany");
  if ((inRegion("BE") && year >= 2019) || (inRegion("MV") && year >= 2023)) add(makeDate(year, 3, 8), "womensDay");
  add(addDays(e, -2), "goodFriday");
  if (inRegion("BB")) add(e, "easterSunday");
  add(addDays(e, 1), "easterMonday");
  add(makeDate(year, 5, 1), "labourDay");
  add(addDays(e, 39), "ascension");
  if (inRegion("BB")) add(addDays(e, 49), "whitSunday");
  add(addDays(e, 50), "whitMonday");
  if (inRegion("BW", "BY", "HE", "NW", "RP", "SL")) add(addDays(e, 60), "corpusChristi");
  if (inRegion("SL")) add(makeDate(year, 8, 15), "assumption");
  if (inRegion("TH") && year >= 2019) add(makeDate(year, 9, 20), "childrensDay");
  add(makeDate(year, 10, 3), "germanUnity");
  const reformationAll = ["BB", "MV", "SN", "ST", "TH"];
  const reformationSince2018 = ["HB", "HH", "NI", "SH"];
  if (inRegion(...reformationAll) || (inRegion(...reformationSince2018) && year >= 2018) || year === 2017) {
    add(makeDate(year, 10, 31), "reformation");
  }
  if (inRegion("BW", "BY", "NW", "RP", "SL")) add(makeDate(year, 11, 1), "allSaints");
  if (inRegion("SN")) add(repentanceDay(year), "repentance");
  add(makeDate(year, 12, 25), "christmas");
  add(makeDate(year, 12, 26), "boxingDay");
  return h;
}

/** Cached lookup across years. */
export function createHolidayLookup(country: string, region: string) {
  const cache = new Map<number, Map<ISODate, string>>();
  return (date: ISODate): string | undefined => {
    const y = Number(date.slice(0, 4));
    let m = cache.get(y);
    if (!m) {
      m = publicHolidays(y, country, region);
      cache.set(y, m);
    }
    return m.get(date);
  };
}
