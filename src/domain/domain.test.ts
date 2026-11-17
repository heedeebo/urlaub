import { describe, expect, it } from "vitest";
import { defaultSettings, DEFAULT_EMAIL_TEMPLATE, LEGACY_EMAIL_TEMPLATE } from "./defaults";
import { renderEmail, templateValues } from "./email";
import { entitlementForYear, fullMonthsEmployed } from "./entitlement";
import { createHolidayLookup, easterSunday, publicHolidays } from "./holidays";
import { balanceForRequest, computeYear, nextRequestNumber, type LedgerInput } from "./ledger";
import type { Adjustment, RequestStatus, Settings, VacationRequest, YearAccount } from "./types";
import { buildRequestDays, describeRange, sumDays } from "./workdays";

const bw = { workdays: [1, 2, 3, 4, 5], holiday: createHolidayLookup("DE", "BW") };

let seq = 0;
function req(start: string, end: string, status: RequestStatus, halfDays: string[] = []): VacationRequest {
  seq++;
  return {
    id: `r${seq}`,
    number: `VR-${start.slice(0, 4)}-${String(seq).padStart(3, "0")}`,
    start,
    end,
    days: buildRequestDays(start, end, bw, halfDays),
    comment: "",
    status,
    signature: null,
    statusHistory: [],
    createdAt: `2026-01-01T00:00:${String(seq).padStart(2, "0")}Z`,
    updatedAt: "",
  };
}

function settings(overrides: Partial<Settings["policy"]> = {}, profile: Partial<Settings["profile"]> = {}): Settings {
  const s = defaultSettings(2027);
  s.profile = { ...s.profile, firstName: "Chris", lastName: "Doe", company: "Acme", employmentStart: "2015-04-01", ...profile };
  s.policy = { ...s.policy, ...overrides };
  return s;
}

function input(opts: {
  requests?: VacationRequest[];
  today?: string;
  carryover?: number;
  settings?: Settings;
  adjustments?: Adjustment[];
  yearAccounts?: YearAccount[];
}): LedgerInput {
  return {
    settings: opts.settings ?? settings(),
    yearAccounts: opts.yearAccounts ?? [{ year: 2027, carryoverOverride: opts.carryover ?? 5 }],
    adjustments: opts.adjustments ?? [],
    requests: opts.requests ?? [],
    today: opts.today ?? "2027-02-10",
  };
}

describe("public holidays", () => {
  it("calculates Easter correctly", () => {
    expect(easterSunday(2024)).toBe("2024-03-31");
    expect(easterSunday(2025)).toBe("2025-04-20");
    expect(easterSunday(2026)).toBe("2026-04-05");
    expect(easterSunday(2027)).toBe("2027-03-28");
  });

  it("lists the 12 Baden-Württemberg holidays", () => {
    const h = publicHolidays(2027, "DE", "BW");
    expect(h.size).toBe(12);
    expect(h.get("2027-01-06")).toBe("epiphany");
    expect(h.get("2027-03-26")).toBe("goodFriday");
    expect(h.get("2027-03-29")).toBe("easterMonday");
    expect(h.get("2027-05-06")).toBe("ascension");
    expect(h.get("2027-05-17")).toBe("whitMonday");
    expect(h.get("2027-05-27")).toBe("corpusChristi");
    expect(h.get("2027-11-01")).toBe("allSaints");
    expect(h.has("2027-10-31")).toBe(false);
  });

  it("handles regional differences", () => {
    expect(publicHolidays(2027, "DE", "BE").has("2027-03-08")).toBe(true);
    expect(publicHolidays(2027, "DE", "HH").has("2027-10-31")).toBe(true);
    expect(publicHolidays(2027, "DE", "SN").get("2027-11-17")).toBe("repentance");
    expect(publicHolidays(2027, "OTHER", "").size).toBe(0);
  });
});

describe("working days", () => {
  it("skips weekends and public holidays", () => {
    const r = describeRange("2027-03-22", "2027-03-28", bw);
    expect(r.workdays).toBe(4); // Good Friday on the 26th
    expect(r.weekendDays).toBe(2);
    expect(r.holidays.map((h) => h.key)).toEqual(["goodFriday"]);
  });

  it("counts half days", () => {
    const days = buildRequestDays("2027-12-20", "2027-12-31", bw, ["2027-12-24", "2027-12-31"]);
    // Dec 20-24 (5) + Dec 27-31 (5) minus Christmas holidays on 25/26 (weekend anyway) = 10 days, two of them half
    expect(days.length).toBe(10);
    expect(sumDays(days)).toBe(9);
  });

  it("respects a custom working week", () => {
    const fourDays = { workdays: [1, 2, 3, 4], holiday: bw.holiday };
    expect(buildRequestDays("2027-03-01", "2027-03-07", fourDays).length).toBe(4);
  });
});

describe("prorated entitlement", () => {
  it("counts full months", () => {
    expect(fullMonthsEmployed("2027-04-01", 2027)).toBe(9);
    expect(fullMonthsEmployed("2027-04-15", 2027)).toBe(8);
    expect(fullMonthsEmployed("2020-04-15", 2027)).toBe(12);
  });

  it("rounds up to whole days (chosen rule)", () => {
    expect(entitlementForYear(30, "2027-04-15", 2027, "fullMonthsRoundUp")).toBe(20); // 30 * 8 / 12 = 20
    expect(entitlementForYear(30, "2027-05-15", 2027, "fullMonthsRoundUp")).toBe(18); // 17.5 -> 18
    expect(entitlementForYear(28, "2027-02-10", 2027, "fullMonthsRoundUp")).toBe(24); // 23.33 -> 24
    expect(entitlementForYear(30, "2027-04-15", 2028, "fullMonthsRoundUp")).toBe(30);
    expect(entitlementForYear(30, "2027-04-15", 2026, "fullMonthsRoundUp")).toBe(0);
  });

  it("supports the other methods", () => {
    expect(entitlementForYear(30, "2027-05-15", 2027, "fullMonthsRound")).toBe(18);
    expect(entitlementForYear(30, "2027-07-02", 2027, "exactDays")).toBe(15);
    expect(entitlementForYear(30, "2027-07-02", 2027, "none")).toBe(30);
  });
});

describe("two balances and FIFO", () => {
  it("matches the example from the spec: 5 + 30, request 8 days", () => {
    // 8 working days in February, before the deadline
    const r = req("2027-02-15", "2027-02-24", "approved");
    expect(sumDays(r.days)).toBe(8);
    const y = computeYear(2027, input({ requests: [r] }));
    expect(y.approved).toEqual({ carryover: 5, current: 3, total: 8 });
    expect(y.carryoverRemaining).toBe(0);
    expect(y.currentRemaining).toBe(27);
    expect(y.totalAvailable).toBe(27);
  });

  it("shows the total available before any request", () => {
    const y = computeYear(2027, input({}));
    expect(y.carryoverTotal).toBe(5);
    expect(y.currentTotal).toBe(30);
    expect(y.totalAvailable).toBe(35);
  });

  it("uses carryover only for days up to March 31", () => {
    // Mar 30 - Apr 2: 4 working days, only Mar 30 and 31 may use carryover
    const r = req("2027-03-30", "2027-04-02", "approved");
    const y = computeYear(2027, input({ requests: [r] }));
    expect(y.approved).toEqual({ carryover: 2, current: 2, total: 4 });
  });

  it("never uses carryover for a request after the deadline", () => {
    const r = req("2027-05-03", "2027-05-05", "approved");
    const y = computeYear(2027, input({ requests: [r], today: "2027-04-15" }));
    expect(y.approved).toEqual({ carryover: 0, current: 3, total: 3 });
    expect(y.expired).toBe(5);
  });

  it("allocates chronologically across several approved requests", () => {
    const later = req("2027-03-01", "2027-03-05", "approved");
    const earlier = req("2027-01-11", "2027-01-13", "approved");
    const y = computeYear(2027, input({ requests: [later, earlier] }));
    expect(y.byRequest.get(earlier.id)).toEqual({ carryover: 3, current: 0, total: 3 });
    expect(y.byRequest.get(later.id)).toEqual({ carryover: 2, current: 3, total: 5 });
  });

  it("splits a half day between the buckets", () => {
    const r = req("2027-03-15", "2027-03-19", "approved", ["2027-03-19"]);
    const y = computeYear(2027, input({ requests: [r], carryover: 4.5 }));
    expect(y.approved).toEqual({ carryover: 4.5, current: 0, total: 4.5 });
    const r2 = req("2027-03-22", "2027-03-22", "approved");
    const y2 = computeYear(2027, input({ requests: [r, r2], carryover: 4 }));
    expect(y2.approved).toEqual({ carryover: 4, current: 1.5, total: 5.5 });
  });
});

describe("status handling", () => {
  it("pending requests reserve days but do not reduce the approved balance", () => {
    const p = req("2027-03-01", "2027-03-05", "pending");
    const y = computeYear(2027, input({ requests: [p] }));
    expect(y.totalAvailable).toBe(35);
    expect(y.pending).toEqual({ carryover: 5, current: 0, total: 5 });
    expect(y.freeTotal).toBe(30);
    expect(y.freeCarryover).toBe(0);
  });

  it("approval deducts from the right buckets", () => {
    const p = req("2027-03-01", "2027-03-05", "approved");
    const y = computeYear(2027, input({ requests: [p] }));
    expect(y.carryoverRemaining).toBe(0);
    expect(y.currentRemaining).toBe(30);
  });

  it("rejected, withdrawn and draft requests release all days", () => {
    const list = [
      req("2027-03-01", "2027-03-05", "rejected"),
      req("2027-03-08", "2027-03-12", "withdrawn"),
      req("2027-03-15", "2027-03-19", "draft"),
    ];
    const y = computeYear(2027, input({ requests: list }));
    expect(y.totalAvailable).toBe(35);
    expect(y.freeTotal).toBe(35);
    expect(y.allocations.length).toBe(0);
  });

  it("approved requests take precedence over earlier pending ones", () => {
    const pendingEarly = req("2027-02-01", "2027-02-05", "pending");
    const approvedLate = req("2027-03-01", "2027-03-03", "approved");
    const y = computeYear(2027, input({ requests: [pendingEarly, approvedLate] }));
    expect(y.byRequest.get(approvedLate.id)).toEqual({ carryover: 3, current: 0, total: 3 });
    expect(y.byRequest.get(pendingEarly.id)).toEqual({ carryover: 2, current: 3, total: 5 });
  });
});

describe("March 31 deadline", () => {
  it("flags unplanned carryover as at risk before the deadline", () => {
    const r = req("2027-01-04", "2027-01-05", "approved");
    const y = computeYear(2027, input({ requests: [r], today: "2027-03-31" }));
    expect(y.deadlinePassed).toBe(false);
    expect(y.atRisk).toBe(3);
    expect(y.expired).toBe(0);
    expect(y.carryoverRemaining).toBe(3);
  });

  it("flags remaining carryover as expired after the deadline, without deleting it", () => {
    const r = req("2027-01-04", "2027-01-05", "approved");
    const y = computeYear(2027, input({ requests: [r], today: "2027-04-01" }));
    expect(y.deadlinePassed).toBe(true);
    expect(y.expired).toBe(3);
    expect(y.carryoverTotal).toBe(5); // history stays visible
    expect(y.carryoverRemaining).toBe(0);
    expect(y.totalAvailable).toBe(30);
  });

  it("keeps carryover reserved by a pending request dated before the deadline", () => {
    const p = req("2027-03-29", "2027-03-31", "pending"); // Easter Monday + 2 days
    const y = computeYear(2027, input({ requests: [p], today: "2027-04-05" }));
    expect(y.pending.carryover).toBe(2);
    expect(y.expired).toBe(3);
  });

  it("supports a configurable deadline and a 'keep' policy", () => {
    const s = settings({ carryoverDeadlineMonth: 6, carryoverDeadlineDay: 30 });
    const r = req("2027-05-03", "2027-05-05", "approved");
    expect(computeYear(2027, input({ requests: [r], settings: s })).approved.carryover).toBe(3);

    const keep = settings({ expiryPolicy: "keep" });
    const y = computeYear(2027, input({ requests: [req("2027-09-06", "2027-09-08", "approved")], settings: keep, today: "2027-10-01" }));
    expect(y.approved.carryover).toBe(3);
    expect(y.expired).toBe(0);
  });

  it("supports a per-year deadline override", () => {
    const r = req("2027-04-12", "2027-04-13", "approved");
    const y = computeYear(2027, input({
      requests: [r],
      yearAccounts: [{ year: 2027, carryoverOverride: 5, carryoverDeadlineOverride: "2027-04-30" }],
    }));
    expect(y.approved.carryover).toBe(2);
  });
});

describe("year transitions", () => {
  it("carries the unused current-year balance into the next year", () => {
    const s = settings({ trackingStartYear: 2026 });
    const y2026 = req("2026-08-03", "2026-08-28", "approved"); // 20 days
    const inp = input({ settings: s, requests: [y2026], yearAccounts: [{ year: 2026, carryoverOverride: 0 }], today: "2027-01-10" });
    expect(computeYear(2026, inp).currentRemaining).toBe(10);
    const y = computeYear(2027, inp);
    expect(y.carryoverOpening).toBe(10);
    expect(y.totalAvailable).toBe(40);
  });

  it("does not roll over expired carryover under the expire policy", () => {
    const s = settings({ trackingStartYear: 2026 });
    const inp = input({ settings: s, yearAccounts: [{ year: 2026, carryoverOverride: 4 }], today: "2027-01-10" });
    expect(computeYear(2026, inp).expired).toBe(4);
    expect(computeYear(2027, inp).carryoverOpening).toBe(30);
  });

  it("splits a request across New Year", () => {
    const s = settings({ trackingStartYear: 2026 });
    const r = req("2026-12-28", "2027-01-08", "approved"); // 4 days in 2026 (Dec 28-31), 4 in 2027 (Jan 4,5,7,8)
    const inp = input({ settings: s, requests: [r], yearAccounts: [{ year: 2026, carryoverOverride: 0 }], today: "2026-12-01" });
    expect(computeYear(2026, inp).approved.total).toBe(4);
    const y27 = computeYear(2027, inp);
    expect(y27.approved.total).toBe(4);
    expect(y27.approved.carryover).toBe(4); // FIFO: carryover from 2026 first
  });

  it("shows a separate balance per year for a request across New Year", () => {
    const s = settings({ trackingStartYear: 2026 });
    const summer = req("2026-08-03", "2026-08-28", "approved"); // 20 days, 10 left in 2026
    const draft = req("2026-12-28", "2027-01-08", "draft"); // 4 days 2026, 4 days 2027
    const inp = input({ settings: s, requests: [summer, draft], yearAccounts: [{ year: 2026, carryoverOverride: 0 }], today: "2026-11-17" });
    const b = balanceForRequest(inp, draft);
    expect(b.parts).toHaveLength(2);
    const [p26, p27] = b.parts!;
    expect(p26).toMatchObject({ year: 2026, carryoverAvailable: 0, currentAvailable: 10, requested: 4, fromCarryover: 0, fromCurrent: 4, projected: 6 });
    // 2027 starts with what 2026 has left after this request: 10 - 4 = 6
    expect(p27).toMatchObject({ year: 2027, carryoverAvailable: 6, carryoverExpected: true, currentAvailable: 30, totalAvailable: 36 });
    expect(p27).toMatchObject({ requested: 4, fromCarryover: 4, fromCurrent: 0, projected: 32 });
    expect(b.nextYearDays).toBe(4);
  });

  it("reduces next year's expected carryover by pending requests of this year", () => {
    const s = settings({ trackingStartYear: 2026 });
    const summer = req("2026-08-03", "2026-08-28", "approved"); // 10 left
    const december = req("2026-12-14", "2026-12-16", "pending"); // 3 reserved
    const february = req("2027-02-01", "2027-02-05", "draft"); // 5 days
    const inp = input({ settings: s, requests: [summer, december, february], yearAccounts: [{ year: 2026, carryoverOverride: 0 }], today: "2026-11-17" });
    const y27 = computeYear(2027, inp);
    expect(y27.carryoverOpening).toBe(10); // official: only approved requests count
    expect(y27.carryoverReservedByPrev).toBe(3);
    expect(y27.freeCarryover).toBe(7);
    expect(y27.atRisk).toBe(7);
    const b = balanceForRequest(inp, february);
    expect(b.parts).toHaveLength(1);
    expect(b).toMatchObject({ year: 2027, carryoverAvailable: 7, carryoverExpected: true, requested: 5, fromCarryover: 5, projected: 32 });
  });

  it("keeps the next year untouched while the request stays in this year", () => {
    const s = settings({ trackingStartYear: 2026 });
    const draft = req("2026-12-14", "2026-12-16", "draft");
    const inp = input({ settings: s, requests: [draft], yearAccounts: [{ year: 2026, carryoverOverride: 0 }], today: "2026-11-17" });
    const b = balanceForRequest(inp, draft);
    expect(b.parts).toHaveLength(1);
    expect(b.nextYearDays).toBe(0);
    expect(computeYear(2027, inp).carryoverOpening).toBe(30);
  });

  it("ignores years before tracking started", () => {
    const y = computeYear(2025, input({}));
    expect(y.tracked).toBe(false);
    expect(y.totalAvailable).toBe(0);
  });

  it("prorates the first year of employment", () => {
    const s = settings({ trackingStartYear: 2027 }, { employmentStart: "2027-05-15" });
    const y = computeYear(2027, input({ settings: s, carryover: 0 }));
    expect(y.entitlement).toBe(18);
  });
});

describe("manual adjustments", () => {
  it("adds and removes days with an audit trail", () => {
    const adjustments: Adjustment[] = [
      { id: "a1", year: 2027, bucket: "carryover", days: 2, reason: "HR correction", createdAt: "2027-01-02T10:00:00Z" },
      { id: "a2", year: 2027, bucket: "current", days: -1, reason: "Special arrangement", createdAt: "2027-01-03T10:00:00Z" },
    ];
    const y = computeYear(2027, input({ adjustments }));
    expect(y.carryoverTotal).toBe(7);
    expect(y.currentTotal).toBe(29);
    expect(y.totalAvailable).toBe(36);
  });

  it("supports an entitlement override", () => {
    const y = computeYear(2027, input({ yearAccounts: [{ year: 2027, carryoverOverride: 5, entitlementOverride: 32 }] }));
    expect(y.entitlement).toBe(32);
  });
});

describe("request balance block", () => {
  it("shows before and after values for a new request", () => {
    const existing = req("2027-01-04", "2027-01-05", "approved");
    const draft = req("2027-03-30", "2027-04-02", "draft");
    const b = balanceForRequest(input({ requests: [existing, draft] }), draft);
    expect(b.carryoverAvailable).toBe(3);
    expect(b.currentAvailable).toBe(30);
    expect(b.totalAvailable).toBe(33);
    expect(b.requested).toBe(4);
    expect(b.fromCarryover).toBe(2);
    expect(b.fromCurrent).toBe(2);
    expect(b.projected).toBe(29);
  });

  it("treats an already pending request as itself, not as a reservation", () => {
    const p = req("2027-03-01", "2027-03-05", "pending");
    const b = balanceForRequest(input({ requests: [p] }), p);
    expect(b.reservedByPending).toBe(0);
    expect(b.projected).toBe(30);
  });

  it("numbers requests per year", () => {
    expect(nextRequestNumber([], 2027)).toBe("VR-2027-001");
    expect(nextRequestNumber([{ number: "VR-2027-009" } as VacationRequest], 2027)).toBe("VR-2027-010");
  });
});

describe("email template", () => {
  it("renders the example email", () => {
    const s = settings({}, { managerName: "Ms. Miller" });
    const r = req("2027-05-03", "2027-05-07", "draft");
    const b = balanceForRequest(input({ settings: s, requests: [r], today: "2027-02-10" }), r);
    const mail = renderEmail(DEFAULT_EMAIL_TEMPLATE, templateValues(s.profile, r, b));
    expect(mail.subject).toBe("Vacation request: Chris Doe, May 3 to May 7, 2027");
    expect(mail.body).toContain("Dear Ms. Miller,");
    expect(mail.body).toContain("Requested vacation days: 4"); // Ascension Day on May 6
    expect(mail.body).toContain("Carryover from 2026: 5 days, deadline March 31, 2027");
    expect(mail.body).toContain("Remaining in 2027 after approval: 31 days");
    expect(mail.body).not.toContain("Comment:");
    expect(mail.body).not.toContain("2028");
  });

  it("upgrades an unchanged old default template to the per-year balance", () => {
    const s = settings({}, { managerName: "Ms. Miller" });
    const r = req("2027-05-03", "2027-05-07", "draft");
    const b = balanceForRequest(input({ settings: s, requests: [r] }), r);
    const mail = renderEmail(LEGACY_EMAIL_TEMPLATE, templateValues(s.profile, r, b));
    expect(mail.body).toContain("Vacation balance 2027:");
    expect(mail.body).not.toContain("Previous year carryover:");
  });

  it("lists each year separately for a request across New Year", () => {
    const s = settings({ trackingStartYear: 2026 }, { managerName: "Ms. Miller" });
    const draft = req("2026-12-28", "2027-01-08", "draft");
    const inp = input({ settings: s, requests: [draft], yearAccounts: [{ year: 2026, carryoverOverride: 0 }], today: "2026-11-17" });
    const mail = renderEmail(DEFAULT_EMAIL_TEMPLATE, templateValues(s.profile, draft, balanceForRequest(inp, draft)));
    expect(mail.body).toContain("Requested vacation days: 8");
    expect(mail.body).toContain("This request spans 2026 and 2027.");
    expect(mail.body).toContain("Requested in 2026: 4 days (0 from 2025 carryover, 4 from 2026 vacation)");
    expect(mail.body).toContain("Carryover from 2026 (expected): 26 days");
    expect(mail.body).toContain("Requested in 2027: 4 days (4 from 2026 carryover, 0 from 2027 vacation)");
  });
});
