import { formatDate, formatDays, formatRange } from "./format";
import type { BalanceSnapshot, EmailTemplate, Profile, VacationRequest } from "./types";

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
    comment: req.comment ?? "",
    commentBlock: req.comment?.trim() ? `\nComment: ${req.comment.trim()}\n` : "",
    company: profile.company,
    employeeId: profile.employeeId,
  };
}

export function renderTemplate(text: string, values: Record<string, string>): string {
  return text.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key: string) => values[key] ?? "");
}

export function renderEmail(template: EmailTemplate, values: Record<string, string>) {
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
  "comment",
  "commentBlock",
  "company",
  "employeeId",
];
