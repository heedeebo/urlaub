import { writeFileSync } from "node:fs";
import i18n from "i18next";
import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { defaultSettings } from "../domain/defaults";
import { createHolidayLookup } from "../domain/holidays";
import { balanceForRequest } from "../domain/ledger";
import type { VacationRequest } from "../domain/types";
import { buildRequestDays } from "../domain/workdays";
import en from "../i18n/en";
import { generateRequestPdf, generateRequestPdfs, splitByYear } from "./pdf";

// 1x1 PNG, stands in for a drawn signature
const PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

describe("PDF document", () => {
  it("creates a one-page A4 request with signature and balance", async () => {
    await i18n.init({ resources: { en: { translation: en } }, lng: "en", interpolation: { escapeValue: false } });
    const s = defaultSettings(2027);
    s.profile = {
      ...s.profile,
      firstName: "Jürgen",
      lastName: "Müller",
      company: "Example GmbH",
      employeeId: "4711",
      department: "Engineering",
      jobTitle: "Project Manager",
      employmentStart: "2015-04-01",
      managerName: "Ms. Miller",
    };
    const ctx = { workdays: [1, 2, 3, 4, 5], holiday: createHolidayLookup("DE", "BW") };
    const r: VacationRequest = {
      id: "r1",
      number: "VR-2027-001",
      start: "2027-03-29",
      end: "2027-04-09",
      days: buildRequestDays("2027-03-29", "2027-04-09", ctx, ["2027-04-09"]),
      comment: "Family trip to the Black Forest. Reachable by phone in urgent cases – thanks!",
      status: "pending",
      signature: { dataUrl: PNG, signedAt: "2027-02-10T09:30:00.000Z" },
      statusHistory: [],
      createdAt: "2027-02-10T09:00:00.000Z",
      updatedAt: "",
      sentAt: "2027-02-10T09:31:00.000Z",
    };
    const balance = balanceForRequest(
      { settings: s, yearAccounts: [{ year: 2027, carryoverOverride: 5 }], adjustments: [], requests: [], today: "2027-02-10" },
      r,
    );
    const bytes = await generateRequestPdf({ t: i18n.t, profile: s.profile, request: r, balance, generatedAt: new Date("2027-02-10T09:31:00Z") });
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBe(1);
    expect(Math.round(doc.getPage(0).getWidth())).toBe(595);
    expect(doc.getTitle()).toContain("VR-2027-001");
    expect(balance.fromCarryover).toBe(2); // Mar 30 + 31, Easter Monday is a holiday
    if (process.env.PDF_OUT) writeFileSync(process.env.PDF_OUT, bytes);
  });
});

describe("PDF document across New Year", () => {
  it("shows one balance column per year and stays on one page", async () => {
    await i18n.init({ resources: { en: { translation: en } }, lng: "en", interpolation: { escapeValue: false } });
    const s = defaultSettings(2026);
    s.profile = { ...s.profile, firstName: "Chris", lastName: "Doe", company: "Example GmbH", employmentStart: "2015-04-01", department: "Sales", jobTitle: "Manager" };
    const ctx = { workdays: [1, 2, 3, 4, 5], holiday: createHolidayLookup("DE", "BW") };
    const r: VacationRequest = {
      id: "r2",
      number: "VR-2026-004",
      start: "2026-12-28",
      end: "2027-01-08",
      days: buildRequestDays("2026-12-28", "2027-01-08", ctx),
      comment: "Christmas holidays with the family.",
      status: "pending",
      signature: { dataUrl: PNG, signedAt: "2026-11-17T09:30:00.000Z" },
      statusHistory: [],
      createdAt: "2026-11-17T09:00:00.000Z",
      updatedAt: "",
      sentAt: "2026-11-17T09:31:00.000Z",
    };
    const balance = balanceForRequest(
      { settings: s, yearAccounts: [{ year: 2026, carryoverOverride: 3 }], adjustments: [], requests: [], today: "2026-11-17" },
      r,
    );
    expect(balance.parts?.map((p) => p.year)).toEqual([2026, 2027]);
    const bytes = await generateRequestPdf({ t: i18n.t, profile: s.profile, request: r, balance, generatedAt: new Date("2026-11-17T09:31:00Z") });
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBe(1);
    if (process.env.PDF_OUT_MULTI) writeFileSync(process.env.PDF_OUT_MULTI, bytes);

    // Strictly per year: one PDF per calendar year with only that year's days.
    const parts = splitByYear(r, balance);
    expect(parts.map((p) => [p.request.start, p.request.end, p.request.days.every((d) => d.date.startsWith(String(p.year)))])).toEqual([
      ["2026-12-28", "2026-12-31", true],
      ["2027-01-01", "2027-01-08", true],
    ]);
    expect(parts.map((p) => p.balance.parts?.length)).toEqual([1, 1]);
    const files = await generateRequestPdfs({ t: i18n.t, profile: s.profile, request: r, balance, generatedAt: new Date("2026-11-17T09:31:00Z") });
    expect(files.map((f) => f.filename)).toEqual([
      "VR-2026-004_2026_Vacation-Request_Chris-Doe.pdf",
      "VR-2026-004_2027_Vacation-Request_Chris-Doe.pdf",
    ]);
    for (const f of files) expect((await PDFDocument.load(f.bytes)).getPageCount()).toBe(1);
    if (process.env.PDF_OUT_PARTS) files.forEach((f, i) => writeFileSync(`${process.env.PDF_OUT_PARTS}-${i + 1}.pdf`, f.bytes));
  });
});
