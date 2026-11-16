import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { Card, EmptyState, PageHeader, Select, StatusBadge } from "../components/ui";
import { useStore } from "../data/store";
import { yearOf } from "../domain/dates";
import { formatDate, formatDateTime, formatDays, formatRange } from "../domain/format";
import { sumDays } from "../domain/workdays";

export default function History() {
  const { t } = useTranslation();
  const { data, ledger, today } = useStore();
  const first = data.settings.policy.trackingStartYear;
  const last = Math.max(yearOf(today), ...data.requests.map((r) => yearOf(r.end)));
  const years = Array.from({ length: Math.max(1, last - first + 1) }, (_, i) => last - i);
  const [filter, setFilter] = useState<number | "all">("all");
  const shown = filter === "all" ? years : [filter];
  const d = (n: number) => formatDays(n);

  return (
    <>
      <PageHeader
        title={t("history.title")}
        subtitle={t("history.subtitle")}
        actions={
          <Select value={filter} onChange={(e) => setFilter(e.target.value === "all" ? "all" : Number(e.target.value))} className="w-auto" aria-label={t("common.year")}>
            <option value="all">{t("history.allYears")}</option>
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </Select>
        }
      />

      <Card className="mb-4 overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
              <th className="px-4 py-3">{t("common.year")}</th>
              <th className="px-3 py-3 text-right">{t("history.col.entitlement")}</th>
              <th className="px-3 py-3 text-right">{t("history.col.carryover")}</th>
              <th className="px-3 py-3 text-right">{t("history.col.adjustments")}</th>
              <th className="px-3 py-3 text-right">{t("history.col.used")}</th>
              <th className="px-3 py-3 text-right">{t("history.col.expired")}</th>
              <th className="px-3 py-3 text-right">{t("history.col.pending")}</th>
              <th className="px-4 py-3 text-right">{t("history.col.remaining")}</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((y) => {
              const l = ledger(y);
              return (
                <tr key={y} className="tabular border-b border-line-soft last:border-0">
                  <td className="px-4 py-3 font-semibold">{y}</td>
                  <td className="px-3 py-3 text-right">
                    {d(l.entitlement)}
                    {l.entitlementIsOverride && <span title={t("history.manual")}> *</span>}
                  </td>
                  <td className="px-3 py-3 text-right">
                    {d(l.carryoverOpening)}
                    <div className="text-[11px] text-slate-400">{t("history.until", { date: formatDate(l.carryoverDeadline, "en-US", { month: "short", day: "numeric" }) })}</div>
                  </td>
                  <td className="px-3 py-3 text-right">{l.carryoverAdjustments + l.currentAdjustments === 0 ? "0" : `${l.carryoverAdjustments + l.currentAdjustments > 0 ? "+" : ""}${d(l.carryoverAdjustments + l.currentAdjustments)}`}</td>
                  <td className="px-3 py-3 text-right">
                    {d(l.approved.total)}
                    <div className="text-[11px] text-slate-400">{t("dashboard.kpi.split", { carry: d(l.approved.carryover), current: d(l.approved.current) })}</div>
                  </td>
                  <td className="px-3 py-3 text-right">{l.expired > 0 ? <span className="font-semibold text-carry-dark">{d(l.expired)}</span> : "0"}</td>
                  <td className="px-3 py-3 text-right">{d(l.pending.total)}</td>
                  <td className="px-4 py-3 text-right font-bold">{d(l.totalAvailable)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>

      {shown.map((y) => {
        const l = ledger(y);
        const reqs = data.requests
          .filter((r) => r.days.some((x) => yearOf(x.date) === y) || yearOf(r.start) === y)
          .sort((a, b) => a.start.localeCompare(b.start));
        const adjustments = data.adjustments.filter((a) => a.year === y).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
        return (
          <Card key={y} className="mb-4 p-4 sm:p-5">
            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-lg font-bold">{y}</h2>
              {l.expired > 0 && (
                <span className="rounded-full bg-carry-soft px-2.5 py-0.5 text-xs font-semibold text-carry-dark">
                  {t("history.expiredBadge", { days: d(l.expired), date: formatDate(l.carryoverDeadline), count: l.expired })}
                </span>
              )}
            </div>
            {reqs.length === 0 ? (
              <EmptyState>{t("history.noRequests")}</EmptyState>
            ) : (
              <div className="overflow-hidden rounded-xl border border-line-soft">
                {reqs.map((r) => {
                  const s = l.byRequest.get(r.id);
                  return (
                    <Link
                      key={r.id}
                      to={`/requests/${r.id}`}
                      className="grid grid-cols-[1fr_auto] items-center gap-x-3 border-t border-line-soft px-3.5 py-2.5 first:border-0 hover:bg-slate-50 sm:grid-cols-[1.3fr_1fr_.4fr_auto]"
                    >
                      <div>
                        <b className="block text-sm">{formatRange(r.start, r.end)}</b>
                        <small className="text-xs text-slate-500">{r.number}</small>
                      </div>
                      <div className="hidden text-xs text-slate-500 sm:block">
                        {s ? t("requests.split", { carry: d(s.carryover), current: d(s.current) }) : t("requests.notCounted")}
                      </div>
                      <div className="tabular hidden text-sm sm:block">{d(sumDays(r.days))}</div>
                      <StatusBadge status={r.status} />
                    </Link>
                  );
                })}
              </div>
            )}
            {adjustments.length > 0 && (
              <div className="mt-4">
                <h3 className="mb-2 text-sm font-semibold">{t("history.adjustments")}</h3>
                <ul className="grid gap-1.5 text-sm">
                  {adjustments.map((a) => (
                    <li key={a.id} className="flex flex-wrap justify-between gap-2 rounded-lg bg-canvas px-3 py-2">
                      <span>
                        <b className="tabular">{a.days > 0 ? "+" : ""}{d(a.days)}</b> {t(`bucket.${a.bucket}`)} · {a.reason}
                      </span>
                      <span className="text-xs text-slate-500">{formatDateTime(a.createdAt)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Card>
        );
      })}
    </>
  );
}
