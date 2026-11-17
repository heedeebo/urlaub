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
  YearBalance,
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
  /**
   * Carryover that will not arrive because the previous year still has pending
   * requests (they use up previous year days that would otherwise roll over).
   */
  carryoverReservedByPrev: number;
  /** Same, caused by the preview request's own days in the previous year. */
  carryoverReducedByPreview: number;
  /** Balances after approved and pending requests (incl. previous year pending). */
  freeCarryover: number;
  freeCurrent: number;
  freeTotal: number;
  /** Balances after approved, pending and the preview request. */
  projectedTotal: number;
  projectedCarryover: number;
  projectedCurrent: number;
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

  // Opening carryover in three variants: after approved requests of the previous
  // year (the official balance), after its pending requests too, and after the
  // preview request's own days in the previous year.
  let carryoverOpening = 0;
  let openingFree = 0;
  let openingProjected = 0;
  const carryoverIsOverride = acc?.carryoverOverride != null;
  if (carryoverIsOverride) {
    carryoverOpening = openingFree = openingProjected = acc!.carryoverOverride!;
  } else if (tracked && year > policy.trackingStartYear) {
    const prev = computeYear(year - 1, input, preview, cache);
    const keep = policy.expiryPolicy === "keep";
    carryoverOpening = Math.max(0, roundHalf(prev.currentRemaining + (keep ? prev.carryoverRemaining : 0)));
    openingFree = Math.max(0, roundHalf(prev.freeCurrent + (keep ? prev.freeCarryover : 0)));
    openingProjected = Math.max(0, roundHalf(prev.projectedCurrent + (keep ? prev.projectedCarryover : 0)));
  }
  const carryoverReservedByPrev = roundHalf(Math.max(0, carryoverOpening - openingFree));
  const carryoverReducedByPreview = roundHalf(Math.max(0, openingFree - openingProjected));

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

  // Carryover pots per group: approved requests see the official pot, pending
  // requests and the preview see what is left once the previous year is settled.
  const potApproved = Math.max(0, carryoverTotal);
  const potFree = Math.max(0, roundHalf(carryoverTotal - carryoverReservedByPrev));
  const potProjected = Math.max(0, roundHalf(potFree - carryoverReducedByPreview));
  let carryLeft = potApproved;
  const approved = emptySplit();
  const pending = emptySplit();
  const previewSplit = emptySplit();
  const allocations: DayAllocation[] = [];
  const byRequest = new Map<string, Split>();

  for (const group of groups) {
    if (group.status === "pending") carryLeft = Math.max(0, roundHalf(potFree - approved.carryover));
    if (group.status === "preview") carryLeft = Math.max(0, roundHalf(potProjected - approved.carryover - pending.carryover));
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
  const unplannedFree = roundHalf(Math.max(0, potFree - approved.carryover - pending.carryover));
  const atRisk = !expiryActive && policy.expiryPolicy === "expire" ? unplannedFree : 0;

  const carryoverRemaining = roundHalf(carryoverTotal - approved.carryover - expired);
  const currentRemaining = roundHalf(currentTotal - approved.current);
  const totalAvailable = roundHalf(carryoverRemaining + currentRemaining);
  // Free and projected balances. Carryover used beyond the smaller pot is
  // effectively taken from the current year.
  const usedAll = roundHalf(approved.total + pending.total);
  const carryUsedFree = Math.min(potFree, roundHalf(approved.carryover + pending.carryover));
  const freeCarryover = expiryActive ? 0 : roundHalf(potFree - carryUsedFree);
  const freeCurrent = roundHalf(currentTotal - (usedAll - carryUsedFree));
  const freeTotal = roundHalf(freeCarryover + freeCurrent);
  const carryUsedProj = Math.min(potProjected, roundHalf(approved.carryover + pending.carryover + previewSplit.carryover));
  const projectedCarryover = expiryActive ? 0 : roundHalf(potProjected - carryUsedProj);
  const projectedCurrent = roundHalf(currentTotal - (usedAll + previewSplit.total - carryUsedProj));
  const projectedTotal = roundHalf(projectedCarryover + projectedCurrent);

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
    carryoverReservedByPrev,
    carryoverReducedByPreview,
    freeCarryover,
    freeCurrent,
    freeTotal,
    projectedTotal,
    projectedCarryover,
    projectedCurrent,
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
  const firstYear = req.days.length ? yearOf(req.days[0].date) : yearOf(req.start);
  const lastYear = req.days.length ? yearOf(req.days[req.days.length - 1].date) : firstYear;
  const parts: YearBalance[] = [];
  for (let year = firstYear; year <= lastYear; year++) {
    parts.push(yearBalance(computeYear(year, input, { id: req.id, days: req.days }), input.today));
  }
  const nextYearDays = roundHalf(parts.slice(1).reduce((s, p) => s + p.requested, 0));
  return { ...parts[0], nextYearDays, parts };
}

/**
 * The balance of one year from the point of view of the preview request.
 * Carryover is shown net: days that the previous year still needs (pending
 * requests there, or this request's own days there) are already taken off, so
 * available − reserved − requested = projected holds for every year.
 */
function yearBalance(l: YearLedger, today: ISODate): YearBalance {
  const totalAvailable = roundHalf(l.projectedTotal + l.pending.total + l.preview.total);
  const carryoverAvailable =
    l.expired > 0 || l.deadlinePassed
      ? l.carryoverRemaining
      : Math.max(0, roundHalf(l.carryoverTotal - l.carryoverReservedByPrev - l.carryoverReducedByPreview - l.approved.carryover));
  const yearStarted = today >= makeDate(l.year, 1, 1);
  return {
    year: l.year,
    carryoverAvailable,
    carryoverDeadline: l.carryoverDeadline,
    carryoverExpected: !l.carryoverIsOverride && (!yearStarted || l.carryoverReservedByPrev + l.carryoverReducedByPreview > 0),
    currentAvailable: roundHalf(totalAvailable - carryoverAvailable),
    totalAvailable,
    reservedByPending: l.pending.total,
    requested: l.preview.total,
    fromCarryover: l.preview.carryover,
    fromCurrent: l.preview.current,
    projected: l.projectedTotal,
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
