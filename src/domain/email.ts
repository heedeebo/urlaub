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

/** Plain text balance, one section per calendar year. */
export function balanceText(b: BalanceSnapshot, locale = "en-US"): string {
  const parts: YearBalance[] = b.parts?.length ? b.parts : [b];
  const n = (v: number) => `${formatDays(v, locale)} ${v === 1 ? "day" : "days"}`;
  const sections = parts.map((p) => {
    const lines = [
      `Vacation balance ${p.year}:`,
      `Carryover from ${p.year - 1}${p.carryoverExpected ? " (expected)" : ""}: ${n(p.carryoverAvailable)}, deadline ${formatDate(p.carryoverDeadline, locale)}`,
      `${p.year} vacation remaining: ${n(p.currentAvailable)}`,
      `Total available in ${p.year}: ${n(p.totalAvailable)}`,
    ];
    if (p.reservedByPending > 0) lines.push(`Reserved by other pending requests: ${n(p.reservedByPending)}`);
    lines.push(
      `Requested in ${p.year}: ${n(p.requested)} (${formatDays(p.fromCarryover, locale)} from ${p.year - 1} carryover, ${formatDays(p.fromCurrent, locale)} from ${p.year} vacation)`,
      `Remaining in ${p.year} after approval: ${n(p.projected)}`,
    );
    return lines.join("\n");
  });
  if (parts.length > 1) {
    sections.unshift(`This request spans ${parts.map((p) => p.year).join(" and ")}. Each year is deducted from its own balance.`);
  }
  return sections.join("\n\n") + "\n";
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
