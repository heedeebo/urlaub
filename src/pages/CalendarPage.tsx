import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import BalanceBlock from "../components/BalanceBlock";
import { CalendarLegend, MonthView, YearView } from "../components/Calendar";
import { buildMarks } from "../components/calendarMarks";
import { Button, Card, cx, EmptyState, Notice, PageHeader } from "../components/ui";
import { useStore } from "../data/store";
import { parseISO, yearOf } from "../domain/dates";
import { formatDate, formatDays, formatShort } from "../domain/format";
import { balanceForRequest } from "../domain/ledger";
import type { ISODate } from "../domain/types";
import { buildRequestDays, describeRange, sumDays } from "../domain/workdays";

export default function CalendarPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const store = useStore();
  const { today, ledger, data, holiday, workdayCtx, input } = store;
  const [view, setView] = useState<"month" | "year">("month");
  const [cursor, setCursor] = useState(() => ({ year: yearOf(today), month: parseISO(today).getMonth() }));
  const [sel, setSel] = useState<{ start: ISODate | null; end: ISODate | null }>({ start: null, end: null });

  const y = ledger(cursor.year);
  const marks = useMemo(() => buildMarks(y, data.requests), [y, data.requests]);

  const pick = (d: ISODate) => {
    if (!sel.start || sel.end) setSel({ start: d, end: null });
    else if (d < sel.start) setSel({ start: d, end: sel.start });
    else setSel({ start: sel.start, end: d });
  };

  const move = (delta: number) => {
    if (view === "year") return setCursor((c) => ({ ...c, year: c.year + delta }));
    setCursor((c) => {
      const m = c.month + delta;
      return { year: c.year + Math.floor(m / 12), month: ((m % 12) + 12) % 12 };
    });
  };

  const common = {
    year: cursor.year,
    marks,
    holiday,
    workdays: workdayCtx.workdays,
    today,
    deadline: y.carryoverDeadline,
    expired: y.expired,
    selection: sel,
  };

  return (
    <>
      <PageHeader title={t("calendar.title")} subtitle={t("calendar.subtitle")} />
      <div className="grid items-start gap-4 xl:grid-cols-[1fr_340px]">
        <Card className="p-3 sm:p-5">
          <div className="mb-3.5 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Button variant="secondary" className="h-9 min-h-9 w-9 px-0" onClick={() => move(-1)} aria-label={t("calendar.previous")}>
                ‹
              </Button>
              <Button variant="secondary" className="h-9 min-h-9 w-9 px-0" onClick={() => move(1)} aria-label={t("calendar.next")}>
                ›
              </Button>
              <h2 className="min-w-40 text-lg font-bold">
                {view === "month" ? `${t(`calendar.month.${cursor.month}`)} ${cursor.year}` : t("calendar.yearOverview", { year: cursor.year })}
              </h2>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                className="min-h-9 px-3 text-xs"
                onClick={() => setCursor({ year: yearOf(today), month: parseISO(today).getMonth() })}
              >
                {t("calendar.today")}
              </Button>
              <div className="inline-flex rounded-xl border border-line bg-canvas p-0.5">
                {(["month", "year"] as const).map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setView(v)}
                    className={cx("rounded-[10px] px-3 py-1.5 text-sm font-semibold", view === v ? "bg-white shadow-sm" : "text-slate-500")}
                  >
                    {t(`calendar.view.${v}`)}
                  </button>
                ))}
              </div>
            </div>
          </div>
          {view === "month" ? (
            <MonthView {...common} month={cursor.month} onPick={pick} />
          ) : (
            <YearView
              {...common}
              onMonth={(m) => {
                setCursor((c) => ({ ...c, month: m }));
                setView("month");
              }}
            />
          )}
          <CalendarLegend />
        </Card>

        <Card className="p-4 sm:p-5 xl:sticky xl:top-5">
          <SelectionSummary sel={sel} onClear={() => setSel({ start: null, end: null })} onCreate={(s, e) => navigate(`/requests/new?start=${s}&end=${e}`)} />
        </Card>
      </div>
    </>
  );

  function SelectionSummary({
    sel,
    onClear,
    onCreate,
  }: {
    sel: { start: ISODate | null; end: ISODate | null };
    onClear: () => void;
    onCreate: (s: ISODate, e: ISODate) => void;
  }) {
    const start = sel.start;
    if (!start) {
      const yNow = ledger(cursor.year);
      return (
        <>
          <h3 className="text-base font-semibold">{t("calendar.planTitle")}</h3>
          <p className="mb-3 text-sm text-slate-500">{t("calendar.planHint")}</p>
          <EmptyState>{t("calendar.planEmpty")}</EmptyState>
          <div className="mt-3 overflow-hidden rounded-xl border border-line text-[13.5px]">
            <div className="px-3.5 pb-1 pt-3 text-[11px] font-bold uppercase tracking-wider text-slate-400">
              {t("calendar.freeNow", { year: cursor.year })}
            </div>
            <div className="flex justify-between border-b border-line-soft px-3.5 py-2.5">
              <span className="text-slate-500">{t("calendar.freeCarry", { date: formatShort(yNow.carryoverDeadline) })}</span>
              <b className="tabular">{formatDays(yNow.freeCarryover)}</b>
            </div>
            <div className="flex justify-between border-b border-line-soft px-3.5 py-2.5">
              <span className="text-slate-500">{t("calendar.freeCurrent")}</span>
              <b className="tabular">{formatDays(yNow.freeCurrent)}</b>
            </div>
            <div className="flex justify-between bg-navy-50 px-3.5 py-2.5 font-bold">
              <span>{t("calendar.freeTotal")}</span>
              <span className="tabular">{t("common.days", { count: yNow.freeTotal, value: formatDays(yNow.freeTotal) })}</span>
            </div>
          </div>
        </>
      );
    }
    const end = sel.end ?? start;
    const info = describeRange(start, end, workdayCtx);
    const days = buildRequestDays(start, end, workdayCtx);
    const total = sumDays(days);
    const booked = new Set(
      data.requests.filter((r) => r.status === "approved" || r.status === "pending").flatMap((r) => r.days.map((x) => x.date)),
    );
    const clash = days.filter((d) => booked.has(d.date)).length;
    const b = days.length ? balanceForRequest(input, { id: "__selection__", start, days }) : null;
    const tooMany = b ? b.projected < 0 : false;

    return (
      <>
        <h3 className="text-base font-semibold">{t("calendar.summaryTitle")}</h3>
        <p className="mb-3 text-sm text-slate-500">{sel.end ? t("calendar.summaryHint") : t("calendar.pickEnd")}</p>
        <div className="mb-3 flex items-center justify-between rounded-xl bg-canvas px-3.5 py-3">
          <div>
            <small className="text-[11.5px] text-slate-500">{t("common.from")}</small>
            <b className="block text-[13.5px]">{formatDate(start, "en-US", { weekday: "short", month: "short", day: "numeric" })}</b>
          </div>
          <span className="text-slate-400">→</span>
          <div className="text-right">
            <small className="text-[11.5px] text-slate-500">{t("common.to")}</small>
            <b className="block text-[13.5px]">{formatDate(end, "en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" })}</b>
          </div>
        </div>
        <div className="mb-3 text-center">
          <b className="tabular text-5xl font-extrabold leading-none tracking-tight">{formatDays(total)}</b>
          <div className="text-[12.5px] text-slate-500">
            {t("calendar.workdaysRequested", { count: total })} · {t("calendar.calendarDays", { count: info.calendarDays })}
          </div>
        </div>
        {(info.weekendDays > 0 || info.holidays.length > 0) && (
          <ul className="mb-3 list-disc pl-5 text-xs text-slate-500">
            {info.weekendDays > 0 && <li>{t("calendar.weekendExcluded", { count: info.weekendDays })}</li>}
            {info.holidays.map((h) => (
              <li key={h.date}>
                {formatShort(h.date)}: {t(`holiday.${h.key}`)}
              </li>
            ))}
          </ul>
        )}
        <div className="mb-3 grid gap-2">
          {clash > 0 && <Notice tone="error">{t("calendar.clash", { count: clash })}</Notice>}
          {tooMany && <Notice tone="error">{t("calendar.notEnough", { days: formatDays(-b!.projected), count: -b!.projected })}</Notice>}
          {b && b.fromCarryover > 0 && end > b.carryoverDeadline && <Notice tone="warn">{t("calendar.crossesDeadline")}</Notice>}
        </div>
        {b && <BalanceBlock b={b} />}
        <div className="mt-3 flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={onClear}>
            {t("common.clear")}
          </Button>
          <Button className="flex-[2]" disabled={!days.length} onClick={() => onCreate(start, end)}>
            {t("calendar.createRequest")}
          </Button>
        </div>
      </>
    );
  }
}
