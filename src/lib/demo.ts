import { makeDate } from "../domain/dates";
import { defaultSettings } from "../domain/defaults";
import { createHolidayLookup } from "../domain/holidays";
import { balanceForRequest } from "../domain/ledger";
import type { AppData, RequestStatus, VacationRequest } from "../domain/types";
import { buildRequestDays } from "../domain/workdays";

/** Sample data to try the app. Replaced as soon as real data is imported or entered. */
export function demoData(year: number, today: string): AppData {
  const settings = defaultSettings(year);
  settings.profile = {
    ...settings.profile,
    firstName: "Alex",
    lastName: "Example",
    company: "Example GmbH",
    employmentStart: makeDate(year - 6, 4, 1),
    personalEmail: "alex@example.com",
    managerName: "Ms. Miller",
    managerEmail: "manager@example.com",
  };
  const ctx = { workdays: settings.profile.workdays, holiday: createHolidayLookup("DE", "BW") };
  const base: AppData = { settings, yearAccounts: [{ year, carryoverOverride: 5 }], adjustments: [], requests: [] };

  const plan: [string, string, RequestStatus][] = [
    [makeDate(year, 1, 4), makeDate(year, 1, 5), "approved"],
    [makeDate(year, 3, 30), makeDate(year, 4, 2), "pending"],
    [makeDate(year, 8, 2), makeDate(year, 8, 13), "approved"],
    [makeDate(year, 8, 16), makeDate(year, 8, 20), "rejected"],
  ];
  plan.forEach(([start, end, status], i) => {
    const now = new Date().toISOString();
    const r: VacationRequest = {
      id: crypto.randomUUID(),
      number: `VR-${year}-${String(i + 1).padStart(3, "0")}`,
      start,
      end,
      days: buildRequestDays(start, end, ctx),
      comment: "",
      status,
      signature: null,
      statusHistory: [
        { status: "draft", at: now },
        { status: "pending", at: now, note: "Demo data" },
        ...(status !== "pending" ? [{ status, at: now }] : []),
      ],
      createdAt: now,
      updatedAt: now,
      sentAt: now,
      sentVia: "manual",
    };
    r.snapshot = balanceForRequest({ ...base, today }, r);
    base.requests.push(r);
  });
  return base;
}
