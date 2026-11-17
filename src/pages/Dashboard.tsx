import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { Icon } from "../components/Layout";
import Ring from "../components/Ring";
import { Button, Card, cx, Dot, Notice, PageHeader, Select, StatusBadge } from "../components/ui";
import { useStore } from "../data/store";
import { daysBetween, roundHalf, yearOf } from "../domain/dates";
import type { YearLedger } from "../domain/ledger";
import type { RequestDay } from "../domain/types";
import { formatDate, formatDays, formatRange } from "../domain/format";
import { sumDays } from "../domain/workdays";

/** "2026: 4 · 2027: 4" for a request across New Year. */
function perYear(days: RequestDay[]): string {
  const byYear = new Map<number, number>();
  for (const x of days) byYear.set(yearOf(x.date), (byYear.get(yearOf(x.date)) ?? 0) + x.value);
  return [...byYear].map(([yy, n]) => `${yy}: ${formatDays(n)}`).join(" · ");
}

/**
 * All tracked years side by side. Carryover and the year's own vacation are
 * kept strictly apart. Values of years that depend on open requests of the
 * previous year are marked as expected.
 */
function YearsOverview({ years, selected, onSelect }: { years: number[]; selected: number; onSelect: (y: number) => void }) {
  const { t } = useTranslation();
  const { ledger, today } = useStore();
  const thisYear = yearOf(today);
  const cols = years.map((yy) => ledger(yy));
  const d = (n: number) => formatDays(n);
  const expected = (l: YearLedger) => l.year > thisYear || l.carryoverReservedByPrev > 0;
  type RowDef = { label: string; value: (l: YearLedger) => string; strong?: boolean; tone?: "carry" | "current" | "total" };
  const groups: { title: string; tone: "carry" | "current" | "total"; rows: RowDef[] }[] = [
    {
      title: t("dashboard.years.carryTitle"),
      tone: "carry",
      rows: [
        { label: t("dashboard.years.carryFrom"), value: (l) => `${d(roundHalf(l.carryoverTotal - l.carryoverReservedByPrev))}${expected(l) ? " *" : ""}` },
        { label: t("dashboard.years.deadline"), value: (l) => formatDate(l.carryoverDeadline, "en-US", { month: "short", day: "numeric" }) },
        { label: t("dashboard.years.used"), value: (l) => d(l.approved.carryover) },
        { label: t("dashboard.years.reserved"), value: (l) => d(l.pending.carryover) },
        { label: t("dashboard.years.expired"), value: (l) => (l.deadlinePassed ? d(l.expired) : "-") },
        { label: t("dashboard.years.left"), value: (l) => d(l.freeCarryover), strong: true },
      ],
    },
    {
      title: t("dashboard.years.currentTitle"),
      tone: "current",
      rows: [
        { label: t("dashboard.years.entitlement"), value: (l) => d(l.currentTotal) },
        { label: t("dashboard.years.used"), value: (l) => d(l.approved.current) },
        { label: t("dashboard.years.reserved"), value: (l) => d(l.pending.current) },
        { label: t("dashboard.years.left"), value: (l) => d(l.freeCurrent), strong: true },
      ],
    },
    {
      title: t("dashboard.years.totalTitle"),
      tone: "total",
      rows: [{ label: t("dashboard.years.freeTotal"), value: (l) => d(l.freeTotal), strong: true }],
    },
  ];
  const toneClass = { carry: "text-carry-dark", current: "text-navy-800", total: "text-slate-900" };
  return (
    <Card className="mb-4 py-1.5">
      <div className="px-5 pb-1 pt-3">
        <h2 className="text-base font-semibold">{t("dashboard.years.title")}</h2>
        <p className="text-sm text-slate-500">{t("dashboard.years.subtitle")}</p>
      </div>
      <div className="overflow-x-auto px-2 pb-2">
        <table className="w-full border-collapse text-[13px]" style={{ minWidth: 150 + cols.length * 78 }}>
          <thead>
            <tr>
              <th />
              {cols.map((l) => (
                <th key={l.year} className="px-2 py-2 text-right">
                  <button
                    type="button"
                    onClick={() => onSelect(l.year)}
                    className={cx(
                      "rounded-md px-2 py-0.5 font-bold tabular",
                      l.year === selected ? "bg-navy-900 text-white" : "text-slate-600 hover:bg-slate-100",
                    )}
                  >
                    {l.year}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          {groups.map((g) => (
            <tbody key={g.title}>
              <tr>
                <td colSpan={cols.length + 1} className={cx("px-3 pb-1 pt-3 text-[11px] font-bold uppercase tracking-wider", toneClass[g.tone])}>
                  {g.title}
                </td>
              </tr>
              {g.rows.map((row) => (
                <tr key={row.label} className={cx("border-t border-line-soft", row.strong && "font-bold")}>
                  <td className={cx("px-3 py-1.5", row.strong ? "text-slate-900" : "text-slate-500")}>{row.label}</td>
                  {cols.map((l) => (
                    <td key={l.year} className={cx("tabular px-3 py-1.5 text-right", l.year === selected && "bg-navy-50")}>
                      {l.tracked ? row.value(l) : "-"}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          ))}
        </table>
      </div>
      {cols.some((l) => l.tracked && expected(l)) && <p className="px-5 pb-3 text-xs text-slate-400">{t("dashboard.years.expectedNote")}</p>}
    </Card>
  );
}

export default function Dashboard() {
  const { t } = useTranslation();
  const { data, today, ledger } = useStore();
  const thisYear = yearOf(today);
  const [year, setYear] = useState(thisYear);
  const y = ledger(year);
  const profile = data.settings.profile;
  const d = (n: number) => formatDays(n);

  const pot = y.carryoverTotal + y.currentTotal;
  const freeAfterPending = y.freeTotal;
  const daysLeft = daysBetween(today, y.carryoverDeadline);
  const carryPot = y.carryoverTotal || 1;
  const pendingCount = data.requests.filter((r) => r.status === "pending" && r.days.some((x) => yearOf(x.date) === year)).length;

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "dashboard.greetingMorning" : hour < 18 ? "dashboard.greetingAfternoon" : "dashboard.greetingEvening";

  const upcoming = data.requests
    .filter((r) => r.end >= today && (r.status === "approved" || r.status === "pending" || r.status === "draft"))
    .sort((a, b) => a.start.localeCompare(b.start))
    .slice(0, 5);

  const years = Array.from(new Set([thisYear - 1, thisYear, thisYear + 1, ...data.requests.map((r) => yearOf(r.start))]))
    .filter((v) => v >= data.settings.policy.trackingStartYear)
    .sort();

  const kpis: { label: string; value: string; unit?: string; hint: string; accent?: boolean }[] = [
    { label: t("dashboard.kpi.entitlement"), value: d(y.entitlement), unit: t("common.daysUnit"), hint: t("dashboard.kpi.entitlementHint", { year }) },
    {
      label: t("dashboard.kpi.carryover"),
      value: d(y.carryoverRemaining),
      unit: t("dashboard.kpi.ofTotal", { total: d(y.carryoverTotal) }),
      hint: t("dashboard.kpi.carryoverHint", { year: year - 1 }),
    },
    {
      label: t("dashboard.kpi.deadline"),
      value: formatDate(y.carryoverDeadline, "en-US", { month: "short", day: "numeric" }),
      hint: y.deadlinePassed ? t("dashboard.kpi.deadlinePassed") : t("dashboard.kpi.daysLeft", { count: daysLeft }),
    },
    {
      label: t("dashboard.kpi.approved"),
      value: d(y.approved.total),
      unit: t("common.daysUnit"),
      hint: t("dashboard.kpi.split", { carry: d(y.approved.carryover), current: d(y.approved.current) }),
    },
    {
      label: t("dashboard.kpi.pending"),
      value: d(y.pending.total),
      unit: t("common.daysUnit"),
      hint: t("dashboard.kpi.pendingHint", { count: pendingCount }),
    },
    {
      label: t("dashboard.kpi.currentRemaining"),
      value: d(y.currentRemaining),
      unit: t("common.daysUnit"),
      hint: t("dashboard.kpi.currentHint", { total: d(y.currentTotal), used: d(y.approved.current) }),
    },
    { label: t("dashboard.kpi.total"), value: d(y.totalAvailable), unit: t("common.daysUnit"), hint: t("dashboard.kpi.totalHint"), accent: true },
    { label: t("dashboard.kpi.afterPending"), value: d(freeAfterPending), unit: t("common.daysUnit"), hint: t("dashboard.kpi.afterPendingHint") },
  ];

  return (
    <>
      <PageHeader
        title={t(greeting, { name: profile.firstName })}
        subtitle={t("dashboard.subtitle", { year })}
        actions={
          <>
            <Select value={year} onChange={(e) => setYear(Number(e.target.value))} className="w-auto" aria-label={t("common.year")}>
              {years.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </Select>
            <Link to="/requests/new">
              <Button>
                <Icon name="plus" className="h-4 w-4" />
                {t("nav.newRequest")}
              </Button>
            </Link>
          </>
        }
      />

      <div className="mb-4 grid gap-4 lg:grid-cols-[1.25fr_1fr]">
        <Card className="flex flex-col items-center gap-6 p-5 sm:flex-row sm:p-6">
          <Ring
            total={pot}
            segments={[
              { value: y.approved.total, color: "var(--color-navy-900)" },
              { value: y.pending.total, color: "var(--color-pending)" },
              { value: y.expired, color: "#f0b552" },
              { value: Math.max(0, freeAfterPending), color: "var(--color-navy-100)" },
            ]}
          >
            <div>
              <div className="tabular text-5xl font-extrabold leading-none tracking-tight">{d(y.totalAvailable)}</div>
              <div className="mt-1 text-xs text-slate-500">{t("dashboard.daysLeft")}</div>
            </div>
          </Ring>
          <div className="w-full flex-1">
            <h2 className="text-base font-semibold">{t("dashboard.totalTitle")}</h2>
            <p className="mb-3 text-sm text-slate-500">
              {y.pending.total > 0 ? t("dashboard.totalSubPending", { days: d(freeAfterPending) }) : t("dashboard.totalSub")}
            </p>
            <div className="grid gap-2 text-sm">
              {[
                ["bg-navy-900", t("dashboard.legend.approved"), y.approved.total],
                ["bg-pending", t("dashboard.legend.pending"), y.pending.total],
                ...(y.expired > 0 ? [["bg-[#f0b552]", t("dashboard.legend.expired"), y.expired] as const] : []),
                ["bg-navy-100", t("dashboard.legend.free"), freeAfterPending],
              ].map(([c, l, v]) => (
                <div key={l as string} className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-slate-500">
                    <Dot className={c as string} />
                    {l}
                  </span>
                  <b className="tabular">{t("common.days", { count: v as number, value: d(v as number) })}</b>
                </div>
              ))}
              <div className="flex items-center justify-between border-t border-line-soft pt-2">
                <span className="text-slate-500">{t("dashboard.legend.pot", { year })}</span>
                <b className="tabular">
                  {d(y.currentTotal)} + {d(y.carryoverTotal)}
                </b>
              </div>
            </div>
          </div>
        </Card>

        <Card className="relative overflow-hidden border-carry-line bg-gradient-to-b from-[#fffaf0] to-white p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-carry-soft px-2.5 py-1 text-xs font-semibold text-carry-dark">
              ⏳ {t("dashboard.carry.tag", { year: year - 1 })}
            </span>
            {!y.deadlinePassed && y.carryoverTotal > 0 && (
              <div className="text-left sm:text-right">
                <b className="tabular block text-2xl leading-none text-carry">{daysLeft}</b>
                <small className="text-xs text-slate-500">{t("dashboard.carry.daysUntil")}</small>
              </div>
            )}
          </div>
          <p className="tabular mt-3 text-4xl font-extrabold leading-none tracking-tight">
            {d(y.carryoverRemaining)}{" "}
            <small className="text-[15px] font-semibold tracking-normal text-slate-500">
              {t("dashboard.carry.ofLeft", { total: d(y.carryoverTotal) })}
            </small>
          </p>
          <div className="mt-3.5 flex justify-between text-sm font-semibold">
            {y.deadlinePassed ? t("dashboard.carry.deadlineWas") : t("dashboard.carry.mustBeTaken")}
            <span className="font-medium text-slate-500">{formatDate(y.carryoverDeadline)}</span>
          </div>
          <div className="my-2.5 flex h-2.5 overflow-hidden rounded-full bg-[#f3ead9]">
            <i className="block h-full bg-carry" style={{ width: `${(y.approved.carryover / carryPot) * 100}%` }} />
            <i
              className="block h-full"
              style={{
                width: `${(y.pending.carryover / carryPot) * 100}%`,
                background: "repeating-linear-gradient(45deg,#f0b552 0 4px,#f7d49a 4px 8px)",
              }}
            />
            <i className="block h-full bg-slate-300" style={{ width: `${(y.expired / carryPot) * 100}%` }} />
          </div>
          <div className="grid gap-1.5 text-[12.5px]">
            {[
              ["bg-carry", t("dashboard.carry.used"), y.approved.carryover],
              ["bg-[#f0b552]", t("dashboard.carry.reserved"), y.pending.carryover],
              y.deadlinePassed
                ? ["bg-slate-300", t("dashboard.carry.expired"), y.expired]
                : ["bg-[#f3ead9]", t("dashboard.carry.unplanned"), y.atRisk],
            ].map(([c, l, v]) => (
              <div key={l as string} className="flex justify-between">
                <span className="flex items-center gap-2 text-slate-500">
                  <Dot className={c as string} />
                  {l}
                </span>
                <b className="tabular">{d(v as number)}</b>
              </div>
            ))}
          </div>
          <div className="mt-3">
            {y.carryoverTotal === 0 ? (
              <Notice tone="info">{t("dashboard.carry.none")}</Notice>
            ) : y.deadlinePassed && y.expired > 0 ? (
              <Notice tone="warn">
                {t("dashboard.carry.expiredNote", { days: d(y.expired), count: y.expired })}{" "}
                <Link to="/settings#adjustments" className="font-semibold underline">
                  {t("dashboard.carry.adjust")}
                </Link>
              </Notice>
            ) : y.atRisk > 0 ? (
              <Notice tone="warn">
                <b>{t("dashboard.carry.atRisk", { days: d(y.atRisk), count: y.atRisk })}</b> {t("dashboard.carry.atRiskHint", { date: formatDate(y.carryoverDeadline), count: y.atRisk })}
              </Notice>
            ) : (
              <Notice tone="ok">{t("dashboard.carry.allPlanned")}</Notice>
            )}
          </div>
        </Card>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {kpis.map((k) => (
          <Card key={k.label} className={cx("px-4 py-3.5", k.accent && "border-navy-900! bg-navy-900! text-white")}>
            <div className={cx("text-[12.5px] font-medium", k.accent ? "text-slate-300" : "text-slate-500")}>{k.label}</div>
            <div className="tabular mt-1 text-2xl font-bold tracking-tight">
              {k.value}
              {k.unit && <small className={cx("ml-1 text-[13px] font-medium tracking-normal", k.accent ? "text-slate-300" : "text-slate-500")}>{k.unit}</small>}
            </div>
            <div className={cx("mt-0.5 text-xs", k.accent ? "text-slate-300" : "text-slate-400")}>{k.hint}</div>
          </Card>
        ))}
      </div>

      <YearsOverview years={years} selected={year} onSelect={setYear} />

      <Card className="py-1.5">
        <div className="flex items-center justify-between px-5 pb-2 pt-3">
          <h2 className="text-base font-semibold">{t("dashboard.upcoming")}</h2>
          <Link to="/requests" className="text-sm font-semibold text-navy-800">
            {t("dashboard.allRequests")}
          </Link>
        </div>
        {upcoming.length === 0 ? (
          <p className="px-5 pb-4 text-sm text-slate-500">{t("dashboard.noUpcoming")}</p>
        ) : (
          upcoming.map((r) => (
            <Link
              key={r.id}
              to={`/requests/${r.id}`}
              className="grid grid-cols-[1fr_auto] items-center gap-3 border-t border-line-soft px-5 py-3 hover:bg-slate-50 sm:grid-cols-[1.5fr_.6fr_auto]"
            >
              <div>
                <b className="block text-sm">{formatRange(r.start, r.end)}</b>
                <small className="text-xs text-slate-500">{r.number}</small>
              </div>
              <div className="hidden text-sm text-slate-500 sm:block">
                {t("common.days", { count: sumDays(r.days), value: d(sumDays(r.days)) })}
                {yearOf(r.start) !== yearOf(r.end) && <small className="block text-xs text-slate-400">{perYear(r.days)}</small>}
              </div>
              <StatusBadge status={r.status} />
            </Link>
          ))
        )}
      </Card>
    </>
  );
}
