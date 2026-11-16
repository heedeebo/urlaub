import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { Icon } from "../components/Layout";
import { Button, Card, cx, EmptyState, PageHeader, StatusBadge } from "../components/ui";
import { useStore } from "../data/store";
import { yearOf } from "../domain/dates";
import { formatDays, formatRange } from "../domain/format";
import type { RequestStatus, VacationRequest } from "../domain/types";
import { sumDays } from "../domain/workdays";

type Filter = "all" | RequestStatus;

export default function Requests() {
  const { t } = useTranslation();
  const { data, ledger } = useStore();
  const [filter, setFilter] = useState<Filter>("all");
  const counts = (s: RequestStatus) => data.requests.filter((r) => r.status === s).length;
  const list = data.requests
    .filter((r) => filter === "all" || r.status === filter)
    .sort((a, b) => b.start.localeCompare(a.start));

  const split = (r: VacationRequest) => {
    const parts = new Map<number, { carryover: number; current: number }>();
    for (const y of new Set(r.days.map((d) => yearOf(d.date)))) {
      const s = ledger(y).byRequest.get(r.id);
      if (s) parts.set(y, s);
    }
    if (!parts.size) return null;
    let c = 0;
    let u = 0;
    parts.forEach((p) => {
      c += p.carryover;
      u += p.current;
    });
    return t("requests.split", { carry: formatDays(c), current: formatDays(u) });
  };

  const filters: Filter[] = ["all", "pending", "draft", "approved", "rejected", "withdrawn"];

  return (
    <>
      <PageHeader
        title={t("requests.title")}
        subtitle={t("requests.subtitle")}
        actions={
          <Link to="/requests/new">
            <Button>
              <Icon name="plus" className="h-4 w-4" />
              {t("nav.newRequest")}
            </Button>
          </Link>
        }
      />
      <div className="mb-4 flex gap-1.5 overflow-x-auto pb-1">
        {filters.map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={cx(
              "whitespace-nowrap rounded-full border px-3 py-1.5 text-sm font-semibold",
              filter === f ? "border-navy-900 bg-navy-900 text-white" : "border-line bg-white text-slate-600",
            )}
          >
            {f === "all" ? t("requests.all", { count: data.requests.length }) : `${t(`status.${f}`)} (${counts(f)})`}
          </button>
        ))}
      </div>
      <Card className="py-1">
        {list.length === 0 ? (
          <div className="p-5">
            <EmptyState>{t("requests.empty")}</EmptyState>
          </div>
        ) : (
          list.map((r) => {
            const total = sumDays(r.days);
            return (
              <Link
                key={r.id}
                to={`/requests/${r.id}`}
                className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1 border-t border-line-soft px-4 py-3 first:border-0 hover:bg-slate-50 sm:grid-cols-[1.4fr_1fr_.5fr_auto] sm:px-5"
              >
                <div>
                  <b className="block text-sm">{formatRange(r.start, r.end)}</b>
                  <small className="text-xs text-slate-500">{r.number}</small>
                </div>
                <div className="hidden text-xs text-slate-500 sm:block">{split(r) ?? t("requests.notCounted")}</div>
                <div className="hidden text-sm sm:block">
                  <b className="tabular">{formatDays(total)}</b> <span className="text-slate-500">{t("common.daysUnit")}</span>
                </div>
                <StatusBadge status={r.status} />
              </Link>
            );
          })
        )}
      </Card>
    </>
  );
}
