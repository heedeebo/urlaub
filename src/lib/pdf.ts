import { PDFDocument, rgb, StandardFonts, type PDFFont, type PDFPage } from "pdf-lib";
import type { TFunction } from "i18next";
import { employeeName } from "../domain/email";
import { formatDate, formatDateTime, formatDays, formatShort } from "../domain/format";
import type { BalanceSnapshot, Profile, VacationRequest } from "../domain/types";
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
}

/** Builds the official A4 vacation request document. */
export async function generateRequestPdf({ t, profile, request, balance, generatedAt = new Date() }: PdfInput): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(safe(`${t("pdf.title")} ${request.number}`));
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
  right(request.number, W - M, y - 40, 12, bold, rgb(1, 1, 1));
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

  // Balance table
  section(t("pdf.balance", { year: balance.year }));
  const rowH = 19;
  const days = (n: number) => t("common.days", { count: n, value: formatDays(n) });
  // Carryover highlighted
  page.drawRectangle({ x: M, y: y - 26, width: W - 2 * M, height: 36, color: AMBER_BG, borderColor: rgb(246 / 255, 209 / 255, 153 / 255), borderWidth: 0.7 });
  text(page, t("pdf.carryover"), M + 10, y - 3, 10, bold, AMBER);
  right(days(balance.carryoverAvailable), W - M - 10, y - 3, 10, bold, AMBER);
  text(page, t("pdf.deadline"), M + 10, y - 18, 8.5, font, AMBER);
  right(formatDate(balance.carryoverDeadline), W - M - 10, y - 18, 8.5, bold, AMBER);
  y -= 46;
  const rows: [string, string, boolean?][] = [
    [t("pdf.currentRemaining"), days(balance.currentAvailable)],
    [t("pdf.totalAvailable"), days(balance.totalAvailable)],
    ...(balance.reservedByPending > 0 ? [[t("pdf.reserved"), `- ${days(balance.reservedByPending)}`] as [string, string]] : []),
    [t("pdf.requested"), days(balance.requested)],
    [t("pdf.fromCarryover"), days(balance.fromCarryover)],
    [t("pdf.fromCurrent"), days(balance.fromCurrent)],
    [t("pdf.projected"), days(balance.projected), true],
  ];
  for (const [label, value, strong] of rows) {
    if (strong) page.drawRectangle({ x: M, y: y - 6, width: W - 2 * M, height: rowH, color: NAVY_BG });
    text(page, label, M + 10, y, 10, strong ? bold : font, strong ? TEXT : MUTED);
    right(value, W - M - 10, y, 10, bold);
    page.drawLine({ start: { x: M, y: y - 6 }, end: { x: W - M, y: y - 6 }, thickness: 0.5, color: LINE });
    y -= rowH;
  }
  if (balance.nextYearDays > 0) {
    text(page, t("pdf.nextYear", { days: formatDays(balance.nextYearDays), year: balance.year + 1, count: balance.nextYearDays }), M + 10, y - 2, 8.5, font, MUTED);
    y -= 14;
  }
  y -= 14;

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
  right(request.number, W - M, 32, 7.5, font, MUTED);

  return doc.save();
}

export function pdfFilename(request: VacationRequest, profile: Profile): string {
  const name = employeeName(profile).replace(/[^\w]+/g, "-").replace(/^-|-$/g, "") || "employee";
  return `${request.number}_Vacation-Request_${name}.pdf`;
}
