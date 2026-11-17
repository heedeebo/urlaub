import { useTranslation } from "react-i18next";
import { formatDate, formatDays } from "../domain/format";
import type { BalanceSnapshot, YearBalance } from "../domain/types";
import { cx, Dot } from "./ui";

/** All years a balance snapshot covers. Old snapshots have no parts. */
export function balanceParts(b: BalanceSnapshot): YearBalance[] {
  return b.parts?.length ? b.parts : [b];
}

/**
 * The vacation balance block shown on every request (form, detail, calendar).
 * A request across New Year gets one strictly separate block per year.
 */
export default function BalanceBlock({ b, frozen }: { b: BalanceSnapshot; frozen?: string }) {
  const { t } = useTranslation();
  const parts = balanceParts(b);
  return (
    <div className="space-y-3">
      {parts.length > 1 && (
        <p className="rounded-lg bg-navy-50 px-3.5 py-2.5 text-[13px] text-navy-900">
          {t("balance.multiYear", { years: parts.map((p) => p.year).join(" / ") })}
        </p>
      )}
      {parts.map((p) => (
        <YearBlock key={p.year} p={p} />
      ))}
      {frozen && <p className="px-1 text-xs text-slate-400">{frozen}</p>}
    </div>
  );
}

function YearBlock({ p }: { p: YearBalance }) {
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
  const prev = p.year - 1;
  return (
    <div className="overflow-hidden rounded-xl border border-line">
      <Head>{t("balance.titleYear", { year: p.year })}</Head>
      <div className="mx-3.5 my-2 rounded-lg border border-carry-line bg-carry-soft px-3 py-2.5">
        <div className="flex items-center justify-between text-[13.5px]">
          <span className="font-semibold text-carry-dark">
            {t(p.carryoverExpected ? "balance.carryoverFromExpected" : "balance.carryoverFrom", { year: prev })}
          </span>
          <span className="tabular font-bold text-carry-dark">{d(p.carryoverAvailable)}</span>
        </div>
        <div className="mt-0.5 flex items-center justify-between text-xs text-carry-dark/80">
          <span>{t("balance.deadline")}</span>
          <span className="font-semibold">{formatDate(p.carryoverDeadline)}</span>
        </div>
      </div>
      <Row label={t("balance.currentRemainingYear", { year: p.year })} value={d(p.currentAvailable)} />
      <Row label={t("balance.totalAvailableYear", { year: p.year })} value={d(p.totalAvailable)} />
      {p.reservedByPending > 0 && <Row label={t("balance.reservedByPending")} value={`− ${d(p.reservedByPending)}`} />}
      <Row label={t("balance.requestedYear", { year: p.year })} value={d(p.requested)} />
      <Head>{t("balance.allocation")}</Head>
      <Row label={t("balance.fromCarryoverYear", { year: prev })} value={d(p.fromCarryover)} dot="bg-carry" />
      <Row label={t("balance.fromCurrentYear", { year: p.year })} value={d(p.fromCurrent)} dot="bg-current" />
      <Row label={t("balance.projectedYear", { year: p.year })} value={d(p.projected)} strong />
    </div>
  );
}
