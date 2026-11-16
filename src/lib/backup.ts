import { todayISO } from "../domain/dates";
import type { AppData, VacationRequest } from "../domain/types";
import { downloadBlob } from "./download";

const FORMAT = "my-vacation-manager-backup";

export function exportBackup(data: AppData) {
  const payload = { format: FORMAT, version: 1, exportedAt: new Date().toISOString(), data };
  downloadBlob(new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }), `vacation-backup-${todayISO()}.json`);
}

export function parseBackup(text: string): AppData {
  const parsed = JSON.parse(text);
  const data = parsed?.format === FORMAT ? parsed.data : parsed;
  if (!data?.settings?.profile || !Array.isArray(data.requests) || !Array.isArray(data.adjustments) || !Array.isArray(data.yearAccounts)) {
    throw new Error("invalid");
  }
  return data as AppData;
}

/** Spreadsheet-friendly list of all requests. */
export function exportCsv(requests: VacationRequest[]) {
  const head = ["Number", "Start", "End", "Working days", "Status", "Sent at", "Comment"];
  const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const rows = [...requests]
    .sort((a, b) => a.start.localeCompare(b.start))
    .map((r) =>
      [r.number, r.start, r.end, String(r.days.reduce((s, d) => s + d.value, 0)), r.status, r.sentAt ?? "", r.comment]
        .map(esc)
        .join(","),
    );
  downloadBlob(new Blob([[head.join(","), ...rows].join("\r\n")], { type: "text/csv" }), `vacation-requests-${todayISO()}.csv`);
}
