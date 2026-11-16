import { useTranslation } from "react-i18next";
import { formatDate, formatDays } from "../domain/format";
import type { BalanceSnapshot } from "../domain/types";
import { cx, Dot } from "./ui";

/** The vacation balance block shown on every request (form, detail, PDF). */
export default function BalanceBlock({ b, frozen }: { b: BalanceSnapshot; frozen?: string }) {
  const { t } = useTranslation();
  const d = (n: number) => t("common.days", { count: n, value: formatDays(n) });
  const Row = ({ label, value, strong, dot }: { label: string; value: string; strong?: boolean; dot?: string }) => (
    <div className={cx("flex items-center justify-between gap-3 border-b border-line-soft px-3.5 py-2.5 text-[13.5px] last:border-0", strong && "bg-navy-50 font-bold")}>
      <span className={cx("flex items-center gap-2", strong ? "text-slate-900" : "text-slate-500")}>
        {dot && <Dot className={dot} />}
        {label}
      </span>
      <span className="tabular font-semibold">{value}</span>
    </div>
  );
  const Head = ({ children }: { children: string }) => (
    <div className="px-3.5 pb-1 pt-3 text-[11px] font-bold uppercase tracking-wider text-slate-400">{children}</div>
  );
  return (
    <div className="overflow-hidden rounded-xl border border-line">
      <Head>{t("balance.title")}</Head>
      <div className="mx-3.5 my-2 rounded-lg border border-carry-line bg-carry-soft px-3 py-2.5">
        <div className="flex items-center justify-between text-[13.5px]">
          <span className="font-semibold text-carry-dark">{t("balance.carryover")}</span>
          <span className="tabular font-bold text-carry-dark">{d(b.carryoverAvailable)}</span>
        </div>
        <div className="mt-0.5 flex items-center justify-between text-xs text-carry-dark/80">
          <span>{t("balance.deadline")}</span>
          <span className="font-semibold">{formatDate(b.carryoverDeadline)}</span>
        </div>
      </div>
      <Row label={t("balance.currentRemaining")} value={d(b.currentAvailable)} />
      <Row label={t("balance.totalAvailable")} value={d(b.totalAvailable)} />
      {b.reservedByPending > 0 && <Row label={t("balance.reservedByPending")} value={`− ${d(b.reservedByPending)}`} />}
      <Row label={t("balance.requested")} value={d(b.requested)} />
      <Head>{t("balance.allocation")}</Head>
      <Row label={t("balance.fromCarryover")} value={d(b.fromCarryover)} dot="bg-carry" />
      <Row label={t("balance.fromCurrent")} value={d(b.fromCurrent)} dot="bg-current" />
      <Row label={t("balance.projected")} value={d(b.projected)} strong />
      {b.nextYearDays > 0 && (
        <div className="border-t border-line-soft px-3.5 py-2 text-xs text-slate-500">
          {t("balance.nextYear", { days: formatDays(b.nextYearDays), year: b.year + 1, count: b.nextYearDays })}
        </div>
      )}
      {frozen && <div className="border-t border-line-soft px-3.5 py-2 text-xs text-slate-400">{frozen}</div>}
    </div>
  );
}
