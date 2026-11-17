import { PDFDocument, rgb, StandardFonts, type PDFFont, type PDFPage } from "pdf-lib";
import type { TFunction } from "i18next";
import { employeeName } from "../domain/email";
import { formatDate, formatDateTime, formatDays, formatShort } from "../domain/format";
import type { BalanceSnapshot, Profile, VacationRequest, YearBalance } from "../domain/types";
import { sumDays } from "../domain/workdays";

const NAVY = rgb(15 / 255, 31 / 255, 61 / 255);
const TEXT = rgb(15 / 255, 23 / 255, 42 / 255);
const MUTED = rgb(100 / 255, 116 / 255, 139 / 255);
const LINE = rgb(229 / 255, 232 / 255, 238 / 255);
const AMBER = rgb(154 / 255, 83 / 255, 0);
const AMBER_BG = rgb(1, 244 / 255, 224 / 255);
const NAVY_BG = rgb(232 / 255, 237 / 255, 247 / 255);

/** Standard PDF fonts only know Latin-1. Replace anything else. */
function safe(text: string): string {
  return text
    .replace(/[−–—]/g, "-")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/…/g, "...")
    .replace(/[^\x09\x0A\x0D\x20-\x7E\xA0-\xFF]/g, "?");
}

function wrap(text: string, font: PDFFont, size: number, width: number): string[] {
  const out: string[] = [];
  for (const para of safe(text).split(/\r?\n/)) {
    let line = "";
    for (const word of para.split(/\s+/)) {
      const next = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(next, size) > width && line) {
        out.push(line);
        line = word;
      } else line = next;
    }
    out.push(line);
  }
  return out;
}

export interface PdfInput {
  t: TFunction;
  profile: Profile;
  request: VacationRequest;
  balance: BalanceSnapshot;
  generatedAt?: Date;
  /** Set when a request across New Year is split into one document per year. */
  part?: { index: number; count: number; year: number; otherYears: number[] };
}

/** Builds the official A4 vacation request document. */
export async function generateRequestPdf({ t, profile, request, balance, generatedAt = new Date(), part }: PdfInput): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const docNumber = part ? `${request.number} / ${part.year}` : request.number;
  doc.setTitle(safe(`${t("pdf.title")} ${docNumber}`));
  doc.setAuthor(safe(employeeName(profile)));
  doc.setSubject(safe(t("pdf.title")));
  doc.setCreator("My Vacation Manager");
  doc.setCreationDate(generatedAt);

  const page = doc.addPage([595.28, 841.89]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const W = page.getWidth();
  const M = 48;
  let y = page.getHeight();

  const text = (p: PDFPage, s: string, x: number, yy: number, size = 10, f = font, color = TEXT) =>
    p.drawText(safe(s), { x, y: yy, size, font: f, color });
  const right = (s: string, xRight: number, yy: number, size = 10, f = font, color = TEXT) =>
    text(page, s, xRight - f.widthOfTextAtSize(safe(s), size), yy, size, f, color);

  // Header band
  page.drawRectangle({ x: 0, y: y - 92, width: W, height: 92, color: NAVY });
  text(page, profile.company || "", M, y - 40, 17, bold, rgb(1, 1, 1));
  text(page, t("pdf.title").toUpperCase(), M, y - 60, 10, font, rgb(0.78, 0.82, 0.9));
  right(docNumber, W - M, y - 40, 12, bold, rgb(1, 1, 1));
  right(t("pdf.date", { date: formatDate((request.sentAt ?? request.createdAt).slice(0, 10)) }), W - M, y - 58, 9, font, rgb(0.78, 0.82, 0.9));
  y -= 122;

  const section = (title: string) => {
    text(page, title.toUpperCase(), M, y, 8.5, bold, MUTED);
    page.drawLine({ start: { x: M, y: y - 6 }, end: { x: W - M, y: y - 6 }, thickness: 0.7, color: LINE });
    y -= 24;
  };
  const colW = (W - 2 * M) / 2;
  const pair = (label: string, value: string, col: 0 | 1) => {
    const x = M + col * colW;
    text(page, label, x, y, 8.5, font, MUTED);
    text(page, value || "-", x, y - 13, 10.5, bold);
  };

  // Employee
  section(t("pdf.employee"));
  pair(t("pdf.name"), employeeName(profile), 0);
  pair(t("pdf.employeeId"), profile.employeeId || t("pdf.notProvided"), 1);
  y -= 34;
  pair(t("pdf.company"), profile.company, 0);
  pair(t("pdf.employmentStart"), profile.employmentStart ? formatDate(profile.employmentStart) : "", 1);
  y -= 34;
  if (profile.department || profile.jobTitle) {
    pair(t("pdf.department"), profile.department, 0);
    pair(t("pdf.jobTitle"), profile.jobTitle, 1);
    y -= 34;
  }
  y -= 6;

  // Vacation period
  section(t("pdf.period"));
  const total = sumDays(request.days);
  pair(t("pdf.from"), formatDate(request.start, "en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" }), 0);
  pair(t("pdf.to"), formatDate(request.end, "en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" }), 1);
  y -= 34;
  pair(t("pdf.workingDays"), t("common.days", { count: total, value: formatDays(total) }), 0);
  const halves = request.days.filter((d) => d.value < 1).map((d) => formatShort(d.date));
  pair(t("pdf.halfDays"), halves.length ? halves.join(", ") : t("pdf.none"), 1);
  y -= 40;
  if (part) {
    y += 6;
    page.drawRectangle({ x: M, y: y - 6, width: W - 2 * M, height: 20, color: NAVY_BG });
    text(page, t("pdf.partNote", { index: part.index, count: part.count, year: part.year, other: part.otherYears.join(", ") }), M + 8, y, 8.5, bold, NAVY);
    y -= 28;
  }

  // Balance table: one column per calendar year, each year strictly separate.
  const parts: YearBalance[] = balance.parts?.length ? balance.parts : [balance];
  const multi = parts.length > 1;
  section(multi ? t("pdf.balanceMulti", { years: parts.map((p) => p.year).join(" / ") }) : t("pdf.balance", { year: balance.year }));
  const rowH = multi || part ? 17 : 19;
  const days = (n: number) => t("common.days", { count: n, value: formatDays(n) });
  const valueX = (i: number) => W - M - 10 - (parts.length - 1 - i) * 110;
  const anyExpected = parts.some((p) => p.carryoverExpected);
  if (multi) {
    parts.forEach((p, i) => right(String(p.year), valueX(i), y, 10, bold, NAVY));
    y -= 16;
  }
  // Carryover highlighted
  page.drawRectangle({ x: M, y: y - 26, width: W - 2 * M, height: 36, color: AMBER_BG, borderColor: rgb(246 / 255, 209 / 255, 153 / 255), borderWidth: 0.7 });
  text(page, multi ? t("pdf.carryoverPrev") : t("pdf.carryoverFrom", { year: balance.year - 1 }), M + 10, y - 3, 10, bold, AMBER);
  parts.forEach((p, i) => right(days(p.carryoverAvailable) + (p.carryoverExpected ? " *" : ""), valueX(i), y - 3, 10, bold, AMBER));
  text(page, t("pdf.deadline"), M + 10, y - 18, 8.5, font, AMBER);
  parts.forEach((p, i) => right(formatDate(p.carryoverDeadline), valueX(i), y - 18, 8.5, bold, AMBER));
  y -= 46;
  const label = (key: string, year: number) => (multi ? t(`pdf.${key}`) : t(`pdf.${key}Year`, { year, prev: year - 1 }));
  const rows: [string, (p: YearBalance) => string, boolean?][] = [
    [label("currentRemaining", balance.year), (p) => days(p.currentAvailable)],
    [label("totalAvailable", balance.year), (p) => days(p.totalAvailable)],
    ...(parts.some((p) => p.reservedByPending > 0)
      ? [[t("pdf.reserved"), (p: YearBalance) => (p.reservedByPending > 0 ? `- ${days(p.reservedByPending)}` : "-")] as [string, (p: YearBalance) => string]]
      : []),
    [label("requested", balance.year), (p) => days(p.requested)],
    [label("fromCarryover", balance.year), (p) => days(p.fromCarryover)],
    [label("fromCurrent", balance.year), (p) => days(p.fromCurrent)],
    [label("projected", balance.year), (p) => days(p.projected), true],
  ];
  for (const [rowLabel, value, strong] of rows) {
    if (strong) page.drawRectangle({ x: M, y: y - 6, width: W - 2 * M, height: rowH, color: NAVY_BG });
    text(page, rowLabel, M + 10, y, 10, strong ? bold : font, strong ? TEXT : MUTED);
    parts.forEach((p, i) => right(value(p), valueX(i), y, 10, bold));
    page.drawLine({ start: { x: M, y: y - 6 }, end: { x: W - M, y: y - 6 }, thickness: 0.5, color: LINE });
    y -= rowH;
  }
  if (anyExpected) {
    text(page, t("pdf.expectedNote"), M + 10, y - 1, 8, font, MUTED);
    y -= 10;
  }
  y -= anyExpected ? 10 : 14;

  // Comment
  if (request.comment.trim()) {
    section(t("pdf.comment"));
    const lines = wrap(request.comment.trim(), font, 10, W - 2 * M).slice(0, 4);
    for (const l of lines) {
      text(page, l, M, y, 10);
      y -= 14;
    }
    y -= 10;
  }

  // Signatures: employee left, manager right
  const half = (W - 2 * M - 20) / 2;
  section(t("pdf.signatures"));
  const sigY = y;
  text(page, t("pdf.employeeSignature"), M, sigY, 8.5, bold, MUTED);
  if (request.signature) {
    const png = await doc.embedPng(request.signature.dataUrl);
    const maxW = half - 10;
    const maxH = 62;
    const scale = Math.min(maxW / png.width, maxH / png.height);
    page.drawImage(png, { x: M, y: sigY - 12 - png.height * scale, width: png.width * scale, height: png.height * scale });
  } else {
    text(page, t("pdf.notSigned"), M, sigY - 40, 9, font, MUTED);
  }
  page.drawLine({ start: { x: M, y: sigY - 80 }, end: { x: M + half, y: sigY - 80 }, thickness: 0.7, color: TEXT });
  text(page, employeeName(profile), M, sigY - 93, 9.5, bold);
  if (request.signature) {
    text(page, t("pdf.signedAt", { date: formatDateTime(request.signature.signedAt) }), M, sigY - 106, 8.5, font, MUTED);
  }

  // Manager box
  const mx = M + half + 20;
  page.drawRectangle({ x: mx, y: sigY - 150, width: half, height: 160, borderColor: LINE, borderWidth: 1 });
  text(page, t("pdf.managerDecision"), mx + 10, sigY - 6, 8.5, bold, MUTED);
  const checkbox = (label: string, x: number) => {
    page.drawRectangle({ x, y: sigY - 30, width: 10, height: 10, borderColor: TEXT, borderWidth: 0.8 });
    text(page, label, x + 15, sigY - 29, 9.5);
  };
  checkbox(t("pdf.approved"), mx + 10);
  checkbox(t("pdf.rejected"), mx + 95);
  text(page, t("pdf.managerComments"), mx + 10, sigY - 50, 8.5, font, MUTED);
  for (let i = 0; i < 2; i++) {
    page.drawLine({ start: { x: mx + 10, y: sigY - 68 - i * 16 }, end: { x: mx + half - 10, y: sigY - 68 - i * 16 }, thickness: 0.5, color: LINE });
  }
  page.drawLine({ start: { x: mx + 10, y: sigY - 125 }, end: { x: mx + 70, y: sigY - 125 }, thickness: 0.7, color: TEXT });
  page.drawLine({ start: { x: mx + 85, y: sigY - 125 }, end: { x: mx + half - 10, y: sigY - 125 }, thickness: 0.7, color: TEXT });
  text(page, t("pdf.dateLabel"), mx + 10, sigY - 138, 8, font, MUTED);
  text(page, profile.managerName ? t("pdf.managerSignatureNamed", { name: profile.managerName }) : t("pdf.managerSignature"), mx + 85, sigY - 138, 8, font, MUTED);

  // Footer
  page.drawLine({ start: { x: M, y: 46 }, end: { x: W - M, y: 46 }, thickness: 0.5, color: LINE });
  text(page, t("pdf.footer", { date: formatDateTime(generatedAt.toISOString()) }), M, 32, 7.5, font, MUTED);
  right(docNumber, W - M, 32, 7.5, font, MUTED);

  return doc.save();
}

export function pdfFilename(request: VacationRequest, profile: Profile, year?: number): string {
  const name = employeeName(profile).replace(/[^\w]+/g, "-").replace(/^-|-$/g, "") || "employee";
  return `${request.number}${year ? `_${year}` : ""}_Vacation-Request_${name}.pdf`;
}

export interface YearPart {
  year: number;
  request: VacationRequest;
  balance: BalanceSnapshot;
}

/**
 * A request across New Year becomes one part per calendar year: only the
 * days of that year and only that year's balance. One year: one part.
 */
export function splitByYear(request: VacationRequest, balance: BalanceSnapshot): YearPart[] {
  const parts = balance.parts ?? [];
  if (parts.length < 2) return [{ year: balance.year, request, balance }];
  return parts.map((p) => {
    const from = `${p.year}-01-01`;
    const to = `${p.year}-12-31`;
    return {
      year: p.year,
      request: {
        ...request,
        start: request.start > from ? request.start : from,
        end: request.end < to ? request.end : to,
        days: request.days.filter((d) => d.date >= from && d.date <= to),
      },
      balance: { ...p, nextYearDays: 0, parts: [p] },
    };
  });
}

export interface PdfFile {
  filename: string;
  bytes: Uint8Array;
}

/** All documents for a request: one PDF, or one per year across New Year. */
export async function generateRequestPdfs(input: PdfInput): Promise<PdfFile[]> {
  const parts = splitByYear(input.request, input.balance);
  if (parts.length === 1) return [{ filename: pdfFilename(input.request, input.profile), bytes: await generateRequestPdf(input) }];
  const years = parts.map((p) => p.year);
  return Promise.all(
    parts.map(async (p, i) => ({
      filename: pdfFilename(input.request, input.profile, p.year),
      bytes: await generateRequestPdf({
        ...input,
        request: p.request,
        balance: p.balance,
        part: { index: i + 1, count: parts.length, year: p.year, otherYears: years.filter((y) => y !== p.year) },
      }),
    })),
  );
}
