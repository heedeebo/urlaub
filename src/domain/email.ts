import { formatDate, formatDays, formatRange } from "./format";
import { DEFAULT_EMAIL_TEMPLATE, LEGACY_EMAIL_TEMPLATE } from "./defaults";
import type { BalanceSnapshot, EmailTemplate, Profile, VacationRequest, YearBalance } from "./types";

export function employeeName(p: Profile): string {
  return `${p.firstName} ${p.lastName}`.trim();
}

export function templateValues(
  profile: Profile,
  req: Pick<VacationRequest, "start" | "end" | "comment">,
  b: BalanceSnapshot,
  locale = "en-US",
): Record<string, string> {
  const total = b.requested + b.nextYearDays;
  return {
    employeeName: employeeName(profile),
    managerName: profile.managerName || "Sir or Madam",
    from: formatDate(req.start, locale),
    to: formatDate(req.end, locale),
    dateRange: formatRange(req.start, req.end, locale),
    days: formatDays(total, locale),
    carryover: formatDays(b.carryoverAvailable, locale),
    carryoverDeadline: formatDate(b.carryoverDeadline, locale),
    currentRemaining: formatDays(b.currentAvailable, locale),
    totalAvailable: formatDays(b.totalAvailable, locale),
    projected: formatDays(b.projected, locale),
    balanceBlock: balanceText(b, locale),
    comment: req.comment ?? "",
    commentBlock: req.comment?.trim() ? `\nComment: ${req.comment.trim()}\n` : "",
    company: profile.company,
    employeeId: profile.employeeId,
  };
}

/** Plain text balance, one section per calendar year (phones only get plain text). */
export function balanceText(b: BalanceSnapshot, locale = "en-US"): string {
  const parts: YearBalance[] = b.parts?.length ? b.parts : [b];
  const n = (v: number) => `${formatDays(v, locale)} ${v === 1 ? "day" : "days"}`;
  const sections = parts.map((p) => {
    const lines = [
      `VACATION BALANCE ${p.year}`,
      `• Carryover from ${p.year - 1}${p.carryoverExpected ? " (expected)" : ""}: ${n(p.carryoverAvailable)}, deadline ${formatDate(p.carryoverDeadline, locale)}`,
      `• ${p.year} vacation remaining: ${n(p.currentAvailable)}`,
      `• Total available in ${p.year}: ${n(p.totalAvailable)}`,
    ];
    if (p.reservedByPending > 0) lines.push(`• Reserved by other pending requests: ${n(p.reservedByPending)}`);
    lines.push(
      `• Requested in ${p.year}: ${n(p.requested)} (${formatDays(p.fromCarryover, locale)} from ${p.year - 1} carryover, ${formatDays(p.fromCurrent, locale)} from ${p.year} vacation)`,
      `• Remaining in ${p.year} after approval: ${n(p.projected)}`,
    );
    return lines.join("\n");
  });
  if (parts.length > 1) {
    sections.unshift(`This request spans ${parts.map((p) => p.year).join(" and ")}. Each year is deducted from its own balance, so there is one PDF per year attached.`);
  }
  return sections.join("\n\n") + "\n";
}

const esc = (v: string) => v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const FONT = "font-family:Calibri,Arial,Helvetica,sans-serif;";
const NAVY = "#0f1f3d";

/** HTML balance: one small table per calendar year, numbers in bold. */
export function balanceHtml(b: BalanceSnapshot, locale = "en-US"): string {
  const parts: YearBalance[] = b.parts?.length ? b.parts : [b];
  const n = (v: number) => esc(`${formatDays(v, locale)} ${v === 1 ? "day" : "days"}`);
  const row = (label: string, value: string, opt: { strong?: boolean; amber?: boolean; small?: string } = {}) => {
    const bg = opt.strong ? "background:#e8edf7;" : opt.amber ? "background:#fff4e0;" : "";
    const color = opt.amber ? "color:#9a5300;" : "color:#1f2937;";
    const small = opt.small ? `<br><span style="font-size:9pt;color:#64748b;font-weight:normal">${esc(opt.small)}</span>` : "";
    return (
      `<tr><td style="${FONT}${bg}${color}padding:5px 10px;border-bottom:1px solid #e5e8ee;${opt.strong ? "font-weight:bold;" : ""}">${esc(label)}${small}</td>` +
      `<td style="${FONT}${bg}${color}padding:5px 10px;border-bottom:1px solid #e5e8ee;text-align:right;font-weight:bold;white-space:nowrap">${value}</td></tr>`
    );
  };
  const tables = parts.map((p) => {
    const rows = [
      row(`Carryover from ${p.year - 1}${p.carryoverExpected ? " (expected)" : ""}`, n(p.carryoverAvailable), {
        amber: true,
        small: `Deadline ${formatDate(p.carryoverDeadline, locale)}`,
      }),
      row(`${p.year} vacation remaining`, n(p.currentAvailable)),
      row(`Total available in ${p.year}`, n(p.totalAvailable)),
    ];
    if (p.reservedByPending > 0) rows.push(row("Reserved by other pending requests", n(p.reservedByPending)));
    rows.push(
      row(`Requested in ${p.year}`, n(p.requested), {
        small: `${formatDays(p.fromCarryover, locale)} from ${p.year - 1} carryover, ${formatDays(p.fromCurrent, locale)} from ${p.year} vacation`,
      }),
      row(`Remaining in ${p.year} after approval`, n(p.projected), { strong: true }),
    );
    return (
      `<p style="${FONT}margin:14px 0 4px;font-size:10pt;font-weight:bold;color:${NAVY};letter-spacing:.5px">VACATION BALANCE ${p.year}</p>` +
      `<table cellpadding="0" cellspacing="0" style="border-collapse:collapse;width:100%;max-width:520px;font-size:11pt;border:1px solid #e5e8ee;margin-bottom:14px">${rows.join("")}</table>`
    );
  });
  const intro =
    parts.length > 1
      ? `<p style="${FONT}margin:10px 0;padding:8px 10px;max-width:500px;background:#e8edf7;color:${NAVY};font-size:10pt">This request spans <b>${parts.map((p) => p.year).join(" and ")}</b>. Each year is deducted from its own balance, so there is one PDF per year attached.</p>`
      : "";
  return intro + tables.join("");
}

/** The same values as templateValues, but as HTML: data in bold, balance as tables. */
export function templateValuesHtml(
  profile: Profile,
  req: Pick<VacationRequest, "start" | "end" | "comment">,
  b: BalanceSnapshot,
  locale = "en-US",
): Record<string, string> {
  const text = templateValues(profile, req, b, locale);
  const plain = new Set(["employeeName", "managerName", "company", "comment"]);
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(text)) out[k] = plain.has(k) || !v ? esc(v) : `<b>${esc(v)}</b>`;
  out.balanceBlock = balanceHtml(b, locale);
  out.commentBlock = req.comment?.trim()
    ? `<p style="${FONT}margin:12px 0;padding:8px 10px;max-width:497px;border-left:3px solid ${NAVY};background:#f4f6f9"><b>Comment:</b> ${esc(req.comment.trim())}</p>`
    : "";
  return out;
}

export function renderTemplate(text: string, values: Record<string, string>): string {
  return text.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key: string) => values[key] ?? "");
}

export function renderEmail(saved: EmailTemplate, values: Record<string, string>) {
  // An unchanged copy of the old default template gets the new per-year balance.
  const template = saved.body === LEGACY_EMAIL_TEMPLATE.body ? { ...saved, body: DEFAULT_EMAIL_TEMPLATE.body } : saved;
  return {
    subject: renderTemplate(template.subject, values).trim(),
    body: renderTemplate(template.body, values).replace(/\n{3,}/g, "\n\n").trim(),
  };
}

/**
 * HTML version of the email for Outlook: the saved template's text, with the
 * values in bold and the balance as a table. Template text stays as written.
 */
export function renderEmailHtml(saved: EmailTemplate, htmlValues: Record<string, string>): string {
  const template = saved.body === LEGACY_EMAIL_TEMPLATE.body ? DEFAULT_EMAIL_TEMPLATE.body : saved.body;
  const html = template
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .split(/(\{\{\s*\w+\s*\}\})/g)
    .map((piece) => {
      const m = /^\{\{\s*(\w+)\s*\}\}$/.exec(piece);
      return m ? (htmlValues[m[1]] ?? "") : esc(piece).replace(/\n/g, "<br>");
    })
    .join("")
    // Block elements bring their own spacing.
    .replace(/(<br>\s*)+(<(p|table)\b)/g, "$2")
    .replace(/(<\/(p|table)>)(\s*<br>)+/g, "$1");
  return `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="${FONT}font-size:11pt;color:#1f2937;line-height:1.45">${html}</body></html>`;
}

export const TEMPLATE_PLACEHOLDERS = [
  "employeeName",
  "managerName",
  "from",
  "to",
  "dateRange",
  "days",
  "carryover",
  "carryoverDeadline",
  "currentRemaining",
  "totalAvailable",
  "projected",
  "balanceBlock",
  "comment",
  "commentBlock",
  "company",
  "employeeId",
];
