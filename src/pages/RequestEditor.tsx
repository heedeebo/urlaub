import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import BalanceBlock from "../components/BalanceBlock";
import SignatureField from "../components/SignatureField";
import { Button, Card, cx, Field, Input, Notice, PageHeader, Textarea } from "../components/ui";
import { useStore } from "../data/store";
import { yearOf } from "../domain/dates";
import { employeeName } from "../domain/email";
import { formatDate, formatDays } from "../domain/format";
import { balanceForRequest, nextRequestNumber } from "../domain/ledger";
import type { Signature, VacationRequest } from "../domain/types";
import { buildRequestDays, describeRange, sumDays } from "../domain/workdays";
import { useRequestActions } from "../lib/useRequestActions";

export default function RequestEditor() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams();
  const [params] = useSearchParams();
  const { data, input, workdayCtx, saveRequest, today } = useStore();
  const { send } = useRequestActions();
  const existing = id ? data.requests.find((r) => r.id === id) : undefined;
  const profile = data.settings.profile;

  const [reqId] = useState(() => existing?.id ?? crypto.randomUUID());
  const [start, setStart] = useState(existing?.start ?? params.get("start") ?? "");
  const [end, setEnd] = useState(existing?.end ?? params.get("end") ?? params.get("start") ?? "");
  const [halfDays, setHalfDays] = useState<string[]>(existing?.days.filter((d) => d.value < 1).map((d) => d.date) ?? []);
  const [comment, setComment] = useState(existing?.comment ?? "");
  const [signature, setSignature] = useState<Signature | null>(existing?.signature ?? null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "error" | "ok" | "warn"; text: string } | null>(null);
  const [signatureReset, setSignatureReset] = useState(false);

  const validRange = Boolean(start && end && end >= start);
  const days = useMemo(
    () => (validRange ? buildRequestDays(start, end, workdayCtx, halfDays) : []),
    [validRange, start, end, workdayCtx, halfDays],
  );

  if (existing && existing.status !== "draft") {
    return (
      <Card className="p-6">
        <Notice tone="info">{t("editor.notEditable")}</Notice>
        <Link to={`/requests/${existing.id}`} className="mt-3 inline-block font-semibold text-navy-800">
          {t("editor.backToRequest")}
        </Link>
      </Card>
    );
  }
  const total = sumDays(days);
  const info = validRange ? describeRange(start, end, workdayCtx) : null;
  const balance = days.length ? balanceForRequest(input, { id: reqId, start, days }) : null;
  const booked = new Set(
    data.requests.filter((r) => r.id !== reqId && (r.status === "approved" || r.status === "pending")).flatMap((r) => r.days.map((d) => d.date)),
  );
  const clash = days.filter((d) => booked.has(d.date)).length;

  // A signature belongs to exactly these dates. Changing them invalidates it.
  const changeDates = (s: string, e: string, half = halfDays) => {
    setStart(s);
    setEnd(e);
    setHalfDays(half.filter((h) => h >= s && h <= e));
    if (signature) {
      setSignature(null);
      setSignatureReset(true);
    }
  };
  const toggleHalf = (date: string) => {
    const next = halfDays.includes(date) ? halfDays.filter((d) => d !== date) : [...halfDays, date];
    changeDates(start, end, next);
  };

  const build = (): VacationRequest => {
    const now = new Date().toISOString();
    return {
      id: reqId,
      number: existing?.number ?? nextRequestNumber(data.requests, yearOf(start)),
      start,
      end,
      days,
      comment,
      status: "draft",
      signature,
      statusHistory: existing?.statusHistory ?? [{ status: "draft", at: now }],
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      sentAt: null,
      sentVia: null,
      snapshot: null,
    };
  };

  const saveDraft = async () => {
    setBusy(true);
    try {
      await saveRequest(build());
      navigate(`/requests/${reqId}`);
    } finally {
      setBusy(false);
    }
  };

  const sendNow = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const draft = build();
      await saveRequest(draft);
      const out = await send(draft);
      if (out.kind === "error") setMessage({ tone: "error", text: out.message });
      else navigate(`/requests/${reqId}?sent=${out.kind}`);
    } catch (e) {
      setMessage({ tone: "error", text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  const missingProfile = !profile.managerEmail;

  return (
    <>
      <PageHeader title={existing ? t("editor.editTitle", { number: existing.number }) : t("editor.newTitle")} subtitle={t("editor.subtitle")} />
      <div className="grid items-start gap-4 xl:grid-cols-[1fr_380px]">
        <div className="grid gap-4">
          <Card className="p-4 sm:p-5">
            <h2 className="mb-3 text-base font-semibold">{t("editor.employee")}</h2>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-4">
              {[
                [t("editor.name"), employeeName(profile)],
                [t("editor.employeeId"), profile.employeeId || "-"],
                [t("editor.company"), profile.company],
                [t("editor.employmentStart"), profile.employmentStart ? formatDate(profile.employmentStart) : ""],
              ].map(([k, v]) => (
                <div key={k}>
                  <dt className="text-xs text-slate-500">{k}</dt>
                  <dd className="font-semibold">{v || "-"}</dd>
                </div>
              ))}
            </dl>
          </Card>

          <Card className="p-4 sm:p-5">
            <h2 className="mb-3 text-base font-semibold">{t("editor.period")}</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={t("common.from")}>
                <Input type="date" value={start} onChange={(e) => changeDates(e.target.value, end && end >= e.target.value ? end : e.target.value)} />
              </Field>
              <Field label={t("common.to")}>
                <Input type="date" value={end} min={start} onChange={(e) => changeDates(start, e.target.value)} />
              </Field>
            </div>
            {start && end && end < start && <div className="mt-3"><Notice tone="error">{t("editor.endBeforeStart")}</Notice></div>}
            {info && (
              <div className="mt-4 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="tabular text-3xl font-extrabold">{formatDays(total)}</span>
                <span className="text-sm text-slate-500">
                  {t("calendar.workdaysRequested", { count: total })} · {t("calendar.calendarDays", { count: info.calendarDays })}
                  {info.holidays.length > 0 && ` · ${t("editor.holidaysExcluded", { count: info.holidays.length })}`}
                </span>
              </div>
            )}
            {days.length > 0 && (
              <details className="mt-3 rounded-xl border border-line-soft" open={days.length <= 10}>
                <summary className="cursor-pointer px-3 py-2 text-sm font-semibold">{t("editor.halfDays")}</summary>
                <div className="flex flex-wrap gap-1.5 px-3 pb-3">
                  {days.map((d) => {
                    const isHalf = d.value < 1;
                    return (
                      <button
                        key={d.date}
                        type="button"
                        onClick={() => toggleHalf(d.date)}
                        className={cx(
                          "rounded-lg border px-2.5 py-1.5 text-xs font-semibold",
                          isHalf ? "border-pending bg-pending-soft text-pending" : "border-line bg-white text-slate-600",
                        )}
                      >
                        {formatDate(d.date, "en-US", { weekday: "short", month: "short", day: "numeric" })} · {isHalf ? "½" : "1"}
                      </button>
                    );
                  })}
                </div>
                <p className="px-3 pb-3 text-xs text-slate-400">{t("editor.halfDaysHint")}</p>
              </details>
            )}
            <div className="mt-3 grid gap-2">
              {clash > 0 && <Notice tone="error">{t("calendar.clash", { count: clash })}</Notice>}
              {balance && balance.projected < 0 && <Notice tone="error">{t("calendar.notEnough", { days: formatDays(-balance.projected), count: -balance.projected })}</Notice>}
              {start && start < today && <Notice tone="info">{t("editor.pastDates")}</Notice>}
            </div>
          </Card>

          <Card className="p-4 sm:p-5">
            <Field label={t("editor.comment")} hint={t("editor.commentHint")}>
              <Textarea rows={3} value={comment} onChange={(e) => setComment(e.target.value)} maxLength={500} />
            </Field>
          </Card>

          <Card className="p-4 sm:p-5">
            <h2 className="text-base font-semibold">{t("signature.title")}</h2>
            <p className="mb-3 text-sm text-slate-500">{t("signature.subtitle")}</p>
            {signatureReset && !signature && <div className="mb-3"><Notice tone="warn">{t("signature.resetNotice")}</Notice></div>}
            <SignatureField value={signature} onChange={setSignature} disabled={!days.length} />
          </Card>
        </div>

        <div className="grid gap-4 xl:sticky xl:top-5">
          <Card className="p-4 sm:p-5">
            {balance ? <BalanceBlock b={balance} /> : <p className="text-sm text-slate-500">{t("editor.pickDates")}</p>}
          </Card>
          <Card className="grid gap-2 p-4 sm:p-5">
            {message && <Notice tone={message.tone}>{message.text}</Notice>}
            {missingProfile && (
              <Notice tone="warn">
                {t("send.needManager")}{" "}
                <Link to="/settings" className="font-semibold underline">
                  {t("nav.settings")}
                </Link>
              </Notice>
            )}
            <Button onClick={sendNow} disabled={busy || !days.length || !signature || missingProfile}>
              {busy ? t("common.working") : t("editor.signAndSend")}
            </Button>
            {!signature && days.length > 0 && <p className="text-center text-xs text-slate-400">{t("editor.signFirst")}</p>}
            <Button variant="secondary" onClick={saveDraft} disabled={busy || !days.length}>
              {t("editor.saveDraft")}
            </Button>
            <p className="text-center text-xs text-slate-400">
              {t("editor.recipient", { to: profile.managerEmail || "-" })}
            </p>
          </Card>
        </div>
      </div>
    </>
  );
}
