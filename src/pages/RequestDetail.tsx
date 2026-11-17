import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import BalanceBlock from "../components/BalanceBlock";
import MailWithPdf from "../components/MailWithPdf";
import { Button, Card, Field, Input, Notice, PageHeader, StatusBadge } from "../components/ui";
import { useStore } from "../data/store";
import { formatDate, formatDateTime, formatDays, formatRange, formatShort } from "../domain/format";
import type { RequestStatus } from "../domain/types";
import { sumDays } from "../domain/workdays";
import { useRequestActions } from "../lib/useRequestActions";

const STATUSES: RequestStatus[] = ["pending", "approved", "rejected", "withdrawn"];

export default function RequestDetail() {
  const { t } = useTranslation();
  const { id } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { data, deleteRequest } = useStore();
  const { balanceOf, downloadPdf, previewEmail, setStatus } = useRequestActions();
  const r = data.requests.find((x) => x.id === id);
  const [next, setNext] = useState<RequestStatus | "">("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "error" | "info"; text: string } | null>(null);

  if (!r) {
    return (
      <Card className="p-6">
        <Notice tone="error">{t("detail.notFound")}</Notice>
        <Link to="/requests" className="mt-3 inline-block font-semibold text-navy-800">
          {t("detail.back")}
        </Link>
      </Card>
    );
  }

  const balance = balanceOf(r);
  const total = sumDays(r.days);
  const sentNotice = params.get("sent");
  const mail = previewEmail(r);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setMessage(null);
    try {
      await fn();
    } catch (e) {
      setMessage({ tone: "error", text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  const changeStatus = () =>
    run(async () => {
      if (!next) return;
      await setStatus(r, next, note);
      setMessage({ tone: "ok", text: t("detail.statusSaved", { status: t(`status.${next}`) }) });
      setNext("");
      setNote("");
    });

  return (
    <>
      <PageHeader
        title={r.number}
        subtitle={formatRange(r.start, r.end)}
        actions={
          <>
            <StatusBadge status={r.status} />
          </>
        }
      />
      {sentNotice === "email" && (
        <div className="mb-4">
          <Notice tone="ok">{t("send.sentEmail", { to: data.settings.profile.managerEmail })}</Notice>
        </div>
      )}
      {sentNotice === "mailto" && (
        <div className="mb-4">
          <Notice tone="info">{t("send.sentMailto")}</Notice>
        </div>
      )}
      {message && (
        <div className="mb-4">
          <Notice tone={message.tone}>{message.text}</Notice>
        </div>
      )}

      <div className="grid items-start gap-4 xl:grid-cols-[1fr_380px]">
        <div className="grid gap-4">
          {r.status === "pending" && <MailWithPdf request={r} autoOpen={sentNotice === "mailto"} />}
          <Card className="p-4 sm:p-5">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-4">
              <div>
                <dt className="text-xs text-slate-500">{t("common.from")}</dt>
                <dd className="font-semibold">{formatDate(r.start, "en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" })}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">{t("common.to")}</dt>
                <dd className="font-semibold">{formatDate(r.end, "en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" })}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">{t("detail.workingDays")}</dt>
                <dd className="font-semibold">{t("common.days", { count: total, value: formatDays(total) })}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">{t("detail.sent")}</dt>
                <dd className="font-semibold">{r.sentAt ? formatDateTime(r.sentAt) : t("detail.notSent")}</dd>
              </div>
            </dl>
            {r.days.some((d) => d.value < 1) && (
              <p className="mt-3 text-xs text-slate-500">
                {t("detail.halfDays", { dates: r.days.filter((d) => d.value < 1).map((d) => formatShort(d.date)).join(", ") })}
              </p>
            )}
            {r.comment && (
              <div className="mt-4 rounded-xl bg-canvas p-3 text-sm">
                <div className="mb-1 text-xs font-semibold text-slate-500">{t("editor.comment")}</div>
                {r.comment}
              </div>
            )}
          </Card>

          <Card className="p-4 sm:p-5">
            <h2 className="mb-3 text-base font-semibold">{t("signature.title")}</h2>
            {r.signature ? (
              <>
                <div className="rounded-xl border border-line bg-white p-3">
                  <img src={r.signature.dataUrl} alt={t("signature.previewAlt")} className="mx-auto h-28 object-contain" />
                </div>
                <p className="mt-2 text-xs text-slate-500">{t("signature.signedAt", { date: formatDateTime(r.signature.signedAt) })}</p>
              </>
            ) : (
              <Notice tone="warn">{t("detail.noSignature")}</Notice>
            )}
          </Card>

          {r.status !== "draft" && (
            <Card className="p-4 sm:p-5">
              <h2 className="text-base font-semibold">{t("detail.updateStatus")}</h2>
              <p className="mb-3 text-sm text-slate-500">{t("detail.updateStatusHint")}</p>
              <div className="mb-3 flex flex-wrap gap-2">
                {STATUSES.filter((s) => s !== r.status).map((s) => (
                  <Button key={s} variant={next === s ? "primary" : "secondary"} className="min-h-9" onClick={() => setNext(s)}>
                    {t(`detail.markAs.${s}`)}
                  </Button>
                ))}
              </div>
              {next && (
                <div className="grid gap-3">
                  <Notice tone="info">{t(`detail.effect.${next}`)}</Notice>
                  <Field label={t("detail.note")}>
                    <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder={t("detail.notePlaceholder")} />
                  </Field>
                  <div>
                    <Button onClick={changeStatus} disabled={busy}>
                      {t("detail.saveStatus")}
                    </Button>
                  </div>
                </div>
              )}
            </Card>
          )}

          <Card className="p-4 sm:p-5">
            <h2 className="mb-3 text-base font-semibold">{t("detail.history")}</h2>
            <ol className="grid gap-3 border-l-2 border-line-soft pl-4">
              {[...r.statusHistory].reverse().map((h, i) => (
                <li key={i} className="relative">
                  <span className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full bg-navy-800" />
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge status={h.status} />
                    <span className="text-xs text-slate-500">{formatDateTime(h.at)}</span>
                  </div>
                  {h.note && <p className="mt-1 text-sm text-slate-600">{h.note}</p>}
                </li>
              ))}
            </ol>
          </Card>

          <Card className="p-4 sm:p-5">
            <details>
              <summary className="cursor-pointer text-base font-semibold">{t("detail.emailPreview")}</summary>
              <div className="mt-3 rounded-xl bg-canvas p-3 text-sm">
                <div className="mb-2">
                  <span className="text-slate-500">{t("detail.subject")}: </span>
                  <b>{mail.subject}</b>
                </div>
                <iframe
                  title={t("detail.emailPreview")}
                  sandbox=""
                  srcDoc={mail.html}
                  className="h-[560px] w-full rounded-lg border border-line bg-white"
                />
              </div>
            </details>
          </Card>
        </div>

        <div className="grid gap-4 xl:sticky xl:top-5">
          <Card className="p-4 sm:p-5">
            <BalanceBlock b={balance} frozen={r.snapshot && r.sentAt ? t("detail.frozen", { date: formatDateTime(r.sentAt) }) : undefined} />
          </Card>
          <Card className="grid gap-2 p-4 sm:p-5">
            <Button variant="secondary" onClick={() => run(() => downloadPdf(r))} disabled={busy}>
              {t("detail.downloadPdf")}
            </Button>
            {r.status === "draft" && (
              <>
                <Link to={`/requests/${r.id}/edit`}>
                  <Button className="w-full">{r.signature ? t("detail.reviewAndSend") : t("detail.editAndSign")}</Button>
                </Link>
                <Button
                  variant="secondary"
                  onClick={() =>
                    run(async () => {
                      if (!window.confirm(t("detail.markSentConfirm"))) return;
                      await setStatus(r, "pending", t("detail.markedSentManually"));
                    })
                  }
                  disabled={busy}
                >
                  {t("detail.markSent")}
                </Button>
              </>
            )}
            <Button
              variant="danger"
              onClick={() =>
                run(async () => {
                  if (!window.confirm(t(r.status === "draft" ? "detail.deleteConfirmDraft" : "detail.deleteConfirm", { number: r.number }))) return;
                  await deleteRequest(r.id);
                  navigate("/requests");
                })
              }
              disabled={busy}
            >
              {t("detail.deleteRequest")}
            </Button>
          </Card>
        </div>
      </div>
    </>
  );
}
