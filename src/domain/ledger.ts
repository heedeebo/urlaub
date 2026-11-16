import { makeDate, roundHalf, yearOf } from "./dates";
import { entitlementForYear } from "./entitlement";
import type {
  Adjustment,
  BalanceSnapshot,
  ISODate,
  RequestDay,
  RequestStatus,
  Settings,
  VacationRequest,
  YearAccount,
} from "./types";

export interface LedgerInput {
  settings: Settings;
  yearAccounts: YearAccount[];
  adjustments: Adjustment[];
  requests: VacationRequest[];
  today: ISODate;
}

export interface Preview {
  id: string;
  days: RequestDay[];
}

export type AllocationStatus = RequestStatus | "preview";

export interface DayAllocation {
  requestId: string;
  status: AllocationStatus;
  date: ISODate;
  value: number;
  carryover: number;
  current: number;
}

export interface Split {
  carryover: number;
  current: number;
  total: number;
}

export interface YearLedger {
  year: number;
  /** False for years before the first tracked year. */
  tracked: boolean;
  entitlement: number;
  entitlementIsOverride: boolean;
  carryoverOpening: number;
  carryoverIsOverride: boolean;
  carryoverDeadline: ISODate;
  deadlinePassed: boolean;
  carryoverAdjustments: number;
  currentAdjustments: number;
  /** Carryover pot: opening plus adjustments. */
  carryoverTotal: number;
  /** Entitlement plus adjustments. */
  currentTotal: number;
  approved: Split;
  pending: Split;
  preview: Split;
  /** Carryover days flagged as expired (never deleted, only flagged). */
  expired: number;
  /** Carryover days not yet planned while the deadline is still ahead. */
  atRisk: number;
  /** Balances after approved requests (and expiry). */
  carryoverRemaining: number;
  currentRemaining: number;
  totalAvailable: number;
  /** Balances after approved and pending requests. */
  freeCarryover: number;
  freeCurrent: number;
  freeTotal: number;
  /** Balances after approved, pending and the preview request. */
  projectedTotal: number;
  allocations: DayAllocation[];
  byRequest: Map<string, Split>;
}

const emptySplit = (): Split => ({ carryover: 0, current: 0, total: 0 });

function addToSplit(s: Split, carryover: number, current: number) {
  s.carryover = roundHalf(s.carryover + carryover);
  s.current = roundHalf(s.current + current);
  s.total = roundHalf(s.carryover + s.current);
}

export function carryoverDeadlineFor(year: number, input: LedgerInput): ISODate {
  const acc = input.yearAccounts.find((a) => a.year === year);
  if (acc?.carryoverDeadlineOverride) return acc.carryoverDeadlineOverride;
  const p = input.settings.policy;
  return makeDate(year, p.carryoverDeadlineMonth, p.carryoverDeadlineDay);
}

/**
 * Computes the vacation account for one calendar year.
 *
 * Rules:
 * - Two buckets: carryover from the previous year and the current year entitlement.
 * - FIFO: every vacation day uses carryover first, but only for dates on or before
 *   the carryover deadline (unless the policy is "keep").
 * - Approved requests are allocated first (by date), then pending requests
 *   (reservations), then an optional preview (the request being edited).
 * - Pending requests never reduce the approved balance, they only reserve days.
 * - After the deadline, unused carryover is flagged as expired. Nothing is deleted.
 */
export function computeYear(
  year: number,
  input: LedgerInput,
  preview?: Preview,
  cache: Map<number, YearLedger> = new Map(),
): YearLedger {
  if (!preview && cache.has(year)) return cache.get(year)!;

  const { settings } = input;
  const { profile, policy } = settings;
  const acc = input.yearAccounts.find((a) => a.year === year);
  const tracked = year >= policy.trackingStartYear;

  const baseEntitlement = entitlementForYear(
    profile.annualEntitlement,
    profile.employmentStart,
    year,
    policy.prorationMethod,
  );
  const entitlementIsOverride = acc?.entitlementOverride != null;
  const entitlement = tracked ? (entitlementIsOverride ? acc!.entitlementOverride! : baseEntitlement) : 0;

  let carryoverOpening = 0;
  const carryoverIsOverride = acc?.carryoverOverride != null;
  if (carryoverIsOverride) {
    carryoverOpening = acc!.carryoverOverride!;
  } else if (tracked && year > policy.trackingStartYear) {
    const prev = computeYear(year - 1, input, undefined, cache);
    const rolled = prev.currentRemaining + (policy.expiryPolicy === "keep" ? prev.carryoverRemaining : 0);
    carryoverOpening = Math.max(0, roundHalf(rolled));
  }

  const carryoverDeadline = carryoverDeadlineFor(year, input);
  const deadlinePassed = input.today > carryoverDeadline;

  const adjustmentsOfYear = input.adjustments.filter((a) => a.year === year);
  const carryoverAdjustments = roundHalf(
    adjustmentsOfYear.filter((a) => a.bucket === "carryover").reduce((s, a) => s + a.days, 0),
  );
  const currentAdjustments = roundHalf(
    adjustmentsOfYear.filter((a) => a.bucket === "current").reduce((s, a) => s + a.days, 0),
  );
  const carryoverTotal = roundHalf(carryoverOpening + carryoverAdjustments);
  const currentTotal = roundHalf(entitlement + currentAdjustments);

  // Allocation order: approved, pending, preview. Within a group by start date.
  const byStart = (a: VacationRequest, b: VacationRequest) =>
    a.start.localeCompare(b.start) || a.createdAt.localeCompare(b.createdAt);
  const relevant = input.requests.filter((r) => r.id !== preview?.id);
  const groups: { status: AllocationStatus; items: { id: string; days: RequestDay[] }[] }[] = [
    { status: "approved", items: relevant.filter((r) => r.status === "approved").sort(byStart) },
    { status: "pending", items: relevant.filter((r) => r.status === "pending").sort(byStart) },
    { status: "preview", items: preview ? [preview] : [] },
  ];

  let carryLeft = Math.max(0, carryoverTotal);
  const approved = emptySplit();
  const pending = emptySplit();
  const previewSplit = emptySplit();
  const allocations: DayAllocation[] = [];
  const byRequest = new Map<string, Split>();

  for (const group of groups) {
    const target = group.status === "approved" ? approved : group.status === "pending" ? pending : previewSplit;
    for (const req of group.items) {
      const split = emptySplit();
      const days = req.days.filter((d) => yearOf(d.date) === year).sort((a, b) => a.date.localeCompare(b.date));
      for (const day of days) {
        const canUseCarryover = policy.expiryPolicy === "keep" || day.date <= carryoverDeadline;
        const fromCarry = canUseCarryover ? Math.min(day.value, carryLeft) : 0;
        carryLeft = roundHalf(carryLeft - fromCarry);
        const fromCurrent = roundHalf(day.value - fromCarry);
        addToSplit(split, fromCarry, fromCurrent);
        allocations.push({
          requestId: req.id,
          status: group.status,
          date: day.date,
          value: day.value,
          carryover: fromCarry,
          current: fromCurrent,
        });
      }
      addToSplit(target, split.carryover, split.current);
      byRequest.set(req.id, split);
    }
  }

  const expiryActive = policy.expiryPolicy === "expire" && deadlinePassed;
  const unplannedCarry = roundHalf(Math.max(0, carryoverTotal - approved.carryover - pending.carryover));
  const expired = expiryActive ? unplannedCarry : 0;
  const atRisk = !expiryActive && policy.expiryPolicy === "expire" ? unplannedCarry : 0;

  const carryoverRemaining = roundHalf(carryoverTotal - approved.carryover - expired);
  const currentRemaining = roundHalf(currentTotal - approved.current);
  const totalAvailable = roundHalf(carryoverRemaining + currentRemaining);
  const freeCarryover = roundHalf(carryoverRemaining - pending.carryover);
  const freeCurrent = roundHalf(currentRemaining - pending.current);
  const freeTotal = roundHalf(freeCarryover + freeCurrent);
  const projectedTotal = roundHalf(freeTotal - previewSplit.total);

  const ledger: YearLedger = {
    year,
    tracked,
    entitlement,
    entitlementIsOverride,
    carryoverOpening,
    carryoverIsOverride,
    carryoverDeadline,
    deadlinePassed,
    carryoverAdjustments,
    currentAdjustments,
    carryoverTotal,
    currentTotal,
    approved,
    pending,
    preview: previewSplit,
    expired,
    atRisk,
    carryoverRemaining,
    currentRemaining,
    totalAvailable,
    freeCarryover,
    freeCurrent,
    freeTotal,
    projectedTotal,
    allocations,
    byRequest,
  };
  if (!preview) cache.set(year, ledger);
  return ledger;
}

/**
 * Balance block for a request (form, PDF, email). The request itself is treated
 * as the preview so the numbers show the state "before" and "after" it.
 */
export function balanceForRequest(input: LedgerInput, req: { id: string; start: ISODate; days: RequestDay[] }): BalanceSnapshot {
  const year = req.days.length ? yearOf(req.days[0].date) : yearOf(req.start);
  const ledger = computeYear(year, input, { id: req.id, days: req.days });
  const requestedInYear = ledger.preview.total;
  const nextYearDays = roundHalf(
    req.days.filter((d) => yearOf(d.date) > year).reduce((s, d) => s + d.value, 0),
  );
  return {
    year,
    carryoverAvailable: ledger.carryoverRemaining,
    carryoverDeadline: ledger.carryoverDeadline,
    currentAvailable: ledger.currentRemaining,
    totalAvailable: ledger.totalAvailable,
    reservedByPending: ledger.pending.total,
    requested: requestedInYear,
    fromCarryover: ledger.preview.carryover,
    fromCurrent: ledger.preview.current,
    projected: ledger.projectedTotal,
    nextYearDays,
  };
}

/** Next request number for a year, e.g. VR-2027-004. */
export function nextRequestNumber(requests: VacationRequest[], year: number): string {
  const prefix = `VR-${year}-`;
  const max = requests
    .filter((r) => r.number.startsWith(prefix))
    .map((r) => Number(r.number.slice(prefix.length)) || 0)
    .reduce((a, b) => Math.max(a, b), 0);
  return prefix + String(max + 1).padStart(3, "0");
}
