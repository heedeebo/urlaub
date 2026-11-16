import { yearOf } from "../domain/dates";
import type { YearLedger } from "../domain/ledger";
import type { ISODate, VacationRequest } from "../domain/types";

export type MarkKind = "approvedCarry" | "approvedCurrent" | "pendingCarry" | "pendingCurrent" | "rejected" | "draft";

export interface DayMark {
  kind: MarkKind;
  requestId: string;
  half: boolean;
}

/** Combines the ledger allocations (approved, pending) with rejected and draft requests. */
export function buildMarks(ledger: YearLedger, requests: VacationRequest[]): Map<ISODate, DayMark> {
  const marks = new Map<ISODate, DayMark>();
  for (const a of ledger.allocations) {
    if (a.status !== "approved" && a.status !== "pending") continue;
    const carry = a.carryover > 0;
    const kind: MarkKind =
      a.status === "approved" ? (carry ? "approvedCarry" : "approvedCurrent") : carry ? "pendingCarry" : "pendingCurrent";
    marks.set(a.date, { kind, requestId: a.requestId, half: a.value < 1 });
  }
  for (const r of requests) {
    if (r.status !== "rejected" && r.status !== "draft") continue;
    for (const d of r.days) {
      if (yearOf(d.date) !== ledger.year || marks.has(d.date)) continue;
      marks.set(d.date, { kind: r.status, requestId: r.id, half: d.value < 1 });
    }
  }
  return marks;
}

export const markStyle: Record<MarkKind, string> = {
  approvedCarry: "bg-carry text-white",
  approvedCurrent: "bg-current text-white",
  pendingCarry: "bg-carry-soft text-carry-dark outline-[1.5px] outline-dashed outline-carry -outline-offset-[1.5px]",
  pendingCurrent: "bg-pending-soft text-pending outline-[1.5px] outline-dashed outline-pending -outline-offset-[1.5px]",
  rejected: "bg-rejected-soft text-rejected line-through",
  draft: "bg-slate-100 text-slate-500 outline-1 outline-dashed outline-slate-300 -outline-offset-1",
};
