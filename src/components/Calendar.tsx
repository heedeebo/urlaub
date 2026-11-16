import { useTranslation } from "react-i18next";
import { addDays, makeDate, parseISO, toISO } from "../domain/dates";
import { formatDays } from "../domain/format";
import type { ISODate } from "../domain/types";
import { markStyle, type DayMark } from "./calendarMarks";
import { cx } from "./ui";

export interface CalendarProps {
  year: number;
  marks: Map<ISODate, DayMark>;
  holiday: (d: ISODate) => string | undefined;
  workdays: number[];
  today: ISODate;
  deadline: ISODate;
  expired: number;
  selection?: { start: ISODate | null; end: ISODate | null };
  onPick?: (d: ISODate) => void;
}

const WEEK = [1, 2, 3, 4, 5, 6, 0];

function inSelection(d: ISODate, sel?: CalendarProps["selection"]) {
  if (!sel?.start) return false;
  const end = sel.end ?? sel.start;
  return d >= sel.start && d <= end;
}

export function MonthView(props: CalendarProps & { month: number }) {
  const { t } = useTranslation();
  const { year, month, marks, holiday, workdays, today, deadline, expired, selection, onPick } = props;
  const first = new Date(year, month, 1);
  const start = toISO(new Date(year, month, 1 - ((first.getDay() + 6) % 7)));
  const cells: ISODate[] = [];
  for (let i = 0; i < 42; i++) {
    const d = addDays(start, i);
    if (i >= 35 && parseISO(d).getMonth() !== month) break;
    cells.push(d);
  }
  const markLabel: Record<DayMark["kind"], string> = {
    approvedCarry: t("calendar.mark.approvedCarry"),
    approvedCurrent: t("calendar.mark.approvedCurrent"),
    pendingCarry: t("calendar.mark.pendingCarry"),
    pendingCurrent: t("calendar.mark.pendingCurrent"),
    rejected: t("calendar.mark.rejected"),
    draft: t("calendar.mark.draft"),
  };

  return (
    <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
      {WEEK.map((w) => (
        <div key={w} className="px-1 pb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400 sm:px-1.5">
          {t(`calendar.weekdayShort.${w}`)}
        </div>
      ))}
      {cells.map((d) => {
        const date = parseISO(d);
        const out = date.getMonth() !== month;
        const weekend = !workdays.includes(date.getDay());
        const hol = holiday(d);
        const mark = marks.get(d);
        const sel = inSelection(d, selection);
        const isDeadline = d === deadline;
        return (
          <button
            key={d}
            type="button"
            data-date={d}
            onClick={() => onPick?.(d)}
            disabled={!onPick}
            className={cx(
              "relative flex min-h-[52px] flex-col items-start gap-0.5 rounded-[10px] border p-1 text-left transition sm:min-h-[88px] sm:rounded-xl sm:p-2",
              weekend ? "border-weekend bg-weekend" : hol ? "border-[#c6e8e2] bg-holiday-soft" : "border-line-soft bg-white",
              onPick && "hover:border-slate-300",
              out && "opacity-35",
              sel && (weekend || hol ? "shadow-[inset_0_0_0_2px_#c2cad9]" : "border-navy-900 shadow-[inset_0_0_0_2px_var(--color-navy-900)]"),
            )}
          >
            <span
              className={cx(
                "tabular text-[13px] font-semibold",
                weekend && "text-slate-400",
                d === today && "rounded-md bg-navy-900 px-1.5 text-white",
              )}
            >
              {date.getDate()}
            </span>
            {hol && (
              <span className="line-clamp-2 hidden text-[10.5px] font-medium leading-tight text-holiday sm:block">
                {t(`holiday.${hol}`)}
              </span>
            )}
            {isDeadline && (
              <span
                title={t("calendar.deadlineFlag")}
                className="absolute right-1 top-1 h-2 w-2 rounded-full bg-carry sm:h-auto sm:w-auto sm:rounded-[5px] sm:px-1.5 sm:py-px sm:text-[9.5px] sm:font-bold sm:text-white"
              >
                <span className="hidden sm:inline">{expired > 0 ? t("calendar.expiredFlag", { days: formatDays(expired) }) : t("calendar.deadlineFlag")}</span>
              </span>
            )}
            {mark && (
              <span
                className={cx(
                  "mt-auto block h-1.5 w-full overflow-hidden rounded-[3px] text-[0px] sm:h-auto sm:rounded-md sm:px-1.5 sm:py-0.5 sm:text-[10.5px] sm:font-semibold sm:whitespace-nowrap sm:text-ellipsis",
                  markStyle[mark.kind],
                )}
              >
                {markLabel[mark.kind]}
                {mark.half ? " ½" : ""}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export function YearView(props: CalendarProps & { onMonth: (m: number) => void }) {
  const { t } = useTranslation();
  const { year, marks, holiday, workdays, deadline, onMonth, selection } = props;
  const mini: Record<DayMark["kind"], string> = {
    approvedCarry: "bg-carry text-white",
    approvedCurrent: "bg-current text-white",
    pendingCarry: "bg-carry-soft text-carry-dark outline-1 outline-dashed outline-carry",
    pendingCurrent: "bg-pending-soft text-pending outline-1 outline-dashed outline-pending",
    rejected: "bg-rejected-soft text-rejected",
    draft: "bg-slate-200 text-slate-500",
  };
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: 12 }, (_, m) => {
        const lead = (new Date(year, m, 1).getDay() + 6) % 7;
        const n = new Date(year, m + 1, 0).getDate();
        return (
          <button
            key={m}
            type="button"
            onClick={() => onMonth(m)}
            className="rounded-xl border border-line-soft bg-white p-2.5 text-left hover:border-slate-300"
          >
            <div className="mb-1.5 text-[12.5px] font-semibold">{t(`calendar.month.${m}`)}</div>
            <div className="grid grid-cols-7 gap-[2px]">
              {Array.from({ length: lead }, (_, i) => (
                <i key={`l${i}`} />
              ))}
              {Array.from({ length: n }, (_, i) => {
                const d = makeDate(year, m + 1, i + 1);
                const mark = marks.get(d);
                const weekend = !workdays.includes(parseISO(d).getDay());
                return (
                  <i
                    key={d}
                    className={cx(
                      "grid aspect-square place-items-center rounded-[3px] text-[8.5px] not-italic text-slate-500",
                      mark ? mini[mark.kind] : weekend ? "bg-weekend text-slate-400" : holiday(d) ? "bg-[#bfe5de] text-holiday" : "",
                      d === deadline && "outline-2 outline-carry",
                      inSelection(d, selection) && "outline-2 outline-navy-900",
                    )}
                  >
                    {i + 1}
                  </i>
                );
              })}
            </div>
          </button>
        );
      })}
    </div>
  );
}

export function CalendarLegend() {
  const { t } = useTranslation();
  const items: [string, string][] = [
    ["bg-carry", "calendar.legend.approvedCarry"],
    ["bg-current", "calendar.legend.approvedCurrent"],
    ["bg-carry-soft outline-[1.5px] outline-dashed outline-carry", "calendar.legend.pendingCarry"],
    ["bg-pending-soft outline-[1.5px] outline-dashed outline-pending", "calendar.legend.pendingCurrent"],
    ["bg-rejected-soft", "calendar.legend.rejected"],
    ["bg-slate-100 outline-1 outline-dashed outline-slate-300", "calendar.legend.draft"],
    ["bg-holiday-soft outline-1 outline-[#c6e8e2]", "calendar.legend.holiday"],
    ["bg-weekend", "calendar.legend.weekend"],
    ["bg-carry rounded-full", "calendar.legend.deadline"],
  ];
  return (
    <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-xs text-slate-500">
      {items.map(([c, k]) => (
        <span key={k} className="inline-flex items-center gap-1.5">
          <i className={cx("inline-block h-2.5 w-3.5 rounded-[3px]", c)} />
          {t(k)}
        </span>
      ))}
    </div>
  );
}
